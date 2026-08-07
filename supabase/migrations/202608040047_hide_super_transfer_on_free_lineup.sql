-- Super Transfer cannot be consumed when the owner's first actual lineup in a
-- transfer period is already unlimited/free.
begin;

create or replace function public.reject_super_transfer_on_free_lineup()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_booster_code text;
  v_league_id uuid;
  v_member_id uuid;
  v_match_number integer;
  v_period public.league_transfer_periods%rowtype;
begin
  select code into v_booster_code
  from public.booster_rules
  where id = new.booster_rule_id;

  if v_booster_code is distinct from 'SUP-TR' then
    return new;
  end if;

  select lineup.league_id, lineup.member_id, fixture.match_number
    into v_league_id, v_member_id, v_match_number
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.id = new.lineup_id;

  select * into v_period
  from public.league_transfer_periods period
  where period.league_id = v_league_id
    and period.active
    and v_match_number between period.start_match_number and period.end_match_number
  order by period.sort_order
  limit 1;

  if v_period.id is not null
     and v_period.first_match_free
     and not exists (
       select 1
       from public.lineup_submissions prior_lineup
       join public.fixtures prior_fixture on prior_fixture.id = prior_lineup.fixture_id
       where prior_lineup.league_id = v_league_id
         and prior_lineup.member_id = v_member_id
         and prior_lineup.status in ('submitted', 'locked')
         and prior_fixture.match_number between v_period.start_match_number and v_period.end_match_number
         and prior_fixture.match_number < v_match_number
     ) then
    raise exception 'Super Transfer is unavailable because this lineup already has free transfers';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_super_transfer_on_free_lineup_before_write
on public.lineup_boosters;

create trigger reject_super_transfer_on_free_lineup_before_write
before insert or update of lineup_id, booster_rule_id
on public.lineup_boosters
for each row execute function public.reject_super_transfer_on_free_lineup();

revoke all on function public.reject_super_transfer_on_free_lineup() from public;

commit;
