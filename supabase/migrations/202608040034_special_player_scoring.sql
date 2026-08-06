-- Apply Unique usage fees and Royalty credits during score publication.
begin;

alter table public.member_match_scores
  alter column lineup_id drop not null,
  add column if not exists special_rule_set_id uuid references public.special_player_rule_sets(id) on delete restrict;

create table public.special_player_score_adjustments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  rule_set_id uuid not null references public.special_player_rule_sets(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  source_member_id uuid not null references public.league_members(id) on delete cascade,
  recipient_member_id uuid references public.league_members(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('other_player_usage_fee', 'regular_royalty', 'marquee_royalty')),
  final_player_contribution numeric(14,2) not null,
  rate_percent numeric(5,2) not null,
  minimum_fee numeric(10,2),
  adjustment_points numeric(14,2) not null,
  calculation_breakdown jsonb not null default '{}'::jsonb check (jsonb_typeof(calculation_breakdown) = 'object'),
  created_at timestamptz not null default now(),
  unique (fixture_id, player_id, source_member_id, recipient_member_id, adjustment_type)
);

create index special_player_score_adjustments_fixture_idx
  on public.special_player_score_adjustments (fixture_id, source_member_id, recipient_member_id);

create or replace function public.special_usage_fee(
  p_final_contribution numeric, p_percent numeric, p_minimum numeric
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(p_final_contribution * p_percent / 100, p_minimum)
$$;

create or replace function public.special_royalty_points(
  p_final_contribution numeric, p_percent numeric,
  p_zero_floor boolean, p_rounding text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_rounding
    when 'immediate_whole_point' then round(
      case when p_zero_floor then greatest(p_final_contribution * p_percent / 100, 0)
           else p_final_contribution * p_percent / 100 end
    )
    else case when p_zero_floor then greatest(p_final_contribution * p_percent / 100, 0)
              else p_final_contribution * p_percent / 100 end
  end
$$;

create or replace function public.publish_match_scores(p_fixture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_special public.special_player_rule_sets%rowtype;
  v_calculation_version integer;
  v_member_count integer;
  v_was_published boolean;
  v_acquisition_mode text;
  v_ownership_deductions_enabled boolean;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_league_admin(v_fixture.league_id) then raise exception 'League admin access required'; end if;
  if v_fixture.scoring_status <> 'review' then raise exception 'Match points must be in review before publishing'; end if;
  select max(calculation_version) into v_calculation_version from public.player_match_points where fixture_id = p_fixture_id;
  if v_calculation_version is null then raise exception 'No calculated player points found'; end if;
  select exists (select 1 from public.member_match_scores where fixture_id = p_fixture_id and published_at is not null) into v_was_published;
  select * into v_special from public.special_player_rules_for_match(v_fixture.league_id, v_fixture.match_number);

  select acquisition_mode, other_owner_deductions_enabled
  into v_acquisition_mode, v_ownership_deductions_enabled
  from public.league_format_configs where league_id = v_fixture.league_id;
  v_acquisition_mode := coalesce(v_acquisition_mode, 'auction');
  v_ownership_deductions_enabled := coalesce(v_ownership_deductions_enabled, true);

  create temporary table calculated_special_values on commit drop as
  with rule as (
    select rules.* from public.lineup_rule_sets rules
    where rules.id = public.lineup_rule_set_for_fixture(p_fixture_id)
  )
  select lineup.id lineup_id, lineup.member_id, lineup_player.player_id,
    league_player.owner_member_id,
    case
      when lineup.impact_player_id = lineup_player.player_id and lineup.impact_type = 'BAI' then points.batting_points * rule.impact_multiplier
      when lineup.impact_player_id = lineup_player.player_id and lineup.impact_type = 'BOI' then points.bowling_points * rule.impact_multiplier
      else points.total_points
    end
    * case when lineup.captain_player_id = lineup_player.player_id then rule.captain_multiplier
           when lineup.vice_captain_player_id = lineup_player.player_id then rule.vice_captain_multiplier else 1 end
    * case when booster.code = '3X' and lineup_booster.target_player_id = lineup_player.player_id
           then booster.player_multiplier else 1 end as player_contribution,
    case when booster.code = '2UP' then coalesce(booster.match_multiplier, 2) else 1 end as match_multiplier,
    league_player.owner_member_id is not null and league_player.owner_member_id <> lineup.member_id as borrowed,
    exists (
      select 1 from public.effective_phase_special_players(v_fixture.phase_id, 'marquee') marquee
      where marquee.member_id = league_player.owner_member_id and marquee.player_id = lineup_player.player_id
    ) as is_marquee,
    rule.other_owner_penalty_percent as legacy_penalty_percent,
    rule.other_owner_minimum_penalty as legacy_minimum_penalty
  from public.lineup_submissions lineup
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  join public.player_match_points points on points.fixture_id = lineup.fixture_id
    and points.player_id = lineup_player.player_id and points.calculation_version = v_calculation_version
  join public.league_players league_player on league_player.league_id = lineup.league_id
    and league_player.player_id = lineup_player.player_id
  cross join rule
  left join public.lineup_boosters lineup_booster on lineup_booster.lineup_id = lineup.id
  left join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
  where lineup.fixture_id = p_fixture_id and lineup.status in ('submitted', 'locked');

  delete from public.special_player_score_adjustments where fixture_id = p_fixture_id;

  if coalesce(v_special.unique_mode_enabled, false) then
    insert into public.special_player_score_adjustments (
      league_id, fixture_id, rule_set_id, player_id, source_member_id, recipient_member_id,
      adjustment_type, final_player_contribution, rate_percent, minimum_fee,
      adjustment_points, calculation_breakdown
    )
    select v_fixture.league_id, p_fixture_id, v_special.id, value.player_id, value.member_id, null,
      'other_player_usage_fee', value.player_contribution * value.match_multiplier,
      v_special.other_player_fee_percent, v_special.other_player_minimum_fee,
      -public.special_usage_fee(value.player_contribution, v_special.other_player_fee_percent,
        v_special.other_player_minimum_fee) * value.match_multiplier,
      jsonb_build_object('order', 'fee_before_match_multiplier', 'match_multiplier', value.match_multiplier)
    from calculated_special_values value where value.borrowed;
  end if;

  if coalesce(v_special.marquee_mode_enabled, false) then
    insert into public.special_player_score_adjustments (
      league_id, fixture_id, rule_set_id, player_id, source_member_id, recipient_member_id,
      adjustment_type, final_player_contribution, rate_percent, minimum_fee,
      adjustment_points, calculation_breakdown
    )
    select v_fixture.league_id, p_fixture_id, v_special.id, value.player_id, value.member_id,
      value.owner_member_id,
      case when value.is_marquee then 'marquee_royalty' else 'regular_royalty' end,
      value.player_contribution * value.match_multiplier,
      case when value.is_marquee then v_special.marquee_royalty_percent else v_special.regular_royalty_percent end,
      null,
      public.special_royalty_points(
        value.player_contribution * value.match_multiplier,
        case when value.is_marquee then v_special.marquee_royalty_percent else v_special.regular_royalty_percent end,
        v_special.royalty_zero_floor, v_special.royalty_rounding
      ),
      jsonb_build_object('zero_floor', v_special.royalty_zero_floor,
        'rounding', v_special.royalty_rounding, 'is_marquee', value.is_marquee)
    from calculated_special_values value where value.borrowed;
  end if;

  delete from public.member_match_scores where fixture_id = p_fixture_id;
  insert into public.member_match_scores (
    fixture_id, member_id, lineup_id, base_points, captain_bonus, vice_captain_bonus,
    impact_adjustment, ownership_adjustment, special_rule_set_id,
    calculation_breakdown, published_at
  )
  select p_fixture_id, value.member_id, value.lineup_id,
    sum(value.player_contribution * value.match_multiplier), 0, 0, 0,
    coalesce((select sum(adjustment.adjustment_points)
      from public.special_player_score_adjustments adjustment
      where adjustment.fixture_id = p_fixture_id and adjustment.source_member_id = value.member_id
        and adjustment.adjustment_type = 'other_player_usage_fee'),
      case when v_ownership_deductions_enabled and not coalesce(v_special.marquee_mode_enabled, false)
        and not coalesce(v_special.unique_mode_enabled, false)
      then -sum(case when value.borrowed and value.player_contribution > 0
        then greatest(value.player_contribution * value.legacy_penalty_percent / 100, value.legacy_minimum_penalty)
             * value.match_multiplier else 0 end) else 0 end),
    v_special.id,
    jsonb_build_object('gross_points', sum(value.player_contribution * value.match_multiplier),
      'special_rule_version', v_special.version,
      'unique_mode_enabled', coalesce(v_special.unique_mode_enabled, false),
      'marquee_mode_enabled', coalesce(v_special.marquee_mode_enabled, false)), now()
  from calculated_special_values value
  group by value.member_id, value.lineup_id;

  insert into public.member_match_scores (
    fixture_id, member_id, lineup_id, base_points, captain_bonus, vice_captain_bonus,
    impact_adjustment, ownership_adjustment, special_rule_set_id, calculation_breakdown, published_at
  )
  select p_fixture_id, royalty.recipient_member_id, null, 0, 0, 0, 0,
    case when v_special.royalty_rounding = 'final_total_whole_point' then round(sum(royalty.adjustment_points))
         else sum(royalty.adjustment_points) end, v_special.id,
    jsonb_build_object('royalty_only', true, 'royalty_points',
      case when v_special.royalty_rounding = 'final_total_whole_point' then round(sum(royalty.adjustment_points))
           else sum(royalty.adjustment_points) end,
      'special_rule_version', v_special.version), now()
  from public.special_player_score_adjustments royalty
  where royalty.fixture_id = p_fixture_id and royalty.recipient_member_id is not null
    and not exists (select 1 from public.member_match_scores score
      where score.fixture_id = p_fixture_id and score.member_id = royalty.recipient_member_id)
  group by royalty.recipient_member_id;

  update public.member_match_scores score
  set ownership_adjustment = score.ownership_adjustment + royalty.royalty_points,
      calculation_breakdown = score.calculation_breakdown || jsonb_build_object('royalty_points', royalty.royalty_points)
  from (
    select recipient_member_id,
      case when v_special.royalty_rounding = 'final_total_whole_point' then round(sum(adjustment_points))
           else sum(adjustment_points) end royalty_points
    from public.special_player_score_adjustments
    where fixture_id = p_fixture_id and recipient_member_id is not null
    group by recipient_member_id
  ) royalty
  where score.fixture_id = p_fixture_id and score.member_id = royalty.recipient_member_id
    and score.lineup_id is not null;

  select count(*) into v_member_count from public.member_match_scores where fixture_id = p_fixture_id;
  with ranked as (
    select id, dense_rank() over (order by total_points desc)::integer match_rank
    from public.member_match_scores where fixture_id = p_fixture_id
  ) update public.member_match_scores score set rank = ranked.match_rank
    from ranked where score.id = ranked.id;

  update public.player_match_points set published_at = now()
  where fixture_id = p_fixture_id and calculation_version = v_calculation_version;
  update public.lineup_submissions set status = 'locked', locked_at = coalesce(locked_at, now()), updated_at = now()
  where fixture_id = p_fixture_id and status = 'submitted';
  update public.fixtures set status = 'completed',
    scoring_status = case when v_was_published then 'corrected' else 'published' end, updated_at = now()
  where id = p_fixture_id;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (v_fixture.league_id, auth.uid(), case when v_was_published then 'match_scores_corrected' else 'match_scores_published' end,
    'fixture', p_fixture_id::text, jsonb_build_object('calculation_version', v_calculation_version,
      'member_count', v_member_count, 'special_rule_set_id', v_special.id,
      'special_rule_version', v_special.version));
  return jsonb_build_object('calculation_version', v_calculation_version, 'member_count', v_member_count,
    'scoring_status', case when v_was_published then 'corrected' else 'published' end,
    'special_rule_version', v_special.version);
end;
$$;

alter table public.special_player_score_adjustments enable row level security;
create policy special_player_score_adjustments_read on public.special_player_score_adjustments
  for select to authenticated using (public.is_league_member(league_id));
grant select on public.special_player_score_adjustments to authenticated;
revoke insert, update, delete on public.special_player_score_adjustments from authenticated;

revoke all on function public.special_usage_fee(numeric,numeric,numeric) from public;
grant execute on function public.special_usage_fee(numeric,numeric,numeric) to authenticated;
revoke all on function public.special_royalty_points(numeric,numeric,boolean,text) from public;
grant execute on function public.special_royalty_points(numeric,numeric,boolean,text) to authenticated;

commit;
