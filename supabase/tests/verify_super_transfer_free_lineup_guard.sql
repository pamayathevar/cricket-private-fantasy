select
  to_regprocedure('public.reject_super_transfer_on_free_lineup()') is not null
    as free_lineup_guard_installed,
  exists (
    select 1
    from pg_trigger
    where tgname = 'reject_super_transfer_on_free_lineup_before_write'
      and not tgisinternal
  ) as free_lineup_trigger_installed;
