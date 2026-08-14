do $$
begin
  if position('on conflict do nothing' in lower(pg_get_functiondef('public.claim_due_match_reminders(integer)'::regprocedure))) = 0 then
    raise exception 'Reminder claim function still uses an ambiguous conflict target';
  end if;
end;
$$;

select
  position('on conflict do nothing' in lower(pg_get_functiondef('public.claim_due_match_reminders(integer)'::regprocedure))) > 0
    as unambiguous_idempotency_conflict,
  position('skip locked' in lower(pg_get_functiondef('public.claim_due_match_reminders(integer)'::regprocedure))) > 0
    as concurrent_claim_protection;
