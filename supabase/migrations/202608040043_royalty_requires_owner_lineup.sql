-- Credit royalty only when the owning member also selected that player for the fixture.
begin;

do $$
declare
  v_definition text;
  v_old_fragment text := $old$jsonb_build_object('zero_floor', v_special.royalty_zero_floor,
        'rounding', v_special.royalty_rounding, 'is_marquee', value.is_marquee)
    from calculated_special_values value where value.borrowed;$old$;
  v_new_fragment text := $new$jsonb_build_object('zero_floor', v_special.royalty_zero_floor,
        'rounding', v_special.royalty_rounding, 'is_marquee', value.is_marquee,
        'owner_selected_player', true)
    from calculated_special_values value
    where value.borrowed
      and exists (
        select 1
        from public.lineup_submissions owner_lineup
        join public.lineup_players owner_player on owner_player.lineup_id = owner_lineup.id
        where owner_lineup.fixture_id = p_fixture_id
          and owner_lineup.member_id = value.owner_member_id
          and owner_lineup.status in ('submitted', 'locked')
          and owner_player.player_id = value.player_id
      );$new$;
begin
  v_definition := pg_get_functiondef('public.publish_match_scores(uuid)'::regprocedure);
  if position(v_old_fragment in v_definition) = 0 then
    if position('owner_selected_player' in v_definition) > 0 then
      return;
    end if;
    raise exception 'Could not locate the royalty adjustment insert in publish_match_scores';
  end if;
  execute replace(v_definition, v_old_fragment, v_new_fragment);
end;
$$;

commit;
