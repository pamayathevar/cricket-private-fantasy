-- Read-only verification for the match score review/publish workflow.
select
  to_regprocedure('public.stage_match_player_points(uuid,jsonb)') is not null as staging_rpc_installed,
  to_regprocedure('public.publish_match_scores(uuid)') is not null as publishing_rpc_installed,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'member_match_scores'
      and column_name = 'calculation_breakdown'
  ) as score_breakdown_installed;
