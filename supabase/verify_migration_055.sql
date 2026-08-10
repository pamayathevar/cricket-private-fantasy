-- Expected: all values are true.
with definition as (
  select pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  ) body
)
select
  position('pg_advisory_xact_lock' in body) > 0
    as submission_chain_is_serialized,
  position('pg_advisory_xact_lock' in body) < position('for update' in body)
    as chain_lock_precedes_fixture_lock,
  not has_function_privilege(
    'authenticated',
    'public.submit_lineup(uuid,uuid[],uuid,uuid,uuid,text)',
    'EXECUTE'
  ) as authenticated_cannot_bypass_with_base_submission,
  not has_function_privilege(
    'authenticated',
    'public.submit_lineup_with_booster(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) as authenticated_cannot_bypass_with_booster_submission,
  has_function_privilege(
    'authenticated',
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) as authenticated_can_use_enforced_submission,
  not has_function_privilege(
    'anon',
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) as anonymous_cannot_submit
from definition;
