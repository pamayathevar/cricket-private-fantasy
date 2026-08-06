-- Read-only verification for migration 034.
select
  to_regclass('public.special_player_score_adjustments') is not null as adjustment_table_installed,
  to_regprocedure('public.special_usage_fee(numeric,numeric,numeric)') is not null as usage_fee_function_installed,
  to_regprocedure('public.special_royalty_points(numeric,numeric,boolean,text)') is not null as royalty_function_installed,
  public.special_usage_fee(100, 30, 15) = 30 as fee_100_is_30,
  public.special_usage_fee(0, 30, 15) = 15 as fee_zero_is_15,
  public.special_royalty_points(-10, 15, true, 'immediate_whole_point') = 0 as negative_royalty_is_zero,
  public.special_royalty_points(103, 15, true, 'immediate_whole_point') = 15 as royalty_rounds_immediately,
  position('special_player_score_adjustments' in pg_get_functiondef('public.publish_match_scores(uuid)'::regprocedure)) > 0
    as publication_uses_special_adjustments,
  not has_table_privilege('authenticated', 'public.special_player_score_adjustments', 'INSERT,UPDATE,DELETE')
    as direct_adjustment_writes_blocked;
