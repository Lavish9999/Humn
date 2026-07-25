-- Preserve deletion-request evidence without retaining a direct user foreign key.
alter table public.deletion_requests
  alter column user_id drop not null;
alter table public.deletion_requests
  drop constraint deletion_requests_user_id_fkey;
alter table public.deletion_requests
  add constraint deletion_requests_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.deletion_requests
  add column if not exists user_email_hash text;

create or replace function public.audit_moderation_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    new.actor_id,
    'moderation.' || new.action,
    'moderation_case',
    new.case_id::text,
    jsonb_build_object('reason_code', new.reason_code, 'action_id', new.id)
  );
  return new;
end;
$$;

create trigger moderation_action_audit
  after insert on public.moderation_actions
  for each row execute function public.audit_moderation_action();

create index if not exists deletion_requests_status_idx
  on public.deletion_requests(status, requested_at desc);
