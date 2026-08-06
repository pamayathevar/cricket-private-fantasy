-- Expected: all values are true.
select
  position('owner_selected_player' in pg_get_functiondef(
    'public.publish_match_scores(uuid)'::regprocedure
  )) > 0 as owner_lineup_royalty_check_installed,
  position('owner_lineup.member_id = value.owner_member_id' in pg_get_functiondef(
    'public.publish_match_scores(uuid)'::regprocedure
  )) > 0 as royalty_owner_match_check_installed,
  position('owner_player.player_id = value.player_id' in pg_get_functiondef(
    'public.publish_match_scores(uuid)'::regprocedure
  )) > 0 as royalty_player_match_check_installed;
