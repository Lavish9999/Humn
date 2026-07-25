begin;

create or replace function public.derive_work_badge(
  p_status public.humn_work_status,
  p_proof_count integer,
  p_ai_declared boolean
)
returns table (badge_variant text, badge_label text)
language sql
immutable
parallel safe
as $$
  select
    case
      when coalesce(p_ai_declared, false) then 'unverified'
      when p_status = 'verified' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then 'verified'
      when p_status = 'awaiting' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then 'awaiting'
      else 'unverified'
    end,
    case
      when coalesce(p_ai_declared, false) then 'UNVERIFIED · SELF-DECLARED'
      when p_status = 'verified' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then 'VERIFIED · AUTOMATED CLEAR'
      when p_status = 'awaiting' and greatest(coalesce(p_proof_count, 0), 0) >= 1 then 'AWAITING AUTOMATED REVIEW'
      else 'UNVERIFIED · SELF-DECLARED'
    end;
$$;

create or replace function public.derive_work_badge(
  p_status public.humn_work_status,
  p_proof_count integer
)
returns table (badge_variant text, badge_label text)
language sql
immutable
parallel safe
as $$
  select * from public.derive_work_badge(p_status, p_proof_count, false);
$$;

grant execute on function public.derive_work_badge(public.humn_work_status,integer,boolean) to anon, authenticated;
grant execute on function public.derive_work_badge(public.humn_work_status,integer) to anon, authenticated;

comment on function public.derive_work_badge(public.humn_work_status,integer,boolean) is
  'Badge presentation invariant: automated VERIFIED requires proof and cannot be shown for AI-declared legacy rows.';

commit;
