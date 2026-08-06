import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { Player } from "./squadData";
import { supabase } from "./supabase";

const OWNER_FONT = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const fmt = (value: unknown) => Math.round(Number(value ?? 0)).toLocaleString("en-US");
const roleLabel: Record<Player["role"], string> = { BA: "Batter", BO: "Bowler", WK: "Wicketkeeper", AL: "All-rounder" };
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
export function SpecialPlayerBadge({ label }: { label?: string }) { return label ? <Text style={[x.specialPlayerBadge, label === "MARQUEE" && x.marqueePlayerBadge]}>{label}</Text> : null; }
function useFixtureSpecialLabels(fixtureIds: string[]) {
  const [labels, setLabels] = useState<Record<string, Record<string, string[]>>>({});
  const key = fixtureIds.join(",");
  useEffect(() => {
    let mounted = true;
    if (!fixtureIds.length) { setLabels({}); return () => { mounted = false; }; }
    Promise.all(fixtureIds.map(async fixtureId => {
      const { data } = await supabase.rpc("special_player_labels_for_fixture", { p_fixture_id: fixtureId });
      const byName = ((data ?? []) as Array<{ full_name: string; label: string }>).reduce((result, row) => ({ ...result, [row.full_name]: [...(result[row.full_name] ?? []), row.label] }), {} as Record<string, string[]>);
      return [fixtureId, byName] as const;
    })).then(rows => { if (mounted) setLabels(Object.fromEntries(rows)); });
    return () => { mounted = false; };
  }, [key]);
  return labels;
}
function useLeagueSpecialLabels(leagueId: string) {
  const [fixtureId, setFixtureId] = useState("");
  useEffect(() => {
    let mounted = true;
    supabase.from("fixtures").select("id").eq("league_id", leagueId).eq("status", "scheduled").order("match_number").limit(1).maybeSingle().then(({ data }) => {
      if (mounted) setFixtureId(data?.id ?? "");
    });
    return () => { mounted = false; };
  }, [leagueId]);
  const labels = useFixtureSpecialLabels(fixtureId ? [fixtureId] : []);
  return fixtureId ? labels[fixtureId] ?? {} : {};
}
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
    supabase.from("league_phases").select("id,code,name,start_match_number,end_match_number,sort_order").eq("league_id", leagueId).eq("active", true).order("sort_order"),
    supabase.from("league_standings").select("member_id,display_name,total_points,matches_scored,rank").eq("league_id", leagueId).order("rank"),
    supabase.from("league_phase_standings").select("phase_id,member_id,phase_code,phase_name,display_name,total_points,matches_scored,rank").eq("league_id", leagueId).order("rank"),
  ]).then(([p, o, r]) => { const e = p.error ?? o.error ?? r.error; if (e) setError(e.message); else { setPhases(p.data ?? []); setOverall(o.data ?? []); setPhaseRows(r.data ?? []); } setLoading(false); }); }, [leagueId]);
  if (loading) return <Loading />;
  if (error) return <Empty text={error} />;
  const rows = selected === "overall" ? overall : phaseRows.filter(row => row.phase_code === selected);
  return <View><Text style={x.section}>League Ranking</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.chips}><Chip active={selected === "overall"} label="Overall" detail="All published" onPress={() => setSelected("overall")} />{phases.map((phase, index) => <Chip key={phase.id ?? `${phase.code}:${index}`} active={selected === phase.code} label={phase.name} detail={`M${phase.start_match_number}–${phase.end_match_number}`} onPress={() => setSelected(phase.code)} />)}</ScrollView>{rows.length ? <View style={x.card}>{rows.map((row, index) => <View key={`${selected}:${row.member_id ?? index}`} style={x.row}><Text style={x.rank}>#{row.rank}</Text><View style={x.avatar}><Text style={x.avatarText}>{row.display_name[0]}</Text></View><View style={x.grow}><Text style={x.ownerDisplayName}>{row.display_name}</Text><Text style={x.meta}>{row.matches_scored} scored matches</Text></View><Text style={x.value}>{fmt(row.total_points)} pts</Text></View>)}</View> : <Empty text="No published match scores in this ranking period." />}</View>;
}

function Chip({ active, label, detail, onPress }: { active: boolean; label: string; detail: string; onPress: () => void }) { return <TouchableOpacity style={[x.chip, active && x.chipActive]} onPress={onPress}><Text style={[x.chipLabel, active && x.chipLabelActive]}>{label}</Text><Text style={[x.chipDetail, active && x.chipLabelActive]}>{detail}</Text></TouchableOpacity>; }

export function ProductionMatches({ leagueId, roster }: { leagueId: string; roster: Player[] }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [royalties, setRoyalties] = useState<any[]>([]);
  const [royaltyMode, setRoyaltyMode] = useState(false);
  const [expanded, setExpanded] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { let cancelled = false; setMatches([]); setRoyalties([]); setRoyaltyMode(false); setError(""); Promise.all([
    supabase.from("fixtures").select("id,match_number,scheduled_start,status,scoring_status,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code),player_match_points(player_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,breakdown,calculation_version,published_at,player:players(full_name))").eq("league_id", leagueId).order("match_number"),
    supabase.from("special_player_score_adjustments").select("fixture_id,player_id,source_member_id,recipient_member_id,adjustment_type,final_player_contribution,rate_percent,minimum_fee,adjustment_points").eq("league_id", leagueId).in("adjustment_type", ["regular_royalty", "marquee_royalty"]),
    supabase.from("special_player_rule_sets").select("marquee_mode_enabled").eq("league_id", leagueId).eq("active", true).maybeSingle(),
  ]).then(([fixtureResult, royaltyResult, ruleResult]) => {
    if (cancelled) return;
    const e = fixtureResult.error ?? royaltyResult.error ?? ruleResult.error;
    if (e) setError(e.message);
    else {
      setMatches(fixtureResult.data ?? []);
      setRoyalties(royaltyResult.data ?? []);
      setRoyaltyMode(ruleResult.data?.marquee_mode_enabled === true);
    }
  }); return () => { cancelled = true; }; }, [leagueId]);
  const specialLabels = useFixtureSpecialLabels(matches.map(match => match.id));
  if (error) return <ScrollView contentContainerStyle={x.screen}><Empty text={error} /></ScrollView>;
  return <ScrollView contentContainerStyle={x.screen}>
    <Text style={x.title}>Fixtures</Text>
    <Text style={x.subtitle}>All fixtures · published points are visible to owners</Text>
    {!matches.length ? <Empty text="No fixtures have been imported for this league." /> : null}
    {matches.map(match => {
      const open = expanded === match.id;
      const latestVersion = Math.max(0, ...(match.player_match_points ?? []).filter((point: any) => point.published_at).map((point: any) => point.calculation_version));
      const points = [...(match.player_match_points ?? [])].filter((point: any) => point.published_at && point.calculation_version === latestVersion).sort((a, b) => {
        const pa = roster.find(p => p.name === a.player?.full_name);
        const pb = roster.find(p => p.name === b.player?.full_name);
        return (pa?.team ?? "").localeCompare(pb?.team ?? "") || Number(b.total_points) - Number(a.total_points);
      });
      const matchRoyalties = royalties.filter(row => row.fixture_id === match.id);
      return <View key={match.id} style={x.cardBlock}>
        <TouchableOpacity style={x.matchHeader} onPress={() => setExpanded(open ? "" : match.id)}>
          <View style={x.grow}><Text style={x.name}>Match {match.match_number}</Text><View style={x.matchTeams}><IplTeamBadge code={match.home?.code} /><Text style={x.vsText}>vs</Text><IplTeamBadge code={match.away?.code} /></View><Text style={x.meta}>{match.status.toUpperCase()} · {match.scoring_status.toUpperCase()}</Text></View>
          <Text style={x.chevron}>{open ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {open ? points.length ? <View>
          <View style={x.pointHead}><Text style={x.pointPlayer}>PLAYER</Text><Text style={x.pointCell}>BAT</Text><Text style={x.pointCell}>BOWL</Text><Text style={x.pointCell}>FLD</Text><Text style={x.pointCell}>BON</Text>{royaltyMode ? <Text style={x.pointCell}>ROY</Text> : null}<Text style={x.pointTotal}>TOTAL</Text></View>
          {points.map(point => {
            const player = roster.find(p => p.name === point.player?.full_name);
            const playerRoyalties = matchRoyalties.filter(row => row.player_id === point.player_id);
            const playerRoyaltyTotal = playerRoyalties.reduce((sum, royalty) => sum + Number(royalty.adjustment_points), 0);
            return <View key={point.player_id ?? point.player?.full_name} style={x.pointRow}><View style={x.pointPlayer}><View style={x.playerLabelRow}><Text style={x.name}>{point.player?.full_name}</Text>{(specialLabels[match.id]?.[point.player?.full_name] ?? []).map(label => <SpecialPlayerBadge key={label} label={label} />)}</View><View style={x.inlineMeta}><IplTeamBadge code={player?.team} /><Text style={x.meta}>{player?.owner === "Available" ? "OpenPlayer" : `Owned by ${player?.owner ?? "—"}`}</Text></View></View><Text style={x.pointCell}>{fmt(point.batting_points)}</Text><Text style={x.pointCell}>{fmt(point.bowling_points)}</Text><Text style={x.pointCell}>{fmt(point.fielding_points)}</Text><Text style={x.pointCell}>{fmt(point.bonus_points)}</Text>{royaltyMode ? <Text style={[x.pointCell, playerRoyaltyTotal > 0 && x.royaltyColumn]}>{fmt(playerRoyaltyTotal)}</Text> : null}<Text style={x.pointTotal}>{fmt(Number(point.total_points) + (royaltyMode ? playerRoyaltyTotal : 0))}</Text></View>;
          })}
        </View> : <Empty text={match.scoring_status === "review" ? "Points are under admin review." : "Points have not been published."} /> : null}
      </View>;
    })}
  </ScrollView>;
}

type SpecialSelectionConfig = { type: "unique" | "marquee"; required: number };
type SpecialSelectionPhase = { id: string; name: string; sort_order: number; is_final_phase: boolean; opensAt: string | null; closesAt: string | null };
export function ProductionSquads({ leagueId, currentOwner, roster, specialSelection }: { leagueId: string; currentOwner: string; roster: Player[]; specialSelection?: SpecialSelectionConfig | null }) {
  const [points, setPoints] = useState<any[]>([]);
  const [royalties, setRoyalties] = useState<any[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(currentOwner);
  const [expandedPlayer, setExpandedPlayer] = useState("");
  const [error, setError] = useState("");
  const leagueSpecialLabels = useLeagueSpecialLabels(leagueId);
  const [specialPhase, setSpecialPhase] = useState<SpecialSelectionPhase | null>(null);
  const [specialSelected, setSpecialSelected] = useState<string[]>([]);
  const [specialPlayerIds, setSpecialPlayerIds] = useState<Record<string, string>>({});
  const [specialBusy, setSpecialBusy] = useState(false);
  const [specialMessage, setSpecialMessage] = useState("");
  useEffect(() => { Promise.all([
    supabase.from("player_match_points").select("fixture_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,calculation_version,published_at,player:players(full_name),fixture:fixtures!inner(league_id)").eq("fixture.league_id", leagueId).not("published_at", "is", null),
    supabase.from("special_player_score_adjustments").select("fixture_id,player_id,source_member_id,recipient_member_id,adjustment_type,final_player_contribution,rate_percent,minimum_fee,adjustment_points,player:players(full_name)").eq("league_id", leagueId).in("adjustment_type", ["regular_royalty", "marquee_royalty"]),
    supabase.from("league_members").select("id,display_name").eq("league_id", leagueId),
  ]).then(([pointResult, royaltyResult, memberResult]) => {
    const e = pointResult.error ?? royaltyResult.error ?? memberResult.error;
    if (e) setError(e.message);
    else {
      setPoints(pointResult.data ?? []);
      setRoyalties(royaltyResult.data ?? []);
      setMemberNames(Object.fromEntries((memberResult.data ?? []).map((member: any) => [member.id, member.display_name])));
    }
  }); }, [leagueId]);
  useEffect(() => {
    let mounted = true;
    setSpecialPhase(null); setSpecialSelected([]); setSpecialPlayerIds({}); setSpecialMessage("");
    if (!specialSelection) return () => { mounted = false; };
    const load = async () => {
      setSpecialBusy(true);
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const { data: member, error: memberError } = userId ? await supabase.from("league_members").select("id").eq("league_id", leagueId).eq("user_id", userId).eq("status", "active").maybeSingle() : { data: null, error: null };
      if (!mounted) return;
      if (!member) { setSpecialMessage(memberError?.message ?? "Active owner membership is required."); setSpecialBusy(false); return; }
      const [phaseResult, playerResult, selectionResult] = await Promise.all([
        supabase.from("league_phases").select("id,name,sort_order,is_final_phase").eq("league_id", leagueId).eq("active", true).order("sort_order"),
        supabase.from("league_players").select("player_id,player:players(full_name)").eq("league_id", leagueId).eq("owner_member_id", member.id).eq("active", true),
        supabase.from("phase_special_players").select("phase_id,player_id").eq("league_id", leagueId).eq("member_id", member.id).eq("selection_type", specialSelection.type),
      ]);
      const loadError = phaseResult.error ?? playerResult.error ?? selectionResult.error;
      if (loadError) { setSpecialMessage(loadError.message); setSpecialBusy(false); return; }
      const phases = await Promise.all(((phaseResult.data ?? []) as any[]).map(async phase => {
        const [opens, closes] = await Promise.all([
          supabase.rpc("phase_special_selection_opens_at", { p_phase_id: phase.id }),
          supabase.rpc("phase_special_selection_deadline", { p_phase_id: phase.id }),
        ]);
        return { ...phase, opensAt: opens.data as string | null, closesAt: closes.data as string | null } as SpecialSelectionPhase;
      }));
      if (!mounted) return;
      const now = Date.now();
      const target = phases.find(phase => !phase.is_final_phase && (!phase.opensAt || new Date(phase.opensAt).getTime() <= now) && !!phase.closesAt && now < new Date(phase.closesAt).getTime()) ?? null;
      const explicit = (selectionResult.data ?? []) as Array<{ phase_id: string; player_id: string }>;
      const targetOrder = target?.sort_order ?? -1;
      const sourcePhase = [...phases].filter(phase => phase.sort_order <= targetOrder && explicit.some(row => row.phase_id === phase.id)).sort((a, b) => b.sort_order - a.sort_order)[0];
      setSpecialPhase(target);
      setSpecialSelected(sourcePhase ? explicit.filter(row => row.phase_id === sourcePhase.id).map(row => row.player_id) : []);
      setSpecialPlayerIds(Object.fromEntries(((playerResult.data ?? []) as any[]).map(row => [row.player?.full_name, row.player_id])));
      setSpecialBusy(false);
    };
    load();
    return () => { mounted = false; };
  }, [leagueId, specialSelection?.type, specialSelection?.required]);
  const toggleSpecial = (playerId: string) => {
    if (!specialPhase || specialBusy || !specialSelection) return;
    setSpecialMessage("");
    setSpecialSelected(current => current.includes(playerId) ? current.filter(id => id !== playerId) : current.length < specialSelection.required ? [...current, playerId] : current);
  };
  const saveSpecial = async () => {
    if (!specialPhase || !specialSelection || specialSelected.length !== specialSelection.required) return;
    setSpecialBusy(true); setSpecialMessage("");
    const { error: saveError } = await supabase.rpc("set_phase_special_players", { p_phase_id: specialPhase.id, p_selection_type: specialSelection.type, p_player_ids: specialSelected });
    setSpecialBusy(false);
    setSpecialMessage(saveError ? saveError.message : `Saved ${specialSelection.required} ${specialSelection.type === "unique" ? "Unique" : "Marquee"} Players for ${specialPhase.name}.`);
  };
  const totals = useMemo(() => { const latest = new Map<string, any>(); for (const row of points) { const key = `${row.fixture_id}:${row.player?.full_name}`; if (!latest.has(key) || latest.get(key).calculation_version < row.calculation_version) latest.set(key, row); } const map = new Map<string, any>(); for (const row of latest.values()) { const name = row.player?.full_name; const current = map.get(name) ?? { matches: 0, batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 }; map.set(name, { matches: current.matches + 1, batting: current.batting + Number(row.batting_points), bowling: current.bowling + Number(row.bowling_points), fielding: current.fielding + Number(row.fielding_points), bonus: current.bonus + Number(row.bonus_points), total: current.total + Number(row.total_points) }); } return map; }, [points]);
  const royaltyTotals = useMemo(() => { const map = new Map<string, { total: number; rows: any[] }>(); for (const row of royalties) { const owner = memberNames[row.recipient_member_id]; const name = row.player?.full_name; if (!owner || !name) continue; const key = `${owner}:${name}`; const current = map.get(key) ?? { total: 0, rows: [] }; map.set(key, { total: current.total + Number(row.adjustment_points), rows: [...current.rows, row] }); } return map; }, [royalties, memberNames]);
  if (error) return <Empty text={error} />;
  const owners = Array.from(new Set(roster.filter(p => p.owner !== "Available").map(p => p.owner))).sort((a, b) => a === currentOwner ? -1 : b === currentOwner ? 1 : a.localeCompare(b));
  const royaltyMode = specialSelection?.type === "marquee";
  return <View>
<Text style={x.section}>Owner Squads</Text>
<Text style={x.subtitle}>Auction squads with player points and royalty earned</Text>{owners.map(owner => { const open = expanded === owner; const isCurrentOwner = owner === currentOwner; const ownerPlayers = roster.filter(p => p.owner === owner).sort((a, b) => (totals.get(b.name)?.total ?? 0) - (totals.get(a.name)?.total ?? 0)); const baseTotal = ownerPlayers.reduce((sum, p) => sum + (totals.get(p.name)?.total ?? 0), 0); const royaltyTotal = ownerPlayers.reduce((sum, p) => sum + (royaltyTotals.get(`${owner}:${p.name}`)?.total ?? 0), 0); const total = baseTotal + royaltyTotal; return <View key={owner} style={x.cardBlock}>
<TouchableOpacity style={x.row} onPress={() => setExpanded(open ? "" : owner)}>
<View style={x.avatar}>
<Text style={x.avatarText}>{owner[0]}</Text>
</View>
<View style={x.grow}>
<Text style={x.ownerDisplayName}>{owner}{isCurrentOwner ? " · You" : ""}</Text>
<Text style={x.meta}>{ownerPlayers.length} auction players{royaltyTotal > 0 ? ` · Royalty +${fmt(royaltyTotal)}` : ""}</Text>
</View>
<Text style={x.value}>{fmt(total)} pts</Text>
<Text style={x.chevron}>{open ? "▲" : "▼"}</Text>
</TouchableOpacity>{open && isCurrentOwner && specialSelection ? <View style={x.specialSelectionBanner}>
<Text style={x.specialSelectionTitle}>{specialPhase ? `${specialPhase.name} ${specialSelection.type === "unique" ? "Unique" : "Marquee"} Players` : "Special-player selection"}</Text>
<Text style={x.specialSelectionText}>{specialBusy ? "Loading selection…" : specialPhase ? `Select ${specialSelection.required} below · ${specialSelected.length}/${specialSelection.required} selected · closes ${new Date(specialPhase.closesAt!).toLocaleString()}` : "No selection window is currently open. The next phase opens only after the current phase starts; playoffs carry forward."}</Text>
</View> : null}{open ? <View style={x.pointHead}><Text style={x.pointPlayer}>PLAYER</Text><Text style={x.pointCell}>BAT</Text><Text style={x.pointCell}>BOWL</Text><Text style={x.pointCell}>FLD</Text><Text style={x.pointCell}>BON</Text>{royaltyMode ? <Text style={x.pointCell}>ROY</Text> : null}<Text style={x.pointTotal}>TOTAL</Text></View> : null}{open && ownerPlayers.map(player => { const p = totals.get(player.name) ?? { matches: 0, batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 }; const royalty = royaltyTotals.get(`${owner}:${player.name}`) ?? { total: 0, rows: [] }; const playerKey = `${owner}:${player.team}:${player.name}`; const playerOpen = expandedPlayer === playerKey; const specialPlayerId = specialPlayerIds[player.name]; const specialChecked = !!specialPlayerId && specialSelected.includes(specialPlayerId); return <View key={player.name}>
<TouchableOpacity style={x.pointRow} onPress={() => setExpandedPlayer(playerOpen ? "" : playerKey)}>
<View style={x.pointPlayer}>
<View style={x.ownerPlayerNameRow}>
<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={x.playerListName}>{player.name}</Text>{(leagueSpecialLabels[player.name] ?? []).map((label: string) => <SpecialPlayerBadge key={label} label={label} />)}<Text style={x.ownerPlayerChevron}>{playerOpen ? "▲" : "▼"}</Text>{isCurrentOwner && specialSelection && specialPhase && specialPlayerId ? <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: specialChecked }} style={[x.specialCheckbox, specialChecked && x.specialCheckboxChecked]} onPress={() => toggleSpecial(specialPlayerId)}>
<Text style={x.specialCheckboxText}>{specialChecked ? "✓" : ""}</Text>
</TouchableOpacity> : null}</View>
<View style={x.ownerPlayerTeamRole}>
<IplTeamBadge code={player.team} />
<Text style={x.ownerPlayerRole}>{roleLabel[player.role]}</Text></View>
<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={x.ownerPlayerCosts}>Selection ₹{player.price}m  ·  Bid {player.bidPrice == null ? "—" : `₹${player.bidPrice}m`}</Text>
</View>
<Text style={x.pointCell}>{fmt(p.batting)}</Text>
<Text style={x.pointCell}>{fmt(p.bowling)}</Text>
<Text style={x.pointCell}>{fmt(p.fielding)}</Text>
<Text style={x.pointCell}>{fmt(p.bonus)}</Text>
{royaltyMode ? <Text style={[x.pointCell, royalty.total > 0 && x.royaltyColumn]}>{fmt(royalty.total)}</Text> : null}
<Text style={x.pointTotal}>{fmt(p.total + (royaltyMode ? royalty.total : 0))}</Text>
</TouchableOpacity>{playerOpen ? <View style={x.ownerPlayerBreakdown}>
<BreakdownLine label="Scored matches" value={p.matches} />
<BreakdownLine label="Batting" value={p.batting} />
<BreakdownLine label="Bowling" value={p.bowling} />
<BreakdownLine label="Fielding" value={p.fielding} />
<BreakdownLine label="Bonus" value={p.bonus} />
{royaltyMode ? <BreakdownLine label="Royalty earned" value={royalty.total} /> : null}
<BreakdownLine label="Total points" value={p.total + (royaltyMode ? royalty.total : 0)} strong />
</View> : null}</View>; })}{open && isCurrentOwner && specialSelection && specialPhase ? <View style={x.specialSelectionActions}>
<TouchableOpacity disabled={specialBusy || specialSelected.length !== specialSelection.required} style={[x.primary, (specialBusy || specialSelected.length !== specialSelection.required) && { opacity: 0.45 }]} onPress={saveSpecial}>
<Text style={x.primaryText}>Save {specialSelected.length}/{specialSelection.required} for {specialPhase.name}</Text>
</TouchableOpacity>{specialMessage ? <Text style={x.specialSelectionMessage}>{specialMessage}</Text> : null}</View> : specialMessage && open && isCurrentOwner ? <Text style={x.specialSelectionMessage}>{specialMessage}</Text> : null}</View>; })}</View>;
}

type LeagueSquadPlayer = Player & { leaguePlayerId: string; playerId: string; active: boolean; bidPrice: number | null; ownerId: string };
type LeagueSquadOwner = { id: string; display_name: string };
export function ProductionPlayerSquad({ leagueId, canEdit, onAvailabilityChanged }: { leagueId: string; canEdit: boolean; onAvailabilityChanged: () => void }) {
  const [expandedTeams, setExpandedTeams] = useState<string[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState("");
  const [pointRows, setPointRows] = useState<any[]>([]);
  const [royaltyRows, setRoyaltyRows] = useState<any[]>([]);
  const [royaltyMode, setRoyaltyMode] = useState(false);
  const [squadPlayers, setSquadPlayers] = useState<LeagueSquadPlayer[]>([]);
  const [pointsError, setPointsError] = useState("");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [owners, setOwners] = useState<LeagueSquadOwner[]>([]);
  const [addingTeam, setAddingTeam] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRole, setNewPlayerRole] = useState<Player["role"]>("BA");
  const [newPlayerCost, setNewPlayerCost] = useState("0");
  const [newPlayerOwnerId, setNewPlayerOwnerId] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Player["role"]>("BA");
  const [editCost, setEditCost] = useState("0");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editBusy, setEditBusy] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const leagueSpecialLabels = useLeagueSpecialLabels(leagueId);
  const teams = useMemo(() => Array.from(new Set(squadPlayers.map(player => player.team))).sort((a, b) => a.localeCompare(b)), [squadPlayers]);
  useEffect(() => {
    let cancelled = false;
    setPointRows([]);
    setRoyaltyRows([]);
    setRoyaltyMode(false);
    setSquadPlayers([]);
    setOwners([]);
    setPointsError("");
    setAvailabilityMessage("");
    setExpandedPlayer("");
    Promise.all([
      supabase.from("player_match_points").select("fixture_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,calculation_version,published_at,player:players(full_name,team:cricket_teams(code)),fixture:fixtures!inner(league_id)").eq("fixture.league_id", leagueId).not("published_at", "is", null),
      supabase.from("league_players").select("id,player_id,active,acquisition_price,bid_price,owner:league_members(id,display_name),player:players(full_name,role,team:cricket_teams(code))").eq("league_id", leagueId),
      supabase.from("league_members").select("id,display_name").eq("league_id", leagueId).eq("status", "active").in("role", ["owner", "league_admin"]).order("display_name"),
      supabase.from("special_player_score_adjustments").select("player_id,adjustment_points,adjustment_type").eq("league_id", leagueId).in("adjustment_type", ["regular_royalty", "marquee_royalty"]),
      supabase.from("special_player_rule_sets").select("marquee_mode_enabled").eq("league_id", leagueId).eq("active", true).maybeSingle(),
    ]).then(([pointsResult, squadResult, ownerResult, royaltyResult, ruleResult]) => {
        if (cancelled) return;
        const error = pointsResult.error ?? squadResult.error ?? ownerResult.error ?? royaltyResult.error ?? ruleResult.error;
        if (error) setPointsError(error.message);
        else {
          setPointRows(pointsResult.data ?? []);
          setRoyaltyRows(royaltyResult.data ?? []);
          setRoyaltyMode(ruleResult.data?.marquee_mode_enabled === true);
          setSquadPlayers((squadResult.data as any[] ?? []).map(row => ({ leaguePlayerId: row.id, playerId: row.player_id, active: row.active, name: row.player.full_name, team: row.player.team?.code ?? "—", role: row.player.role as Player["role"], price: Number(row.acquisition_price), bidPrice: row.bid_price == null ? null : Number(row.bid_price), ownerId: row.owner?.id ?? "", owner: row.owner?.display_name ?? "Available" })).sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)));
          setOwners((ownerResult.data ?? []) as LeagueSquadOwner[]);
        }
      });
    return () => { cancelled = true; };
  }, [leagueId, loadVersion]);
  const playerTotals = useMemo(() => {
    const latest = new Map<string, any>();
    for (const row of pointRows) {
      const playerKey = `${row.player?.team?.code ?? ""}:${row.player?.full_name ?? ""}`;
      const matchKey = `${row.fixture_id}:${playerKey}`;
      if (!latest.has(matchKey) || Number(latest.get(matchKey).calculation_version) < Number(row.calculation_version)) latest.set(matchKey, row);
    }
    const totals = new Map<string, { matches: number; batting: number; bowling: number; fielding: number; bonus: number; total: number }>();
    for (const row of latest.values()) {
      const key = `${row.player?.team?.code ?? ""}:${row.player?.full_name ?? ""}`;
      const current = totals.get(key) ?? { matches: 0, batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 };
      totals.set(key, {
        matches: current.matches + 1,
        batting: current.batting + Number(row.batting_points ?? 0),
        bowling: current.bowling + Number(row.bowling_points ?? 0),
        fielding: current.fielding + Number(row.fielding_points ?? 0),
        bonus: current.bonus + Number(row.bonus_points ?? 0),
        total: current.total + Number(row.total_points ?? 0),
      });
    }
    return totals;
  }, [pointRows]);
  const playerRoyaltyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    if (!royaltyMode) return totals;
    for (const row of royaltyRows) totals.set(row.player_id, (totals.get(row.player_id) ?? 0) + Number(row.adjustment_points ?? 0));
    return totals;
  }, [royaltyRows, royaltyMode]);
  const toggleTeam = (team: string) => setExpandedTeams(current => current.includes(team) ? current.filter(code => code !== team) : [...current, team]);
  const allExpanded = teams.length > 0 && expandedTeams.length === teams.length;
  const openEditPlayer = (player: LeagueSquadPlayer) => {
    if (editingPlayerId === player.leaguePlayerId) { setEditingPlayerId(""); return; }
    setEditingPlayerId(player.leaguePlayerId);
    setEditName(player.name); setEditRole(player.role); setEditCost(String(player.price)); setEditOwnerId(player.ownerId); setEditActive(player.active); setAvailabilityMessage("");
  };
  const savePlayer = async (player: LeagueSquadPlayer) => {
    const cost = Number(editCost);
    if (!editName.trim()) { setAvailabilityMessage("Player name is required."); return; }
    if (!Number.isFinite(cost) || cost < 0) { setAvailabilityMessage("Selection cost must be zero or greater."); return; }
    setEditBusy(true); setAvailabilityMessage("");
    const { error } = await supabase.rpc("edit_league_player", { p_league_player_id: player.leaguePlayerId, p_full_name: editName.trim(), p_role: editRole, p_selection_cost: cost, p_owner_member_id: editOwnerId || null, p_active: editActive });
    setEditBusy(false);
    if (error) { setAvailabilityMessage(error.message); Alert.alert("Edit player", error.message); return; }
    setEditingPlayerId("");
    setAvailabilityMessage(`${editName.trim()} updated. Auction bid price was preserved.`);
    setLoadVersion(version => version + 1);
    onAvailabilityChanged();
  };
  const openAddPlayer = (team: string) => {
    setAddingTeam(team);
    setExpandedTeams(current => current.includes(team) ? current : [...current, team]);
    setNewPlayerName(""); setNewPlayerRole("BA"); setNewPlayerCost("0"); setNewPlayerOwnerId(""); setAvailabilityMessage("");
  };
  const addReplacementPlayer = async () => {
    const cost = Number(newPlayerCost);
    if (!newPlayerName.trim()) { setAvailabilityMessage("Player name is required."); return; }
    if (!Number.isFinite(cost) || cost < 0) { setAvailabilityMessage("Selection cost must be zero or greater."); return; }
    setAddBusy(true); setAvailabilityMessage("");
    const { error } = await supabase.rpc("add_league_replacement_player", { p_league_id: leagueId, p_team_code: addingTeam, p_full_name: newPlayerName.trim(), p_role: newPlayerRole, p_selection_cost: cost, p_owner_member_id: newPlayerOwnerId || null });
    setAddBusy(false);
    if (error) { setAvailabilityMessage(error.message); Alert.alert("Add player", error.message); return; }
    const addedName = newPlayerName.trim();
    setAddingTeam(""); setNewPlayerName(""); setNewPlayerOwnerId("");
    setAvailabilityMessage(`${addedName} added to ${addingTeam}.`);
    setLoadVersion(version => version + 1);
    onAvailabilityChanged();
  };
  return <View>
    <View style={x.squadTitleRow}><View style={x.grow}><Text style={x.section}>IPL Squad</Text><Text style={x.subtitle}>{squadPlayers.filter(player => player.active).length} active · {squadPlayers.filter(player => !player.active).length} inactive</Text></View>{teams.length ? <TouchableOpacity style={x.squadToggle} onPress={() => setExpandedTeams(allExpanded ? [] : teams)}><Text style={x.squadToggleText}>{allExpanded ? "Collapse all" : "Expand all"}</Text></TouchableOpacity> : null}</View>
    {availabilityMessage ? <View style={x.squadAvailabilityMessage}><Text style={x.squadAvailabilityMessageText}>{availabilityMessage}</Text></View> : null}
    {pointsError ? <View style={x.squadPointsWarning}><Text style={x.squadPointsWarningText}>Points unavailable: {pointsError}</Text></View> : null}
    {!squadPlayers.length ? <Empty text="No squad players have been imported for this league." /> : teams.map(team => {
      const teamPlayers = squadPlayers.filter(player => player.team === team).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
      const collapsed = !expandedTeams.includes(team);
      const colors = teamBadge(team);
      return <View key={team} style={x.squadTeamCard}>
        <View style={[x.squadTeamHeader, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${team} squad`} style={x.squadTeamHeaderMain} onPress={() => toggleTeam(team)}>
            <Text style={[x.squadTeamCode, { color: colors.color }]}>{team}</Text>
            <Text style={[x.squadTeamSummary, { color: colors.color }]}>{teamPlayers.filter(p => p.active).length}/{teamPlayers.length} active · {teamPlayers.filter(p => p.role === "BA").length} BA · {teamPlayers.filter(p => p.role === "WK").length} WK · {teamPlayers.filter(p => p.role === "AL").length} AL · {teamPlayers.filter(p => p.role === "BO").length} BO</Text>
            <Text style={[x.squadTeamChevron, { color: colors.color }]}>{collapsed ? "▼" : "▲"}</Text>
          </TouchableOpacity>
          {canEdit ? <TouchableOpacity style={[x.squadAddPlayerButton, { borderColor: colors.color }]} onPress={() => addingTeam === team ? setAddingTeam("") : openAddPlayer(team)}><Text style={[x.squadAddPlayerButtonText, { color: colors.color }]}>{addingTeam === team ? "Cancel" : "+ Add"}</Text></TouchableOpacity> : null}
        </View>
        {addingTeam === team ? <View style={x.squadAddForm}>
          <Text style={x.squadAddFormTitle}>Add replacement to {team}</Text>
          <TextInput style={x.squadAddInput} value={newPlayerName} onChangeText={setNewPlayerName} placeholder="Player name" placeholderTextColor="#8B9893" />
          <View style={x.squadAddRoles}>{(["BA", "WK", "AL", "BO"] as Player["role"][]).map(role => <TouchableOpacity key={role} style={[x.squadAddRole, newPlayerRole === role && x.squadAddRoleActive]} onPress={() => setNewPlayerRole(role)}><Text style={[x.squadAddRoleText, newPlayerRole === role && x.squadAddRoleTextActive]}>{roleLabel[role]}</Text></TouchableOpacity>)}</View>
          <Text style={x.squadAddLabel}>Selection cost (₹m)</Text>
          <TextInput style={x.squadAddInput} value={newPlayerCost} onChangeText={setNewPlayerCost} keyboardType="decimal-pad" placeholder="Selection cost (₹m)" placeholderTextColor="#8B9893" />
          <Text style={x.squadAddLabel}>Assign to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.squadOwnerChoices}><TouchableOpacity style={[x.squadOwnerChoice, !newPlayerOwnerId && x.squadOwnerChoiceActive]} onPress={() => setNewPlayerOwnerId("")}><Text style={[x.squadOwnerChoiceText, !newPlayerOwnerId && x.squadOwnerChoiceTextActive]}>OpenPlayer</Text></TouchableOpacity>{owners.map(owner => <TouchableOpacity key={owner.id} style={[x.squadOwnerChoice, newPlayerOwnerId === owner.id && x.squadOwnerChoiceActive]} onPress={() => setNewPlayerOwnerId(owner.id)}><Text style={[x.squadOwnerChoiceText, newPlayerOwnerId === owner.id && x.squadOwnerChoiceTextActive]}>{owner.display_name}</Text></TouchableOpacity>)}</ScrollView>
          <TouchableOpacity disabled={addBusy} style={[x.squadAddSubmit, addBusy && { opacity: 0.6 }]} onPress={addReplacementPlayer}>{addBusy ? <ActivityIndicator color="#10251F" /> : <Text style={x.squadAddSubmitText}>Add player</Text>}</TouchableOpacity>
        </View> : null}
        {!collapsed ? teamPlayers.map(player => {
          const playerKey = `${team}:${player.name}`;
          const points = playerTotals.get(playerKey);
          const royalty = playerRoyaltyTotals.get(player.playerId) ?? 0;
          const playerOpen = expandedPlayer === playerKey;
          return <View key={playerKey}>
            <View style={[x.squadPlayerRow, !player.active && x.squadPlayerRowInactive]}>
              <TouchableOpacity disabled={!points} style={x.squadPlayerMain} onPress={() => setExpandedPlayer(playerOpen ? "" : playerKey)}>
                <View style={x.grow}><View style={x.squadPlayerNameRow}><Text style={[x.squadPlayerName, !player.active && x.squadPlayerNameInactive]}>{player.name}</Text>{(leagueSpecialLabels[player.name] ?? []).map((label: string) => <SpecialPlayerBadge key={label} label={label} />)}<Text style={x.squadSelectionCost}>₹{player.price.toFixed(1)}m</Text></View><Text style={x.squadPlayerOwner}>{`${!player.active ? "Inactive · " : ""}${player.owner === "Available" ? "OpenPlayer" : `Owned by ${player.owner} [Bid ${player.bidPrice == null ? "—" : `₹${player.bidPrice.toFixed(1)}m`}]`}`}</Text></View>
                <Text style={x.roleText}>{roleLabel[player.role]}</Text>
                {points ? <><View style={x.squadScoreBlock}>{royaltyMode && royalty > 0 ? <Text style={x.squadRoyaltyPoints}>ROY {fmt(royalty)}</Text> : null}<Text style={x.squadPlayerPoints}>{fmt(points.total + royalty)} pts</Text></View><Text style={x.squadPlayerChevron}>{playerOpen ? "▲" : "▼"}</Text></> : <Text style={[x.squadPointsPending, royaltyMode && royalty > 0 && x.royaltyColumn]}>{royaltyMode && royalty > 0 ? `ROY ${fmt(royalty)}` : "0 pts"}</Text>}
              </TouchableOpacity>
              {canEdit ? <TouchableOpacity style={x.squadEditButton} onPress={() => openEditPlayer(player)}><Text style={x.squadEditButtonText}>{editingPlayerId === player.leaguePlayerId ? "Cancel" : "Edit"}</Text></TouchableOpacity> : null}
            </View>
            {editingPlayerId === player.leaguePlayerId ? <View style={x.squadEditForm}>
              <Text style={x.squadAddFormTitle}>Edit {player.name}</Text>
              <Text style={x.squadAddLabel}>Player name</Text>
              <TextInput style={x.squadAddInput} value={editName} onChangeText={setEditName} placeholder="Player name" placeholderTextColor="#8B9893" />
              <Text style={x.squadAddLabel}>Role</Text>
              <View style={x.squadAddRoles}>{(["BA", "WK", "AL", "BO"] as Player["role"][]).map(role => <TouchableOpacity key={role} style={[x.squadAddRole, editRole === role && x.squadAddRoleActive]} onPress={() => setEditRole(role)}><Text style={[x.squadAddRoleText, editRole === role && x.squadAddRoleTextActive]}>{roleLabel[role]}</Text></TouchableOpacity>)}</View>
              <Text style={x.squadAddLabel}>Selection cost (₹m)</Text>
              <TextInput style={x.squadAddInput} value={editCost} onChangeText={setEditCost} keyboardType="decimal-pad" placeholder="Selection cost (₹m)" placeholderTextColor="#8B9893" />
              <Text style={x.squadAddLabel}>Assigned owner</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.squadOwnerChoices}><TouchableOpacity style={[x.squadOwnerChoice, !editOwnerId && x.squadOwnerChoiceActive]} onPress={() => setEditOwnerId("")}><Text style={[x.squadOwnerChoiceText, !editOwnerId && x.squadOwnerChoiceTextActive]}>OpenPlayer</Text></TouchableOpacity>{owners.map(owner => <TouchableOpacity key={owner.id} style={[x.squadOwnerChoice, editOwnerId === owner.id && x.squadOwnerChoiceActive]} onPress={() => setEditOwnerId(owner.id)}><Text style={[x.squadOwnerChoiceText, editOwnerId === owner.id && x.squadOwnerChoiceTextActive]}>{owner.display_name}</Text></TouchableOpacity>)}</ScrollView>
              <Text style={x.squadAddLabel}>Availability</Text>
              <View style={x.squadEditAvailability}><TouchableOpacity style={[x.squadEditStatus, editActive && x.squadEditStatusActive]} onPress={() => setEditActive(true)}><Text style={[x.squadEditStatusText, editActive && x.squadEditStatusTextActive]}>Active</Text></TouchableOpacity><TouchableOpacity style={[x.squadEditStatus, !editActive && x.squadEditStatusInactive]} onPress={() => setEditActive(false)}><Text style={[x.squadEditStatusText, !editActive && x.squadEditStatusTextInactive]}>Deactivate</Text></TouchableOpacity></View>
              <Text style={x.squadEditBidNote}>Completed bid: {player.bidPrice == null ? "—" : `₹${player.bidPrice.toFixed(1)}m`} · read-only</Text>
              <TouchableOpacity disabled={editBusy} style={[x.squadAddSubmit, editBusy && { opacity: 0.6 }]} onPress={() => savePlayer(player)}>{editBusy ? <ActivityIndicator color="#10251F" /> : <Text style={x.squadAddSubmitText}>Save changes</Text>}</TouchableOpacity>
            </View> : null}
            {playerOpen && points ? <View style={x.squadPointsBreakdown}>
              <BreakdownLine label="Scored matches" value={points.matches} />
              <BreakdownLine label="Batting" value={points.batting} />
              <BreakdownLine label="Bowling" value={points.bowling} />
              <BreakdownLine label="Fielding" value={points.fielding} />
              <BreakdownLine label="Bonus" value={points.bonus} />
              {royaltyMode ? <BreakdownLine label="Royalty earned" value={royalty} /> : null}
              <BreakdownLine label="Total points" value={points.total + royalty} strong />
            </View> : null}
          </View>;
        }) : null}
      </View>;
    })}
  </View>;
}

export function ProductionHistory({ leagueId }: { leagueId: string }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [playerOwners, setPlayerOwners] = useState<Record<string, string>>({});
  const [transferPeriods, setTransferPeriods] = useState<any[]>([]);
  const [lineupRules, setLineupRules] = useState<any[]>([]);
  const [specialRules, setSpecialRules] = useState<any[]>([]);
  const [leagueFormat, setLeagueFormat] = useState({ ownership_enabled: true, other_owner_deductions_enabled: true });
  const [expandedMatch, setExpandedMatch] = useState("");
  const [expandedOwner, setExpandedOwner] = useState("");
  const [expandedPlayer, setExpandedPlayer] = useState("");
  const [error, setError] = useState("");
  const specialLabels = useFixtureSpecialLabels(matches.map(match => match.id));
  useEffect(() => {
    Promise.all([
      supabase.from("fixtures").select("id,match_number,stage,status,scoring_status,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code),player_match_points(player_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,breakdown,calculation_version,published_at),member_match_scores(lineup_id,total_points,rank,calculation_breakdown),lineup_submissions(id,status,captain_player_id,vice_captain_player_id,impact_player_id,impact_type,member:league_members(id,display_name),lineup_players(slot,player:players(id,full_name,role,team:cricket_teams(code))),lineup_boosters(target_player_id,booster:booster_rules(code,player_multiplier,match_multiplier)))").eq("league_id", leagueId).order("match_number", { ascending: false }),
      supabase.from("transfer_events").select("member_id,transfer_count,transfer_period_id,reason,fixture:fixtures(match_number)").eq("league_id", leagueId).eq("reason", "lineup_change"),
      supabase.from("league_transfer_periods").select("id,name,start_match_number,end_match_number,transfer_limit,first_match_free,sort_order").eq("league_id", leagueId).eq("active", true).order("sort_order"),
      supabase.from("league_players").select("player_id,owner:league_members(display_name)").eq("league_id", leagueId).eq("active", true),
      supabase.from("lineup_rule_sets").select("version,effective_from_match_number,captain_multiplier,vice_captain_multiplier,impact_multiplier,other_owner_penalty_percent,other_owner_minimum_penalty").eq("league_id", leagueId).order("effective_from_match_number").order("version"),
      supabase.from("league_format_configs").select("ownership_enabled,other_owner_deductions_enabled").eq("league_id", leagueId).maybeSingle(),
      supabase.from("special_player_rule_sets").select("version,effective_from_match_number,unique_mode_enabled,marquee_mode_enabled,other_player_fee_percent,other_player_minimum_fee").eq("league_id", leagueId).order("effective_from_match_number").order("version"),
    ]).then(([matchResult, transferResult, periodResult, ownershipResult, ruleResult, formatResult, specialRuleResult]) => {
      const firstError = matchResult.error ?? transferResult.error ?? periodResult.error ?? ownershipResult.error ?? ruleResult.error ?? formatResult.error ?? specialRuleResult.error;
      if (firstError) { setError(firstError.message); return; }
      setMatches((matchResult.data ?? []).filter((match: any) => match.status !== "scheduled" || (match.lineup_submissions?.length ?? 0) > 0));
      setTransfers(transferResult.data ?? []);
      setTransferPeriods(periodResult.data ?? []);
      setLineupRules(ruleResult.data ?? []);
      setSpecialRules(specialRuleResult.data ?? []);
      if (formatResult.data) setLeagueFormat(formatResult.data);
      setPlayerOwners(Object.fromEntries((ownershipResult.data ?? []).map((row: any) => [row.player_id, row.owner?.display_name ?? ""])));
    });
  }, [leagueId]);
  if (error) return <ScrollView contentContainerStyle={x.screen}><Empty text={error} /></ScrollView>;
  return <ScrollView contentContainerStyle={x.screen}>
    <Text style={x.title}>Team History</Text>
    <Text style={x.subtitle}>Your submitted XIs and owner teams visible after lock</Text>
    {matches.length ? matches.map(match => {
      const open = expandedMatch === match.id;
      const lineups = [...(match.lineup_submissions ?? [])].sort((a, b) => {
        const scoreA = (match.member_match_scores ?? []).find((score: any) => score.lineup_id === a.id);
        const scoreB = (match.member_match_scores ?? []).find((score: any) => score.lineup_id === b.id);
        return (scoreA?.rank ?? 999) - (scoreB?.rank ?? 999) || (a.member?.display_name ?? "").localeCompare(b.member?.display_name ?? "");
      });
      const matchRule = [...lineupRules].filter(rule => Number(rule.effective_from_match_number ?? 1) <= Number(match.match_number)).sort((a, b) => Number(b.effective_from_match_number ?? 1) - Number(a.effective_from_match_number ?? 1) || Number(b.version) - Number(a.version))[0];
      const matchSpecialRule = [...specialRules].filter(rule => Number(rule.effective_from_match_number ?? 1) <= Number(match.match_number)).sort((a, b) => Number(b.effective_from_match_number ?? 1) - Number(a.effective_from_match_number ?? 1) || Number(b.version) - Number(a.version))[0];
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
              const ownership = !leagueFormat.ownership_enabled || !auctionOwner ? "OpenPlayer" : auctionOwner === owner ? "Mine" : `Owned by ${auctionOwner}`;
              const markers = [lineup.captain_player_id === player.id ? "C" : "", lineup.vice_captain_player_id === player.id ? "VC" : "", lineup.impact_player_id === player.id ? lineup.impact_type : "", booster?.target_player_id === player.id ? "3X" : ""].filter(Boolean);
              const playerPoints = [...(match.player_match_points ?? [])].filter((item: any) => item.player_id === player.id && item.published_at).sort((a: any, b: any) => b.calculation_version - a.calculation_version)[0];
              const impactMultiplier = Number(matchRule?.impact_multiplier ?? 1);
              let eligiblePoints = Number(playerPoints?.total_points ?? 0);
              if (lineup.impact_player_id === player.id && lineup.impact_type === "BAI") eligiblePoints = Number(playerPoints?.batting_points ?? 0) * impactMultiplier;
              else if (lineup.impact_player_id === player.id && lineup.impact_type === "BOI") eligiblePoints = Number(playerPoints?.bowling_points ?? 0) * impactMultiplier;
              const markerMultiplier = lineup.captain_player_id === player.id ? Number(matchRule?.captain_multiplier ?? 1) : lineup.vice_captain_player_id === player.id ? Number(matchRule?.vice_captain_multiplier ?? 1) : 1;
              const playerBoosterMultiplier = booster?.target_player_id === player.id && booster?.booster?.code === "3X" ? Number(booster?.booster?.player_multiplier ?? 1) : 1;
              const grossContribution = eligiblePoints * markerMultiplier * playerBoosterMultiplier;
              // Match the published scoring RPC: Royalty keeps the borrower's full points;
              // Unique mode uses its configured usage fee; standard leagues use legacy ownership deduction.
              const royaltyMode = matchSpecialRule?.marquee_mode_enabled === true;
              const uniqueMode = matchSpecialRule?.unique_mode_enabled === true;
              const borrowed = leagueFormat.ownership_enabled && !!auctionOwner && auctionOwner !== owner
                && (uniqueMode || leagueFormat.other_owner_deductions_enabled);
              const ownershipDeduction = !borrowed || royaltyMode ? 0 : uniqueMode
                ? Math.max(grossContribution * Number(matchSpecialRule?.other_player_fee_percent ?? 0) / 100, Number(matchSpecialRule?.other_player_minimum_fee ?? 0))
                : grossContribution > 0 ? Math.max(grossContribution * Number(matchRule?.other_owner_penalty_percent ?? 0) / 100, Number(matchRule?.other_owner_minimum_penalty ?? 0)) : 0;
              const matchMultiplier = booster?.booster?.code === "2UP" ? Number(booster?.booster?.match_multiplier ?? 2) : 1;
              const contribution = (grossContribution - ownershipDeduction) * matchMultiplier;
              const playerKey = `${key}:${player.id}`;
              const playerOpen = expandedPlayer === playerKey;
              return <View key={player.id}><TouchableOpacity style={x.historyPlayer} onPress={() => setExpandedPlayer(playerOpen ? "" : playerKey)}><Text style={x.chevron}>{playerOpen ? "▲" : "▼"}</Text><View style={[x.grow, { marginLeft: 7 }]}><View style={x.playerLabelRow}><Text style={x.playerName}>{entry.slot}. {player.full_name}</Text>{(specialLabels[match.id]?.[player.full_name] ?? []).map(label => <SpecialPlayerBadge key={label} label={label} />)}</View><View style={x.playerMetaRow}><IplTeamBadge code={player.team?.code} /><Text style={x.roleText}>{player.role}</Text><Text style={[x.ownershipText, ownership === "Mine" ? x.ownershipMine : ownership === "OpenPlayer" ? x.ownershipOpen : x.ownershipOther]}>{ownership}</Text><Text style={x.baseText}>{playerPoints ? `Base ${fmt(playerPoints.total_points)}` : "Points pending"}</Text></View></View>{playerPoints ? <Text style={x.playerValue}>{fmt(contribution)} pts</Text> : null}{markers.map(marker => <Text key={marker} style={x.marker}>{marker}</Text>)}</TouchableOpacity>{playerOpen && playerPoints ? <View style={x.playerBreakdown}><BreakdownLine label="Batting" value={playerPoints.batting_points} /><BreakdownLine label="Bowling" value={playerPoints.bowling_points} /><BreakdownLine label="Fielding" value={playerPoints.fielding_points} /><BreakdownLine label="Bonus" value={playerPoints.bonus_points} /><BreakdownLine label="Base total" value={playerPoints.total_points} strong />{grossContribution !== Number(playerPoints.total_points) ? <BreakdownLine label="After player multipliers" value={grossContribution} /> : null}{ownershipDeduction > 0 ? <BreakdownLine label={uniqueMode ? "Other-player usage fee" : "Ownership deduction"} value={-ownershipDeduction} /> : null}{matchMultiplier !== 1 ? <BreakdownLine label={`After ${booster?.booster?.code} (${matchMultiplier}×)`} value={contribution} /> : null}<BreakdownLine label="Final player contribution" value={contribution} strong /></View> : null}</View>;
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
  pointHead: { flexDirection: "row", padding: 9, backgroundColor: "#EEF2EF" }, pointRow: { flexDirection: "row", alignItems: "center", padding: 9, borderTopWidth: 1, borderTopColor: "#EDF0EA" }, pointPlayer: { flex: 1, minWidth: 0, paddingRight: 5 }, pointCell: { width: 27, textAlign: "right", color: "#61736C", fontSize: 8 }, royaltyColumn: { color: "#704091", fontWeight: "900" }, pointTotal: { width: 35, textAlign: "right", color: "#173028", fontSize: 9, fontWeight: "900" },
  ownerTotalsSection: { backgroundColor: "#F8FAF7", borderTopWidth: 1, borderTopColor: "#E2E8E4", paddingHorizontal: 12, paddingVertical: 8 }, ownerTotalRow: { flexDirection: "row", alignItems: "center", minHeight: 40, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#E8EDE9" }, ownerTotalValues: { flexDirection: "row", alignItems: "center", gap: 9 }, ownerTotalName: { color: "#173028", fontSize: 10, fontWeight: "800" }, ownerTotalPoints: { color: "#174D3D", fontSize: 12, fontWeight: "900", marginLeft: 10 }, ownerRoyaltyMeta: { color: "#704091", fontSize: 8, fontWeight: "800", marginTop: 2 },
  playerRoyaltySection: { backgroundColor: "#F8F2FF", borderTopWidth: 1, borderTopColor: "#E7D8F3", paddingHorizontal: 12, paddingVertical: 4 }, royaltySectionTitle: { color: "#704091", fontSize: 8, fontWeight: "900", marginTop: 4, marginBottom: 3, letterSpacing: 0.4 }, royaltyDetailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2 }, royaltyDetailText: { flex: 1, color: "#665273", fontSize: 8 }, royaltyValue: { color: "#704091", fontSize: 8, fontWeight: "900", marginLeft: 5 }, compactRoyalty: { color: "#704091", fontSize: 8, fontWeight: "900", marginTop: 4 },
  playerLabelRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 }, specialPlayerBadge: { color: "#6B4E00", backgroundColor: "#FFF0A8", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontWeight: "900", overflow: "hidden" }, marqueePlayerBadge: { color: "#FFFFFF", backgroundColor: "#7B3FA1" },
  ownerDisplayName: { color: "#10251F", fontFamily: OWNER_FONT, fontSize: 15, fontWeight: "700", letterSpacing: 0.25 },
  playerListName: { flex: 1, color: "#173028", fontSize: 11, fontWeight: "900" },
  ownerPlayerNameRow: { flexDirection: "row", alignItems: "center", minWidth: 0 }, ownerPlayerChevron: { color: "#61756D", fontSize: 7, fontWeight: "900", marginLeft: 4 }, ownerPlayerTeamRole: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 5 }, ownerPlayerRole: { color: "#536B62", fontSize: 8, fontWeight: "800" }, ownerPlayerCosts: { color: "#7D8B85", fontSize: 8, lineHeight: 11, marginTop: 4 }, ownerPlayerBreakdown: { backgroundColor: "#F0F4F1", paddingHorizontal: 28, paddingVertical: 8 },
  specialSelectionBanner: { backgroundColor: "#EAF3EE", borderBottomWidth: 1, borderBottomColor: "#D5E2DB", paddingHorizontal: 12, paddingVertical: 10 }, specialSelectionTitle: { color: "#174D3D", fontSize: 10, fontWeight: "900" }, specialSelectionText: { color: "#61736C", fontSize: 8, lineHeight: 12, marginTop: 3 }, specialCheckbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: "#8EA198", alignItems: "center", justifyContent: "center", marginLeft: 8 }, specialCheckboxChecked: { backgroundColor: "#174D3D", borderColor: "#174D3D" }, specialCheckboxText: { color: "#DDFB72", fontSize: 12, fontWeight: "900" }, specialSelectionActions: { paddingHorizontal: 12, paddingBottom: 12 }, specialSelectionMessage: { color: "#315C50", fontSize: 9, fontWeight: "800", paddingHorizontal: 12, paddingVertical: 9 },
  squadTitleRow: { flexDirection: "row", alignItems: "center" }, squadToggle: { backgroundColor: "#E5ECE8", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, marginLeft: 8 }, squadToggleText: { color: "#315047", fontSize: 8, fontWeight: "900" },
  squadTeamCard: { backgroundColor: "white", borderRadius: 14, overflow: "hidden", marginBottom: 11 }, squadTeamHeader: { minHeight: 52, borderWidth: 2, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 7 }, squadTeamHeaderMain: { flex: 1, minHeight: 38, flexDirection: "row", alignItems: "center", paddingHorizontal: 3 }, squadTeamCode: { width: 45, fontSize: 14, fontWeight: "900" }, squadTeamSummary: { flex: 1, fontSize: 8, lineHeight: 12, fontWeight: "800", opacity: 0.92 }, squadTeamChevron: { marginLeft: 7, fontSize: 10, fontWeight: "900" }, squadAddPlayerButton: { minWidth: 49, minHeight: 28, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center", marginLeft: 7 }, squadAddPlayerButtonText: { fontSize: 7, fontWeight: "900" },
  squadAddForm: { backgroundColor: "#F4F7F4", borderBottomWidth: 1, borderBottomColor: "#DDE5E0", padding: 12 }, squadAddFormTitle: { color: "#173028", fontSize: 12, fontWeight: "900", marginBottom: 9 }, squadAddInput: { backgroundColor: "white", borderWidth: 1, borderColor: "#D5DED9", borderRadius: 9, color: "#173028", fontSize: 11, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 8 }, squadAddRoles: { flexDirection: "row", gap: 5, marginBottom: 8 }, squadAddRole: { flex: 1, minHeight: 31, backgroundColor: "#E5ECE8", borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }, squadAddRoleActive: { backgroundColor: "#174D3D" }, squadAddRoleText: { color: "#536B62", fontSize: 7, fontWeight: "900" }, squadAddRoleTextActive: { color: "#DDFB72" }, squadAddLabel: { color: "#60726A", fontSize: 8, fontWeight: "900", marginBottom: 6 }, squadOwnerChoices: { gap: 6, paddingBottom: 9 }, squadOwnerChoice: { backgroundColor: "white", borderWidth: 1, borderColor: "#D5DED9", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }, squadOwnerChoiceActive: { backgroundColor: "#174D3D", borderColor: "#174D3D" }, squadOwnerChoiceText: { color: "#536B62", fontSize: 8, fontWeight: "800" }, squadOwnerChoiceTextActive: { color: "#DDFB72" }, squadAddSubmit: { backgroundColor: "#DDFB72", borderRadius: 9, minHeight: 38, alignItems: "center", justifyContent: "center" }, squadAddSubmitText: { color: "#10251F", fontSize: 10, fontWeight: "900" },
  squadPlayerRow: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: "#E8EDE9" }, squadPlayerMain: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", paddingRight: 8 }, squadPlayerNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }, squadPlayerName: { color: "#173028", fontSize: 13, fontWeight: "900" }, squadSelectionCost: { color: "#655B25", backgroundColor: "#F5EFD2", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontWeight: "900" }, squadPlayerOwner: { color: "#72827B", fontSize: 8, marginTop: 4, fontWeight: "600" },
  squadScoreBlock: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }, squadRoyaltyPoints: { color: "#704091", fontSize: 7, fontWeight: "900" }, squadPlayerPoints: { color: "#174D3D", fontSize: 11, fontWeight: "900" }, squadPointsPending: { color: "#8A9691", fontSize: 11, textAlign: "right", fontWeight: "800", marginLeft: 9 }, squadPlayerChevron: { color: "#61756D", fontSize: 9, fontWeight: "900", marginLeft: 7 }, squadPointsBreakdown: { backgroundColor: "#F0F4F1", paddingHorizontal: 28, paddingVertical: 8 }, squadPointsWarning: { backgroundColor: "#FFF0EC", borderRadius: 10, padding: 10, marginBottom: 10 }, squadPointsWarningText: { color: "#7A4036", fontSize: 9, fontWeight: "700" },
  squadPlayerRowInactive: { backgroundColor: "#F0F1EF", opacity: 0.75 }, squadPlayerNameInactive: { color: "#7F8985", textDecorationLine: "line-through" }, squadEditButton: { minWidth: 50, minHeight: 28, borderRadius: 7, borderWidth: 1, borderColor: "#A9BBB3", backgroundColor: "#F5F8F6", alignItems: "center", justifyContent: "center", paddingHorizontal: 7 }, squadEditButtonText: { color: "#315047", fontSize: 8, fontWeight: "900" }, squadEditForm: { backgroundColor: "#F4F7F4", borderTopWidth: 1, borderTopColor: "#DDE5E0", padding: 12 }, squadEditAvailability: { flexDirection: "row", gap: 7, marginBottom: 9 }, squadEditStatus: { flex: 1, minHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: "#CBD6D0", alignItems: "center", justifyContent: "center" }, squadEditStatusActive: { backgroundColor: "#EAF6E5", borderColor: "#9FC694" }, squadEditStatusInactive: { backgroundColor: "#FFF0EC", borderColor: "#E0AFA4" }, squadEditStatusText: { color: "#65766F", fontSize: 8, fontWeight: "900" }, squadEditStatusTextActive: { color: "#285F39" }, squadEditStatusTextInactive: { color: "#7A4036" }, squadEditBidNote: { color: "#7A6A31", fontSize: 8, fontWeight: "800", marginBottom: 9 }, squadAvailabilityMessage: { backgroundColor: "#EAF6E5", borderRadius: 10, padding: 10, marginBottom: 10 }, squadAvailabilityMessageText: { color: "#285F39", fontSize: 9, fontWeight: "800" },
  ownerBlock: { borderTopWidth: 1, borderTopColor: "#DCE4DF" }, ownerName: { color: "#10251F", fontFamily: OWNER_FONT, fontSize: 15, fontWeight: "700", letterSpacing: 0.25 }, ownerMeta: { color: "#718079", fontSize: 9, marginTop: 4 }, transferSummary: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }, transferUsed: { color: "#315C50", backgroundColor: "#E4F0EB", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: "800" }, transferBalance: { color: "#6B5B1E", backgroundColor: "#F5EFD2", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: "900" }, historyPlayer: { flexDirection: "row", alignItems: "center", minHeight: 58, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FAFBF8", borderTopWidth: 1, borderTopColor: "#E4EAE6" }, playerName: { color: "#173028", fontSize: 13, lineHeight: 18, fontWeight: "800" }, playerMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }, teamBadge: { overflow: "hidden", borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: "900" }, roleText: { color: "#536B62", backgroundColor: "#E7EEE9", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: "700" }, ownershipText: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 8, fontWeight: "800" }, ownershipMine: { color: "#285F39", backgroundColor: "#DFF0DD" }, ownershipOpen: { color: "#4E5F58", backgroundColor: "#E7ECE9" }, ownershipOther: { color: "#74463D", backgroundColor: "#F8E6E1" }, baseText: { color: "#7D8B85", fontSize: 9, fontWeight: "600" }, playerValue: { color: "#174D3D", fontSize: 13, fontWeight: "900", marginHorizontal: 8 }, marker: { color: "#173028", backgroundColor: "#DDFB72", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, fontSize: 8, fontWeight: "900" }, playerBreakdown: { backgroundColor: "#F0F4F1", paddingHorizontal: 34, paddingVertical: 8 }, breakdownLine: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#E1E7E3" }, breakdownLabel: { flex: 1, color: "#63756E", fontSize: 9 }, breakdownValue: { color: "#40574F", fontSize: 9 }, breakdownStrong: { color: "#173028", fontWeight: "900" },
});
