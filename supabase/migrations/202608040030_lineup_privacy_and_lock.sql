-- Enforce the same pre-lock privacy for owners and league administrators.
-- All lineup writes must use the security-definer submission RPC, which checks
-- fixture status and lineup_lock_at before changing players or markers.
begin;

drop policy if exists lineups_read on public.lineup_submissions;
drop policy if exists lineups_admin_all on public.lineup_submissions;
create policy lineups_read on public.lineup_submissions
  for select to authenticated
  using (
    member_id = public.current_member_id(league_id)
    or (
      public.is_league_member(league_id)
      and exists (
        select 1
        from public.fixtures fixture
        join public.lineup_rule_sets rules
          on rules.id = public.lineup_rule_set_for_fixture(fixture.id)
        where fixture.id = fixture_id
          and rules.reveal_lineups_after_lock
          and now() >= fixture.lineup_lock_at
      )
    )
  );

drop policy if exists lineup_players_read on public.lineup_players;
drop policy if exists lineup_players_admin_all on public.lineup_players;
create policy lineup_players_read on public.lineup_players
  for select to authenticated
  using (
    exists (
      select 1 from public.lineup_submissions lineup
      where lineup.id = lineup_id
    )
  );

drop policy if exists lineup_boosters_read on public.lineup_boosters;
drop policy if exists lineup_boosters_admin_all on public.lineup_boosters;
create policy lineup_boosters_read on public.lineup_boosters
  for select to authenticated
  using (
    member_id = public.current_member_id(league_id)
    or (
      public.is_league_member(league_id)
      and exists (
        select 1
        from public.fixtures fixture
        join public.lineup_rule_sets rules
          on rules.id = public.lineup_rule_set_for_fixture(fixture.id)
        where fixture.id = fixture_id
          and rules.reveal_lineups_after_lock
          and now() >= fixture.lineup_lock_at
      )
    )
  );

-- Authenticated clients submit through submit_lineup_with_transfer_enforcement.
-- Its security-definer call chain owns all required table mutations and rejects
-- submissions at/after lineup_lock_at or when a fixture is no longer scheduled.
revoke insert, update, delete on public.lineup_submissions from authenticated;
revoke insert, update, delete on public.lineup_players from authenticated;
revoke insert, update, delete on public.lineup_boosters from authenticated;

grant select on public.lineup_submissions, public.lineup_players, public.lineup_boosters to authenticated;

commit;
