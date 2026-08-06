-- A missed locked match does not block later submissions. The first actual
-- submission in each configured transfer period receives the free reset.
begin;

do $$
declare
  v_definition text;
  v_old_sequence text := $old$and candidate.match_number < v_fixture.match_number
    and not exists ($old$;
  v_new_sequence text := $new$and candidate.match_number < v_fixture.match_number
    and candidate.status = 'scheduled'
    and coalesce(candidate.lineup_lock_at, candidate.scheduled_start) > now()
    and not exists ($new$;
  v_old_free text := $old$v_initial_lineup := v_period.first_match_free
    and v_fixture.match_number = v_period.start_match_number;$old$;
  v_new_free text := $new$v_initial_lineup := v_period.first_match_free
    and not exists (
      select 1
      from public.lineup_submissions period_lineup
      join public.fixtures period_fixture on period_fixture.id = period_lineup.fixture_id
      where period_lineup.league_id = v_fixture.league_id
        and period_lineup.member_id = v_member_id
        and period_lineup.status in ('submitted', 'locked')
        and period_fixture.match_number between v_period.start_match_number and v_period.end_match_number
        and period_fixture.match_number < v_fixture.match_number
    );$new$;
begin
  v_definition := pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  );

  if position(v_old_sequence in v_definition) > 0 then
    v_definition := replace(v_definition, v_old_sequence, v_new_sequence);
  elsif position($check$candidate.status = 'scheduled'$check$ in v_definition) = 0 then
    raise exception 'Could not locate sequential submission enforcement';
  end if;

  if position(v_old_free in v_definition) > 0 then
    v_definition := replace(v_definition, v_old_free, v_new_free);
  elsif position('period_lineup.member_id = v_member_id' in v_definition) = 0 then
    raise exception 'Could not locate first-match-free enforcement';
  end if;

  execute v_definition;
end;
$$;

commit;
