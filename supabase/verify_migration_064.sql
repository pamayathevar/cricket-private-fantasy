select
  count(*) filter (
    where slug = 'ipl-2026-royalty-test'
      and name = 'IPL 2026'
      and status = 'active'
  ) = 1 as royalty_league_is_visible_ipl_2026,
  count(*) filter (
    where slug in ('ipl-2026', 'ipl-2026-open-test')
      and status = 'archived'
  ) = 2 as superseded_leagues_are_archived,
  count(*) filter (
    where slug in ('ipl-2026', 'ipl-2026-open-test', 'ipl-2026-royalty-test')
      and status = 'active'
  ) = 1 as exactly_one_target_league_is_visible
from public.leagues
where slug in (
  'ipl-2026',
  'ipl-2026-open-test',
  'ipl-2026-royalty-test'
);
