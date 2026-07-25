begin;

-- Chunk 2 boundary: policies are complete before the corresponding write UIs ship.
-- Client-side feature code remains inert until later chunks, but ownership is
-- already enforced here so future flows cannot bypass authorization.

-- Remove every existing policy on the canonical persistence tables. PostgreSQL
-- policies are permissive by default, so leaving a broad legacy policy in place
-- would weaken any stricter policy added below.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'users',
        'works',
        'proof_entries',
        'file_evidence',
        'technical_signals',
        'collections',
        'collection_items',
        'follows',
        'reports'
      ])
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end $$;

alter table public.users enable row level security;
alter table public.works enable row level security;
alter table public.proof_entries enable row level security;
alter table public.file_evidence enable row level security;
alter table public.technical_signals enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;

-- Explicit table grants complement RLS. The authenticated role receives only the
-- statement types that the current data model is intended to support.
revoke all on table public.users from anon, authenticated;
revoke all on table public.works from anon, authenticated;
revoke all on table public.proof_entries from anon, authenticated;
revoke all on table public.file_evidence from anon, authenticated;
revoke all on table public.technical_signals from anon, authenticated;
revoke all on table public.collections from anon, authenticated;
revoke all on table public.collection_items from anon, authenticated;
revoke all on table public.follows from anon, authenticated;
revoke all on table public.reports from anon, authenticated;

grant select on table public.users to anon, authenticated;
grant update (display_name, avatar_url) on table public.users to authenticated;

grant select on table public.works to anon, authenticated;
grant insert, update, delete on table public.works to authenticated;

grant select on table public.proof_entries to anon, authenticated;
grant insert, update, delete on table public.proof_entries to authenticated;

grant select on table public.file_evidence to anon, authenticated;
grant insert, update, delete on table public.file_evidence to authenticated;

grant select on table public.technical_signals to anon, authenticated;
grant insert, update, delete on table public.technical_signals to authenticated;

grant select on table public.collections to anon, authenticated;
grant insert, update, delete on table public.collections to authenticated;

grant select on table public.collection_items to anon, authenticated;
grant insert, update, delete on table public.collection_items to authenticated;

grant select on table public.follows to anon, authenticated;
grant insert, delete on table public.follows to authenticated;

grant select, insert on table public.reports to authenticated;

-- Public profiles are readable. Ordinary client updates can only touch the
-- caller's own display name and avatar because of both RLS and column grants.
create policy users_public_read
on public.users
for select
to anon, authenticated
using (true);

create policy users_self_update
on public.users
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Defense in depth for immutable/protected columns. A future validated handle
-- change function may set the transaction-local `humn.allow_handle_change` flag
-- after checking availability, cooldowns, redirects, and audit requirements.
create or replace function public.protect_humn_user_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'User id is immutable';
  end if;

  if new.handle is distinct from old.handle
     and coalesce(current_setting('humn.allow_handle_change', true), 'off') <> 'on' then
    raise exception 'Handle changes require the validated handle-change flow';
  end if;

  if new.reputation is distinct from old.reputation then
    raise exception 'Reputation is server-managed';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'User creation time is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists humn_users_protect_fields on public.users;
create trigger humn_users_protect_fields
before update on public.users
for each row execute function public.protect_humn_user_fields();

-- Published-origin states are publicly readable. Rejected rows remain visible
-- only to their owning creator, which preserves the existing status rule while
-- allowing a creator to inspect and correct their own rejected record.
create policy works_public_read
on public.works
for select
to anon, authenticated
using (
  status in ('declared', 'awaiting', 'verified')
  or creator_id = (select auth.uid())
);

create policy works_creator_insert
on public.works
for insert
to authenticated
with check (creator_id = (select auth.uid()));

create policy works_creator_update
on public.works
for update
to authenticated
using (creator_id = (select auth.uid()))
with check (creator_id = (select auth.uid()));

create policy works_creator_delete
on public.works
for delete
to authenticated
using (creator_id = (select auth.uid()));

-- Child evidence is readable exactly when its parent Work is readable.
create policy proof_entries_parent_read
on public.proof_entries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.works work
    where work.id = proof_entries.work_id
      and (
        work.status in ('declared', 'awaiting', 'verified')
        or work.creator_id = (select auth.uid())
      )
  )
);

create policy proof_entries_owner_insert
on public.proof_entries
for insert
to authenticated
with check (
  exists (
    select 1 from public.works work
    where work.id = proof_entries.work_id
      and work.creator_id = (select auth.uid())
  )
);

create policy proof_entries_owner_update
on public.proof_entries
for update
to authenticated
using (
  exists (
    select 1 from public.works work
    where work.id = proof_entries.work_id
      and work.creator_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.works work
    where work.id = proof_entries.work_id
      and work.creator_id = (select auth.uid())
  )
);

