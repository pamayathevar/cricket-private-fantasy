-- Royalty is generated only when the player's IPL team is participating in the fixture.
-- Repair any previously published off-fixture royalties and rerank affected matches.
begin;

do $$
declare
  v_definition text;
  v_old_fragment text := $old$jsonb_build_object('zero_floor', v_special.royalty_zero_floor,
        'rounding', v_special.royalty_rounding, 'is_marquee', value.is_marquee,
        'owner_selected_player', true)
    from calculated_special_values value
    where value.borrowed
      and exists (
        select 1
        from public.lineup_submissions owner_lineup
        join public.lineup_players owner_player on owner_player.lineup_id = owner_lineup.id
        where owner_lineup.fixture_id = p_fixture_id
          and owner_lineup.member_id = value.owner_member_id
          and owner_lineup.status in ('submitted', 'locked')
          and owner_player.player_id = value.player_id
      );$old$;
  v_new_fragment text := $new$jsonb_build_object('zero_floor', v_special.royalty_zero_floor,
        'rounding', v_special.royalty_rounding, 'is_marquee', value.is_marquee,
        'owner_selected_player', true, 'fixture_team_eligible', true)
    from calculated_special_values value
    where value.borrowed
      and exists (
        select 1
        from public.lineup_submissions owner_lineup
        join public.lineup_players owner_player on owner_player.lineup_id = owner_lineup.id
        where owner_lineup.fixture_id = p_fixture_id
          and owner_lineup.member_id = value.owner_member_id
          and owner_lineup.status in ('submitted', 'locked')
          and owner_player.player_id = value.player_id
      )
      and exists (
        select 1
        from public.players royalty_player
        where royalty_player.id = value.player_id
          and royalty_player.team_id in (v_fixture.home_team_id, v_fixture.away_team_id)
      );$new$;
begin
  v_definition := pg_get_functiondef('public.publish_match_scores(uuid)'::regprocedure);
  if position(v_old_fragment in v_definition) = 0 then
    if position('fixture_team_eligible' in v_definition) > 0 then
      return;
    end if;
    raise exception 'Could not locate the owner-selected royalty insert in publish_match_scores';
  end if;
  execute replace(v_definition, v_old_fragment, v_new_fragment);
end;
$$;

create temporary table invalid_royalty_corrections on commit drop as
select adjustment.fixture_id,
  adjustment.recipient_member_id,
  sum(adjustment.adjustment_points)::numeric as removed_points
from public.special_player_score_adjustments adjustment
join public.fixtures fixture on fixture.id = adjustment.fixture_id
join public.players player on player.id = adjustment.player_id
where adjustment.adjustment_type in ('regular_royalty', 'marquee_royalty')
  and adjustment.recipient_member_id is not null
  and player.team_id not in (fixture.home_team_id, fixture.away_team_id)
group by adjustment.fixture_id, adjustment.recipient_member_id;

update public.member_match_scores score
set ownership_adjustment = score.ownership_adjustment - correction.removed_points,
    calculation_breakdown = jsonb_set(
      coalesce(score.calculation_breakdown, '{}'::jsonb),
      '{royalty_points}',
      to_jsonb(greatest(
        coalesce((score.calculation_breakdown->>'royalty_points')::numeric, 0) - correction.removed_points,
        0
      )),
      true
    ) || jsonb_build_object(
      'royalty_fixture_team_correction',
      jsonb_build_object(
        'removed_points', correction.removed_points,
        'reason', 'Player IPL team was not participating in the fixture',
        'corrected_at', now()
      )
    ),
    updated_at = now()
from invalid_royalty_corrections correction
where score.fixture_id = correction.fixture_id
  and score.member_id = correction.recipient_member_id;

delete from public.special_player_score_adjustments adjustment
using public.fixtures fixture, public.players player
where fixture.id = adjustment.fixture_id
  and player.id = adjustment.player_id
  and adjustment.adjustment_type in ('regular_royalty', 'marquee_royalty')
  and player.team_id not in (fixture.home_team_id, fixture.away_team_id);

insert into public.audit_events (
  league_id, actor_user_id, action, entity_type, entity_id, after_data
)
select fixture.league_id, null, 'off_fixture_royalties_corrected', 'fixture',
  correction.fixture_id::text,
  jsonb_build_object(
    'removed_points', sum(correction.removed_points),
    'affected_recipients', count(*),
    'eligibility', 'player_team_must_match_fixture_home_or_away_team'
  )
from invalid_royalty_corrections correction
join public.fixtures fixture on fixture.id = correction.fixture_id
group by fixture.league_id, correction.fixture_id;

with affected_fixtures as (
  select distinct fixture_id from invalid_royalty_corrections
), ranked as (
  select score.id,
    dense_rank() over (
      partition by score.fixture_id
      order by score.total_points desc
    )::integer as corrected_rank
  from public.member_match_scores score
  join affected_fixtures affected on affected.fixture_id = score.fixture_id
)
update public.member_match_scores score
set rank = ranked.corrected_rank,
    updated_at = now()
from ranked
where score.id = ranked.id;

commit;
