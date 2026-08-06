-- Unique-driven and Royalty-driven modes require player ownership and are mutually exclusive.
begin;

create or replace function public.validate_special_player_rule_mode()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_ownership_enabled boolean;
begin
  select ownership_enabled into v_ownership_enabled
  from public.league_format_configs where league_id = new.league_id;
  if new.unique_mode_enabled and new.marquee_mode_enabled then
    raise exception 'Unique-player-driven and Royalty-driven modes cannot be enabled together';
  end if;
  if (new.unique_mode_enabled or new.marquee_mode_enabled) and not coalesce(v_ownership_enabled, false) then
    raise exception 'Unique-player-driven and Royalty-driven modes require an Auction / Owned league';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_special_player_rule_mode_before_write on public.special_player_rule_sets;
create trigger validate_special_player_rule_mode_before_write
before insert or update of unique_mode_enabled, marquee_mode_enabled, league_id
on public.special_player_rule_sets
for each row execute function public.validate_special_player_rule_mode();

-- Repair only invalid, future-effective active versions created before this guard.
create temporary table invalid_special_versions on commit drop as
select rules.id, rules.league_id, rules.version
from public.special_player_rule_sets rules
join public.league_format_configs format on format.league_id = rules.league_id
where rules.active and not format.ownership_enabled
  and (rules.unique_mode_enabled or rules.marquee_mode_enabled)
  and not exists (
    select 1 from public.fixtures fixture
    where fixture.league_id = rules.league_id
      and fixture.match_number >= rules.effective_from_match_number
      and (fixture.status <> 'scheduled' or now() >= fixture.lineup_lock_at)
  );

update public.special_player_rule_sets rules set active = false
from invalid_special_versions invalid where rules.id = invalid.id;

update public.special_player_rule_sets rules set active = true
where rules.id in (
  select distinct on (candidate.league_id) candidate.id
  from public.special_player_rule_sets candidate
  join invalid_special_versions invalid on invalid.league_id = candidate.league_id
  join public.league_format_configs format on format.league_id = candidate.league_id
  where candidate.id <> invalid.id
    and not (candidate.unique_mode_enabled or candidate.marquee_mode_enabled)
  order by candidate.league_id, candidate.version desc
);

insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
select invalid.league_id, null, 'invalid_special_rule_version_deactivated',
  'special_player_rule_set', invalid.id::text,
  jsonb_build_object('version', invalid.version, 'reason', 'ownership_required')
from invalid_special_versions invalid;

commit;
