select
  to_regprocedure('public.publish_match_scores_safe(uuid)') is not null as safe_publish_installed,
  to_regprocedure('public.settle_abandoned_match(uuid)') is not null as abandoned_settlement_installed;
