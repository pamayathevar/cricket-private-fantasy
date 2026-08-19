-- Substitute fielders remain visible in scorecards but earn no fantasy points by default.
begin;

alter table public.lineup_rule_sets
  add column if not exists substitute_fielder_points_enabled boolean not null default false;

comment on column public.lineup_rule_sets.substitute_fielder_points_enabled is
  'When true, substitute fielders receive catch, stumping and run-out fantasy points.';

commit;
