create type public.user_role as enum ('user','support','moderator','senior_moderator','trust_safety_lead','admin','auditor');
create type public.work_status as enum ('draft','processing','needs_evidence','under_review','published','rejected','archived');
create type public.origin_status as enum ('captured_live','process_verified','original_file_verified','creator_verified','review_complete','not_yet_verified','ai_assistance_disclosed','under_review');
create type public.collection_privacy as enum ('private','invite_only','public');
create type public.collaborator_role as enum ('owner','editor','viewer');
create type public.report_status as enum ('submitted','triaged','in_review','resolved','dismissed');
create type public.case_status as enum ('open','assigned','waiting_evidence','decided','appealed','closed');

create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique,
  display_name text not null default '',
  avatar_url text,
  bio text check (char_length(bio)<=500),
  city text,
  website_url text,
  role public.user_role not null default 'user',
  onboarding_completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_username check (username is null or username::text ~ '^[a-z0-9_]{3,30}$')
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  strict_human_only boolean not null default false,
  include_awaiting_verification boolean not null default true,
  hide_commercial boolean not null default false,
  show_local boolean not null default false,
  mature_artistic_content boolean not null default false,
  timezone text not null default 'America/New_York',
  locale text not null default 'en-US',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger user_settings_updated before update on public.user_settings for each row execute function public.set_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(), slug citext not null unique, name text not null, description text,
  metadata_schema jsonb not null default '{}'::jsonb, is_active boolean not null default true, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger categories_updated before update on public.categories for each row execute function public.set_updated_at();
create table public.user_interests (user_id uuid references public.profiles(id) on delete cascade, category_id uuid references public.categories(id) on delete cascade, weight numeric(5,2) not null default 1, created_at timestamptz not null default now(), primary key(user_id,category_id));

create table public.creator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade, business_name text, professional_level text not null default 'hobbyist',
  accepting_commissions boolean not null default false, accepting_bookings boolean not null default false, selling_work boolean not null default false,
  service_area text, studio_address text, online_only boolean not null default false, verified_at timestamptz, trusted_since date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create trigger creator_profiles_updated before update on public.creator_profiles for each row execute function public.set_updated_at();
create table public.creator_categories (creator_id uuid references public.creator_profiles(user_id) on delete cascade, category_id uuid references public.categories(id) on delete cascade, is_primary boolean not null default false, created_at timestamptz not null default now(), primary key(creator_id,category_id));

create table public.works (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id) on delete cascade,
  primary_category_id uuid references public.categories(id), title text not null check(char_length(title)<=160), description text check(char_length(description)<=5000),
  status public.work_status not null default 'draft', origin_status public.origin_status not null default 'not_yet_verified',
  origin_risk_score int check(origin_risk_score between 0 and 100), origin_policy_version text not null default '2026-07-23',
  search_document tsvector generated always as (to_tsvector('english',coalesce(title,'')||' '||coalesce(description,''))) stored,
  published_at timestamptz, is_test_content boolean not null default false, comments_enabled boolean not null default true,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index works_creator_idx on public.works(creator_id,created_at desc); create index works_status_idx on public.works(status,published_at desc); create index works_search_idx on public.works using gin(search_document);
create trigger works_updated before update on public.works for each row execute function public.set_updated_at();

create table public.work_media (
  id uuid primary key default gen_random_uuid(), work_id uuid not null references public.works(id) on delete cascade,
  media_type text not null check(media_type in ('image','video')), public_url text, storage_path text not null, original_storage_path text,
  width int not null check(width>0), height int not null check(height>0), duration_ms int, blurhash text, alt_text text,
  source_type text not null check(source_type in ('live_capture','camera_library','desktop_upload','connected_service','project_file','development_seed')),
  sort_order int not null default 0, content_hash text, perceptual_hash text, created_at timestamptz not null default now(), unique(work_id,sort_order)
);
create index work_media_work_idx on public.work_media(work_id,sort_order);

create table public.work_origin_declarations (
  work_id uuid primary key references public.works(id) on delete cascade, creator_id uuid not null references public.profiles(id),
  ownership text not null check(ownership in ('self','another_human_authorized')), generative_ai_used boolean not null,
  ordinary_editing_used boolean not null, ai_assisted_editing_used boolean not null, photographed_real_subject boolean,
  rights_confirmed boolean not null, policy_version text not null, accepted_at timestamptz not null default now()
);

