import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Player } from "./squadData";
import { supabase } from "./supabase";

const OWNER_FONT = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const fmt = (value: unknown) => Math.round(Number(value ?? 0)).toLocaleString("en-US");
export const IPL_TEAM_BADGES: Record<string, { backgroundColor: string; color: string; borderColor: string }> = {
  RCB: { backgroundColor: "#C8102E", color: "#FFFFFF", borderColor: "#111111" },
  CSK: { backgroundColor: "#F9CD05", color: "#123B72", borderColor: "#123B72" },
  MI: { backgroundColor: "#005DAA", color: "#FFFFFF", borderColor: "#D4AF37" },
  KKR: { backgroundColor: "#3A225D", color: "#F2C14E", borderColor: "#F2C14E" },
  SRH: { backgroundColor: "#F26522", color: "#111111", borderColor: "#111111" },
  DC: { backgroundColor: "#17479E", color: "#FFFFFF", borderColor: "#D71920" },
  GT: { backgroundColor: "#0B1F3A", color: "#D4AF37", borderColor: "#D4AF37" },
  LSG: { backgroundColor: "#0057B8", color: "#FFFFFF", borderColor: "#D71920" },
  PBKS: { backgroundColor: "#ED1B24", color: "#FFFFFF", borderColor: "#A7A9AC" },
  RR: { backgroundColor: "#E91E8C", color: "#FFFFFF", borderColor: "#17479E" },
};
export const teamBadge = (code?: string) => IPL_TEAM_BADGES[code ?? ""] ?? { backgroundColor: "#546A61", color: "#FFFFFF", borderColor: "#546A61" };
export function IplTeamBadge({ code }: { code?: string }) { return <Text style={[x.teamBadge, teamBadge(code)]}>{code ?? "TBD"}</Text>; }
const Empty = ({ text }: { text: string }) => <View style={x.empty}><Text style={x.emptyText}>{text}</Text></View>;
const Loading = () => <View style={x.empty}><ActivityIndicator color="#174D3D" /><Text style={x.emptyText}>Loading from Supabase…</Text></View>;

export function ProductionDashboard({ leagueId, leagueName, memberName, openTeam }: { leagueId: string; leagueName: string; memberName: string; openTeam: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      supabase.from("fixtures").select("match_number,scheduled_start,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code)").eq("league_id", leagueId).eq("status", "scheduled").order("match_number").limit(1).maybeSingle(),
      supabase.from("league_standings").select("display_name,total_points,matches_scored,rank").eq("league_id", leagueId).eq("display_name", memberName).maybeSingle(),
      supabase.from("league_members").select("id").eq("league_id", leagueId).eq("display_name", memberName).single(),
      supabase.from("league_transfer_periods").select("id,name,start_match_number,end_match_number,transfer_limit").eq("league_id", leagueId).eq("active", true).order("sort_order"),
    ]).then(async ([fixture, standing, member, periods]) => {
      const firstError = fixture.error ?? standing.error ?? member.error ?? periods.error;
      if (firstError) { setError(firstError.message); return; }
      if (!member.data) { setError("League member record was not found."); return; }
      const transfers = await supabase.from("transfer_events").select("transfer_period_id,transfer_count").eq("member_id", member.data.id).eq("reason", "lineup_change");
      if (transfers.error) { setError(transfers.error.message); return; }
      setData({ fixture: fixture.data, standing: standing.data, periods: periods.data ?? [], transfers: transfers.data ?? [] });
    });
  }, [leagueId, memberName]);
  if (error) return <Empty text={error} />;
  if (!data) return <Loading />;
  const fixture = data.fixture;
  const start = fixture ? new Date(fixture.scheduled_start) : null;
  const period = data.periods.find((item: any) => fixture && fixture.match_number >= item.start_match_number && fixture.match_number <= item.end_match_number) ?? data.periods[0];
  const used = data.transfers.filter((event: any) => event.transfer_period_id === period?.id).reduce((sum: number, event: any) => sum + event.transfer_count, 0);
  return <><Text style={x.title}>Good evening, {memberName}</Text><Text style={x.subtitle}>{leagueName} · Private league</Text>
    {fixture ? <View style={x.hero}><Text style={x.heroLabel}>NEXT MATCH · M{fixture.match_number}</Text><View style={x.heroTeams}><IplTeamBadge code={fixture.home?.code} /><Text style={x.accent}>vs</Text><IplTeamBadge code={fixture.away?.code} /></View><Text style={x.heroMeta}>{start?.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} · Lineup open</Text><TouchableOpacity style={x.primary} onPress={openTeam}><Text style={x.primaryText}>Set playing XI</Text></TouchableOpacity></View> : <Empty text="No scheduled match." />}
    <View style={x.stats}><Metric label="RANK" value={data.standing ? `#${data.standing.rank}` : "—"} detail={`${data.standing?.matches_scored ?? 0} matches`} /><Metric label="POINTS" value={fmt(data.standing?.total_points)} detail="published" /><Metric label="TRANSFERS" value={period ? `${used}/${period.transfer_limit}` : "—"} detail={period?.name ?? "not configured"} /></View>
  </>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <View style={x.metric}><Text style={x.metricLabel}>{label}</Text><Text style={x.metricValue}>{value}</Text><Text style={x.meta}>{detail}</Text></View>; }

