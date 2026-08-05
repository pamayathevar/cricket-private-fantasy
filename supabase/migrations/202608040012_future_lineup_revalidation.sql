-- Revalidate unstarted submitted XIs when a playing-rule version's effective match is set.
begin;

alter table public.lineup_submissions
  add column if not exists validation_status text not null default 'valid'
    check (validation_status in ('valid', 'needs_changes')),
  add column if not exists validation_errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_errors) = 'array'),
  add column if not exists validated_rule_set_id uuid references public.lineup_rule_sets(id);

create or replace function public.revalidate_future_lineups_for_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  with candidates as (
    select lineup.id,
      array_remove(array[
        case when count(player.player_id) <> new.lineup_size then format('Select exactly %s players', new.lineup_size) end,
        case when count(player.player_id) filter (where person.role = 'BA') < new.min_batters then format('At least %s batters required', new.min_batters) end,
        case when count(player.player_id) filter (where person.role = 'BO') < new.min_bowlers then format('At least %s bowlers required', new.min_bowlers) end,
        case when count(player.player_id) filter (where person.role = 'WK') < new.min_wicketkeepers then format('At least %s wicketkeepers required', new.min_wicketkeepers) end,
        case when count(player.player_id) filter (where person.role = 'AL') < new.min_all_rounders then format('At least %s all-rounders required', new.min_all_rounders) end,
        case when lineup.lineup_cost > new.lineup_budget then format('Lineup exceeds budget of %s', new.lineup_budget) end,
        case when coalesce(max(team_counts.player_count), 0) > new.max_from_one_team then format('Maximum %s players from one cricket team', new.max_from_one_team) end
      ], null) errors
    from public.lineup_submissions lineup
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    left join public.lineup_players player on player.lineup_id = lineup.id
    left join public.players person on person.id = player.player_id
    left join lateral (
      select count(*) player_count
      from public.lineup_players grouped_player
      join public.players grouped_person on grouped_person.id = grouped_player.player_id
      where grouped_player.lineup_id = lineup.id
      group by grouped_person.team_id
      order by count(*) desc limit 1
    ) team_counts on true
    where lineup.league_id = new.league_id
      and fixture.status = 'scheduled'
      and fixture.match_number >= new.effective_from_match_number
      and public.lineup_rule_set_for_fixture(fixture.id) = new.id
      and lineup.status in ('submitted', 'draft')
    group by lineup.id, lineup.lineup_cost
  )
  update public.lineup_submissions lineup
  set validation_status = case when cardinality(candidates.errors) = 0 then 'valid' else 'needs_changes' end,
      validation_errors = to_jsonb(candidates.errors),
      validated_rule_set_id = new.id,
      status = case when cardinality(candidates.errors) = 0 then lineup.status else 'draft' end,
      updated_at = now()
  from candidates
  where lineup.id = candidates.id;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (new.league_id, auth.uid(), 'future_lineups_revalidated', 'lineup_rule_set', new.id::text,
    jsonb_build_object('version', new.version, 'effective_from_match_number', new.effective_from_match_number));
  return new;
end;
$$;

drop trigger if exists lineup_rules_revalidate_future_lineups on public.lineup_rule_sets;
create trigger lineup_rules_revalidate_future_lineups
after update of effective_from_match_number on public.lineup_rule_sets
for each row
when (old.effective_from_match_number is distinct from new.effective_from_match_number)
execute function public.revalidate_future_lineups_for_rule();

commit;