create table public.proof_stories (id uuid primary key default gen_random_uuid(), work_id uuid not null unique references public.works(id) on delete cascade, creator_id uuid not null references public.profiles(id), title text, is_public boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.proof_story_items (id uuid primary key default gen_random_uuid(), proof_story_id uuid not null references public.proof_stories(id) on delete cascade, item_type text not null, public_url text, private_storage_path text, caption text, occurred_at timestamptz, sort_order int not null default 0, created_at timestamptz not null default now());

create table public.collections (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, name text not null check(char_length(name)<=100), description text check(char_length(description)<=1000),
  privacy public.collection_privacy not null default 'private', cover_url text, archived_at timestamptz, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index collections_owner_idx on public.collections(owner_id,updated_at desc); create trigger collections_updated before update on public.collections for each row execute function public.set_updated_at();
create table public.collection_sections (id uuid primary key default gen_random_uuid(), collection_id uuid not null references public.collections(id) on delete cascade, name text not null, sort_order int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.collection_items (id uuid primary key default gen_random_uuid(), collection_id uuid not null references public.collections(id) on delete cascade, section_id uuid references public.collection_sections(id) on delete set null, work_id uuid not null references public.works(id) on delete cascade, added_by uuid not null references public.profiles(id), note text check(char_length(note)<=1000), sort_order numeric not null default 1000, created_at timestamptz not null default now(), unique(collection_id,work_id));
create table public.collection_collaborators (collection_id uuid references public.collections(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, role public.collaborator_role not null, invited_by uuid references public.profiles(id), accepted_at timestamptz, created_at timestamptz not null default now(), primary key(collection_id,user_id));

create table public.follows (follower_id uuid references public.profiles(id) on delete cascade, creator_id uuid references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), primary key(follower_id,creator_id), check(follower_id<>creator_id));
create table public.work_saves (user_id uuid references public.profiles(id) on delete cascade, work_id uuid references public.works(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id,work_id));

create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id), work_id uuid references public.works(id), reported_user_id uuid references public.profiles(id), reason text not null, details text not null, evidence_url text, status public.report_status not null default 'submitted', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index reports_status_idx on public.reports(status,created_at); create trigger reports_updated before update on public.reports for each row execute function public.set_updated_at();
create table public.moderation_cases (id uuid primary key default gen_random_uuid(), queue_type text not null, status public.case_status not null default 'open', priority int not null default 50 check(priority between 0 and 100), work_id uuid references public.works(id), creator_id uuid references public.profiles(id), assigned_to uuid references public.profiles(id), policy_version text not null default '2026-07-23', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index moderation_queue_idx on public.moderation_cases(status,priority desc,created_at); create trigger moderation_cases_updated before update on public.moderation_cases for each row execute function public.set_updated_at();
create table public.moderation_actions (id uuid primary key default gen_random_uuid(), case_id uuid not null references public.moderation_cases(id) on delete cascade, actor_id uuid not null references public.profiles(id), action text not null, reason_code text not null, notes text, previous_state jsonb, new_state jsonb, created_at timestamptz not null default now());

create table public.notification_preferences (user_id uuid primary key references public.profiles(id) on delete cascade, collection_activity boolean not null default true, creator_updates boolean not null default true, comments_replies boolean not null default true, verification_results boolean not null default true, commission_messages boolean not null default true, weekly_digest boolean not null default false, quiet_hours_start time, quiet_hours_end time, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), provider text not null, provider_customer_id text, provider_subscription_id text unique, plan_key text not null, status text not null, current_period_end timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.entitlements (user_id uuid references public.profiles(id) on delete cascade, entitlement_key text not null, source text not null, active boolean not null default false, expires_at timestamptz, updated_at timestamptz not null default now(), primary key(user_id,entitlement_key));

create table public.recommendation_events (id bigint generated always as identity primary key, user_id uuid references public.profiles(id) on delete set null, anonymous_session_id uuid, work_id uuid references public.works(id) on delete cascade, event_type text not null, context jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index recommendation_events_user_time_idx on public.recommendation_events(user_id,created_at desc);
create table public.feed_impressions (id bigint generated always as identity primary key, user_id uuid references public.profiles(id), session_id uuid not null, work_id uuid not null references public.works(id), rank int not null, ranking_version text not null, viewed_ms int not null default 0, created_at timestamptz not null default now());
create table public.feed_actions (id bigint generated always as identity primary key, impression_id bigint references public.feed_impressions(id), action text not null, created_at timestamptz not null default now());
create table public.visual_embeddings (work_id uuid primary key references public.works(id) on delete cascade, model_version text not null, embedding vector(768) not null, created_at timestamptz not null default now());
create index visual_embeddings_hnsw on public.visual_embeddings using hnsw (embedding vector_cosine_ops);

create table public.feature_flags (key text primary key, enabled boolean not null default false, rules jsonb not null default '{}'::jsonb, updated_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.device_sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, device_hash text not null, platform text not null, app_version text, last_seen_at timestamptz not null default now(), revoked_at timestamptz, created_at timestamptz not null default now());
create table public.security_events (id bigint generated always as identity primary key, user_id uuid references public.profiles(id), event_type text not null, risk_level text not null default 'low', ip_hash text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.audit_logs (id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.deletion_requests (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), status text not null default 'requested', requested_at timestamptz not null default now(), scheduled_for timestamptz not null default now()+interval '30 days', completed_at timestamptz);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name,username) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''),nullif(lower(new.raw_user_meta_data->>'username'),''));
  insert into public.user_settings(user_id) values(new.id);
  insert into public.notification_preferences(user_id) values(new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace view public.discover_works with (security_invoker=true) as
select w.id,w.title,w.description,w.origin_status,w.creator_id,p.display_name creator_name,p.username::text creator_username,p.avatar_url creator_avatar_url,
       m.public_url media_url,m.width,m.height,m.blurhash,m.alt_text,w.published_at
from public.works w join public.profiles p on p.id=w.creator_id join lateral(select * from public.work_media where work_id=w.id order by sort_order limit 1)m on true
where w.status='published' and w.deleted_at is null;

create or replace function public.search_works(search_query text,result_limit int default 40)
returns table(id uuid,title text,description text,origin_status public.origin_status,creator_username text,rank real) language sql stable security invoker as $$
select w.id,w.title,w.description,w.origin_status,p.username::text,ts_rank(w.search_document,websearch_to_tsquery('english',search_query))
from public.works w join public.profiles p on p.id=w.creator_id
where w.status='published' and w.deleted_at is null and w.search_document @@ websearch_to_tsquery('english',search_query)
order by ts_rank(w.search_document,websearch_to_tsquery('english',search_query)) desc,w.published_at desc limit least(result_limit,100) $$;