export function ProductionRanking({ leagueId }: { leagueId: string }) {
  const [phases, setPhases] = useState<any[]>([]);
  const [selected, setSelected] = useState("overall");
  const [overall, setOverall] = useState<any[]>([]);
  const [phaseRows, setPhaseRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([
    supabase.from("league_phases").select("code,name,start_match_number,end_match_number,sort_order").eq("league_id", leagueId).eq("active", true).order("sort_order"),
    supabase.from("league_standings").select("display_name,total_points,matches_scored,rank").eq("league_id", leagueId).order("rank"),
    supabase.from("league_phase_standings").select("phase_code,phase_name,display_name,total_points,matches_scored,rank").eq("league_id", leagueId).order("rank"),
  ]).then(([p, o, r]) => { const e = p.error ?? o.error ?? r.error; if (e) setError(e.message); else { setPhases(p.data ?? []); setOverall(o.data ?? []); setPhaseRows(r.data ?? []); } setLoading(false); }); }, [leagueId]);
  if (loading) return <Loading />;
  if (error) return <Empty text={error} />;
  const rows = selected === "overall" ? overall : phaseRows.filter(row => row.phase_code === selected);
  return <View><Text style={x.section}>League Ranking</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.chips}><Chip active={selected === "overall"} label="Overall" detail="All published" onPress={() => setSelected("overall")} />{phases.map(phase => <Chip key={phase.code} active={selected === phase.code} label={phase.name} detail={`M${phase.start_match_number}–${phase.end_match_number}`} onPress={() => setSelected(phase.code)} />)}</ScrollView>{rows.length ? <View style={x.card}>{rows.map(row => <View key={row.display_name} style={x.row}><Text style={x.rank}>#{row.rank}</Text><View style={x.avatar}><Text style={x.avatarText}>{row.display_name[0]}</Text></View><View style={x.grow}><Text style={x.ownerDisplayName}>{row.display_name}</Text><Text style={x.meta}>{row.matches_scored} scored matches</Text></View><Text style={x.value}>{fmt(row.total_points)} pts</Text></View>)}</View> : <Empty text="No published match scores in this ranking period." />}</View>;
}

function Chip({ active, label, detail, onPress }: { active: boolean; label: string; detail: string; onPress: () => void }) { return <TouchableOpacity style={[x.chip, active && x.chipActive]} onPress={onPress}><Text style={[x.chipLabel, active && x.chipLabelActive]}>{label}</Text><Text style={[x.chipDetail, active && x.chipLabelActive]}>{detail}</Text></TouchableOpacity>; }

export function ProductionMatches({ leagueId, roster }: { leagueId: string; roster: Player[] }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [expanded, setExpanded] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { supabase.from("fixtures").select("id,match_number,scheduled_start,status,scoring_status,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code),player_match_points(batting_points,bowling_points,fielding_points,bonus_points,total_points,breakdown,calculation_version,published_at,player:players(full_name))").eq("league_id", leagueId).order("match_number").then(({ data, error: e }) => { if (e) setError(e.message); else setMatches(data ?? []); }); }, [leagueId]);
  if (error) return <ScrollView contentContainerStyle={x.screen}><Empty text={error} /></ScrollView>;
  return <ScrollView contentContainerStyle={x.screen}>
    <Text style={x.title}>Matches</Text>
    <Text style={x.subtitle}>All fixtures · published points are visible to owners</Text>
    {matches.map(match => {
      const open = expanded === match.id;
      const latestVersion = Math.max(0, ...(match.player_match_points ?? []).filter((point: any) => point.published_at).map((point: any) => point.calculation_version));
      const points = [...(match.player_match_points ?? [])].filter((point: any) => point.published_at && point.calculation_version === latestVersion).sort((a, b) => {
        const pa = roster.find(p => p.name === a.player?.full_name);
        const pb = roster.find(p => p.name === b.player?.full_name);
        return (pa?.team ?? "").localeCompare(pb?.team ?? "") || Number(b.total_points) - Number(a.total_points);
      });
      return <View key={match.id} style={x.cardBlock}>
        <TouchableOpacity style={x.matchHeader} onPress={() => setExpanded(open ? "" : match.id)}>
          <View style={x.grow}><Text style={x.name}>Match {match.match_number}</Text><View style={x.matchTeams}><IplTeamBadge code={match.home?.code} /><Text style={x.vsText}>vs</Text><IplTeamBadge code={match.away?.code} /></View><Text style={x.meta}>{match.status.toUpperCase()} · {match.scoring_status.toUpperCase()}</Text></View>
          <Text style={x.chevron}>{open ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {open ? points.length ? <View>
          <View style={x.pointHead}><Text style={x.pointPlayer}>PLAYER</Text><Text style={x.pointCell}>BAT</Text><Text style={x.pointCell}>BOWL</Text><Text style={x.pointCell}>FLD</Text><Text style={x.pointCell}>BON</Text><Text style={x.pointTotal}>TOTAL</Text></View>
          {points.map(point => {
            const player = roster.find(p => p.name === point.player?.full_name);
            return <View key={point.player?.full_name} style={x.pointRow}><View style={x.pointPlayer}><Text style={x.name}>{point.player?.full_name}</Text><View style={x.inlineMeta}><IplTeamBadge code={player?.team} /><Text style={x.meta}>{player?.owner === "Available" ? "OpenPlayer" : `Owned by ${player?.owner ?? "—"}`}</Text></View></View><Text style={x.pointCell}>{fmt(point.batting_points)}</Text><Text style={x.pointCell}>{fmt(point.bowling_points)}</Text><Text style={x.pointCell}>{fmt(point.fielding_points)}</Text><Text style={x.pointCell}>{fmt(point.bonus_points)}</Text><Text style={x.pointTotal}>{fmt(point.total_points)}</Text></View>;
          })}
        </View> : <Empty text={match.scoring_status === "review" ? "Points are under admin review." : "Points have not been published."} /> : null}
      </View>;
    })}
  </ScrollView>;
}

export function ProductionSquads({ leagueId, currentOwner, roster }: { leagueId: string; currentOwner: string; roster: Player[] }) {
  const [points, setPoints] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(currentOwner);
  const [error, setError] = useState("");
  useEffect(() => { supabase.from("player_match_points").select("fixture_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,calculation_version,published_at,player:players(full_name),fixture:fixtures!inner(league_id)").eq("fixture.league_id", leagueId).not("published_at", "is", null).then(({ data, error: e }) => { if (e) setError(e.message); else setPoints(data ?? []); }); }, [leagueId]);
  const totals = useMemo(() => { const latest = new Map<string, any>(); for (const row of points) { const key = `${row.fixture_id}:${row.player?.full_name}`; if (!latest.has(key) || latest.get(key).calculation_version < row.calculation_version) latest.set(key, row); } const map = new Map<string, any>(); for (const row of latest.values()) { const name = row.player?.full_name; const current = map.get(name) ?? { batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 }; map.set(name, { batting: current.batting + Number(row.batting_points), bowling: current.bowling + Number(row.bowling_points), fielding: current.fielding + Number(row.fielding_points), bonus: current.bonus + Number(row.bonus_points), total: current.total + Number(row.total_points) }); } return map; }, [points]);
  if (error) return <Empty text={error} />;
  const owners = Array.from(new Set(roster.filter(p => p.owner !== "Available").map(p => p.owner))).sort((a, b) => a === currentOwner ? -1 : b === currentOwner ? 1 : a.localeCompare(b));
  return <View><Text style={x.section}>Owner Squads</Text><Text style={x.subtitle}>Auction squads with totals from published matches</Text>{owners.map(owner => { const open = expanded === owner; const ownerPlayers = roster.filter(p => p.owner === owner).sort((a, b) => (totals.get(b.name)?.total ?? 0) - (totals.get(a.name)?.total ?? 0)); const total = ownerPlayers.reduce((sum, p) => sum + (totals.get(p.name)?.total ?? 0), 0); return <View key={owner} style={x.cardBlock}><TouchableOpacity style={x.row} onPress={() => setExpanded(open ? "" : owner)}><View style={x.avatar}><Text style={x.avatarText}>{owner[0]}</Text></View><View style={x.grow}><Text style={x.ownerDisplayName}>{owner}{owner === currentOwner ? " · You" : ""}</Text><Text style={x.meta}>{ownerPlayers.length} auction players</Text></View><Text style={x.value}>{fmt(total)} pts</Text><Text style={x.chevron}>{open ? "▲" : "▼"}</Text></TouchableOpacity>{open && ownerPlayers.map(player => { const p = totals.get(player.name) ?? { batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 }; return <View key={player.name} style={x.pointRow}><View style={x.pointPlayer}><Text style={x.playerListName}>{player.name}</Text><View style={x.inlineMeta}><IplTeamBadge code={player.team} /><Text style={x.meta}>{player.role} · ₹{player.price}m</Text></View></View><Text style={x.pointCell}>{fmt(p.batting)}</Text><Text style={x.pointCell}>{fmt(p.bowling)}</Text><Text style={x.pointCell}>{fmt(p.fielding)}</Text><Text style={x.pointCell}>{fmt(p.bonus)}</Text><Text style={x.pointTotal}>{fmt(p.total)}</Text></View>; })}</View>; })}</View>;
}

export function ProductionHistory({ leagueId }: { leagueId: string }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [playerOwners, setPlayerOwners] = useState<Record<string, string>>({});
  const [transferPeriods, setTransferPeriods] = useState<any[]>([]);
  const [lineupRules, setLineupRules] = useState<any[]>([]);
  const [expandedMatch, setExpandedMatch] = useState("");
  const [expandedOwner, setExpandedOwner] = useState("");
  const [expandedPlayer, setExpandedPlayer] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      supabase.from("fixtures").select("id,match_number,stage,status,scoring_status,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code),player_match_points(player_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,breakdown,calculation_version,published_at),member_match_scores(lineup_id,total_points,rank,calculation_breakdown),lineup_submissions(id,status,captain_player_id,vice_captain_player_id,impact_player_id,impact_type,member:league_members(id,display_name),lineup_players(slot,player:players(id,full_name,role,team:cricket_teams(code))),lineup_boosters(target_player_id,booster:booster_rules(code,player_multiplier,match_multiplier)))").eq("league_id", leagueId).in("status", ["live", "completed", "abandoned"]).order("match_number", { ascending: false }),
      supabase.from("transfer_events").select("member_id,transfer_count,transfer_period_id,reason,fixture:fixtures(match_number)").eq("league_id", leagueId).eq("reason", "lineup_change"),
      supabase.from("league_transfer_periods").select("id,name,start_match_number,end_match_number,transfer_limit,first_match_free,sort_order").eq("league_id", leagueId).eq("active", true).order("sort_order"),
      supabase.from("league_players").select("player_id,owner:league_members(display_name)").eq("league_id", leagueId).eq("active", true),
      supabase.from("lineup_rule_sets").select("version,effective_from_match_number,captain_multiplier,vice_captain_multiplier,impact_multiplier,other_owner_penalty_percent,other_owner_minimum_penalty").eq("league_id", leagueId).order("effective_from_match_number").order("version"),
    ]).then(([matchResult, transferResult, periodResult, ownershipResult, ruleResult]) => {
      const firstError = matchResult.error ?? transferResult.error ?? periodResult.error ?? ownershipResult.error ?? ruleResult.error;
      if (firstError) { setError(firstError.message); return; }
      setMatches(matchResult.data ?? []);
      setTransfers(transferResult.data ?? []);
      setTransferPeriods(periodResult.data ?? []);
      setLineupRules(ruleResult.data ?? []);
      setPlayerOwners(Object.fromEntries((ownershipResult.data ?? []).map((row: any) => [row.player_id, row.owner?.display_name ?? ""])));
    });
  }, [leagueId]);
  if (error) return <ScrollView contentContainerStyle={x.screen}><Empty text={error} /></ScrollView>;
  return <ScrollView contentContainerStyle={x.screen}>
    <Text style={x.title}>Team History</Text>
    <Text style={x.subtitle}>Started matches and visible locked owner XIs</Text>
    {matches.length ? matches.map(match => {
      const open = expandedMatch === match.id;
      const lineups = [...(match.lineup_submissions ?? [])].sort((a, b) => {
        const scoreA = (match.member_match_scores ?? []).find((score: any) => score.lineup_id === a.id);
        const scoreB = (match.member_match_scores ?? []).find((score: any) => score.lineup_id === b.id);
        return (scoreA?.rank ?? 999) - (scoreB?.rank ?? 999) || (a.member?.display_name ?? "").localeCompare(b.member?.display_name ?? "");
      });
      const matchRule = [...lineupRules].filter(rule => Number(rule.effective_from_match_number ?? 1) <= Number(match.match_number)).sort((a, b) => Number(b.effective_from_match_number ?? 1) - Number(a.effective_from_match_number ?? 1) || Number(b.version) - Number(a.version))[0];
      return <View key={match.id} style={x.cardBlock}>
        <TouchableOpacity style={x.matchHeader} onPress={() => setExpandedMatch(open ? "" : match.id)}>
          <View style={x.grow}><Text style={x.name}>Match {match.match_number}</Text><View style={x.matchTeams}><IplTeamBadge code={match.home?.code} /><Text style={x.vsText}>vs</Text><IplTeamBadge code={match.away?.code} /></View><Text style={x.meta}>{match.status.toUpperCase()} · {match.scoring_status.toUpperCase()} · {lineups.length} visible teams</Text></View>
          <Text style={x.chevron}>{open ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {open ? lineups.length ? lineups.map(lineup => {
          const owner = lineup.member?.display_name ?? "Owner";
          const transferPeriod = transferPeriods.find(period => Number(match.match_number) >= period.start_match_number && Number(match.match_number) <= period.end_match_number);
          const periodLimit = Number(transferPeriod?.transfer_limit ?? 0);
          const ownerPeriodTransfers = transfers.filter(event => event.member_id === lineup.member?.id && event.transfer_period_id === transferPeriod?.id);
          const matchTransfers = ownerPeriodTransfers.filter(event => Number(event.fixture?.match_number) === Number(match.match_number)).reduce((sum, event) => sum + Number(event.transfer_count), 0);
          const usedThroughMatch = ownerPeriodTransfers.filter(event => Number(event.fixture?.match_number) <= Number(match.match_number)).reduce((sum, event) => sum + Number(event.transfer_count), 0);
          const balanceAfterMatch = Math.max(0, periodLimit - usedThroughMatch);
          const score = (match.member_match_scores ?? []).find((item: any) => item.lineup_id === lineup.id);
          const key = `${match.id}:${lineup.id}`;
          const ownerOpen = expandedOwner === key;
          const booster = lineup.lineup_boosters?.[0];
          return <View key={key} style={x.ownerBlock}>
            <TouchableOpacity style={x.row} onPress={() => setExpandedOwner(ownerOpen ? "" : key)}>
              <Text style={x.rank}>{score?.rank ? `#${score.rank}` : "—"}</Text>
              <View style={x.grow}><Text style={x.ownerName}>{owner}{booster?.booster?.code ? ` · ${booster.booster.code}` : ""}</Text><Text style={x.ownerMeta}>{lineup.lineup_players?.length ?? 0} players · {score ? "points published" : "awaiting points"}</Text><View style={x.transferSummary}><Text style={x.transferUsed}>↔ {matchTransfers} transfer{matchTransfers === 1 ? "" : "s"} this match</Text><Text style={x.transferBalance}>{transferPeriod ? `${balanceAfterMatch}/${periodLimit} ${transferPeriod.name}` : "period not configured"}</Text></View></View>
              <Text style={x.value}>{score ? `${fmt(score.total_points)} pts` : lineup.status.toUpperCase()}</Text><Text style={x.chevron}>{ownerOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {ownerOpen ? (lineup.lineup_players ?? []).sort((a: any, b: any) => a.slot - b.slot).map((entry: any) => {
              const player = entry.player;
              const auctionOwner = playerOwners[player.id] ?? "";
              const ownership = !auctionOwner ? "OpenPlayer" : auctionOwner === owner ? "Mine" : `Owned by ${auctionOwner}`;
              const markers = [lineup.captain_player_id === player.id ? "C" : "", lineup.vice_captain_player_id === player.id ? "VC" : "", lineup.impact_player_id === player.id ? lineup.impact_type : "", booster?.target_player_id === player.id ? "3X" : ""].filter(Boolean);
              const playerPoints = [...(match.player_match_points ?? [])].filter((item: any) => item.player_id === player.id && item.published_at).sort((a: any, b: any) => b.calculation_version - a.calculation_version)[0];
              const impactMultiplier = Number(matchRule?.impact_multiplier ?? 1);
              let eligiblePoints = Number(playerPoints?.total_points ?? 0);
              if (lineup.impact_player_id === player.id && lineup.impact_type === "BAI") eligiblePoints = Number(playerPoints?.batting_points ?? 0) * impactMultiplier;
              else if (lineup.impact_player_id === player.id && lineup.impact_type === "BOI") eligiblePoints = Number(playerPoints?.bowling_points ?? 0) * impactMultiplier;
              const markerMultiplier = lineup.captain_player_id === player.id ? Number(matchRule?.captain_multiplier ?? 1) : lineup.vice_captain_player_id === player.id ? Number(matchRule?.vice_captain_multiplier ?? 1) : 1;
              const playerBoosterMultiplier = booster?.target_player_id === player.id && booster?.booster?.code === "3X" ? Number(booster?.booster?.player_multiplier ?? 1) : 1;
              const grossContribution = eligiblePoints * markerMultiplier * playerBoosterMultiplier;
              // Match the published scoring RPC: both OpenPlayers and other-owner players are non-owned.
              const borrowed = auctionOwner !== owner;
              const ownershipDeduction = borrowed && grossContribution > 0 ? Math.max(grossContribution * Number(matchRule?.other_owner_penalty_percent ?? 0) / 100, Number(matchRule?.other_owner_minimum_penalty ?? 0)) : 0;
              const matchMultiplier = booster?.booster?.code === "2UP" ? Number(booster?.booster?.match_multiplier ?? 2) : 1;
              const contribution = (grossContribution - ownershipDeduction) * matchMultiplier;
              const playerKey = `${key}:${player.id}`;
              const playerOpen = expandedPlayer === playerKey;
              return <View key={player.id}><TouchableOpacity style={x.historyPlayer} onPress={() => setExpandedPlayer(playerOpen ? "" : playerKey)}><Text style={x.chevron}>{playerOpen ? "▲" : "▼"}</Text><View style={[x.grow, { marginLeft: 7 }]}><Text style={x.playerName}>{entry.slot}. {player.full_name}</Text><View style={x.playerMetaRow}><IplTeamBadge code={player.team?.code} /><Text style={x.roleText}>{player.role}</Text><Text style={[x.ownershipText, ownership === "Mine" ? x.ownershipMine : ownership === "OpenPlayer" ? x.ownershipOpen : x.ownershipOther]}>{ownership}</Text><Text style={x.baseText}>{playerPoints ? `Base ${fmt(playerPoints.total_points)}` : "Points pending"}</Text></View></View>{playerPoints ? <Text style={x.playerValue}>{fmt(contribution)} pts</Text> : null}{markers.map(marker => <Text key={marker} style={x.marker}>{marker}</Text>)}</TouchableOpacity>{playerOpen && playerPoints ? <View style={x.playerBreakdown}><BreakdownLine label="Batting" value={playerPoints.batting_points} /><BreakdownLine label="Bowling" value={playerPoints.bowling_points} /><BreakdownLine label="Fielding" value={playerPoints.fielding_points} /><BreakdownLine label="Bonus" value={playerPoints.bonus_points} /><BreakdownLine label="Base total" value={playerPoints.total_points} strong />{grossContribution !== Number(playerPoints.total_points) ? <BreakdownLine label="After player multipliers" value={grossContribution} /> : null}{ownershipDeduction > 0 ? <BreakdownLine label="Ownership deduction" value={-ownershipDeduction} /> : null}{matchMultiplier !== 1 ? <BreakdownLine label={`After ${booster?.booster?.code} (${matchMultiplier}×)`} value={contribution} /> : null}<BreakdownLine label="Final player contribution" value={contribution} strong /></View> : null}</View>;
            }) : null}
          </View>;
        }) : <Empty text="No owner lineup is visible for this match." /> : null}
      </View>;
    }) : <Empty text="No matches have started yet." />}
  </ScrollView>;
}
function BreakdownLine({ label, value, strong = false }: { label: string; value: unknown; strong?: boolean }) { return <View style={x.breakdownLine}><Text style={[x.breakdownLabel, strong && x.breakdownStrong]}>{label}</Text><Text style={[x.breakdownValue, strong && x.breakdownStrong]}>{fmt(value)}</Text></View>; }
const x = StyleSheet.create({
  screen: { backgroundColor: "#F4F5EF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 110, minHeight: 750 },
  title: { color: "#10251F", fontSize: 25, fontWeight: "900" }, subtitle: { color: "#718079", fontSize: 12, marginTop: 4, marginBottom: 18 }, section: { color: "#10251F", fontSize: 18, fontWeight: "900", marginTop: 22, marginBottom: 10 },
  hero: { backgroundColor: "#123C31", borderRadius: 22, padding: 20 }, heroLabel: { color: "#9BC1B6", fontSize: 10, fontWeight: "800" }, heroTitle: { color: "white", fontSize: 28, fontWeight: "900", marginTop: 10 }, heroTeams: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }, heroMeta: { color: "#B7CDC6", fontSize: 11, marginTop: 8 }, accent: { color: "#DDFB72", fontSize: 13, fontWeight: "900" }, primary: { backgroundColor: "#DDFB72", borderRadius: 13, padding: 14, alignItems: "center", marginTop: 16 }, primaryText: { color: "#10251F", fontWeight: "900" },
  stats: { flexDirection: "row", gap: 8, marginTop: 12 }, metric: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12 }, metricLabel: { color: "#87938E", fontSize: 8, fontWeight: "900" }, metricValue: { color: "#10251F", fontSize: 17, fontWeight: "900", marginTop: 5 },
  empty: { backgroundColor: "white", borderRadius: 14, padding: 18, alignItems: "center", marginVertical: 8 }, emptyText: { color: "#718079", fontSize: 11, lineHeight: 16, marginTop: 5, textAlign: "center" },
  card: { backgroundColor: "white", borderRadius: 16, overflow: "hidden" }, cardBlock: { backgroundColor: "white", borderRadius: 15, overflow: "hidden", marginBottom: 10 }, row: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#EDF0EA" }, matchHeader: { flexDirection: "row", alignItems: "center", padding: 14 }, matchTeams: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }, vsText: { color: "#718079", fontSize: 8, fontWeight: "900" }, inlineMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }, grow: { flex: 1 }, name: { color: "#173028", fontSize: 11, fontWeight: "900" }, meta: { color: "#7D8B85", fontSize: 8, marginTop: 3 }, value: { color: "#174D3D", fontSize: 11, fontWeight: "900", marginHorizontal: 7 }, chevron: { color: "#61756D", fontSize: 10 }, rank: { width: 34, color: "#5F716A", fontWeight: "900" }, avatar: { width: 31, height: 31, borderRadius: 10, backgroundColor: "#E8F4EF", alignItems: "center", justifyContent: "center", marginRight: 9 }, avatarText: { color: "#174D3D", fontWeight: "900" },
  chips: { gap: 7, paddingBottom: 12 }, chip: { backgroundColor: "#E5ECE8", borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9 }, chipActive: { backgroundColor: "#174D3D" }, chipLabel: { color: "#315047", fontSize: 10, fontWeight: "900" }, chipLabelActive: { color: "#DDFB72" }, chipDetail: { color: "#82918B", fontSize: 7, marginTop: 2 },
  pointHead: { flexDirection: "row", padding: 9, backgroundColor: "#EEF2EF" }, pointRow: { flexDirection: "row", alignItems: "center", padding: 9, borderTopWidth: 1, borderTopColor: "#EDF0EA" }, pointPlayer: { flex: 1.8 }, pointCell: { width: 38, textAlign: "right", color: "#61736C", fontSize: 8 }, pointTotal: { width: 43, textAlign: "right", color: "#173028", fontSize: 9, fontWeight: "900" },
  ownerDisplayName: { color: "#10251F", fontFamily: OWNER_FONT, fontSize: 15, fontWeight: "700", letterSpacing: 0.25 },
  playerListName: { color: "#173028", fontSize: 11, fontWeight: "900" },
  ownerBlock: { borderTopWidth: 1, borderTopColor: "#DCE4DF" }, ownerName: { color: "#10251F", fontFamily: OWNER_FONT, fontSize: 15, fontWeight: "700", letterSpacing: 0.25 }, ownerMeta: { color: "#718079", fontSize: 9, marginTop: 4 }, transferSummary: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }, transferUsed: { color: "#315C50", backgroundColor: "#E4F0EB", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: "800" }, transferBalance: { color: "#6B5B1E", backgroundColor: "#F5EFD2", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: "900" }, historyPlayer: { flexDirection: "row", alignItems: "center", minHeight: 58, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FAFBF8", borderTopWidth: 1, borderTopColor: "#E4EAE6" }, playerName: { color: "#173028", fontSize: 13, lineHeight: 18, fontWeight: "800" }, playerMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }, teamBadge: { overflow: "hidden", borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: "900" }, roleText: { color: "#536B62", backgroundColor: "#E7EEE9", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: "700" }, ownershipText: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: "800" }, ownershipMine: { color: "#285F39", backgroundColor: "#DFF0DD" }, ownershipOpen: { color: "#4E5F58", backgroundColor: "#E7ECE9" }, ownershipOther: { color: "#74463D", backgroundColor: "#F8E6E1" }, baseText: { color: "#7D8B85", fontSize: 9, fontWeight: "600" }, playerValue: { color: "#174D3D", fontSize: 13, fontWeight: "900", marginHorizontal: 8 }, marker: { color: "#173028", backgroundColor: "#DDFB72", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, fontSize: 8, fontWeight: "900" }, playerBreakdown: { backgroundColor: "#F0F4F1", paddingHorizontal: 34, paddingVertical: 8 }, breakdownLine: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#E1E7E3" }, breakdownLabel: { flex: 1, color: "#63756E", fontSize: 9 }, breakdownValue: { color: "#40574F", fontSize: 9 }, breakdownStrong: { color: "#173028", fontWeight: "900" },
});