create policy proof_entries_owner_delete
on public.proof_entries
for delete
to authenticated
using (
  exists (
    select 1 from public.works work
    where work.id = proof_entries.work_id
      and work.creator_id = (select auth.uid())
  )
);

create policy file_evidence_parent_read
on public.file_evidence
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.works work
    where work.id = file_evidence.work_id
      and (
        work.status in ('declared', 'awaiting', 'verified')
        or work.creator_id = (select auth.uid())
      )
  )
);

create policy file_evidence_owner_insert
on public.file_evidence
for insert
to authenticated
with check (
  exists (
    select 1 from public.works work
    where work.id = file_evidence.work_id
      and work.creator_id = (select auth.uid())
  )
);

create policy file_evidence_owner_update
on public.file_evidence
for update
to authenticated
using (
  exists (
    select 1 from public.works work
    where work.id = file_evidence.work_id
      and work.creator_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.works work
    where work.id = file_evidence.work_id
      and work.creator_id = (select auth.uid())
  )
);

create policy file_evidence_owner_delete
on public.file_evidence
for delete
to authenticated
using (
  exists (
    select 1 from public.works work
    where work.id = file_evidence.work_id
      and work.creator_id = (select auth.uid())
  )
);

create policy technical_signals_parent_read
on public.technical_signals
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.works work
    where work.id = technical_signals.work_id
      and (
        work.status in ('declared', 'awaiting', 'verified')
        or work.creator_id = (select auth.uid())
      )
  )
);

create policy technical_signals_owner_insert
on public.technical_signals
for insert
to authenticated
with check (
  exists (
    select 1 from public.works work
    where work.id = technical_signals.work_id
      and work.creator_id = (select auth.uid())
  )
);

create policy technical_signals_owner_update
on public.technical_signals
for update
to authenticated
using (
  exists (
    select 1 from public.works work
    where work.id = technical_signals.work_id
      and work.creator_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.works work
    where work.id = technical_signals.work_id
      and work.creator_id = (select auth.uid())
  )
);

create policy technical_signals_owner_delete
on public.technical_signals
for delete
to authenticated
using (
  exists (
    select 1 from public.works work
    where work.id = technical_signals.work_id
      and work.creator_id = (select auth.uid())
  )
);

-- Collections are public only when explicitly marked public. Private rows and
-- every collection mutation are owner-only.
create policy collections_public_read
on public.collections
for select
to anon, authenticated
using (privacy = 'public');

create policy collections_owner_read
on public.collections
for select
to authenticated
using (owner_id = (select auth.uid()));

create policy collections_owner_insert
on public.collections
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy collections_owner_update
on public.collections
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy collections_owner_delete
on public.collections
for delete
to authenticated
using (owner_id = (select auth.uid()));

create policy collection_items_parent_read
on public.collection_items
for select
to anon, authenticated
using (
  exists (
    select 1 from public.collections collection
    where collection.id = collection_items.collection_id
      and (
        collection.privacy = 'public'
        or collection.owner_id = (select auth.uid())
      )
  )
);

create policy collection_items_owner_insert
on public.collection_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.collections collection
    where collection.id = collection_items.collection_id
      and collection.owner_id = (select auth.uid())
  )
);

create policy collection_items_owner_update
on public.collection_items
for update
to authenticated
using (
  exists (
    select 1 from public.collections collection
    where collection.id = collection_items.collection_id
      and collection.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.collections collection
    where collection.id = collection_items.collection_id
      and collection.owner_id = (select auth.uid())
  )
);

create policy collection_items_owner_delete
on public.collection_items
for delete
to authenticated
using (
  exists (
    select 1 from public.collections collection
    where collection.id = collection_items.collection_id
      and collection.owner_id = (select auth.uid())
  )
);

-- Follow edges are readable, but only the follower may create or remove their
-- own edge. The table constraint continues to prevent self-following.
create policy follows_public_read
on public.follows
for select
to anon, authenticated
using (true);

create policy follows_follower_insert
on public.follows
for insert
to authenticated
with check (follower_id = (select auth.uid()));

create policy follows_follower_delete
on public.follows
for delete
to authenticated
using (follower_id = (select auth.uid()));

-- Reports are private to the reporter. Client roles receive no update or delete
-- privilege and no policy for either statement type.
create policy reports_reporter_read
on public.reports
for select
to authenticated
using (reporter_id = (select auth.uid()));

create policy reports_reporter_insert
on public.reports
for insert
to authenticated
with check (reporter_id = (select auth.uid()));

comment on table public.reports is
  'Authenticated reporters may insert and read their own reports. Client update/delete is intentionally denied; moderation uses trusted server/admin access.';

commit;
