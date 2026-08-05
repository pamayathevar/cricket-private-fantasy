-- Rollback-only smoke test for migration 019.
begin;

create temporary table unique_owner_name_test_result (
  test_name text primary key,
  status text not null,
  detail text not null
) on commit drop;

do $$
declare
  v_league_id uuid := gen_random_uuid();
begin
  insert into public.leagues (id, slug, name, competition, season_year, status)
  values (v_league_id, 'test-unique-owner-names', 'Test Unique Owner Names', 'Test', 2099, 'setup');

  insert into public.league_members (league_id, email, display_name, role, status)
  values (v_league_id, 'first-jeba@example.invalid', 'Jeba', 'owner', 'invited');

  begin
    insert into public.league_members (league_id, email, display_name, role, status)
    values (v_league_id, 'second-jeba@example.invalid', '  jEbA  ', 'owner', 'invited');
    insert into unique_owner_name_test_result values
      ('case-insensitive trimmed duplicate rejected', 'FAIL', 'Duplicate owner name was accepted');
  exception when unique_violation or raise_exception then
    insert into unique_owner_name_test_result values
      ('case-insensitive trimmed duplicate rejected', 'PASS', 'Duplicate owner name was rejected');
  end;

  insert into public.league_members (league_id, email, display_name, role, status)
  values (v_league_id, 'different-owner@example.invalid', 'Different Owner', 'owner', 'invited');
  insert into unique_owner_name_test_result values
    ('different owner name accepted', 'PASS', 'A distinct owner name was accepted');
end;
$$;

select * from unique_owner_name_test_result order by test_name;
rollback;
