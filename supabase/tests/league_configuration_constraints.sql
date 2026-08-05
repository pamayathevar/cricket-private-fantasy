-- Rollback-only database constraint smoke tests for migration 018.
-- Run against staging after migration 018. A successful run returns all PASS and leaves no rows.
begin;

create temporary table league_configuration_test_results (
  test_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

do $$
declare
  v_open_league uuid := gen_random_uuid();
  v_invalid_league uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
begin
  insert into public.leagues (id, slug, name, competition, season_year, status)
  values (v_open_league, 'test-open-league', 'Test Open League', 'Test', 2099, 'setup');

  insert into public.league_format_configs (
    league_id, acquisition_mode, ownership_enabled, bidding_enabled,
    other_owner_deductions_enabled, unique_players_enabled, unique_scope,
    royalty_enabled, setup_status
  ) values (
    v_open_league, 'all_open', false, false, false, true, 'match', false, 'draft'
  );
  insert into league_configuration_test_results values
    ('valid all-open unique-only format', true, 'Accepted without ownership, bidding, deductions or royalty');

  insert into public.league_members (id, league_id, email, display_name, role, status)
  values (v_member, v_open_league, 'declined-test@example.invalid', 'Declined Test', 'owner', 'declined');
  insert into league_configuration_test_results values
    ('expanded participation status', true, 'Declined membership accepted');

  insert into public.leagues (id, slug, name, competition, season_year, status)
  values (v_invalid_league, 'test-invalid-open-league', 'Invalid Open League', 'Test', 2099, 'setup');
  begin
    insert into public.league_format_configs (
      league_id, acquisition_mode, ownership_enabled, bidding_enabled, other_owner_deductions_enabled
    ) values (v_invalid_league, 'all_open', true, false, false);
    insert into league_configuration_test_results values
      ('invalid all-open ownership rejected', false, 'Invalid configuration was accepted');
  exception when check_violation then
    insert into league_configuration_test_results values
      ('invalid all-open ownership rejected', true, 'Check constraint rejected ownership in all-open mode');
  end;

  begin
    update public.leagues set status = 'active' where id = v_open_league;
    update public.league_format_configs set royalty_enabled = true where league_id = v_open_league;
    insert into league_configuration_test_results values
      ('started format lock', false, 'Started league format was editable');
  exception when raise_exception then
    insert into league_configuration_test_results values
      ('started format lock', true, 'Trigger rejected format change after setup');
  end;
end;
$$;

select test_name, case when passed then 'PASS' else 'FAIL' end as status, detail
from league_configuration_test_results
order by test_name;

rollback;

