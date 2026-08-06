-- Permit trusted SQL Editor/service verification while retaining member checks for app JWTs.
begin;

create or replace function public.special_player_labels_for_fixture(p_fixture_id uuid)
returns table(player_id uuid, full_name text, label text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_rules public.special_player_rule_sets%rowtype;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id;
  if not found then raise exception 'Fixture not found'; end if;
  if auth.uid() is not null and not public.is_league_member(v_fixture.league_id) then
    raise exception 'Active league membership required';
  end if;

  select * into v_rules
  from public.special_player_rules_for_match(v_fixture.league_id, v_fixture.match_number);
  if v_rules.id is null then return; end if;

  if v_rules.unique_mode_enabled then
    return query
      select player.id, player.full_name, 'UNIQUE'::text
      from public.effective_phase_special_players(v_fixture.phase_id, 'unique') selected
      join public.players player on player.id = selected.player_id;
  elsif v_rules.marquee_mode_enabled then
    return query
      select player.id, player.full_name, 'MARQUEE'::text
      from public.effective_phase_special_players(v_fixture.phase_id, 'marquee') selected
      join public.players player on player.id = selected.player_id;

    if v_rules.automatic_unique_enabled then
      return query
        select player.id, player.full_name, 'AUTO UNIQUE'::text
        from public.league_players league_player
        join public.players player on player.id = league_player.player_id
        where league_player.league_id = v_fixture.league_id
          and league_player.active
          and league_player.owner_member_id is not null
          and (
            select count(*)
            from public.lineup_players lineup_player
            join public.lineup_submissions lineup on lineup.id = lineup_player.lineup_id
            join public.fixtures used_fixture on used_fixture.id = lineup.fixture_id
            where lineup.league_id = v_fixture.league_id
              and lineup_player.player_id = league_player.player_id
              and used_fixture.match_number < v_fixture.match_number
              and (used_fixture.status in ('live', 'completed', 'abandoned') or now() >= used_fixture.lineup_lock_at)
              and lineup.status in ('submitted', 'locked')
          ) > v_rules.automatic_unique_usage_threshold;
    end if;
  end if;
end;
$$;

revoke all on function public.special_player_labels_for_fixture(uuid) from public;
grant execute on function public.special_player_labels_for_fixture(uuid) to authenticated;

commit;
