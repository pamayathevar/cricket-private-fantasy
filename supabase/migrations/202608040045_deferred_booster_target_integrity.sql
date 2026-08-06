-- Keep player-level booster targets inside the submitted XI. The check is
-- deferred so a legitimate resubmission may replace lineup_players within the
-- same transaction before the invariant is evaluated.
begin;

create or replace function public.enforce_booster_target_in_lineup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lineup_id uuid;
  v_target_player_id uuid;
  v_booster_code text;
begin
  if tg_op = 'DELETE' then
    v_lineup_id := old.lineup_id;
  else
    v_lineup_id := new.lineup_id;
  end if;

  -- Cascading deletion of the complete lineup needs no validation.
  if not exists (select 1 from public.lineup_submissions where id = v_lineup_id) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select lineup_booster.target_player_id, booster.code
    into v_target_player_id, v_booster_code
  from public.lineup_boosters lineup_booster
  join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
  where lineup_booster.lineup_id = v_lineup_id;

  if found
     and v_booster_code = '3X'
     and v_target_player_id is not null
     and not exists (
       select 1
       from public.lineup_players lineup_player
       where lineup_player.lineup_id = v_lineup_id
         and lineup_player.player_id = v_target_player_id
     ) then
    raise exception '3X booster player must be selected in the submitted XI';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists validate_booster_target_after_booster_write on public.lineup_boosters;
create constraint trigger validate_booster_target_after_booster_write
after insert or update or delete
on public.lineup_boosters
deferrable initially deferred
for each row execute function public.enforce_booster_target_in_lineup();

drop trigger if exists validate_booster_target_after_lineup_player_write on public.lineup_players;
create constraint trigger validate_booster_target_after_lineup_player_write
after insert or update or delete
on public.lineup_players
deferrable initially deferred
for each row execute function public.enforce_booster_target_in_lineup();

revoke all on function public.enforce_booster_target_in_lineup() from public;

commit;
