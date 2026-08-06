select
  to_regprocedure('public.special_player_labels_for_fixture(uuid)') is not null as label_rpc_installed,
  has_function_privilege('authenticated', 'public.special_player_labels_for_fixture(uuid)', 'EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon', 'public.special_player_labels_for_fixture(uuid)', 'EXECUTE') as anonymous_cannot_execute;

select fixture.match_number, labels.full_name, labels.label
from public.fixtures fixture
cross join lateral public.special_player_labels_for_fixture(fixture.id) labels
join public.leagues league on league.id = fixture.league_id
where league.slug = 'special-rules-test-2028'
  and fixture.match_number = 1
order by labels.label, labels.full_name;
