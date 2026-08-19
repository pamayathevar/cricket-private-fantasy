-- Verify that royalties are limited to players whose IPL team participates in the fixture.
do $$
begin
  if position(
    'fixture_team_eligible'
    in pg_get_functiondef('public.publish_match_scores(uuid)'::regprocedure)
  ) = 0 then
    raise exception 'publish_match_scores is missing the fixture-team royalty guard';
  end if;

  if exists (
    select 1
    from public.special_player_score_adjustments adjustment
    join public.fixtures fixture on fixture.id = adjustment.fixture_id
    join public.players player on player.id = adjustment.player_id
    where adjustment.adjustment_type in ('regular_royalty', 'marquee_royalty')
      and player.team_id not in (fixture.home_team_id, fixture.away_team_id)
  ) then
    raise exception 'Off-fixture royalty adjustments still exist';
  end if;

  if exists (
    with corrected_fixtures as (
      select distinct entity_id::uuid as fixture_id
      from public.audit_events
      where action = 'off_fixture_royalties_corrected'
        and entity_type = 'fixture'
    ), expected as (
      select score.id,
        dense_rank() over (
          partition by score.fixture_id
          order by score.total_points desc
        )::integer as expected_rank
      from public.member_match_scores score
      join corrected_fixtures fixture on fixture.fixture_id = score.fixture_id
    )
    select 1
    from public.member_match_scores score
    join expected on expected.id = score.id
    where score.rank is distinct from expected.expected_rank
  ) then
    raise exception 'A corrected fixture has stale member match ranks';
  end if;
end;
$$;
