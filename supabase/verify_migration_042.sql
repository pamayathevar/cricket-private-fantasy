select
  position(
    'v_special.marquee_minimum_royalty else v_special.regular_minimum_royalty'
    in pg_get_functiondef('public.publish_match_scores(uuid)'::regprocedure)
  ) > 0 as publication_persists_royalty_minimum,
  not exists (
    select 1
    from public.special_player_score_adjustments
    where adjustment_type in ('regular_royalty', 'marquee_royalty')
      and minimum_fee is null
  ) as existing_royalty_rows_backfilled;

select
  league.name,
  fixture.match_number,
  player.full_name,
  adjustment.adjustment_type,
  adjustment.rate_percent,
  adjustment.minimum_fee,
  adjustment.adjustment_points
from public.special_player_score_adjustments adjustment
join public.fixtures fixture on fixture.id = adjustment.fixture_id
join public.leagues league on league.id = adjustment.league_id
join public.players player on player.id = adjustment.player_id
where adjustment.adjustment_type in ('regular_royalty', 'marquee_royalty')
order by adjustment.created_at desc, player.full_name;
