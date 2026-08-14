import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import type { Player } from "./squadData";
import { supabase } from "./supabase";
import { userActionError } from "./errorMessages";
import { ownerTheme } from "./ownerTheme";
import { fixtureOwnerAction, fixtureOwnerActionLabel, isNoResultFixture } from "./lineupWorkflowRules";
import { latestPublishedPlayerPoints, scorecardDismissalLabel, scorecardForFixture, seededPlayerPointDetails, seededPlayerPoints, seededPlayerStats } from "./scorecardData";
import { calculatePointDetails, type PlayerMatchStats } from "./scoringRules";
import { CARD_SHADOW, UI_TOKENS, normalizeUiStyles } from "./uiTokens";

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
  PBKS: { backgroundColor: "#C8102E", color: "#FFFFFF", borderColor: "#A7A9AC" },
  RR: { backgroundColor: "#C21875", color: "#FFFFFF", borderColor: "#17479E" },
};
export const teamBadge = (code?: string) => IPL_TEAM_BADGES[code ?? ""] ?? { backgroundColor: "#546A61", color: "#FFFFFF", borderColor: "#546A61" };
export function IplTeamBadge({ code }: { code?: string }) { return <Text style={[x.teamBadge, teamBadge(code)]}>{code ?? "TBD"}</Text>; }
export function SpecialPlayerBadge({ label }: { label?: string }) { return label ? <Text style={[x.specialPlayerBadge, label === "MARQUEE" && x.marqueePlayerBadge]}>{label}</Text> : null; }
export function OwnerBadge({ owner, label, compact = false }: { owner?: string | null; label?: string; compact?: boolean }) {
  const theme = ownerTheme(owner);
  const rawText = String(label ?? (!owner || owner === "Available" || owner === "OpenPlayer" ? "Open" : owner)).trim();
  const ownerName = rawText.replace(/^owned by\s+/i, "").trim();
  const text = /^(available|open\s*player)$/i.test(ownerName) ? "Open" : ownerName;
  return <View style={[x.ownerBadge, compact && x.ownerBadgeCompact, { backgroundColor: theme.soft, borderColor: theme.border }]}><View style={[x.ownerBadgeDot, { backgroundColor: theme.accent }]} /><Text numberOfLines={1} style={[x.ownerBadgeText, { color: theme.strong }]}>{text}</Text></View>;
}
export function OwnerAvatar({ owner, current = false }: { owner?: string | null; current?: boolean }) {
  const theme = ownerTheme(owner);
  return <View style={[x.avatar, { backgroundColor: theme.soft, borderColor: theme.border }, current && { borderColor: theme.accent }]}><Text style={[x.avatarText, { color: theme.strong }]}>{String(owner ?? "?").charAt(0).toUpperCase()}</Text></View>;
}
function OwnerPickerModal({ visible, compact, playerName, owners, selectedOwnerId, onSelect, onClose }: { visible: boolean; compact: boolean; playerName: string; owners: Array<{ id: string; display_name: string }>; selectedOwnerId: string; onSelect: (ownerId: string) => void; onClose: () => void }) {
  return <Modal visible={visible} transparent animationType={compact ? "slide" : "fade"} statusBarTranslucent onRequestClose={onClose}>
    <View style={[x.playerEditOwnerPickerOverlay, !compact && x.playerEditOwnerPickerOverlayWide]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close owner picker" activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View accessibilityViewIsModal accessibilityLabel="Choose assigned owner" style={[x.playerEditOwnerPickerSheet, !compact && x.playerEditOwnerPickerSheetWide]} onStartShouldSetResponder={() => true}>
        <View style={x.playerEditOwnerPickerHeader}><View style={x.grow}><Text style={x.playerEditOwnerPickerEyebrow}>ASSIGNED OWNER</Text><Text accessibilityRole="header" style={x.playerEditOwnerPickerTitle}>Choose owner</Text><Text style={x.playerEditOwnerPickerSubtitle}>Select one owner for {playerName}. You can review this before saving.</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close owner picker" style={x.playerEditOwnerPickerClose} onPress={onClose}><Text style={x.playerEditOwnerPickerCloseText}>×</Text></TouchableOpacity></View>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator contentContainerStyle={x.playerEditOwnerPickerList}>
          {[{ id: "", display_name: "Open player", description: "Available to all league owners" }, ...owners.map(owner => ({ ...owner, description: "League owner" }))].map(owner => {
            const selected = selectedOwnerId === owner.id;
            const theme = ownerTheme(owner.id ? owner.display_name : "Available");
            return <TouchableOpacity key={owner.id || "open"} accessibilityRole="radio" accessibilityLabel={`Assign to ${owner.display_name}`} accessibilityState={{ selected, checked: selected }} style={[x.playerEditOwnerPickerOption, selected && x.playerEditOwnerPickerOptionSelected]} onPress={() => onSelect(owner.id)}>
              <View style={[x.playerEditOwnerPickerAvatar, { backgroundColor: theme.soft, borderColor: theme.border }]}><Text style={[x.playerEditOwnerPickerAvatarText, { color: theme.strong }]}>{owner.id ? owner.display_name.charAt(0).toUpperCase() : "○"}</Text></View>
              <View style={x.grow}><Text numberOfLines={1} style={x.playerEditOwnerPickerName}>{owner.display_name}</Text><Text style={x.playerEditOwnerPickerDescription}>{owner.description}</Text></View>
              <View style={[x.playerEditOwnerPickerRadio, selected && x.playerEditOwnerPickerRadioSelected]}>{selected ? <View style={x.playerEditOwnerPickerRadioDot} /> : null}</View>
            </TouchableOpacity>;
          })}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const FIXTURE_LABEL_CACHE_MS = 30_000;
const fixtureSpecialLabelCache = new Map<string, { loadedAt: number; labels: Record<string, string[]> }>();
function useFixtureSpecialLabels(fixtureIds: string[]) {
  const [labels, setLabels] = useState<Record<string, Record<string, string[]>>>({});
  const key = fixtureIds.join(",");
  useEffect(() => {
    let mounted = true;
    if (!fixtureIds.length) { setLabels({}); return () => { mounted = false; }; }
    const now = Date.now();
    const cached = Object.fromEntries(fixtureIds.flatMap(fixtureId => {
      const value = fixtureSpecialLabelCache.get(fixtureId);
      return value && now - value.loadedAt < FIXTURE_LABEL_CACHE_MS ? [[fixtureId, value.labels] as const] : [];
    }));
    setLabels(cached);
    const missingFixtureIds = fixtureIds.filter(fixtureId => {
      const value = fixtureSpecialLabelCache.get(fixtureId);
      return !value || now - value.loadedAt >= FIXTURE_LABEL_CACHE_MS;
    });
    Promise.all(missingFixtureIds.map(async fixtureId => {
      const { data } = await supabase.rpc("special_player_labels_for_fixture", { p_fixture_id: fixtureId });
      const byName = ((data ?? []) as Array<{ full_name: string; label: string }>).reduce((result, row) => ({ ...result, [row.full_name]: [...(result[row.full_name] ?? []), row.label] }), {} as Record<string, string[]>);
      fixtureSpecialLabelCache.set(fixtureId, { loadedAt: Date.now(), labels: byName });
      return [fixtureId, byName] as const;
    })).then(rows => { if (mounted && rows.length) setLabels(current => ({ ...current, ...Object.fromEntries(rows) })); });
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
const Empty = ({ text, title = "Nothing to show yet" }: { text: string; title?: string }) => <View accessibilityLiveRegion="polite" style={x.empty}><View style={x.emptyIcon}><Text style={x.emptyIconText}>–</Text></View><Text style={x.emptyTitle}>{title}</Text><Text style={x.emptyText}>{text}</Text></View>;
const Loading = () => <View accessibilityRole="progressbar" accessibilityLabel="Loading league data" accessibilityLiveRegion="polite" style={x.statePanel}><ActivityIndicator color={UI_TOKENS.colors.primary} size="large" /><Text style={x.stateTitle}>Loading league data</Text><Text style={x.stateText}>Fetching the latest league information…</Text></View>;
const LoadError = ({ message, onRetry }: { message: string; onRetry: () => void }) => {
  const offline = Platform.OS === "web" && typeof navigator !== "undefined" && navigator.onLine === false;
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={x.loadError}><View style={x.loadErrorIcon}><Text style={x.loadErrorIconText}>!</Text></View><Text style={x.loadErrorTitle}>{offline ? "You’re offline" : "We couldn’t load this screen"}</Text><Text style={x.loadErrorText}>{offline ? "Reconnect to the internet, then try again." : "The league service may be temporarily unavailable. Try again."}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading this screen" style={x.loadErrorRetry} onPress={onRetry}><Text style={x.loadErrorRetryText}>Try again</Text></TouchableOpacity>{__DEV__ ? <Text style={x.loadErrorDetail}>{message}</Text> : null}</View>;
};

export function ProductionDashboard({ leagueId, leagueName, memberName, openTeam }: { leagueId: string; leagueName: string; memberName: string; openTeam: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null); setError("");
    const load = async () => {
      try {
        const [fixture, standing, member, periods] = await Promise.all([
          supabase.from("fixtures").select("match_number,scheduled_start,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code)").eq("league_id", leagueId).eq("status", "scheduled").order("match_number").limit(1).maybeSingle(),
          supabase.from("league_standings").select("display_name,total_points,matches_scored,rank").eq("league_id", leagueId).eq("display_name", memberName).maybeSingle(),
          supabase.from("league_members").select("id").eq("league_id", leagueId).eq("display_name", memberName).single(),
          supabase.from("league_transfer_periods").select("id,name,start_match_number,end_match_number,transfer_limit").eq("league_id", leagueId).eq("active", true).order("sort_order"),
        ]);
        if (cancelled) return;
        const firstError = fixture.error ?? standing.error ?? member.error ?? periods.error;
        if (firstError) { setError(firstError.message); return; }
        if (!member.data) { setError("League member record was not found."); return; }
        const transfers = await supabase.from("transfer_events").select("transfer_period_id,transfer_count").eq("member_id", member.data.id).eq("reason", "lineup_change");
        if (cancelled) return;
        if (transfers.error) { setError(transfers.error.message); return; }
        setData({ fixture: fixture.data, standing: standing.data, periods: periods.data ?? [], transfers: transfers.data ?? [] });
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Dashboard data could not be loaded.");
      }
    };
    load();
    return () => { cancelled = true; };
  }, [leagueId, memberName, reloadKey]);
  if (error) return <LoadError message={error} onRetry={() => setReloadKey(value => value + 1)} />;
  if (!data) return <Loading />;
  const fixture = data.fixture;
  const start = fixture ? new Date(fixture.scheduled_start) : null;
  const period = data.periods.find((item: any) => fixture && fixture.match_number >= item.start_match_number && fixture.match_number <= item.end_match_number) ?? data.periods[0];
  const used = data.transfers.filter((event: any) => event.transfer_period_id === period?.id).reduce((sum: number, event: any) => sum + event.transfer_count, 0);
  return <><Text style={x.title}>Good evening, {memberName}</Text><Text style={x.subtitle}>{leagueName} · Private league</Text>
    {fixture ? <View style={x.hero}><Text style={x.heroLabel}>NEXT MATCH · M{fixture.match_number}</Text><View style={x.heroTeams}><IplTeamBadge code={fixture.home?.code} /><Text style={x.accent}>vs</Text><IplTeamBadge code={fixture.away?.code} /></View><Text style={x.heroMeta}>{start?.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} · Lineup open</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Set playing XI for Match ${fixture.match_number}`} style={x.primary} onPress={openTeam}><Text style={x.primaryText}>Set playing XI</Text></TouchableOpacity></View> : <Empty text="No scheduled match." />}
    <View style={x.stats}><Metric label="RANK" value={data.standing ? `#${data.standing.rank}` : "—"} detail={`${data.standing?.matches_scored ?? 0} matches`} /><Metric label="POINTS" value={fmt(data.standing?.total_points)} detail="published" /><Metric label="TRANSFERS" value={period ? `${used}/${period.transfer_limit}` : "—"} detail={period?.name ?? "not configured"} /></View>
  </>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <View style={x.metric}><Text style={x.metricLabel}>{label}</Text><Text style={x.metricValue}>{value}</Text><Text style={x.meta}>{detail}</Text></View>; }

export function ProductionRanking({ leagueId, currentOwner }: { leagueId: string; currentOwner: string }) {
  const { width: rankingWidth } = useWindowDimensions();
  const compact = rankingWidth < 620;
  const [phases, setPhases] = useState<any[]>([]);
  const [selected, setSelected] = useState("overall");
  const [overall, setOverall] = useState<any[]>([]);
  const [phaseRows, setPhaseRows] = useState<any[]>([]);
  const [matchScores, setMatchScores] = useState<Array<{ match_number: number; member_id: string; total_points: number; valid_result: boolean }>>([]);
  const [playerSelections, setPlayerSelections] = useState<Array<{ match_number: number; player_id: string; player_name: string; valid_result: boolean }>>([]);
  const [showEveryOwner, setShowEveryOwner] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setPhases([]); setOverall([]); setPhaseRows([]); setMatchScores([]); setPlayerSelections([]);
    Promise.all([
      supabase.from("league_phases").select("id,code,name,start_match_number,end_match_number,sort_order").eq("league_id", leagueId).eq("active", true).order("sort_order"),
      supabase.from("league_standings").select("member_id,display_name,total_points,matches_scored,rank").eq("league_id", leagueId).order("rank"),
      supabase.from("league_phase_standings").select("phase_id,member_id,phase_code,phase_name,display_name,total_points,matches_scored,rank").eq("league_id", leagueId).order("rank"),
      supabase.from("league_members").select("id").eq("league_id", leagueId).eq("status", "active").in("role", ["owner", "league_admin"]),
      supabase.from("fixtures").select("match_number,status,scoring_status,home_team_id,away_team_id,member_match_scores(member_id,total_points,published_at),lineup_submissions(member_id,status,lineup_players(player_id,player:players(full_name,team_id)))").eq("league_id", leagueId).order("match_number"),
    ]).then(([p, o, r, m, s]) => {
      if (cancelled) return;
      const e = p.error ?? o.error ?? r.error ?? m.error ?? s.error;
      if (e) setError(e.message);
      else {
        const activeMemberIds = new Set((m.data ?? []).map(member => member.id));
        setPhases(p.data ?? []);
        setOverall((o.data ?? []).filter(row => activeMemberIds.has(row.member_id)));
        setPhaseRows((r.data ?? []).filter(row => activeMemberIds.has(row.member_id)));
        setMatchScores((s.data ?? []).flatMap((fixture: any) => (fixture.member_match_scores ?? [])
          .filter((score: any) => score.published_at && activeMemberIds.has(score.member_id))
          .map((score: any) => ({ match_number: Number(fixture.match_number), member_id: score.member_id, total_points: Number(score.total_points ?? 0), valid_result: !isNoResultFixture(fixture.status) }))));
        setPlayerSelections(
          (s.data ?? [])
            .filter((fixture: any) => (fixture.member_match_scores ?? []).some((score: any) => score.published_at))
            .flatMap((fixture: any) => (fixture.lineup_submissions ?? [])
              .filter((lineup: any) => activeMemberIds.has(lineup.member_id) && ["submitted", "locked"].includes(lineup.status))
              .flatMap((lineup: any) => (lineup.lineup_players ?? [])
                .filter((selection: any) => selection.player?.team_id === fixture.home_team_id || selection.player?.team_id === fixture.away_team_id)
                .map((selection: any) => ({ match_number: Number(fixture.match_number), player_id: selection.player_id, player_name: selection.player?.full_name ?? "Unknown player", valid_result: !isNoResultFixture(fixture.status) }))))
        );
      }
    }).catch(loadError => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Ranking data could not be loaded.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [leagueId, reloadKey]);
  if (loading) return <Loading />;
  if (error) return <LoadError message={error} onRetry={() => setReloadKey(value => value + 1)} />;
  const normalizedOwner = currentOwner.trim().toLocaleLowerCase();
  const rows = [...(selected === "overall" ? overall : phaseRows.filter(row => row.phase_code === selected))]
    .filter(row => Number(row.matches_scored ?? 0) > 0)
    .sort((left, right) => Number(left.rank) - Number(right.rank) || Number(right.total_points) - Number(left.total_points) || String(left.display_name).localeCompare(String(right.display_name)));
  const activePhase = phases.find(phase => phase.code === selected);
  const periodLabel = selected === "overall" ? "Overall championship" : activePhase?.name ?? "Selected phase";
  const periodDetail = selected === "overall" ? "Every published match" : activePhase ? `Matches ${activePhase.start_match_number}–${activePhase.end_match_number}` : "Published matches";
  const currentIndex = rows.findIndex(row => String(row.display_name ?? "").trim().toLocaleLowerCase() === normalizedOwner);
  const currentRow = currentIndex >= 0 ? rows[currentIndex] : null;
  const leader = rows[0] ?? null;
  const pointsAbove = currentIndex > 0 ? Math.max(0, Math.round(Number(rows[currentIndex - 1].total_points)) - Math.round(Number(currentRow.total_points))) : 0;
  const gapToLeader = currentRow && leader ? Math.max(0, Math.round(Number(leader.total_points)) - Math.round(Number(currentRow.total_points))) : 0;
  const podiumRows = rows.length >= 3 ? [rows[1], rows[0], rows[2]] : rows;
  const chasingRows = rows.length >= 3 ? rows.slice(3) : [];
  const maxMatches = rows.reduce((value, row) => Math.max(value, Number(row.matches_scored ?? 0)), 0);
  const periodMatchScores = matchScores.filter(score => selected === "overall" || (activePhase && score.match_number >= Number(activePhase.start_match_number) && score.match_number <= Number(activePhase.end_match_number)));
  const periodPlayerSelections = playerSelections.filter(selection => selected === "overall" || (activePhase && selection.match_number >= Number(activePhase.start_match_number) && selection.match_number <= Number(activePhase.end_match_number)));
  return <View style={x.rankingScreen}>
    <View style={x.rankingHero}>
      <View style={x.rankingHeroGlowLarge} /><View style={x.rankingHeroGlowSmall} />
      <View style={x.rankingHeroHeading}>
        <View style={x.rankingHeroMark}><Text style={x.rankingHeroMarkTop}>1</Text><View style={x.rankingHeroMarkBase} /></View>
        <View style={x.grow}><Text style={x.rankingHeroEyebrow}>LEAGUE LEADERBOARD</Text><Text accessibilityRole="header" style={x.rankingHeroTitle}>The championship race</Text><Text style={x.rankingHeroPeriod}>{periodLabel} · {periodDetail}</Text></View>
        {!compact ? <View style={x.rankingHeroLive}><View style={x.rankingHeroLiveDot} /><Text style={x.rankingHeroLiveText}>LIVE TABLE</Text></View> : null}
      </View>
      <View style={[x.rankingHeroBody, compact && x.rankingHeroBodyCompact]}>
        <View style={[x.rankingOwnerSpotlight, compact && x.rankingOwnerSpotlightCompact]}>
          <Text style={x.rankingOwnerSpotlightLabel}>YOUR POSITION</Text>
          {currentRow ? <>
            <View style={x.rankingOwnerSpotlightMain}><Text style={x.rankingOwnerSpotlightRank}>#{currentRow.rank}</Text><View style={x.rankingOwnerSpotlightScore}><Text style={x.rankingOwnerSpotlightPoints}>{fmt(currentRow.total_points)}</Text><Text style={x.rankingOwnerSpotlightPointsLabel}>POINTS</Text></View></View>
            <Text style={x.rankingOwnerSpotlightMeta}>{currentIndex === 0 ? "You lead the league" : pointsAbove === 0 ? `Tied with #${rows[currentIndex - 1].rank}` : `${fmt(pointsAbove)} pts behind #${rows[currentIndex - 1].rank}`} · {Number(currentRow.matches_scored) === 1 ? "1 match" : `${fmt(currentRow.matches_scored)} matches`}</Text>
          </> : <><Text style={x.rankingOwnerSpotlightEmpty}>No score yet</Text><Text style={x.rankingOwnerSpotlightMeta}>Your position appears after a score is published.</Text></>}
        </View>
        <View style={x.rankingHeroStats}>
          <RankingHeroStat label="LEADER" value={leader?.display_name ?? "—"} detail={leader ? `${fmt(leader.total_points)} pts` : "Awaiting scores"} />
          <RankingHeroStat label="FIELD" value={rows.length ? String(rows.length) : "—"} detail={rows.length === 1 ? "ranked owner" : "ranked owners"} />
          <RankingHeroStat label="LEAD GAP" value={currentRow ? (gapToLeader ? fmt(gapToLeader) : "0") : "—"} detail={currentRow && gapToLeader ? "points to leader" : currentRow ? "you are leading" : "after first score"} />
        </View>
      </View>
    </View>

    <View style={x.rankingPhasePanel}>
      <View style={x.rankingPhaseHeading}><View><Text style={x.rankingPhaseEyebrow}>RANKING PERIOD</Text><Text style={x.rankingPhaseTitle}>{periodLabel}</Text></View>{compact ? <Text style={x.rankingPhaseSwipe}>SWIPE →</Text> : <Text style={x.rankingPhaseCount}>{maxMatches ? `${maxMatches} ${maxMatches === 1 ? "match" : "matches"} scored` : "Awaiting scores"}</Text>}</View>
      <ScrollView accessibilityRole="tablist" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.chips}>
        <Chip active={selected === "overall"} label="Overall" detail="All published" onPress={() => setSelected("overall")} />
        {phases.map((phase, index) => <Chip key={phase.id ?? `${phase.code}:${index}`} active={selected === phase.code} label={phase.name} detail={`M${phase.start_match_number}–${phase.end_match_number}`} onPress={() => setSelected(phase.code)} />)}
      </ScrollView>
    </View>

    {rows.length ? <>
      <RankingTrendChart rows={rows} scores={periodMatchScores} currentOwner={currentOwner} compact={compact} showEveryOwner={showEveryOwner} onToggleOwners={() => setShowEveryOwner(value => !value)} />
      <RankingRecords rows={overall} scores={periodMatchScores} selections={periodPlayerSelections} compact={compact} periodLabel={periodLabel} currentOwner={currentOwner} />
      <View style={x.rankingSectionHeading}><View><Text style={x.rankingSectionEyebrow}>TOP OF THE TABLE</Text><Text accessibilityRole="header" style={x.rankingSectionTitle}>{rows.length >= 3 ? "Podium" : "Current leaders"}</Text></View><Text style={x.rankingSectionMeta}>{rows.length} ranked</Text></View>
      <View accessibilityLabel={`Top ${podiumRows.length} owners`} style={[x.rankingPodium, rows.length < 3 && x.rankingPodiumShort]}>{podiumRows.map((row, index) => {
        const originalIndex = rows.indexOf(row);
        const isWinner = originalIndex === 0;
        const isCurrentOwner = String(row.display_name ?? "").trim().toLocaleLowerCase() === normalizedOwner;
        return <RankingPodiumCard key={`${selected}:podium:${row.member_id ?? index}`} row={row} winner={isWinner} current={isCurrentOwner} compact={compact} leaderPoints={Number(leader?.total_points ?? 0)} />;
      })}</View>
      {chasingRows.length ? <>
        <View style={x.rankingSectionHeading}><View style={x.grow}><Text style={x.rankingSectionEyebrow}>FULL RACE</Text><Text accessibilityRole="header" numberOfLines={1} style={x.rankingSectionTitle}>{compact ? "Chasers" : "The chasing pack"}</Text></View><Text style={x.rankingSectionMeta}>{chasingRows.length} {compact ? "owners" : "competing"}</Text></View>
        <View style={x.rankingChaserGrid}>{chasingRows.map((row, chasingIndex) => {
          const overallIndex = chasingIndex + 3;
          const isCurrentOwner = String(row.display_name ?? "").trim().toLocaleLowerCase() === normalizedOwner;
          const previous = rows[overallIndex - 1];
          return <RankingChaserCard key={`${selected}:ranking:${row.member_id ?? chasingIndex}`} row={row} previous={previous} leader={leader} current={isCurrentOwner} compact={compact} />;
        })}</View>
      </> : null}
    </> : <View style={x.rankingEmpty}><View style={x.rankingEmptyMark}><Text style={x.rankingEmptyMarkText}>1·2</Text></View><Text accessibilityRole="header" style={x.rankingEmptyTitle}>The race starts here</Text><Text style={x.rankingEmptyText}>{activePhase ? `${activePhase.name} covers Matches ${activePhase.start_match_number}–${activePhase.end_match_number}. Its leaderboard appears as soon as a match score is published.` : "The overall leaderboard appears after the first match score is published."}</Text></View>}
  </View>;
}

type RankingTrendSeries = { memberId: string; name: string; current: boolean; color: string; values: Array<{ matchNumber: number; value: number; matchPoints: number }> };

function RankingRecords({ rows, scores, selections, compact, periodLabel, currentOwner }: { rows: any[]; scores: Array<{ match_number: number; member_id: string; total_points: number; valid_result: boolean }>; selections: Array<{ match_number: number; player_id: string; player_name: string; valid_result: boolean }>; compact: boolean; periodLabel: string; currentOwner: string }) {
  const ownerNames = new Map(rows.map(row => [row.member_id, row.display_name]));
  const validScores = scores.filter(score => score.valid_result);
  const validSelections = selections.filter(selection => selection.valid_result);
  if (!validScores.length) return null;
  const highest = [...validScores].sort((left, right) => right.total_points - left.total_points || left.match_number - right.match_number)[0];
  const lowest = [...validScores].sort((left, right) => left.total_points - right.total_points || left.match_number - right.match_number)[0];
  const selectionCounts = new Map<string, { name: string; count: number; matches: Set<number> }>();
  validSelections.forEach(selection => {
    const current = selectionCounts.get(selection.player_id) ?? { name: selection.player_name, count: 0, matches: new Set<number>() };
    current.count += 1;
    current.matches.add(selection.match_number);
    selectionCounts.set(selection.player_id, current);
  });
  const mostUsed = [...selectionCounts.values()].sort((left, right) => right.count - left.count || right.matches.size - left.matches.size || left.name.localeCompare(right.name))[0];
  const matchScores = new Map<number, number[]>();
  validScores.forEach(score => matchScores.set(score.match_number, [...(matchScores.get(score.match_number) ?? []), score.total_points]));
  const closest = [...matchScores.entries()].flatMap(([matchNumber, matchValues]) => {
    const ordered = [...matchValues].sort((left, right) => right - left);
    return ordered.length >= 2 ? [{ matchNumber, margin: Math.abs(ordered[0] - ordered[1]), first: ordered[0], second: ordered[1] }] : [];
  }).sort((left, right) => left.margin - right.margin || left.matchNumber - right.matchNumber)[0];
  const cards = [
    mostUsed ? { icon: "◎", label: "MOST SELECTED", value: mostUsed.name, detail: `${mostUsed.count} eligible picks · ${mostUsed.matches.size} matches`, tone: "green" as const } : null,
    highest ? { icon: "↗", label: "HIGHEST MATCH", value: `${fmt(highest.total_points)} pts`, detail: `${ownerNames.get(highest.member_id) ?? "Owner"} · Match ${highest.match_number}`, tone: "gold" as const } : null,
    lowest ? { icon: "↘", label: "LOWEST MATCH", value: `${fmt(lowest.total_points)} pts`, detail: `${ownerNames.get(lowest.member_id) ?? "Owner"} · Match ${lowest.match_number}`, tone: "blue" as const } : null,
    closest ? { icon: "≈", label: "CLOSEST FINISH", value: `${fmt(closest.margin)} pt${closest.margin === 1 ? "" : "s"}`, detail: `Match ${closest.matchNumber} · ${fmt(closest.first)} vs ${fmt(closest.second)}`, tone: "purple" as const } : null,
  ].filter(Boolean) as Array<{ icon: string; label: string; value: string; detail: string; tone: "green" | "gold" | "blue" | "purple" }>;
  const publishedMatches = [...new Set(validScores.map(score => score.match_number))].sort((left, right) => left - right);
  const scoresByMatch = new Map<number, typeof validScores>();
  const scoresByOwner = new Map<string, typeof validScores>();
  validScores.forEach(score => {
    scoresByMatch.set(score.match_number, [...(scoresByMatch.get(score.match_number) ?? []), score]);
    scoresByOwner.set(score.member_id, [...(scoresByOwner.get(score.member_id) ?? []), score]);
  });
  const matchWins = new Map<string, number>();
  scoresByMatch.forEach(matchRows => {
    const winningScore = Math.max(...matchRows.map(score => score.total_points));
    matchRows.filter(score => score.total_points === winningScore).forEach(score => matchWins.set(score.member_id, (matchWins.get(score.member_id) ?? 0) + 1));
  });
  const winLeader = [...matchWins.entries()].sort((left, right) => right[1] - left[1] || Number(rows.find(row => row.member_id === right[0])?.total_points ?? 0) - Number(rows.find(row => row.member_id === left[0])?.total_points ?? 0))[0];
  const recentMatches = publishedMatches.slice(-Math.min(3, publishedMatches.length));
  const recentForm = [...scoresByOwner.entries()].flatMap(([memberId, ownerScores]) => {
    const recent = ownerScores.filter(score => recentMatches.includes(score.match_number));
    return recent.length === recentMatches.length && recent.length ? [{ memberId, average: recent.reduce((sum, score) => sum + score.total_points, 0) / recent.length }] : [];
  }).sort((left, right) => right.average - left.average)[0];
  const consistentOwner = [...scoresByOwner.entries()].flatMap(([memberId, ownerScores]) => {
    if (ownerScores.length < 3) return [];
    const values = ownerScores.map(score => score.total_points);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const deviation = Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length);
    return [{ memberId, average, deviation, consistency: deviation / Math.max(1, Math.abs(average)) }];
  }).sort((left, right) => left.consistency - right.consistency || right.average - left.average)[0];
  const runningTotals = new Map(rows.map(row => [row.member_id, 0]));
  let initialRanks = new Map<string, number>();
  let latestRanks = new Map<string, number>();
  let previousLeader = "";
  let leadChanges = 0;
  const raceLeaders = new Set<string>();
  publishedMatches.forEach((matchNumber, matchIndex) => {
    (scoresByMatch.get(matchNumber) ?? []).forEach(score => runningTotals.set(score.member_id, Number(runningTotals.get(score.member_id) ?? 0) + score.total_points));
    const ordered = [...runningTotals.entries()].sort((left, right) => right[1] - left[1] || String(ownerNames.get(left[0]) ?? "").localeCompare(String(ownerNames.get(right[0]) ?? "")));
    const ranks = new Map(ordered.map(([memberId], index) => [memberId, index + 1]));
    if (matchIndex === 0) initialRanks = ranks;
    latestRanks = ranks;
    const leaderId = ordered[0]?.[0] ?? "";
    if (leaderId) raceLeaders.add(leaderId);
    if (previousLeader && leaderId && previousLeader !== leaderId) leadChanges += 1;
    previousLeader = leaderId;
  });
  const biggestClimber = rows.map(row => ({ memberId: row.member_id, places: Number(initialRanks.get(row.member_id) ?? 0) - Number(latestRanks.get(row.member_id) ?? 0) })).sort((left, right) => right.places - left.places || Number(latestRanks.get(left.memberId) ?? 99) - Number(latestRanks.get(right.memberId) ?? 99))[0];
  const selectionMoments = new Map<string, { name: string; matchNumber: number; count: number }>();
  validSelections.forEach(selection => {
    const key = `${selection.player_id}:${selection.match_number}`;
    const current = selectionMoments.get(key) ?? { name: selection.player_name, matchNumber: selection.match_number, count: 0 };
    current.count += 1;
    selectionMoments.set(key, current);
  });
  const popularMoment = [...selectionMoments.values()].sort((left, right) => right.count - left.count || left.matchNumber - right.matchNumber || left.name.localeCompare(right.name))[0];
  const normalizedOwner = currentOwner.trim().toLocaleLowerCase();
  const currentMemberId = rows.find(row => String(row.display_name ?? "").trim().toLocaleLowerCase() === normalizedOwner)?.member_id;
  const personalBest = currentMemberId ? [...(scoresByOwner.get(currentMemberId) ?? [])].sort((left, right) => right.total_points - left.total_points || left.match_number - right.match_number)[0] : null;
  type FactTone = "lime" | "gold" | "blue" | "purple" | "orange" | "pink";
  const facts = [
    winLeader ? { icon: "♛", label: "TROPHY MAGNET", value: ownerNames.get(winLeader[0]) ?? "League leader", detail: `${winLeader[1]} match win${winLeader[1] === 1 ? "" : "s"} from ${publishedMatches.length}`, tone: "gold" as FactTone } : null,
    recentForm ? { icon: "⚡", label: recentMatches.length >= 3 ? "HOT HAND" : "FAST START", value: ownerNames.get(recentForm.memberId) ?? "Form leader", detail: `${fmt(recentForm.average)} avg · ${recentMatches.map(match => `M${match}`).join("–")}`, tone: "lime" as FactTone } : null,
    consistentOwner ? { icon: "≈", label: "METRONOME", value: ownerNames.get(consistentOwner.memberId) ?? "Most consistent", detail: `±${fmt(consistentOwner.deviation)} pts typical swing`, tone: "blue" as FactTone } : null,
    biggestClimber?.places > 0
      ? { icon: "↗", label: "BIGGEST CLIMB", value: ownerNames.get(biggestClimber.memberId) ?? "Biggest mover", detail: `Up ${biggestClimber.places} place${biggestClimber.places === 1 ? "" : "s"} since M${publishedMatches[0]}`, tone: "purple" as FactTone }
      : publishedMatches.length > 1 ? { icon: "⇄", label: "LEAD DRAMA", value: `${leadChanges} lead change${leadChanges === 1 ? "" : "s"}`, detail: `${raceLeaders.size} owner${raceLeaders.size === 1 ? " has" : "s have"} led the race`, tone: "purple" as FactTone } : null,
    popularMoment ? { icon: "◎", label: "EVERYONE'S XI", value: popularMoment.name, detail: `${popularMoment.count} of ${scoresByMatch.get(popularMoment.matchNumber)?.length ?? rows.length} owners · M${popularMoment.matchNumber}`, tone: "orange" as FactTone } : null,
    personalBest ? { icon: "★", label: "YOUR PEAK", value: `${fmt(personalBest.total_points)} pts`, detail: `Your best score · Match ${personalBest.match_number}`, tone: "pink" as FactTone } : null,
  ].filter(Boolean) as Array<{ icon: string; label: string; value: string; detail: string; tone: FactTone }>;
  const factToneStyle = (tone: FactTone) => tone === "gold" ? x.rankingFactGold : tone === "blue" ? x.rankingFactBlue : tone === "purple" ? x.rankingFactPurple : tone === "orange" ? x.rankingFactOrange : tone === "pink" ? x.rankingFactPink : x.rankingFactLime;
  const toneStyle = (tone: "green" | "gold" | "blue" | "purple") => tone === "gold" ? x.rankingRecordGold : tone === "blue" ? x.rankingRecordBlue : tone === "purple" ? x.rankingRecordPurple : x.rankingRecordGreen;
  return <View style={x.rankingRecordsSection}>
    <View style={x.rankingRecordsHeading}><View><Text style={x.rankingSectionEyebrow}>LEAGUE RECORDS</Text><Text accessibilityRole="header" style={x.rankingRecordsTitle}>Numbers that tell the story</Text></View><Text numberOfLines={1} style={x.rankingRecordsPeriod}>{compact ? "PUBLISHED" : periodLabel.toUpperCase()}</Text></View>
    <View style={x.rankingRecordsGrid}>{cards.map(card => <View accessibilityLabel={`${card.label}: ${card.value}. ${card.detail}`} key={card.label} style={[x.rankingRecordCard, compact && x.rankingRecordCardCompact, toneStyle(card.tone)]}><View style={x.rankingRecordIcon}><Text style={x.rankingRecordIconText}>{card.icon}</Text></View><View style={x.grow}><Text style={x.rankingRecordLabel}>{card.label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={x.rankingRecordValue}>{card.value}</Text><Text style={x.rankingRecordDetail}>{card.detail}</Text></View></View>)}</View>
    {facts.length ? <View style={x.rankingFactsPanel}><View style={x.rankingFactsGlow} /><View style={x.rankingFactsHeading}><View><Text style={x.rankingFactsEyebrow}>LEAGUE FUN FACTS</Text><Text accessibilityRole="header" style={x.rankingFactsTitle}>Stories behind the scores</Text></View><Text style={x.rankingFactsHint}>{compact ? "SWIPE →" : `${publishedMatches.length} MATCH SNAPSHOT`}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.rankingFactsScroller}>{facts.map(fact => <View accessible accessibilityLabel={`${fact.label}: ${fact.value}. ${fact.detail}`} key={fact.label} style={[x.rankingFactCard, compact && x.rankingFactCardCompact, factToneStyle(fact.tone)]}><View style={x.rankingFactIcon}><Text style={x.rankingFactIconText}>{fact.icon}</Text></View><Text style={x.rankingFactLabel}>{fact.label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={x.rankingFactValue}>{fact.value}</Text><Text numberOfLines={2} style={x.rankingFactDetail}>{fact.detail}</Text></View>)}</ScrollView></View> : null}
  </View>;
}

function RankingTrendChart({ rows, scores, currentOwner, compact, showEveryOwner, onToggleOwners }: { rows: any[]; scores: Array<{ match_number: number; member_id: string; total_points: number }>; currentOwner: string; compact: boolean; showEveryOwner: boolean; onToggleOwners: () => void }) {
  const [plotWidth, setPlotWidth] = useState(0);
  const [chartMode, setChartMode] = useState<"race" | "form">("race");
  const [selectedMatchNumber, setSelectedMatchNumber] = useState<number | null>(null);
  const normalizedOwner = currentOwner.trim().toLocaleLowerCase();
  const matchNumbers = [...new Set(scores.map(score => score.match_number))].sort((left, right) => left - right);
  const matchNumberKey = matchNumbers.join(":");
  useEffect(() => {
    if (!matchNumbers.length) { setSelectedMatchNumber(null); return; }
    setSelectedMatchNumber(value => value != null && matchNumbers.includes(value) ? value : matchNumbers[matchNumbers.length - 1]);
  }, [matchNumberKey]);
  const scoreMap = new Map(scores.map(score => [`${score.member_id}:${score.match_number}`, score.total_points]));
  const allSeries: RankingTrendSeries[] = rows.map(row => {
    let runningTotal = 0;
    return {
      memberId: row.member_id,
      name: row.display_name,
      current: String(row.display_name ?? "").trim().toLocaleLowerCase() === normalizedOwner,
      color: ownerTheme(row.display_name).accent,
      values: matchNumbers.map(matchNumber => {
        const matchPoints = Number(scoreMap.get(`${row.member_id}:${matchNumber}`) ?? 0);
        runningTotal += matchPoints;
        return { matchNumber, value: runningTotal, matchPoints };
      }),
    };
  });
  const focusedIds = new Set([...rows.slice(0, 3).map(row => row.member_id), ...allSeries.filter(series => series.current).map(series => series.memberId)]);
  const visibleSeries = (showEveryOwner ? allSeries : allSeries.filter(series => focusedIds.has(series.memberId))).sort((left, right) => Number(left.current) - Number(right.current));
  if (!matchNumbers.length || !visibleSeries.length) return null;
  const values = visibleSeries.flatMap(series => series.values.map(point => chartMode === "race" ? point.value : point.matchPoints));
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const range = Math.max(1, maximum - minimum);
  const chartHeight = compact ? 194 : 226;
  const inset = compact ? { left: 34, right: 10, top: 12, bottom: 25 } : { left: 45, right: 15, top: 14, bottom: 27 };
  const innerWidth = Math.max(1, plotWidth - inset.left - inset.right);
  const innerHeight = chartHeight - inset.top - inset.bottom;
  const coordinates = (series: RankingTrendSeries) => series.values.map((point, index) => ({
    ...point,
    x: inset.left + (matchNumbers.length === 1 ? innerWidth / 2 : index / (matchNumbers.length - 1) * innerWidth),
    y: inset.top + (maximum - (chartMode === "race" ? point.value : point.matchPoints)) / range * innerHeight,
  }));
  const ticks = [0, 0.5, 1].map(ratio => ({ value: maximum - ratio * range, top: inset.top + ratio * innerHeight }));
  const tickLabel = (value: number) => compact && Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : fmt(value);
  const leaderName = rows[0]?.display_name ?? "leader";
  const activeMatchNumber = selectedMatchNumber ?? matchNumbers[matchNumbers.length - 1];
  const activeMatchIndex = Math.max(0, matchNumbers.indexOf(activeMatchNumber));
  const raceOrder = [...allSeries].sort((left, right) => Number(right.values[activeMatchIndex]?.value ?? 0) - Number(left.values[activeMatchIndex]?.value ?? 0));
  const formOrder = [...allSeries].sort((left, right) => Number(right.values[activeMatchIndex]?.matchPoints ?? 0) - Number(left.values[activeMatchIndex]?.matchPoints ?? 0));
  const activeLeader = raceOrder[0];
  const activeFormLeader = formOrder[0];
  const activeCurrent = allSeries.find(series => series.current);
  const currentRacePoints = Number(activeCurrent?.values[activeMatchIndex]?.value ?? 0);
  const currentFormPoints = Number(activeCurrent?.values[activeMatchIndex]?.matchPoints ?? 0);
  const currentGap = Math.max(0, Number(activeLeader?.values[activeMatchIndex]?.value ?? 0) - currentRacePoints);
  const formGap = Math.max(0, Number(activeFormLeader?.values[activeMatchIndex]?.matchPoints ?? 0) - currentFormPoints);
  const accessibilitySummary = visibleSeries.map(series => `${series.name} ${fmt(chartMode === "race" ? series.values[activeMatchIndex]?.value : series.values[activeMatchIndex]?.matchPoints)} points`).join(", ");
  const selectedX = chartMode === "race"
    ? inset.left + (matchNumbers.length === 1 ? innerWidth / 2 : activeMatchIndex / (matchNumbers.length - 1) * innerWidth)
    : inset.left + innerWidth / matchNumbers.length * activeMatchIndex + innerWidth / matchNumbers.length / 2;
  const baseline = inset.top + maximum / range * innerHeight;
  return <View style={x.rankingTrendCard}>
    <View style={x.rankingTrendGlowLarge} /><View style={x.rankingTrendGlowSmall} />
    <View style={x.rankingTrendHeader}>
      <View style={x.grow}><Text style={x.rankingTrendEyebrow}>RACE ANALYTICS</Text><Text accessibilityRole="header" style={x.rankingTrendTitle}>Momentum centre</Text><Text style={x.rankingTrendSubtitle}>{chartMode === "race" ? "How the championship moved after every match" : "Compare every owner’s points match by match"}</Text></View>
      <View style={x.rankingTrendLive}><View style={x.rankingTrendLiveDot} /><Text style={x.rankingTrendLiveText}>LIVE</Text></View>
    </View>
    <View style={x.rankingTrendToolbar}>
      <View accessibilityRole="tablist" style={x.rankingTrendTabs}>
        <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: chartMode === "race" }} style={[x.rankingTrendTab, chartMode === "race" && x.rankingTrendTabActive]} onPress={() => setChartMode("race")}><Text style={[x.rankingTrendTabText, chartMode === "race" && x.rankingTrendTabTextActive]}>TITLE RACE</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: chartMode === "form" }} style={[x.rankingTrendTab, chartMode === "form" && x.rankingTrendTabActive]} onPress={() => setChartMode("form")}><Text style={[x.rankingTrendTabText, chartMode === "form" && x.rankingTrendTabTextActive]}>MATCH FORM</Text></TouchableOpacity>
      </View>
      {allSeries.length > 3 ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={showEveryOwner ? "Show top three owners and my team" : "Show every ranked owner"} style={x.rankingTrendToggle} onPress={onToggleOwners}><Text style={x.rankingTrendToggleText}>{showEveryOwner ? "FOCUS" : "ALL OWNERS"}</Text></TouchableOpacity> : null}
    </View>
    <View accessible accessibilityLabel={`${leaderName} leads. ${accessibilitySummary}`} style={[x.rankingTrendPlot, { height: chartHeight }]} onLayout={event => setPlotWidth(event.nativeEvent.layout.width)}>
      {plotWidth ? <>
        {ticks.map((tick, index) => <React.Fragment key={`tick:${index}`}><View style={[x.rankingTrendGridLine, { left: inset.left, right: inset.right, top: tick.top }]} /><Text style={[x.rankingTrendAxisValue, { top: tick.top - 7, width: inset.left - 5 }]}>{tickLabel(tick.value)}</Text></React.Fragment>)}
        <View style={[x.rankingTrendSelectionBand, { left: selectedX - 9, top: inset.top, height: innerHeight }]} />
        {chartMode === "race" ? visibleSeries.map(series => {
          const points = coordinates(series);
          return <React.Fragment key={series.memberId}>
            {points.slice(1).map((point, index) => {
              const previous = points[index];
              const dx = point.x - previous.x;
              const dy = point.y - previous.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx);
              return <View key={`${series.memberId}:line:${point.matchNumber}`} style={[x.rankingTrendSegment, series.current && x.rankingTrendSegmentCurrent, { left: (previous.x + point.x) / 2 - length / 2, top: (previous.y + point.y) / 2 - (series.current ? 1.5 : 1), width: length, backgroundColor: series.color, transform: [{ rotate: `${angle}rad` }] }]} />;
            })}
            {points.map((point, index) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${series.name}, Match ${point.matchNumber}, ${fmt(point.value)} cumulative points`} key={`${series.memberId}:dot:${point.matchNumber}`} style={[x.rankingTrendDotHit, { left: point.x - 9, top: point.y - 9 }]} onPress={() => setSelectedMatchNumber(point.matchNumber)}><View style={[x.rankingTrendDot, series.current && x.rankingTrendDotCurrent, index === activeMatchIndex && x.rankingTrendDotSelected, { backgroundColor: series.color }]} /></TouchableOpacity>)}
          </React.Fragment>;
        }) : <>
          <View style={[x.rankingTrendBaseline, { left: inset.left, right: inset.right, top: baseline }]} />
          {matchNumbers.flatMap((matchNumber, matchIndex) => {
            const groupWidth = innerWidth / matchNumbers.length;
            const gap = compact ? 1.5 : 2;
            const barWidth = Math.max(2, Math.min(compact ? 8 : 14, (groupWidth * 0.76 - gap * (visibleSeries.length - 1)) / visibleSeries.length));
            const groupBarsWidth = barWidth * visibleSeries.length + gap * (visibleSeries.length - 1);
            const groupCenter = inset.left + groupWidth * matchIndex + groupWidth / 2;
            return visibleSeries.map((series, seriesIndex) => {
              const point = series.values[matchIndex];
              const valueY = inset.top + (maximum - point.matchPoints) / range * innerHeight;
              const barTop = Math.min(valueY, baseline);
              const barHeight = Math.max(2, Math.abs(baseline - valueY));
              return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${series.name}, Match ${matchNumber}, ${fmt(point.matchPoints)} points`} key={`${series.memberId}:bar:${matchNumber}`} style={[x.rankingFormBarHit, { left: groupCenter - groupBarsWidth / 2 + seriesIndex * (barWidth + gap), top: barTop, width: barWidth, height: barHeight }]} onPress={() => setSelectedMatchNumber(matchNumber)}><View style={[x.rankingFormBar, series.current && x.rankingFormBarCurrent, matchNumber === activeMatchNumber && x.rankingFormBarSelected, { backgroundColor: series.color }]} /></TouchableOpacity>;
            });
          })}
        </>}
        {matchNumbers.map((matchNumber, index) => {
          const showLabel = !compact || matchNumbers.length <= 6 || index === 0 || index === matchNumbers.length - 1 || index % 2 === 0;
          if (!showLabel) return null;
          const left = chartMode === "race" ? inset.left + (matchNumbers.length === 1 ? innerWidth / 2 : index / (matchNumbers.length - 1) * innerWidth) : inset.left + innerWidth / matchNumbers.length * index + innerWidth / matchNumbers.length / 2;
          return <Text key={`match:${matchNumber}`} style={[x.rankingTrendMatchLabel, { left: Math.max(0, Math.min(plotWidth - 30, left - 15)), top: chartHeight - 18 }, matchNumber === activeMatchNumber && x.rankingTrendMatchLabelActive]}>M{matchNumber}</Text>;
        })}
      </> : null}
    </View>
    <View style={x.rankingTrendInsights}>
      <View style={x.rankingTrendInsight}><Text style={x.rankingTrendInsightLabel}>SELECTED</Text><Text style={x.rankingTrendInsightValue}>MATCH {activeMatchNumber}</Text><Text style={x.rankingTrendInsightDetail}>Tap chart to change</Text></View>
      <View style={x.rankingTrendInsight}><Text style={x.rankingTrendInsightLabel}>{chartMode === "race" ? "LEADER" : "BEST FORM"}</Text><Text numberOfLines={1} style={x.rankingTrendInsightValue}>{chartMode === "race" ? activeLeader?.name : activeFormLeader?.name}</Text><Text style={x.rankingTrendInsightDetail}>{fmt(chartMode === "race" ? activeLeader?.values[activeMatchIndex]?.value : activeFormLeader?.values[activeMatchIndex]?.matchPoints)} pts</Text></View>
      <View style={[x.rankingTrendInsight, x.rankingTrendInsightYou]}><Text style={x.rankingTrendInsightLabel}>YOU</Text><Text style={x.rankingTrendInsightValue}>{fmt(chartMode === "race" ? currentRacePoints : currentFormPoints)} PTS</Text><Text style={x.rankingTrendInsightDetail}>{(chartMode === "race" ? currentGap : formGap) ? `${fmt(chartMode === "race" ? currentGap : formGap)} off pace` : "Leading pace"}</Text></View>
    </View>
    <View style={x.rankingTrendLegend}>{visibleSeries.map(series => <View key={`legend:${series.memberId}`} style={[x.rankingTrendLegendItem, series.current && x.rankingTrendLegendCurrent]}><View style={[x.rankingTrendLegendDot, { backgroundColor: series.color }]} /><Text numberOfLines={1} style={x.rankingTrendLegendName}>{series.name}{series.current ? " · YOU" : ""}</Text><Text style={x.rankingTrendLegendScore}>{fmt(chartMode === "race" ? series.values[activeMatchIndex]?.value : series.values[activeMatchIndex]?.matchPoints)}</Text></View>)}</View>
  </View>;
}

function RankingHeroStat({ label, value, detail }: { label: string; value: string; detail: string }) { return <View style={x.rankingHeroStat}><Text style={x.rankingHeroStatLabel}>{label}</Text><Text numberOfLines={1} style={x.rankingHeroStatValue}>{value}</Text><Text numberOfLines={1} style={x.rankingHeroStatDetail}>{detail}</Text></View>; }

function RankingPodiumCard({ row, winner, current, compact, leaderPoints }: { row: any; winner: boolean; current: boolean; compact: boolean; leaderPoints: number }) {
  const rank = Number(row.rank);
  const theme = ownerTheme(row.display_name);
  const palette = rank === 1
    ? { strong: "#805300", soft: "#FFF5CC", border: "#D9AA24", accent: "#E6B82F", glow: "rgba(230,184,47,0.19)" }
    : rank === 2
      ? { strong: "#485868", soft: "#EFF3F6", border: "#AEBAC5", accent: "#9EABB8", glow: "rgba(142,157,171,0.18)" }
      : { strong: "#7D4123", soft: "#FAEADF", border: "#C9855D", accent: "#B96E43", glow: "rgba(185,110,67,0.17)" };
  const matches = Number(row.matches_scored ?? 0);
  const behindLeader = Math.max(0, Math.round(leaderPoints) - Math.round(Number(row.total_points)));
  return <View accessibilityLabel={`${row.display_name}, podium rank ${rank}, ${fmt(row.total_points)} points`} style={[x.rankingPodiumCard, { borderColor: palette.border, backgroundColor: palette.soft }, compact && x.rankingPodiumCardCompact, winner && x.rankingPodiumCardWinner, winner && compact && x.rankingPodiumCardWinnerCompact, current && x.rankingPodiumCardCurrent]}>
    <View style={[x.rankingPodiumTopBar, { backgroundColor: palette.accent }]} /><View style={[x.rankingPodiumGlow, { backgroundColor: palette.glow }]} />
    {current && !compact ? <View style={x.rankingPodiumYou}><Text style={x.rankingPodiumYouText}>YOU</Text></View> : null}
    <View style={[x.rankingMedal, compact && x.rankingMedalCompact, { backgroundColor: palette.soft, borderColor: palette.border }]}><Text style={[x.rankingMedalRank, compact && x.rankingMedalRankCompact, { color: palette.strong }]}>{rank}</Text><View style={[x.rankingMedalRibbon, { backgroundColor: palette.strong }]} /></View>
    <View style={[x.rankingPodiumAvatar, compact && x.rankingPodiumAvatarCompact, { backgroundColor: theme.soft, borderColor: theme.border }]}><Text style={[x.rankingPodiumAvatarText, compact && x.rankingPodiumAvatarTextCompact, { color: theme.strong }]}>{String(row.display_name ?? "?").charAt(0).toUpperCase()}</Text></View>
    <Text numberOfLines={1} adjustsFontSizeToFit style={[x.rankingPodiumName, compact && x.rankingPodiumNameCompact]}>{row.display_name}{current && compact ? " · YOU" : ""}</Text>
    <Text style={[x.rankingPodiumPoints, compact && x.rankingPodiumPointsCompact, { color: palette.strong }]}>{fmt(row.total_points)}</Text><Text style={[x.rankingPodiumPointsLabel, compact && x.rankingPodiumCompactBadgeText]}>POINTS</Text>
    <Text numberOfLines={1} style={[x.rankingPodiumMeta, compact && x.rankingPodiumCompactBadgeText]}>{matches === 1 ? (compact ? "1 match" : "1 scored match") : `${matches} ${compact ? "matches" : "scored matches"}`}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[x.rankingPodiumLeaderGap, compact && x.rankingPodiumCompactBadgeText, !behindLeader && x.rankingPodiumLeader]}>{behindLeader ? `${fmt(behindLeader)} ${compact ? "to" : "behind"} #1` : "LEADER"}</Text>
  </View>;
}

function RankingChaserCard({ row, previous, leader, current, compact }: { row: any; previous: any; leader: any; current: boolean; compact: boolean }) {
  const theme = ownerTheme(row.display_name);
  const gap = Math.max(0, Math.round(Number(previous?.total_points ?? row.total_points)) - Math.round(Number(row.total_points)));
  const behindLeader = leader ? Math.max(0, Math.round(Number(leader.total_points)) - Math.round(Number(row.total_points))) : 0;
  const matches = Number(row.matches_scored ?? 0);
  const average = matches ? Number(row.total_points) / matches : 0;
  const progress = leader && Number(leader.total_points) > 0 ? Math.max(7, Math.min(100, Number(row.total_points) / Number(leader.total_points) * 100)) : 0;
  const progressRounded = Math.round(progress);
  return <View accessibilityLabel={`${row.display_name}, rank ${row.rank}, ${fmt(row.total_points)} points, ${gap ? `${fmt(gap)} points behind rank ${previous?.rank}` : "tied on points"}, ${fmt(behindLeader)} points behind rank 1`} style={[x.rankingChaserCard, compact ? x.rankingChaserCardCompact : x.rankingChaserCardDesktop, { borderColor: current ? UI_TOKENS.colors.primary : theme.border, backgroundColor: current ? UI_TOKENS.colors.primarySoft : "#FFFFFF" }, current && x.rankingChaserCardCurrent]}>
    <View style={[x.rankingChaserAccent, { backgroundColor: current ? UI_TOKENS.colors.primary : theme.accent }]} />
    <View style={x.rankingChaserTop}>
      <View style={[x.rankingChaserRank, { backgroundColor: current ? UI_TOKENS.colors.primary : theme.soft }]}><Text style={[x.rankingChaserRankText, { color: current ? UI_TOKENS.colors.accent : theme.strong }]}>#{row.rank}</Text></View>
      <OwnerAvatar owner={row.display_name} current={current} />
      <View style={x.rankingChaserIdentity}><View style={x.rankingOwnerLine}><Text numberOfLines={1} style={[x.rankingChaserName, compact && x.rankingChaserNameCompact]}>{row.display_name}</Text>{current ? <View style={x.rankingYouBadge}><Text style={x.youBadgeText}>YOU</Text></View> : null}</View><Text numberOfLines={1} style={[x.rankingChaserMeta, compact && x.rankingChaserCompactBadgeText]}>{matches === 1 ? "1 match" : `${matches} matches`} · {fmt(average)} avg</Text></View>
      <View style={x.rankingChaserScore}><Text style={[x.rankingChaserPoints, compact && x.rankingChaserPointsCompact]}>{fmt(row.total_points)}</Text><Text style={[x.rankingChaserPointsLabel, compact && x.rankingChaserCompactBadgeText]}>POINTS</Text></View>
    </View>
    {compact ? <><View style={x.rankingChaserCompactMetrics}><Text numberOfLines={1} style={x.rankingChaserCompactMetricText}>{gap ? `${fmt(gap)} pts to #${previous?.rank}` : `Tied #${previous?.rank}`}</Text><View style={x.rankingChaserCompactMetricDot} /><Text numberOfLines={1} style={x.rankingChaserCompactMetricText}>{fmt(behindLeader)} pts to #1</Text></View><View style={x.rankingChaserCompactProgress}><View style={x.rankingChaserCompactTrack}><View style={[x.rankingChaserProgressFill, { width: `${progress}%` as any, backgroundColor: current ? UI_TOKENS.colors.primary : theme.accent }]} /></View><Text style={x.rankingChaserCompactProgressText}>{progressRounded}%</Text></View></> : <><View style={x.rankingChaserMetrics}>
      <View style={x.rankingChaserMetric}><Text style={x.rankingChaserMetricLabel}>NEXT RANK</Text><Text style={x.rankingChaserMetricValue}>{gap ? `${fmt(gap)} pts` : "Tied"}</Text><Text style={x.rankingChaserMetricDetail}>{gap ? `behind #${previous?.rank}` : `with #${previous?.rank}`}</Text></View>
      <View style={x.rankingChaserMetricDivider} />
      <View style={x.rankingChaserMetric}><Text style={x.rankingChaserMetricLabel}>LEADER GAP</Text><Text style={x.rankingChaserMetricValue}>{fmt(behindLeader)} pts</Text><Text style={x.rankingChaserMetricDetail}>behind #1</Text></View>
    </View>
    <View style={x.rankingChaserProgressHeading}><Text style={x.rankingChaserProgressLabel}>CHASE PROGRESS</Text><Text style={x.rankingChaserProgressValue}>{progressRounded}% of leader</Text></View><View style={x.rankingChaserProgressTrack}><View style={[x.rankingChaserProgressFill, { width: `${progress}%` as any, backgroundColor: current ? UI_TOKENS.colors.primary : theme.accent }]} /></View></>}
  </View>;
}

function Chip({ active, label, detail, onPress }: { active: boolean; label: string; detail: string; onPress: () => void }) { return <TouchableOpacity accessibilityRole="tab" accessibilityLabel={`${label}, ${detail}`} accessibilityState={{ selected: active }} style={[x.chip, active && x.chipActive]} onPress={onPress}><View style={[x.chipIndicator, active && x.chipIndicatorActive]} /><Text numberOfLines={1} style={[x.chipLabel, active && x.chipLabelActive]}>{label}</Text><Text style={[x.chipDetail, active && x.chipDetailActive]}>{detail}</Text></TouchableOpacity>; }
function HorizontalFilterLabel({ label, showHint }: { label: string; showHint: boolean }) { return <View style={x.historyFilterLabelRow}><Text style={x.historyFilterLabel}>{label}</Text>{showHint ? <Text style={x.horizontalScrollHint}>SWIPE →</Text> : null}</View>; }

export function ProductionMatches({ leagueId, memberId, roster, availableFixtureIds, openTeam, openHistory }: { leagueId: string; memberId: string; roster: Player[]; availableFixtureIds: Array<string | undefined>; openTeam: (fixtureId: string) => void; openHistory: (fixtureId: string) => void }) {
  const { width: matchesWidth } = useWindowDimensions();
  const compact = matchesWidth < 620;
  const [matches, setMatches] = useState<any[]>([]);
  const [royalties, setRoyalties] = useState<any[]>([]);
  const [royaltyMode, setRoyaltyMode] = useState(false);
  const [expanded, setExpanded] = useState("");
  const [matchFilter, setMatchFilter] = useState<"ALL" | "UPCOMING" | "ACTIVE" | "PUBLISHED">("ALL");
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { let cancelled = false; setLoading(true); setMatches([]); setRoyalties([]); setRoyaltyMode(false); setError(""); Promise.all([
    supabase.from("fixtures").select("id,match_number,scheduled_start,lineup_lock_at,status,scoring_status,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code),lineup_submissions(id,member_id,status,submitted_at),player_match_points(player_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,breakdown,calculation_version,published_at,player:players(full_name))").eq("league_id", leagueId).order("match_number"),
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
    setLoading(false);
  }).catch(reason => {
    if (!cancelled) {
      setError(reason instanceof Error ? reason.message : "Could not load fixtures.");
      setLoading(false);
    }
  }); return () => { cancelled = true; }; }, [leagueId, reloadKey]);
  const specialLabels = useFixtureSpecialLabels(expanded ? [expanded] : []);
  const filteredMatches = useMemo(() => matches.filter(match => {
    if (matchFilter === "UPCOMING") return match.status === "scheduled";
    if (matchFilter === "ACTIVE") return match.status !== "scheduled" && match.scoring_status !== "published";
    if (matchFilter === "PUBLISHED") return match.scoring_status === "published";
    return true;
  }), [matches, matchFilter]);
  const visibleMatches = filteredMatches.slice(0, visibleLimit);
  const upcomingCount = matches.filter(match => match.status === "scheduled").length;
  const activeCount = matches.filter(match => match.status !== "scheduled" && match.scoring_status !== "published").length;
  const publishedCount = matches.filter(match => match.scoring_status === "published").length;
  const actionableMatch = matches.find(match => {
    const ownerSubmission = (match.lineup_submissions ?? []).some((lineup: any) => lineup.member_id === memberId);
    const locked = match.status !== "scheduled" || (match.lineup_lock_at && new Date(match.lineup_lock_at).getTime() <= Date.now());
    return match.status === "scheduled" && availableFixtureIds.includes(match.id) && !locked && !ownerSubmission;
  }) ?? matches.find(match => {
    const locked = match.status !== "scheduled" || (match.lineup_lock_at && new Date(match.lineup_lock_at).getTime() <= Date.now());
    return match.status === "scheduled" && availableFixtureIds.includes(match.id) && !locked;
  });
  const actionableSubmission = actionableMatch?.lineup_submissions?.find((lineup: any) => lineup.member_id === memberId);
  const actionableDate = actionableMatch?.scheduled_start ? new Date(actionableMatch.scheduled_start).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "Time to be confirmed";
  if (loading) return <ScrollView contentContainerStyle={x.screen}><Loading /></ScrollView>;
  if (error) return <ScrollView contentContainerStyle={x.screen}><LoadError message={error} onRetry={() => setReloadKey(value => value + 1)} /></ScrollView>;
  return <ScrollView contentContainerStyle={x.screen}>
    <View style={x.fixtureHero}>
      <View style={x.fixtureHeroGlow} />
      <View style={x.fixtureHeroHeading}><View style={x.fixtureHeroMark}><Text style={x.fixtureHeroMarkText}>▦</Text></View><View style={x.grow}><Text style={x.fixtureHeroEyebrow}>MATCH CENTRE</Text><Text accessibilityRole="header" style={x.fixtureHeroTitle}>Fixtures & lineups</Text><Text style={x.fixtureHeroSubtitle}>Plan your next XI and follow every match result.</Text></View></View>
      {matches.length ? <View style={[x.fixtureHeroStats, compact && x.fixtureHeroStatsCompact]}><FixtureHeroStat label="FIXTURES" value={matches.length} /><FixtureHeroStat label="UPCOMING" value={upcomingCount} /><FixtureHeroStat label="ACTIVE" value={activeCount} /><FixtureHeroStat label="PUBLISHED" value={publishedCount} /></View> : null}
      {actionableMatch ? <View style={[x.fixtureHeroAction, compact && x.fixtureHeroActionCompact]}><View style={x.fixtureHeroActionMain}><Text style={x.fixtureHeroActionLabel}>{actionableSubmission ? "NEXT LINEUP" : "ACTION REQUIRED"}</Text><View style={x.fixtureHeroTeams}><Text style={x.fixtureHeroMatch}>MATCH {actionableMatch.match_number}</Text><IplTeamBadge code={actionableMatch.home?.code} /><Text style={x.fixtureHeroVs}>VS</Text><IplTeamBadge code={actionableMatch.away?.code} /></View><Text numberOfLines={1} style={x.fixtureHeroDate}>{actionableDate}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel={`${actionableSubmission ? "Edit" : "Submit"} XI for Match ${actionableMatch.match_number}`} style={[x.fixtureHeroActionButton, compact && x.fixtureHeroActionButtonCompact]} onPress={() => openTeam(actionableMatch.id)}><Text style={x.fixtureHeroActionButtonText}>{actionableSubmission ? "Edit XI" : "Submit XI"}</Text><Text style={x.fixtureHeroActionArrow}>›</Text></TouchableOpacity></View> : null}
    </View>
    {matches.length ? <View style={x.fixtureFilterPanel}><View style={x.fixtureBrowseHeading}><View><Text style={x.fixtureBrowseEyebrow}>FULL SCHEDULE</Text><Text style={x.fixtureBrowseTitle}>Browse fixtures</Text></View><Text style={x.fixtureBrowseCount}>{filteredMatches.length} matches</Text></View><View style={x.fixtureFilterHeading}><Text style={x.fixtureFilterHeadingText}>STATUS</Text>{matchesWidth < 520 ? <Text style={x.horizontalScrollHint}>SWIPE →</Text> : null}</View><ScrollView horizontal accessibilityRole="tablist" style={x.fixtureFilterScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={x.fixtureFilters}>{([['ALL', 'All'], ['UPCOMING', 'Upcoming'], ['ACTIVE', 'Live / awaiting'], ['PUBLISHED', 'Published']] as Array<[typeof matchFilter, string]>).map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="tab" accessibilityLabel={`${label} fixtures`} accessibilityState={{ selected: matchFilter === value }} style={[x.fixtureFilter, matchFilter === value && x.fixtureFilterActive]} onPress={() => { setMatchFilter(value); setExpanded(""); setVisibleLimit(12); }}><Text style={[x.fixtureFilterText, matchFilter === value && x.fixtureFilterTextActive]}>{label}</Text></TouchableOpacity>)}</ScrollView></View> : null}
    {!matches.length ? <Empty title="No fixtures yet" text="Fixtures will appear after the league schedule is imported." /> : null}
    {matches.length && !filteredMatches.length ? <Empty title="No matching fixtures" text="Choose another fixture filter to see matches." /> : null}
    {visibleMatches.map(match => {
      const open = expanded === match.id;
      const latestVersion = Math.max(0, ...(match.player_match_points ?? []).filter((point: any) => point.published_at).map((point: any) => point.calculation_version));
      const points = [...(match.player_match_points ?? [])].filter((point: any) => point.published_at && point.calculation_version === latestVersion).sort((a, b) => {
        const pa = roster.find(p => p.name === a.player?.full_name);
        const pb = roster.find(p => p.name === b.player?.full_name);
        return (pa?.team ?? "").localeCompare(pb?.team ?? "") || Number(b.total_points) - Number(a.total_points);
      });
      const matchRoyalties = royalties.filter(row => row.fixture_id === match.id);
      const published = match.scoring_status === "published";
      const noResult = isNoResultFixture(match.status);
      const noResultSettled = noResult && published;
      const completed = match.status === "completed";
      const ownerSubmission = (match.lineup_submissions ?? []).find((lineup: any) => lineup.member_id === memberId && (lineup.status === "submitted" || lineup.status === "locked"));
      const locked = match.status !== "scheduled" || (match.lineup_lock_at && new Date(match.lineup_lock_at).getTime() <= Date.now());
      const availableForSelection = availableFixtureIds.includes(match.id);
      const ownerAction = fixtureOwnerAction({ availableForSelection, locked, completed, published, hasSubmission: !!ownerSubmission });
      const ownerActionLabel = fixtureOwnerActionLabel({ action: ownerAction, published });
      const ownerStatus = noResultSettled ? "REFUNDED" : noResult ? "REFUND PENDING" : ownerSubmission ? "SUBMITTED" : locked ? "NOT SUBMITTED" : availableForSelection ? "ACTION NEEDED" : "NOT OPEN";
      const statusLabel = noResultSettled ? "NO RESULT" : noResult ? "NO RESULT PENDING" : published ? "PUBLISHED" : match.status === "live" ? "LIVE" : completed ? "AWAITING SCORES" : "UPCOMING";
      const detailsAvailable = noResult || published || completed;
      const fixtureTone = noResult ? { accent: UI_TOKENS.status.neutral, wash: UI_TOKENS.status.neutralWash } : published ? { accent: UI_TOKENS.status.success, wash: UI_TOKENS.status.successWash } : match.status === "live" ? { accent: "#C95C24", wash: "#FFF0E7" } : completed ? { accent: UI_TOKENS.status.neutral, wash: UI_TOKENS.status.neutralWash } : availableForSelection ? { accent: UI_TOKENS.status.warning, wash: UI_TOKENS.status.warningWash } : { accent: UI_TOKENS.colors.primary, wash: UI_TOKENS.colors.primarySoft };
      const scheduled = match.scheduled_start ? new Date(match.scheduled_start).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "Time to be confirmed";
      return <View key={match.id} style={[x.fixtureMatchCard, open && x.fixtureMatchCardOpen, { borderLeftColor: fixtureTone.accent }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Match ${match.match_number}, ${match.home?.code} versus ${match.away?.code}, ${statusLabel}${detailsAvailable ? ", view match details" : ""}`} accessibilityState={{ expanded: detailsAvailable ? open : undefined, disabled: !detailsAvailable }} disabled={!detailsAvailable} style={[x.fixtureMatchHeader, compact && x.fixtureMatchHeaderCompact]} onPress={() => setExpanded(open ? "" : match.id)}>
          <View style={[x.fixtureMatchNumber, { backgroundColor: fixtureTone.wash }]}><Text style={[x.fixtureMatchNumberLabel, { color: fixtureTone.accent }]}>MATCH</Text><Text style={[x.fixtureMatchNumberValue, { color: fixtureTone.accent }]}>{match.match_number}</Text></View>
          <View style={x.fixtureMatchIdentity}><View style={x.fixtureMatchTeams}><IplTeamBadge code={match.home?.code} /><Text style={x.fixtureMatchVs}>VS</Text><IplTeamBadge code={match.away?.code} /></View><Text numberOfLines={1} style={x.fixtureMatchDate}>{scheduled}</Text></View>
          <View style={x.fixtureMatchEnd}><View style={[x.fixtureMatchStatus, { backgroundColor: fixtureTone.wash }]}><View style={[x.fixtureMatchStatusDot, { backgroundColor: fixtureTone.accent }]} /><Text numberOfLines={1} style={[x.fixtureMatchStatusText, { color: fixtureTone.accent }]}>{statusLabel}</Text></View>{detailsAvailable ? <View style={x.fixtureMatchDisclosure}><Text style={x.fixtureMatchDisclosureText}>{open ? "HIDE" : noResult ? "DETAILS" : published ? "SCORES" : "DETAILS"}</Text><Text style={x.fixtureMatchDisclosureIcon}>{open ? "▲" : "▼"}</Text></View> : null}</View>
        </TouchableOpacity>
        <View style={x.ownerSubmissionBar}><View style={x.ownerSubmissionIdentity}><Text style={x.ownerSubmissionLabel}>YOUR XI</Text><View style={[x.ownerSubmissionPill, noResult ? x.ownerSubmissionLater : ownerSubmission ? x.ownerSubmissionDone : locked ? x.ownerSubmissionMissed : availableForSelection ? x.ownerSubmissionNeeded : x.ownerSubmissionLater]}><Text style={[x.ownerSubmissionPillText, noResult ? x.ownerSubmissionLaterText : ownerSubmission ? x.ownerSubmissionDoneText : locked ? x.ownerSubmissionMissedText : availableForSelection ? x.ownerSubmissionNeededText : x.ownerSubmissionLaterText]}>{ownerStatus}</Text></View></View>{ownerAction === "submit" || ownerAction === "edit" ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${ownerActionLabel} for Match ${match.match_number}`} style={x.ownerSubmissionAction} onPress={() => openTeam(match.id)}><Text style={x.ownerSubmissionActionText}>{ownerActionLabel}</Text><Text style={x.ownerSubmissionActionArrow}>›</Text></TouchableOpacity> : ownerAction === "history" ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${noResult ? "View No Result details" : ownerActionLabel} for Match ${match.match_number}`} style={x.ownerSubmissionAction} onPress={() => openHistory(match.id)}><Text style={x.ownerSubmissionActionText}>{noResult ? "View details" : ownerActionLabel}</Text><Text style={x.ownerSubmissionActionArrow}>›</Text></TouchableOpacity> : <Text style={x.ownerSubmissionLocked}>{ownerActionLabel}</Text>}</View>
        {open ? noResult ? <Empty title={noResultSettled ? "No Result" : "Settlement pending"} text={noResultSettled ? "This fixture was voided. Transfers and boosters were refunded, later unlocked XIs were reset, and later locked XI charges were rebased to the last valid team." : "A league administrator must settle this fixture before transfers, boosters, and later XI charges are corrected."} /> : points.length ? <View style={x.fixtureScores}>
          {compact ? <View style={x.fixtureScoreIntro}><Text style={x.fixtureScoreIntroTitle}>PLAYER POINTS</Text><Text style={x.fixtureScoreIntroText}>{points.length} published players · Tap Results for owner XI totals</Text></View> : <View style={x.pointHead}><Text style={x.pointPlayer}>PLAYER</Text><Text style={x.pointCell}>BAT</Text><Text style={x.pointCell}>BOWL</Text><Text style={x.pointCell}>FLD</Text><Text style={x.pointCell}>BON</Text>{royaltyMode ? <Text style={x.pointCell}>ROY</Text> : null}<Text style={x.pointTotal}>TOTAL</Text></View>}
          {points.map(point => {
            const player = roster.find(p => p.name === point.player?.full_name);
            const playerRoyalties = matchRoyalties.filter(row => row.player_id === point.player_id);
            const playerRoyaltyTotal = playerRoyalties.reduce((sum, royalty) => sum + Number(royalty.adjustment_points), 0);
            const totalPoints = Number(point.total_points) + (royaltyMode ? playerRoyaltyTotal : 0);
            return compact ? <View key={point.player_id ?? point.player?.full_name} style={x.fixtureScoreCard}><View style={x.fixtureScoreTop}><View style={x.fixtureScoreIdentity}><View style={x.playerLabelRow}><Text numberOfLines={1} style={x.fixtureScoreName}>{point.player?.full_name}</Text>{(specialLabels[match.id]?.[point.player?.full_name] ?? []).map(label => <SpecialPlayerBadge key={label} label={label} />)}</View><View style={x.inlineMeta}><IplTeamBadge code={player?.team} /><OwnerBadge owner={player?.owner} label={player?.owner === "Available" ? "Open player" : player?.owner ?? "—"} compact /></View></View><View style={x.fixtureScoreTotal}><Text style={x.fixtureScoreTotalValue}>{fmt(totalPoints)}</Text><Text style={x.fixtureScoreTotalLabel}>PTS</Text></View></View><View style={x.fixtureScoreMetrics}><FixtureScoreMetric label="BAT" value={point.batting_points} /><FixtureScoreMetric label="BOWL" value={point.bowling_points} /><FixtureScoreMetric label="FLD" value={point.fielding_points} /><FixtureScoreMetric label="BON" value={point.bonus_points} />{royaltyMode ? <FixtureScoreMetric label="ROY" value={playerRoyaltyTotal} accent={playerRoyaltyTotal > 0} /> : null}</View></View> : <View key={point.player_id ?? point.player?.full_name} style={x.pointRow}><View style={x.pointPlayer}><View style={x.playerLabelRow}><Text style={x.name}>{point.player?.full_name}</Text>{(specialLabels[match.id]?.[point.player?.full_name] ?? []).map(label => <SpecialPlayerBadge key={label} label={label} />)}</View><View style={x.inlineMeta}><IplTeamBadge code={player?.team} /><OwnerBadge owner={player?.owner} label={player?.owner === "Available" ? "Open player" : player?.owner ?? "—"} compact /></View></View><Text style={x.pointCell}>{fmt(point.batting_points)}</Text><Text style={x.pointCell}>{fmt(point.bowling_points)}</Text><Text style={x.pointCell}>{fmt(point.fielding_points)}</Text><Text style={x.pointCell}>{fmt(point.bonus_points)}</Text>{royaltyMode ? <Text style={[x.pointCell, playerRoyaltyTotal > 0 && x.royaltyColumn]}>{fmt(playerRoyaltyTotal)}</Text> : null}<Text style={x.pointTotal}>{fmt(totalPoints)}</Text></View>;
          })}
        </View> : <Empty text={match.scoring_status === "review" ? "Points are under admin review." : "Points have not been published."} /> : null}
      </View>;
    })}
    {filteredMatches.length > visibleMatches.length ? <View style={x.fixtureLoadMore}><View><Text style={x.fixtureLoadMoreTitle}>Showing {visibleMatches.length} of {filteredMatches.length}</Text><Text style={x.fixtureLoadMoreText}>Load more fixtures when you need them.</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Load 12 more fixtures" style={x.fixtureLoadMoreButton} onPress={() => setVisibleLimit(limit => limit + 12)}><Text style={x.fixtureLoadMoreButtonText}>Load 12 more</Text></TouchableOpacity></View> : null}
  </ScrollView>;
}

function FixtureHeroStat({ label, value }: { label: string; value: number }) { return <View style={x.fixtureHeroStat}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={x.fixtureHeroStatValue}>{value}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={x.fixtureHeroStatLabel}>{label}</Text></View>; }
function FixtureScoreMetric({ label, value, accent = false }: { label: string; value: unknown; accent?: boolean }) { return <View style={[x.fixtureScoreMetric, accent && x.fixtureScoreMetricAccent]}><Text style={[x.fixtureScoreMetricLabel, accent && x.fixtureScoreMetricLabelAccent]}>{label}</Text><Text style={[x.fixtureScoreMetricValue, accent && x.fixtureScoreMetricValueAccent]}>{fmt(value)}</Text></View>; }

type SpecialSelectionConfig = { type: "unique" | "marquee"; required: number };
type SpecialSelectionPhase = { id: string; name: string; sort_order: number; is_final_phase: boolean; opensAt: string | null; closesAt: string | null };
type OwnerPlayerSort = "points" | "royalty" | "cost" | "name";
type OwnerRoleFilter = "ALL" | Player["role"];
type OwnerSpecialFilter = "ALL" | "MARQUEE";
type OwnerPlayerMatchScore = {
  fixtureId: string;
  matchNumber: number;
  home: string;
  away: string;
  batting: number;
  bowling: number;
  fielding: number;
  bonus: number;
  royalty: number;
  total: number;
};
type PlayerPerformanceInsights = { average: number; bestMatch: OwnerPlayerMatchScore | null };

function PlayerFormTrend({ matches, compact }: { matches: OwnerPlayerMatchScore[]; compact: boolean }) {
  const recent = [...matches].sort((left, right) => left.matchNumber - right.matchNumber).slice(-6);
  if (!recent.length) return null;
  const maxMagnitude = Math.max(1, ...recent.map(match => Math.abs(match.total)));
  const accessibilitySummary = recent.map(match => `Match ${match.matchNumber}, ${fmt(match.total)} points`).join("; ");
  return <View accessible accessibilityLabel={`Recent fantasy form. ${accessibilitySummary}`} style={[x.playerPoolFormCard, compact && x.playerPoolFormCardCompact]}>
    <View style={x.playerPoolFormHeader}><View><Text style={x.playerPoolFormEyebrow}>RECENT FORM</Text><Text style={x.playerPoolFormTitle}>Fantasy points trend</Text></View></View>
    <View style={x.playerPoolFormPlot}>{recent.map(match => {
      const barHeight = Math.max(5, Math.round((Math.abs(match.total) / maxMagnitude) * (compact ? 34 : 40)));
      const negative = match.total < 0;
      const zero = match.total === 0;
      return <View key={match.fixtureId} style={x.playerPoolFormPoint}><Text style={[x.playerPoolFormValue, negative && x.playerPoolFormValueNegative]}>{fmt(match.total)}</Text><View style={[x.playerPoolFormTrack, compact && x.playerPoolFormTrackCompact]}><View style={[x.playerPoolFormBar, { height: barHeight }, negative ? x.playerPoolFormBarNegative : zero ? x.playerPoolFormBarZero : x.playerPoolFormBarPositive]} /></View><Text style={x.playerPoolFormMatch}>M{match.matchNumber}</Text></View>;
    })}</View>
    <Text style={x.playerPoolFormCaption}>Last {recent.length} published match{recent.length === 1 ? "" : "es"} · Fantasy points only</Text>
  </View>;
}

function OwnerPlayerMatchBreakdown({ matches, compact, royaltyMode, career, fantasyOnly = false, insights, onOpenScorecard }: { matches: OwnerPlayerMatchScore[]; compact: boolean; royaltyMode: boolean; career: { matches: number; batting: number; bowling: number; fielding: number; bonus: number; royalty: number; total: number }; fantasyOnly?: boolean; insights?: PlayerPerformanceInsights; onOpenScorecard?: (fixtureId: string) => void }) {
  if (!matches.length) return <View style={x.ownerMatchLedgerEmpty}><Text style={x.ownerMatchLedgerEmptyTitle}>No published match points yet</Text><Text style={x.ownerMatchLedgerEmptyText}>Match-by-match scores will appear here after points are published.</Text></View>;
  return <View style={[x.ownerMatchLedger, compact && x.ownerMatchLedgerCompact]}><View style={x.ownerMatchLedgerHeading}><View><Text style={x.ownerMatchLedgerEyebrow}>MATCH HISTORY</Text><Text style={x.ownerMatchLedgerTitle}>Points by match</Text></View><Text style={x.ownerMatchLedgerCount}>{matches.length} scored</Text></View>
  {insights ? <View style={[x.playerPoolInsights, compact && x.playerPoolInsightsCompact]}><View style={x.playerPoolInsight}><Text style={x.playerPoolInsightLabel}>MATCHES</Text><Text style={x.playerPoolInsightValue}>{career.matches}</Text><Text style={x.playerPoolInsightMeta}>scored</Text></View><View style={x.playerPoolInsight}><Text style={x.playerPoolInsightLabel}>AVERAGE</Text><Text style={x.playerPoolInsightValue}>{fmt(insights.average)}</Text><Text style={x.playerPoolInsightMeta}>fantasy pts</Text></View><View style={x.playerPoolInsight}><Text style={x.playerPoolInsightLabel}>BEST MATCH</Text><Text style={x.playerPoolInsightValue}>{insights.bestMatch ? fmt(insights.bestMatch.total) : "—"}</Text><Text numberOfLines={1} style={x.playerPoolInsightMeta}>{insights.bestMatch ? `M${insights.bestMatch.matchNumber} · ${insights.bestMatch.home} vs ${insights.bestMatch.away}` : "No score"}</Text></View>{royaltyMode ? <View style={[x.playerPoolInsight, x.playerPoolRoyaltyInsight]}><Text style={[x.playerPoolInsightLabel, x.royaltyColumn]}>ROY GENERATED</Text><Text style={[x.playerPoolInsightValue, x.royaltyColumn]}>{fmt(career.royalty)}</Text><Text style={x.playerPoolInsightMeta}>owner credit</Text></View> : null}</View> : null}
  {insights ? <PlayerFormTrend matches={matches} compact={compact} /> : null}
  {compact ? <>{matches.map(match => <View key={match.fixtureId} style={x.ownerMatchCard}><View style={x.ownerMatchCardTop}><View><Text style={x.ownerMatchCardNumber}>MATCH {match.matchNumber}</Text><Text style={x.ownerMatchCardTeams}>{match.home} vs {match.away}</Text></View><View style={x.ownerMatchCardTotal}><Text style={x.ownerMatchCardTotalValue}>{fmt(match.total)}</Text><Text style={x.ownerMatchCardTotalLabel}>{fantasyOnly ? "FANTASY PTS" : "TOTAL PTS"}</Text></View></View><View style={x.ownerSquadPlayerMetrics}><FixtureScoreMetric label="BAT" value={match.batting} /><FixtureScoreMetric label="BOWL" value={match.bowling} /><FixtureScoreMetric label="FIELD" value={match.fielding} /><FixtureScoreMetric label="BONUS" value={match.bonus} />{royaltyMode ? <FixtureScoreMetric label="ROY" value={match.royalty} accent={match.royalty > 0} /> : null}</View>{onOpenScorecard ? <TouchableOpacity accessibilityRole="link" accessibilityLabel={`Open scorecard for Match ${match.matchNumber}, ${match.home} versus ${match.away}`} style={x.playerPoolScorecardButton} onPress={() => onOpenScorecard(match.fixtureId)}><Text style={x.playerPoolScorecardIcon}>▤</Text><Text style={x.playerPoolScorecardText}>View scorecard</Text><Text style={x.playerPoolScorecardArrow}>›</Text></TouchableOpacity> : null}</View>)}<View style={x.ownerMatchCareerCompact}><Text style={x.ownerMatchCareerCompactLabel}>{fantasyOnly ? "FANTASY TOTAL" : "CAREER TOTAL"} · {career.matches} MATCH{career.matches === 1 ? "" : "ES"}</Text><Text style={x.ownerMatchCareerCompactValue}>{fmt(career.total)} PTS</Text></View></> : <><View style={x.ownerMatchTableHead}><Text style={x.ownerMatchTableMatchHead}>MATCH</Text><Text style={x.ownerSquadTableMetricHead}>BAT</Text><Text style={x.ownerSquadTableMetricHead}>BOWL</Text><Text style={x.ownerSquadTableMetricHead}>FIELD</Text><Text style={x.ownerSquadTableMetricHead}>BONUS</Text>{royaltyMode ? <Text style={x.ownerSquadTableMetricHead}>ROY</Text> : null}<Text style={x.ownerSquadTableTotalHead}>{fantasyOnly ? "FANTASY" : "TOTAL"}</Text></View>{matches.map(match => <View key={match.fixtureId} style={x.ownerMatchTableRow}><View style={x.ownerMatchTableMatch}><Text style={x.ownerMatchTableNumber}>MATCH {match.matchNumber}</Text><Text style={x.ownerMatchTableTeams}>{match.home} vs {match.away}</Text>{onOpenScorecard ? <TouchableOpacity accessibilityRole="link" accessibilityLabel={`Open scorecard for Match ${match.matchNumber}, ${match.home} versus ${match.away}`} style={x.playerPoolScorecardInline} onPress={() => onOpenScorecard(match.fixtureId)}><Text style={x.playerPoolScorecardInlineText}>▤ Scorecard ›</Text></TouchableOpacity> : null}</View><Text style={x.ownerSquadTableMetric}>{fmt(match.batting)}</Text><Text style={x.ownerSquadTableMetric}>{fmt(match.bowling)}</Text><Text style={x.ownerSquadTableMetric}>{fmt(match.fielding)}</Text><Text style={x.ownerSquadTableMetric}>{fmt(match.bonus)}</Text>{royaltyMode ? <Text style={[x.ownerSquadTableMetric, match.royalty > 0 && x.royaltyColumn]}>{fmt(match.royalty)}</Text> : null}<Text style={x.ownerSquadTableTotal}>{fmt(match.total)}</Text></View>)}<View style={x.ownerMatchCareerRow}><View style={x.ownerMatchTableMatch}><Text style={x.ownerMatchCareerLabel}>{fantasyOnly ? "FANTASY TOTAL" : "CAREER TOTAL"}</Text><Text style={x.ownerMatchTableTeams}>{career.matches} scored match{career.matches === 1 ? "" : "es"}</Text></View><Text style={x.ownerMatchCareerMetric}>{fmt(career.batting)}</Text><Text style={x.ownerMatchCareerMetric}>{fmt(career.bowling)}</Text><Text style={x.ownerMatchCareerMetric}>{fmt(career.fielding)}</Text><Text style={x.ownerMatchCareerMetric}>{fmt(career.bonus)}</Text>{royaltyMode ? <Text style={[x.ownerMatchCareerMetric, career.royalty > 0 && x.royaltyColumn]}>{fmt(career.royalty)}</Text> : null}<Text style={x.ownerMatchCareerTotal}>{fmt(career.total)}</Text></View></>}
  </View>;
}

export function ProductionSquads({ leagueId, currentOwner, roster, specialSelection }: { leagueId: string; currentOwner: string; roster: Player[]; specialSelection?: SpecialSelectionConfig | null }) {
  const { width: ownerSquadsWidth } = useWindowDimensions();
  const compact = ownerSquadsWidth < 620;
  const specialActionLock = useRef(false);
  const [points, setPoints] = useState<any[]>([]);
  const [royalties, setRoyalties] = useState<any[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(currentOwner);
  const [expandedPlayer, setExpandedPlayer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const leagueSpecialLabels = useLeagueSpecialLabels(leagueId);
  const [specialPhase, setSpecialPhase] = useState<SpecialSelectionPhase | null>(null);
  const [specialCurrentPhase, setSpecialCurrentPhase] = useState<SpecialSelectionPhase | null>(null);
  const [specialCurrentSelected, setSpecialCurrentSelected] = useState<string[]>([]);
  const [specialSelected, setSpecialSelected] = useState<string[]>([]);
  const [specialPlayerIds, setSpecialPlayerIds] = useState<Record<string, string>>({});
  const [specialBusy, setSpecialBusy] = useState(false);
  const [specialMessage, setSpecialMessage] = useState("");
  const [playerSort, setPlayerSort] = useState<OwnerPlayerSort>("points");
  const [roleFilter, setRoleFilter] = useState<OwnerRoleFilter>("ALL");
  const [specialFilter, setSpecialFilter] = useState<OwnerSpecialFilter>("ALL");
  const [ownerPlayerSearch, setOwnerPlayerSearch] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  useEffect(() => {
    setRoleFilter("ALL");
    setSpecialFilter("ALL");
    setOwnerPlayerSearch("");
    setFiltersExpanded(false);
  }, [leagueId]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setPoints([]); setRoyalties([]); setMemberNames({});
    Promise.all([
      supabase.from("player_match_points").select("fixture_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,calculation_version,published_at,player:players(full_name,team:cricket_teams(code)),fixture:fixtures!inner(league_id,match_number,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code))").eq("fixture.league_id", leagueId).not("published_at", "is", null),
      supabase.from("special_player_score_adjustments").select("fixture_id,player_id,source_member_id,recipient_member_id,adjustment_type,final_player_contribution,rate_percent,minimum_fee,adjustment_points,player:players(full_name,team:cricket_teams(code))").eq("league_id", leagueId).in("adjustment_type", ["regular_royalty", "marquee_royalty"]),
      supabase.from("league_members").select("id,display_name").eq("league_id", leagueId),
    ]).then(([pointResult, royaltyResult, memberResult]) => {
      if (cancelled) return;
      const e = pointResult.error ?? royaltyResult.error ?? memberResult.error;
      if (e) setError(e.message);
      else {
        setPoints(pointResult.data ?? []);
        setRoyalties(royaltyResult.data ?? []);
        setMemberNames(Object.fromEntries((memberResult.data ?? []).map((member: any) => [member.id, member.display_name])));
      }
    }).catch(loadError => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Owner squads could not be loaded.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [leagueId, reloadKey]);
  useEffect(() => {
    let mounted = true;
    setSpecialPhase(null); setSpecialCurrentPhase(null); setSpecialCurrentSelected([]); setSpecialSelected([]); setSpecialPlayerIds({}); setSpecialMessage("");
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
      const priorToTarget = target ? [...phases].filter(phase => phase.sort_order < target.sort_order).sort((a, b) => b.sort_order - a.sort_order)[0] ?? null : null;
      const latestStartedPhase = [...phases].filter(phase => !!phase.closesAt && new Date(phase.closesAt).getTime() <= now).sort((a, b) => b.sort_order - a.sort_order)[0] ?? null;
      const currentPhase = priorToTarget ?? (target?.sort_order === phases[0]?.sort_order ? null : latestStartedPhase);
      const currentSourcePhase = currentPhase ? [...phases].filter(phase => phase.sort_order <= currentPhase.sort_order && explicit.some(row => row.phase_id === phase.id)).sort((a, b) => b.sort_order - a.sort_order)[0] : null;
      setSpecialPhase(target);
      setSpecialCurrentPhase(currentPhase);
      setSpecialCurrentSelected(currentSourcePhase ? explicit.filter(row => row.phase_id === currentSourcePhase.id).map(row => row.player_id) : []);
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
    if (specialActionLock.current) return;
    specialActionLock.current = true;
    setSpecialBusy(true); setSpecialMessage("");
    try {
      const { error: saveError } = await supabase.rpc("set_phase_special_players", { p_phase_id: specialPhase.id, p_selection_type: specialSelection.type, p_player_ids: specialSelected });
      setSpecialMessage(saveError ? saveError.message : `Saved ${specialSelection.required} ${specialSelection.type === "unique" ? "Unique" : "Marquee"} Players for ${specialPhase.name}.`);
    } finally {
      specialActionLock.current = false;
      setSpecialBusy(false);
    }
  };
  const latestPointRows = useMemo(() => { const latest = new Map<string, any>(); for (const row of points) { const playerKey = `${row.player?.team?.code ?? ""}:${row.player?.full_name ?? ""}`; const key = `${row.fixture_id}:${playerKey}`; if (!latest.has(key) || Number(latest.get(key).calculation_version) < Number(row.calculation_version)) latest.set(key, row); } return [...latest.values()]; }, [points]);
  const totals = useMemo(() => { const map = new Map<string, any>(); for (const row of latestPointRows) { const playerKey = `${row.player?.team?.code ?? ""}:${row.player?.full_name ?? ""}`; const current = map.get(playerKey) ?? { matches: 0, batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 }; map.set(playerKey, { matches: current.matches + 1, batting: current.batting + Number(row.batting_points), bowling: current.bowling + Number(row.bowling_points), fielding: current.fielding + Number(row.fielding_points), bonus: current.bonus + Number(row.bonus_points), total: current.total + Number(row.total_points) }); } return map; }, [latestPointRows]);
  const matchPointsByPlayer = useMemo(() => { const map = new Map<string, any[]>(); for (const row of latestPointRows) { const playerKey = `${row.player?.team?.code ?? ""}:${row.player?.full_name ?? ""}`; if (!row.player?.full_name) continue; map.set(playerKey, [...(map.get(playerKey) ?? []), row]); } for (const rows of map.values()) rows.sort((left, right) => Number(right.fixture?.match_number ?? 0) - Number(left.fixture?.match_number ?? 0)); return map; }, [latestPointRows]);
  const royaltyTotals = useMemo(() => { const map = new Map<string, { total: number; rows: any[] }>(); for (const row of royalties) { const owner = memberNames[row.recipient_member_id]; const name = row.player?.full_name; const team = row.player?.team?.code; if (!owner || !name || !team) continue; const key = `${owner}:${team}:${name}`; const current = map.get(key) ?? { total: 0, rows: [] }; map.set(key, { total: current.total + Number(row.adjustment_points), rows: [...current.rows, row] }); } return map; }, [royalties, memberNames]);
  if (loading) return <Loading />;
  if (error) return <LoadError message={error} onRetry={() => setReloadKey(value => value + 1)} />;
  const owners = Array.from(new Set(roster.filter(p => p.owner !== "Available").map(p => p.owner))).sort((a, b) => a === currentOwner ? -1 : b === currentOwner ? 1 : a.localeCompare(b));
  const royaltyMode = specialSelection?.type === "marquee";
  const selectedSpecialNames = specialSelected.map(playerId => Object.entries(specialPlayerIds).find(([, id]) => id === playerId)?.[0]).filter((name): name is string => !!name);
  const currentSpecialNames = specialCurrentSelected.map(playerId => Object.entries(specialPlayerIds).find(([, id]) => id === playerId)?.[0]).filter((name): name is string => !!name);
  const specialLabel = specialSelection?.type === "unique" ? "Unique" : "Marquee";
  const auctionPlayers = roster.filter(player => player.owner !== "Available");
  const currentOwnerPlayers = auctionPlayers.filter(player => player.owner === currentOwner);
  const currentOwnerBasePoints = currentOwnerPlayers.reduce((sum, player) => sum + (totals.get(`${player.team}:${player.name}`)?.total ?? 0), 0);
  const currentOwnerRoyalty = currentOwnerPlayers.reduce((sum, player) => sum + (royaltyTotals.get(`${currentOwner}:${player.team}:${player.name}`)?.total ?? 0), 0);
  const normalizedOwnerSearch = ownerPlayerSearch.trim().toLocaleLowerCase();
  const ownerPlayerMatchesFilters = (player: Player) => (!normalizedOwnerSearch || player.name.toLocaleLowerCase().includes(normalizedOwnerSearch)) && (roleFilter === "ALL" || player.role === roleFilter) && (specialFilter === "ALL" || (leagueSpecialLabels[player.name] ?? []).includes("MARQUEE"));
  const matchingOwnerPlayers = auctionPlayers.filter(ownerPlayerMatchesFilters);
  const visibleOwners = owners.filter(owner => matchingOwnerPlayers.some(player => player.owner === owner));
  const ownerFiltersApplied = !!normalizedOwnerSearch || roleFilter !== "ALL" || specialFilter !== "ALL" || playerSort !== "points";
  const ownerFilterCount = Number(roleFilter !== "ALL") + Number(specialFilter !== "ALL") + Number(playerSort !== "points");
  const resetOwnerFilters = () => { setOwnerPlayerSearch(""); setRoleFilter("ALL"); setSpecialFilter("ALL"); setPlayerSort("points"); };
  return <View>
<View style={x.ownerSquadsHero}><View style={x.ownerSquadsHeroGlow} /><View style={x.directoryHeroHeading}><View style={x.directoryHeroMark}><Text style={x.directoryHeroMarkText}>◉</Text></View><View style={x.grow}><Text style={x.directoryHeroEyebrow}>AUCTION OWNERSHIP</Text><Text accessibilityRole="header" style={x.directoryHeroTitle}>Owner Squads</Text><Text style={x.directoryHeroSubtitle}>Compare auction squads, player points and royalty earned.</Text></View></View><View style={x.directoryHeroStats}><FixtureHeroStat label="OWNERS" value={owners.length} /><FixtureHeroStat label="PLAYERS" value={auctionPlayers.length} /><FixtureHeroStat label="YOUR SQUAD" value={currentOwnerPlayers.length} /><FixtureHeroStat label="YOUR PTS" value={currentOwnerBasePoints + currentOwnerRoyalty} /></View>{royaltyMode && currentOwnerRoyalty > 0 ? <View style={x.ownerSquadsRoyaltyCallout}><Text style={x.ownerSquadsRoyaltyLabel}>YOUR ROYALTY EARNED</Text><Text style={x.ownerSquadsRoyaltyValue}>+{fmt(currentOwnerRoyalty)} pts</Text></View> : null}</View>
{royaltyMode ? <View style={x.marqueeHeroCard}>
{specialCurrentPhase ? <View style={x.marqueeCurrentBlock}>
<View style={x.marqueeCurrentHeading}><View style={x.marqueeCurrentLiveDot} /><Text style={x.marqueeCurrentEyebrow}>CURRENT PHASE · {specialCurrentPhase.name.toUpperCase()}</Text><View style={x.marqueeCurrentBadge}><Text style={x.marqueeCurrentBadgeText}>ACTIVE</Text></View></View>
<Text style={x.marqueeCurrentTitle}>Your current Marquee Players</Text>
<View style={x.marqueeCurrentSlots}>{Array.from({ length: specialSelection?.required ?? 2 }).map((_, index) => <View key={index} style={x.marqueeCurrentSlot}><Text style={x.marqueeCurrentSlotNumber}>{index + 1}</Text><Text numberOfLines={1} style={x.marqueeCurrentSlotName}>{currentSpecialNames[index] ?? "Not selected"}</Text></View>)}</View>
<Text style={x.marqueeCurrentHelp}>These players remain active for {specialCurrentPhase.name} and cannot be changed now.</Text>
</View> : null}
{specialCurrentPhase ? <View style={x.marqueeHeroDivider} /> : null}
<View style={x.marqueeHeroTop}>
<View style={x.marqueeHeroIcon}><Text style={x.marqueeHeroIconText}>M</Text></View>
<View style={x.grow}><Text style={x.marqueeHeroEyebrow}>{specialPhase ? `${specialCurrentPhase ? "NEXT PHASE" : "INITIAL SELECTION"} · ${specialPhase.name.toUpperCase()}` : "NEXT PHASE SELECTION"}</Text><Text style={x.marqueeHeroTitle}>{specialPhase ? `${specialCurrentPhase ? "Change" : "Choose"} your ${specialSelection?.required ?? 2} Marquee Players` : "Next-phase changes are locked"}</Text></View>
{specialPhase ? <View style={x.marqueeHeroCount}><Text style={x.marqueeHeroCountValue}>{specialSelected.length}/{specialSelection?.required ?? 2}</Text><Text style={x.marqueeHeroCountLabel}>SELECTED</Text></View> : null}
</View>
{specialPhase ? <><View style={x.marqueeHeroSlots}>{Array.from({ length: specialSelection?.required ?? 2 }).map((_, index) => <View key={index} style={[x.marqueeHeroSlot, selectedSpecialNames[index] && x.marqueeHeroSlotFilled]}><Text style={x.marqueeHeroSlotNumber}>{index + 1}</Text><Text numberOfLines={1} style={[x.marqueeHeroSlotName, selectedSpecialNames[index] && x.marqueeHeroSlotNameFilled]}>{selectedSpecialNames[index] ?? "Choose a player"}</Text></View>)}</View><Text style={x.marqueeHeroHelp}>Open your squad below and tap “Select as Marquee” to prepare {specialPhase.name}.</Text><Text style={x.marqueeHeroDeadline}>Change deadline: {new Date(specialPhase.closesAt!).toLocaleString()}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Confirm Marquee Players for ${specialPhase.name}`} accessibilityState={{ disabled: specialBusy || specialSelected.length !== (specialSelection?.required ?? 2), busy: specialBusy }} disabled={specialBusy || specialSelected.length !== (specialSelection?.required ?? 2)} style={[x.marqueeHeroSave, (specialBusy || specialSelected.length !== (specialSelection?.required ?? 2)) && x.marqueeHeroSaveDisabled]} onPress={saveSpecial}><Text style={x.marqueeHeroSaveText}>{specialBusy ? "Saving…" : specialSelected.length === (specialSelection?.required ?? 2) ? `Confirm for ${specialPhase.name}` : `Select ${(specialSelection?.required ?? 2) - specialSelected.length} more player${(specialSelection?.required ?? 2) - specialSelected.length === 1 ? "" : "s"}`}</Text></TouchableOpacity></> : <Text style={x.marqueeHeroLocked}>The next-phase selection window is not open. Your current Marquee Players remain active; playoff selections carry forward automatically.</Text>}
{specialMessage ? <Text style={x.specialSelectionInlineMessage}>{specialMessage}</Text> : null}
</View> : null}
<View style={x.ownerSortCard}>
<View style={x.ownerSquadsFilterHeader}><View style={x.grow}><Text style={x.historyFilterTitle}>Find a squad player</Text><Text style={x.historyFilterSubtitle}>{matchingOwnerPlayers.length} of {auctionPlayers.length} auction players</Text></View>{ownerFiltersApplied && !compact ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reset owner squad search and filters" style={x.historyClear} onPress={resetOwnerFilters}><Text style={x.historyClearText}>Reset</Text></TouchableOpacity> : null}</View>
<View style={x.playerPoolSearchRow}><TextInput accessibilityLabel="Search players across owner squads" style={x.playerPoolSearchInput} value={ownerPlayerSearch} onChangeText={setOwnerPlayerSearch} placeholder="Search player name" placeholderTextColor="#839089" />{compact ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={filtersExpanded ? "Hide owner squad filters" : "Show owner squad filters"} accessibilityState={{ expanded: filtersExpanded }} style={[x.playerPoolFilterToggle, (filtersExpanded || ownerFilterCount > 0) && x.playerPoolFilterToggleActive]} onPress={() => setFiltersExpanded(value => !value)}><Text style={[x.playerPoolFilterToggleText, (filtersExpanded || ownerFilterCount > 0) && x.playerPoolFilterToggleTextActive]}>Filters{ownerFilterCount ? ` · ${ownerFilterCount}` : ""}</Text><Text style={[x.playerPoolFilterToggleIcon, (filtersExpanded || ownerFilterCount > 0) && x.playerPoolFilterToggleTextActive]}>{filtersExpanded ? "▲" : "▼"}</Text></TouchableOpacity> : null}</View>
{(!compact || filtersExpanded) ? <>
<Text style={x.ownerSortLabel}>FILTER BY ROLE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.ownerSortOptions}>{([{ code: "ALL", label: "All roles" }, { code: "BA", label: "Batters" }, { code: "WK", label: "Wicketkeepers" }, { code: "AL", label: "All-rounders" }, { code: "BO", label: "Bowlers" }] as Array<{ code: OwnerRoleFilter; label: string }>).map(option => <TouchableOpacity key={option.code} accessibilityRole="button" accessibilityLabel={`Filter by ${option.label}`} accessibilityState={{ selected: roleFilter === option.code }} style={[x.ownerSortButton, roleFilter === option.code && x.ownerSortButtonActive]} onPress={() => setRoleFilter(option.code)}><Text style={[x.ownerSortButtonText, roleFilter === option.code && x.ownerSortButtonTextActive]}>{option.label}</Text></TouchableOpacity>)}</ScrollView>
{royaltyMode ? <><Text style={[x.ownerSortLabel, { marginTop: 11 }]}>PLAYER TYPE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.ownerSortOptions}>{([{ code: "ALL", label: "All players" }, { code: "MARQUEE", label: "Marquee" }] as Array<{ code: OwnerSpecialFilter; label: string }>).map(option => <TouchableOpacity key={option.code} accessibilityRole="button" accessibilityLabel={`Filter by ${option.label}`} accessibilityState={{ selected: specialFilter === option.code }} style={[x.ownerSortButton, specialFilter === option.code && x.ownerSortButtonActive]} onPress={() => setSpecialFilter(option.code)}><Text style={[x.ownerSortButtonText, specialFilter === option.code && x.ownerSortButtonTextActive]}>{option.label}</Text></TouchableOpacity>)}</ScrollView></> : null}
<Text style={[x.ownerSortLabel, { marginTop: 11 }]}>SORT PLAYERS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.ownerSortOptions}>{([{ code: "points", label: "Points" }, { code: "royalty", label: "Royalty" }, { code: "cost", label: "Selection cost" }, { code: "name", label: "Name" }] as Array<{ code: OwnerPlayerSort; label: string }>).map(option => <TouchableOpacity key={option.code} accessibilityRole="button" accessibilityLabel={`Sort players by ${option.label}`} accessibilityState={{ selected: playerSort === option.code }} style={[x.ownerSortButton, playerSort === option.code && x.ownerSortButtonActive]} onPress={() => setPlayerSort(option.code)}><Text style={[x.ownerSortButtonText, playerSort === option.code && x.ownerSortButtonTextActive]}>{option.label}</Text></TouchableOpacity>)}</ScrollView>
{ownerFiltersApplied ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reset owner squad search and filters" style={x.ownerSquadsFilterReset} onPress={resetOwnerFilters}><Text style={x.ownerSquadsFilterResetText}>Reset search & filters</Text></TouchableOpacity> : null}
</> : null}
</View>
{visibleOwners.length ? visibleOwners.map(owner => { const open = expanded === owner || !!normalizedOwnerSearch; const isCurrentOwner = owner === currentOwner; const theme = ownerTheme(owner); const allOwnerPlayers = roster.filter(p => p.owner === owner); const ownerPlayers = allOwnerPlayers.filter(ownerPlayerMatchesFilters).sort((a, b) => { if (playerSort === "name") return a.name.localeCompare(b.name); if (playerSort === "cost") return Number(b.price ?? 0) - Number(a.price ?? 0) || a.name.localeCompare(b.name); if (playerSort === "royalty") return (royaltyTotals.get(`${owner}:${b.team}:${b.name}`)?.total ?? 0) - (royaltyTotals.get(`${owner}:${a.team}:${a.name}`)?.total ?? 0) || a.name.localeCompare(b.name); return (totals.get(`${b.team}:${b.name}`)?.total ?? 0) - (totals.get(`${a.team}:${a.name}`)?.total ?? 0) || a.name.localeCompare(b.name); }); const baseTotal = allOwnerPlayers.reduce((sum, p) => sum + (totals.get(`${p.team}:${p.name}`)?.total ?? 0), 0); const royaltyTotal = allOwnerPlayers.reduce((sum, p) => sum + (royaltyTotals.get(`${owner}:${p.team}:${p.name}`)?.total ?? 0), 0); const total = baseTotal + royaltyTotal; return <View key={owner} style={[x.ownerSquadCard, open && x.ownerSquadCardOpen, isCurrentOwner && x.ownerSquadCardCurrent, { borderLeftColor: theme.accent }]}>
<TouchableOpacity accessibilityRole="button" accessibilityLabel={`${owner}’s squad, ${ownerPlayers.length} ${ownerPlayers.length === 1 ? "player" : "players"}, ${fmt(total)} points`} accessibilityState={{ expanded: open }} style={[x.ownerSquadHeader, compact && x.ownerSquadHeaderCompact, open && { backgroundColor: theme.soft }]} onPress={() => setExpanded(open ? "" : owner)}>
<OwnerAvatar owner={owner} current={isCurrentOwner} />
<View style={x.ownerSquadIdentity}>
<View style={x.ownerNameRow}><Text numberOfLines={1} style={[x.ownerDisplayName, compact && x.ownerDisplayNameCompact, { color: theme.strong }]}>{compact ? owner : `${owner}’s squad`}</Text>{isCurrentOwner ? <View style={[x.youBadge, compact && x.ownerYouBadgeCompact, { backgroundColor: UI_TOKENS.colors.primary }]}><Text style={x.youBadgeText}>YOU</Text></View> : null}</View>
<Text numberOfLines={1} style={[x.meta, compact && x.ownerSquadMetaCompact, x.textMutedAccessible]}>{allOwnerPlayers.length} {compact ? "players" : "auction players"}{ownerPlayers.length !== allOwnerPlayers.length ? ` · ${ownerPlayers.length} shown` : ""}{compact && royaltyTotal > 0 ? ` · ROY +${fmt(royaltyTotal)}` : ""}</Text>
</View>
<View style={x.ownerSquadScore}>{royaltyTotal > 0 && !compact ? <Text style={x.ownerSquadRoyalty}>ROY +{fmt(royaltyTotal)}</Text> : null}<Text style={x.ownerSquadPoints}>{fmt(total)}</Text><Text style={x.ownerSquadPointsLabel}>PTS</Text></View>
<View style={x.ownerSquadChevron}><Text style={x.ownerSquadChevronText}>{open ? "▲" : "▼"}</Text></View>
</TouchableOpacity>{open && isCurrentOwner && specialSelection && !royaltyMode ? <View style={x.specialSelectionBanner}>
<View style={x.specialSelectionHeader}><View style={x.grow}><Text style={x.specialSelectionEyebrow}>{specialPhase ? `${specialPhase.name.toUpperCase()} · ${specialLabel.toUpperCase()} SELECTION` : `${specialLabel.toUpperCase()} SELECTION`}</Text><Text style={x.specialSelectionTitle}>{specialPhase ? `Choose your ${specialSelection.required} ${specialLabel} Players` : "Selections are currently locked"}</Text></View>{specialPhase ? <View style={x.specialSelectionCount}><Text style={x.specialSelectionCountValue}>{specialSelected.length}/{specialSelection.required}</Text><Text style={x.specialSelectionCountLabel}>SELECTED</Text></View> : null}</View>
{specialPhase ? <><View style={x.specialSelectionSlots}>{Array.from({ length: specialSelection.required }).map((_, index) => <View key={index} style={[x.specialSelectionSlot, selectedSpecialNames[index] && x.specialSelectionSlotFilled]}><Text numberOfLines={1} style={[x.specialSelectionSlotText, selectedSpecialNames[index] && x.specialSelectionSlotTextFilled]}>{selectedSpecialNames[index] ?? `Slot ${index + 1} · Not selected`}</Text></View>)}</View><Text style={x.specialSelectionDeadline}>Selection closes {new Date(specialPhase.closesAt!).toLocaleString()}</Text><Text style={x.specialSelectionHelp}>Use the {specialLabel} button beside a player below. You must fill all {specialSelection.required} slots before saving.</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Save ${specialLabel} Players for ${specialPhase.name}`} accessibilityState={{ disabled: specialBusy || specialSelected.length !== specialSelection.required, busy: specialBusy }} disabled={specialBusy || specialSelected.length !== specialSelection.required} style={[x.specialSelectionSave, (specialBusy || specialSelected.length !== specialSelection.required) && x.specialSelectionSaveDisabled]} onPress={saveSpecial}><Text style={x.specialSelectionSaveText}>{specialBusy ? "Saving…" : `Save ${specialLabel} Players · ${specialSelected.length}/${specialSelection.required}`}</Text></TouchableOpacity></> : <Text style={x.specialSelectionText}>{specialBusy ? "Loading selection…" : "The next phase opens after the current phase starts. Playoff selections carry forward automatically."}</Text>}{specialMessage ? <Text accessibilityLiveRegion="polite" style={x.specialSelectionInlineMessage}>{specialMessage}</Text> : null}
</View> : null}{open && !compact ? <View style={x.ownerSquadTableHead}><Text numberOfLines={1} style={x.ownerSquadTablePlayerHead}>PLAYER</Text><Text numberOfLines={1} style={x.ownerSquadTableMetricHead}>BAT</Text><Text numberOfLines={1} style={x.ownerSquadTableMetricHead}>BOWL</Text><Text numberOfLines={1} style={x.ownerSquadTableMetricHead}>FIELD</Text><Text numberOfLines={1} style={x.ownerSquadTableMetricHead}>BONUS</Text>{royaltyMode ? <Text numberOfLines={1} style={x.ownerSquadTableMetricHead}>ROY</Text> : null}<Text numberOfLines={1} style={x.ownerSquadTableTotalHead}>TOTAL</Text></View> : null}{open && !ownerPlayers.length ? <Empty text="No players match the selected filters." /> : null}{open && ownerPlayers.map(player => { const scoreKey = `${player.team}:${player.name}`; const p = totals.get(scoreKey) ?? { matches: 0, batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 }; const royalty = royaltyTotals.get(`${owner}:${scoreKey}`) ?? { total: 0, rows: [] }; const royaltyByFixture = new Map<string, number>(); for (const row of royalty.rows) royaltyByFixture.set(row.fixture_id, (royaltyByFixture.get(row.fixture_id) ?? 0) + Number(row.adjustment_points)); const playerMatchRows: OwnerPlayerMatchScore[] = (matchPointsByPlayer.get(scoreKey) ?? []).map(row => { const matchRoyalty = royaltyMode ? (royaltyByFixture.get(row.fixture_id) ?? 0) : 0; return { fixtureId: row.fixture_id, matchNumber: Number(row.fixture?.match_number ?? 0), home: row.fixture?.home?.code ?? "—", away: row.fixture?.away?.code ?? "—", batting: Number(row.batting_points), bowling: Number(row.bowling_points), fielding: Number(row.fielding_points), bonus: Number(row.bonus_points), royalty: matchRoyalty, total: Number(row.total_points) + matchRoyalty }; }); const playerKey = `${owner}:${scoreKey}`; const playerOpen = expandedPlayer === playerKey; const specialPlayerId = specialPlayerIds[player.name]; const specialChecked = !!specialPlayerId && specialSelected.includes(specialPlayerId); const specialDisabled = specialBusy || (!specialChecked && specialSelected.length >= (specialSelection?.required ?? 0)); const totalPoints = p.total + (royaltyMode ? royalty.total : 0); const career = { matches: p.matches, batting: p.batting, bowling: p.bowling, fielding: p.fielding, bonus: p.bonus, royalty: royaltyMode ? royalty.total : 0, total: totalPoints }; return <View key={scoreKey} style={compact ? x.ownerSquadPlayerCard : undefined}>
{compact ? <>
<TouchableOpacity accessibilityRole="button" accessibilityLabel={`${player.name}, ${player.team}, ${player.role}, ${fmt(totalPoints)} points`} accessibilityState={{ expanded: playerOpen }} style={x.ownerSquadPlayerTop} onPress={() => setExpandedPlayer(playerOpen ? "" : playerKey)}>
<View style={x.ownerSquadPlayerIdentity}><View style={x.playerLabelRow}><Text numberOfLines={1} style={x.ownerSquadPlayerName}>{player.name}</Text>{(leagueSpecialLabels[player.name] ?? []).map((label: string) => <SpecialPlayerBadge key={label} label={label} />)}</View><View style={x.ownerSquadPlayerMeta}><IplTeamBadge code={player.team} /><Text style={x.ownerPlayerRole}>{player.role}</Text><Text numberOfLines={1} style={x.ownerPlayerCosts}>₹{player.price}m · Bid {player.bidPrice == null ? "—" : `₹${player.bidPrice}m`}</Text></View></View>
<View style={x.ownerSquadPlayerTotal}><Text style={x.ownerSquadPlayerTotalValue}>{fmt(totalPoints)}</Text><Text style={x.ownerSquadPlayerTotalLabel}>PTS</Text></View><View style={x.ownerSquadPlayerDisclosure}><Text style={x.ownerSquadPlayerDisclosureText}>{playerOpen ? "▲" : "▼"}</Text></View>
</TouchableOpacity>
{isCurrentOwner && specialSelection && specialPhase && specialPlayerId && (!specialDisabled || specialChecked) ? <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: specialChecked, disabled: specialDisabled }} disabled={specialDisabled} style={[x.ownerSquadPlayerSelect, specialChecked && x.specialSelectButtonChecked, specialDisabled && x.specialSelectButtonDisabled]} onPress={() => toggleSpecial(specialPlayerId)}><Text style={[x.specialSelectButtonText, specialChecked && x.specialSelectButtonTextChecked]}>{specialChecked ? `✓ ${specialLabel}` : `+ ${specialLabel}`}</Text></TouchableOpacity> : null}
{playerOpen ? <OwnerPlayerMatchBreakdown matches={playerMatchRows} compact royaltyMode={royaltyMode} career={career} /> : null}
</> : <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${player.name}, ${player.team}, ${player.role}, ${fmt(totalPoints)} points`} accessibilityState={{ expanded: playerOpen }} style={x.ownerSquadTableRow} onPress={() => setExpandedPlayer(playerOpen ? "" : playerKey)}>
<View style={x.ownerSquadTablePlayer}><View style={x.ownerPlayerNameRow}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={x.playerListName}>{player.name}</Text>{(leagueSpecialLabels[player.name] ?? []).map((label: string) => <SpecialPlayerBadge key={label} label={label} />)}<Text style={x.ownerPlayerChevron}>{playerOpen ? "▲" : "▼"}</Text></View><View style={x.ownerPlayerTeamRole}><IplTeamBadge code={player.team} /><Text style={x.ownerPlayerRole}>{roleLabel[player.role]}</Text></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={x.ownerPlayerCosts}>Selection ₹{player.price}m  ·  Bid {player.bidPrice == null ? "—" : `₹${player.bidPrice}m`}</Text>{isCurrentOwner && specialSelection && specialPhase && specialPlayerId ? <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: specialChecked, disabled: specialDisabled }} disabled={specialDisabled} style={[x.specialSelectButton, specialChecked && x.specialSelectButtonChecked, specialDisabled && x.specialSelectButtonDisabled]} onPress={event => { event.stopPropagation(); toggleSpecial(specialPlayerId); }}><Text style={[x.specialSelectButtonText, specialChecked && x.specialSelectButtonTextChecked]}>{specialChecked ? `✓ ${specialLabel} selected` : `+ Select as ${specialLabel}`}</Text></TouchableOpacity> : null}</View>
<Text numberOfLines={1} style={x.ownerSquadTableMetric}>{fmt(p.batting)}</Text><Text numberOfLines={1} style={x.ownerSquadTableMetric}>{fmt(p.bowling)}</Text><Text numberOfLines={1} style={x.ownerSquadTableMetric}>{fmt(p.fielding)}</Text><Text numberOfLines={1} style={x.ownerSquadTableMetric}>{fmt(p.bonus)}</Text>{royaltyMode ? <Text numberOfLines={1} style={[x.ownerSquadTableMetric, royalty.total > 0 && x.royaltyColumn]}>{fmt(royalty.total)}</Text> : null}<Text numberOfLines={1} style={x.ownerSquadTableTotal}>{fmt(totalPoints)}</Text>
</TouchableOpacity>}
{playerOpen && !compact ? <OwnerPlayerMatchBreakdown matches={playerMatchRows} compact={false} royaltyMode={royaltyMode} career={career} /> : null}</View>; })}</View>; }) : <Empty text="No squad players match your search and filters." />}</View>;
}

type LeagueSquadPlayer = Player & { leaguePlayerId: string; playerId: string; active: boolean; bidPrice: number | null; ownerId: string };
type LeagueSquadOwner = { id: string; display_name: string };
export function ProductionPlayerSquad({ leagueId, canEdit, onAvailabilityChanged, openScorecard }: { leagueId: string; canEdit: boolean; onAvailabilityChanged: () => void; openScorecard?: (fixtureId: string) => void }) {
  const { width: playerPoolWidth } = useWindowDimensions();
  const compact = playerPoolWidth < 620;
  const playerActionLock = useRef(false);
  const [expandedTeams, setExpandedTeams] = useState<string[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState("");
  const [pointRows, setPointRows] = useState<any[]>([]);
  const [royaltyRows, setRoyaltyRows] = useState<any[]>([]);
  const [royaltyMode, setRoyaltyMode] = useState(false);
  const [ownershipEnabled, setOwnershipEnabled] = useState(true);
  const [squadPlayers, setSquadPlayers] = useState<LeagueSquadPlayer[]>([]);
  const [pointsError, setPointsError] = useState("");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [owners, setOwners] = useState<LeagueSquadOwner[]>([]);
  const [addingTeam, setAddingTeam] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRole, setNewPlayerRole] = useState<Player["role"]>("BA");
  const [newPlayerCost, setNewPlayerCost] = useState("");
  const [newPlayerOwnerId, setNewPlayerOwnerId] = useState("");
  const [newPlayerOwnerPickerOpen, setNewPlayerOwnerPickerOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Player["role"]>("BA");
  const [editCost, setEditCost] = useState("0");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editBusy, setEditBusy] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [editOwnerDropdownOpen, setEditOwnerDropdownOpen] = useState(false);
  const [discardPrompt, setDiscardPrompt] = useState<"ADD" | "EDIT" | "">("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [squadRoleFilter, setSquadRoleFilter] = useState<"ALL" | Player["role"]>("ALL");
  const [squadAvailabilityFilter, setSquadAvailabilityFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [squadOwnerFilter, setSquadOwnerFilter] = useState("ALL");
  const [squadSortMode, setSquadSortMode] = useState<"NAME" | "POINTS" | "COST_DESC" | "COST_ASC">("NAME");
  const [playerSearch, setPlayerSearch] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const leagueSpecialLabels = useLeagueSpecialLabels(leagueId);
  const teams = useMemo(() => Array.from(new Set(squadPlayers.map(player => player.team))).sort((a, b) => a.localeCompare(b)), [squadPlayers]);
  useEffect(() => {
    let cancelled = false;
    setPointRows([]);
    setRoyaltyRows([]);
    setRoyaltyMode(false);
    setOwnershipEnabled(true);
    setSquadPlayers([]);
    setOwners([]);
    setPointsError("");
    setAvailabilityMessage("");
    setExpandedPlayer("");
    setEditingPlayerId("");
    setEditMessage("");
    setEditOwnerDropdownOpen(false);
    setDiscardPrompt("");
    setNewPlayerOwnerPickerOpen(false);
    setAddMessage("");
    setSquadRoleFilter("ALL");
    setSquadAvailabilityFilter("ALL");
    setSquadOwnerFilter("ALL");
    setSquadSortMode("NAME");
    setPlayerSearch("");
    setFiltersExpanded(false);
    setLoading(true);
    Promise.all([
      supabase.from("player_match_points").select("fixture_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,calculation_version,published_at,player:players(full_name,team:cricket_teams(code)),fixture:fixtures!inner(league_id,match_number,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code))").eq("fixture.league_id", leagueId).not("published_at", "is", null),
      supabase.from("league_players").select("id,player_id,active,acquisition_price,bid_price,owner:league_members(id,display_name),player:players(full_name,role,team:cricket_teams(code))").eq("league_id", leagueId),
      supabase.from("league_members").select("id,display_name").eq("league_id", leagueId).eq("status", "active").in("role", ["owner", "league_admin"]).order("display_name"),
      supabase.from("special_player_score_adjustments").select("fixture_id,player_id,adjustment_points,adjustment_type").eq("league_id", leagueId).in("adjustment_type", ["regular_royalty", "marquee_royalty"]),
      supabase.from("special_player_rule_sets").select("marquee_mode_enabled").eq("league_id", leagueId).eq("active", true).maybeSingle(),
      supabase.from("league_format_configs").select("ownership_enabled").eq("league_id", leagueId).maybeSingle(),
    ]).then(([pointsResult, squadResult, ownerResult, royaltyResult, ruleResult, formatResult]) => {
        if (cancelled) return;
        const error = pointsResult.error ?? squadResult.error ?? ownerResult.error ?? royaltyResult.error ?? ruleResult.error ?? formatResult.error;
        if (error) setPointsError(error.message);
        else {
          setPointRows(pointsResult.data ?? []);
          setRoyaltyRows(royaltyResult.data ?? []);
          setRoyaltyMode(ruleResult.data?.marquee_mode_enabled === true);
          setOwnershipEnabled(formatResult.data?.ownership_enabled !== false);
          setSquadPlayers((squadResult.data as any[] ?? []).map(row => ({ leaguePlayerId: row.id, playerId: row.player_id, active: row.active, name: row.player.full_name, team: row.player.team?.code ?? "—", role: row.player.role as Player["role"], price: Number(row.acquisition_price), bidPrice: row.bid_price == null ? null : Number(row.bid_price), ownerId: row.owner?.id ?? "", owner: row.owner?.display_name ?? "Available" })).sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)));
          setOwners((ownerResult.data ?? []) as LeagueSquadOwner[]);
        }
      }).catch(loadError => {
        if (!cancelled) setPointsError(loadError instanceof Error ? loadError.message : "IPL squad could not be loaded.");
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [leagueId, loadVersion]);
  const latestPlayerPointRows = useMemo(() => {
    const latest = new Map<string, any>();
    for (const row of pointRows) {
      const playerKey = `${row.player?.team?.code ?? ""}:${row.player?.full_name ?? ""}`;
      const matchKey = `${row.fixture_id}:${playerKey}`;
      if (!latest.has(matchKey) || Number(latest.get(matchKey).calculation_version) < Number(row.calculation_version)) latest.set(matchKey, row);
    }
    return [...latest.values()];
  }, [pointRows]);
  const playerTotals = useMemo(() => {
    const totals = new Map<string, { matches: number; batting: number; bowling: number; fielding: number; bonus: number; total: number }>();
    for (const row of latestPlayerPointRows) {
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
  }, [latestPlayerPointRows]);
  const playerMatchPoints = useMemo(() => {
    const matches = new Map<string, any[]>();
    for (const row of latestPlayerPointRows) {
      const key = `${row.player?.team?.code ?? ""}:${row.player?.full_name ?? ""}`;
      if (!row.player?.full_name) continue;
      matches.set(key, [...(matches.get(key) ?? []), row]);
    }
    for (const rows of matches.values()) rows.sort((left, right) => Number(right.fixture?.match_number ?? 0) - Number(left.fixture?.match_number ?? 0));
    return matches;
  }, [latestPlayerPointRows]);
  const playerRoyaltyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    if (!royaltyMode) return totals;
    for (const row of royaltyRows) totals.set(row.player_id, (totals.get(row.player_id) ?? 0) + Number(row.adjustment_points ?? 0));
    return totals;
  }, [royaltyRows, royaltyMode]);
  const playerRoyaltyByFixture = useMemo(() => {
    const royalties = new Map<string, Map<string, number>>();
    if (!royaltyMode) return royalties;
    for (const row of royaltyRows) {
      const byFixture = royalties.get(row.player_id) ?? new Map<string, number>();
      byFixture.set(row.fixture_id, (byFixture.get(row.fixture_id) ?? 0) + Number(row.adjustment_points ?? 0));
      royalties.set(row.player_id, byFixture);
    }
    return royalties;
  }, [royaltyRows, royaltyMode]);
  const filteredSquadPlayers = useMemo(() => squadPlayers.filter(player => {
    if (playerSearch.trim() && !player.name.toLocaleLowerCase().includes(playerSearch.trim().toLocaleLowerCase())) return false;
    if (squadRoleFilter !== "ALL" && player.role !== squadRoleFilter) return false;
    if (squadAvailabilityFilter === "ACTIVE" && !player.active) return false;
    if (squadAvailabilityFilter === "INACTIVE" && player.active) return false;
    if (ownershipEnabled && squadOwnerFilter === "OPEN" && player.ownerId) return false;
    if (ownershipEnabled && squadOwnerFilter !== "ALL" && squadOwnerFilter !== "OPEN" && player.ownerId !== squadOwnerFilter) return false;
    return true;
  }).sort((a, b) => {
    const aPoints = playerTotals.get(`${a.team}:${a.name}`)?.total ?? 0;
    const bPoints = playerTotals.get(`${b.team}:${b.name}`)?.total ?? 0;
    if (squadSortMode === "POINTS") return bPoints - aPoints || a.name.localeCompare(b.name);
    if (squadSortMode === "COST_DESC") return b.price - a.price || a.name.localeCompare(b.name);
    if (squadSortMode === "COST_ASC") return a.price - b.price || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  }), [squadPlayers, playerSearch, squadRoleFilter, squadAvailabilityFilter, squadOwnerFilter, squadSortMode, ownershipEnabled, playerTotals, playerRoyaltyTotals]);
  const displayedTeams = useMemo(() => teams.filter(team => filteredSquadPlayers.some(player => player.team === team)), [teams, filteredSquadPlayers]);
  const squadFiltersApplied = !!playerSearch.trim() || squadRoleFilter !== "ALL" || squadAvailabilityFilter !== "ALL" || (ownershipEnabled && squadOwnerFilter !== "ALL") || squadSortMode !== "NAME";
  const activeFilterCount = Number(squadRoleFilter !== "ALL") + Number(squadAvailabilityFilter !== "ALL") + Number(ownershipEnabled && squadOwnerFilter !== "ALL") + Number(squadSortMode !== "NAME");
  const minimumSelectionCost = useMemo(() => {
    const activePositiveCosts = squadPlayers
      .filter(player => player.active && Number.isFinite(player.price) && player.price > 0)
      .map(player => player.price);
    return activePositiveCosts.length ? Math.min(...activePositiveCosts) : 0;
  }, [squadPlayers]);
  const minimumSelectionCostInput = minimumSelectionCost > 0 ? String(minimumSelectionCost) : "";
  const minimumSelectionCostLabel = minimumSelectionCost > 0 ? `₹${minimumSelectionCost.toFixed(1)}m` : "unavailable";
  const toggleTeam = (team: string) => setExpandedTeams(current => current.includes(team) ? current.filter(code => code !== team) : [...current, team]);
  const allExpanded = displayedTeams.length > 0 && displayedTeams.every(team => expandedTeams.includes(team));
  const openEditPlayer = (player: LeagueSquadPlayer) => {
    setEditingPlayerId(player.leaguePlayerId);
    setEditName(player.name); setEditRole(player.role); setEditCost(String(player.price)); setEditOwnerId(player.ownerId || ""); setEditActive(player.active); setEditMessage(""); setEditOwnerDropdownOpen(false); setAvailabilityMessage("");
  };
  const closeEditPlayer = () => { setEditingPlayerId(""); setEditMessage(""); setEditOwnerDropdownOpen(false); };
  const requestCloseEditPlayer = () => {
    if (editBusy) return;
    const player = squadPlayers.find(candidate => candidate.leaguePlayerId === editingPlayerId);
    const dirty = !!player && (editName.trim() !== player.name || editRole !== player.role || Number(editCost) !== player.price || editActive !== player.active || (ownershipEnabled && editOwnerId !== (player.ownerId || "")));
    if (!dirty) { closeEditPlayer(); return; }
    setDiscardPrompt("EDIT");
  };
  const savePlayer = async (player: LeagueSquadPlayer) => {
    const cost = Number(editCost);
    if (!editName.trim()) { setEditMessage("Player name is required."); return; }
    if (!editCost.trim() || !Number.isFinite(cost) || minimumSelectionCost <= 0 || cost < minimumSelectionCost) { setEditMessage(`Selection cost cannot be below the current IPL minimum of ${minimumSelectionCostLabel}.`); return; }
    const hasChanges = editName.trim() !== player.name || editRole !== player.role || cost !== player.price || editActive !== player.active || (ownershipEnabled && editOwnerId !== (player.ownerId || ""));
    if (!hasChanges) return;
    if (playerActionLock.current) return;
    playerActionLock.current = true;
    setEditBusy(true); setEditMessage(""); setAvailabilityMessage("");
    let error: any = null;
    try {
      ({ error } = await supabase.rpc("edit_league_player", { p_league_player_id: player.leaguePlayerId, p_full_name: editName.trim(), p_role: editRole, p_selection_cost: cost, p_owner_member_id: ownershipEnabled ? editOwnerId || null : null, p_active: editActive }));
    } finally {
      playerActionLock.current = false;
      setEditBusy(false);
    }
    if (error) { const detail = userActionError(error, "Player update"); setEditMessage(detail); Alert.alert("Player not updated", detail); return; }
    setEditingPlayerId("");
    setEditMessage("");
    setEditOwnerDropdownOpen(false);
    setAvailabilityMessage(`${editName.trim()} updated. Auction bid price was preserved.`);
    setLoadVersion(version => version + 1);
    onAvailabilityChanged();
  };
  const openAddPlayer = (team: string) => {
    setAddingTeam(team);
    setNewPlayerName(""); setNewPlayerRole("BA"); setNewPlayerCost(minimumSelectionCostInput); setNewPlayerOwnerId(""); setNewPlayerOwnerPickerOpen(false); setAddMessage(""); setAvailabilityMessage("");
  };
  const closeAddPlayer = () => { setAddingTeam(""); setNewPlayerOwnerPickerOpen(false); setAddMessage(""); };
  const requestCloseAddPlayer = () => {
    if (addBusy) return;
    const dirty = !!newPlayerName.trim() || newPlayerRole !== "BA" || newPlayerCost.trim() !== minimumSelectionCostInput || (ownershipEnabled && !!newPlayerOwnerId);
    if (!dirty) { closeAddPlayer(); return; }
    setDiscardPrompt("ADD");
  };
  const addReplacementPlayer = async () => {
    const cost = Number(newPlayerCost);
    if (!newPlayerName.trim()) { setAddMessage("Player name is required."); return; }
    if (!newPlayerCost.trim() || !Number.isFinite(cost) || minimumSelectionCost <= 0 || cost < minimumSelectionCost) { setAddMessage(`Selection cost cannot be below the current IPL minimum of ${minimumSelectionCostLabel}.`); return; }
    if (playerActionLock.current) return;
    playerActionLock.current = true;
    setAddBusy(true); setAddMessage(""); setAvailabilityMessage("");
    let error: any = null;
    try {
      ({ error } = await supabase.rpc("add_league_replacement_player", { p_league_id: leagueId, p_team_code: addingTeam, p_full_name: newPlayerName.trim(), p_role: newPlayerRole, p_selection_cost: cost, p_owner_member_id: ownershipEnabled ? newPlayerOwnerId || null : null }));
    } finally {
      playerActionLock.current = false;
      setAddBusy(false);
    }
    if (error) { const detail = userActionError(error, "Player addition"); setAddMessage(detail); Alert.alert("Player not added", detail); return; }
    const addedName = newPlayerName.trim();
    setAddingTeam(""); setNewPlayerName(""); setNewPlayerOwnerId(""); setNewPlayerOwnerPickerOpen(false); setAddMessage("");
    setAvailabilityMessage(`${addedName} added to ${addingTeam}.`);
    setLoadVersion(version => version + 1);
    onAvailabilityChanged();
  };
  if (loading) return <Loading />;
  if (pointsError) return <LoadError message={pointsError} onRetry={() => setLoadVersion(version => version + 1)} />;
  const activePlayerCount = squadPlayers.filter(player => player.active).length;
  const inactivePlayerCount = squadPlayers.length - activePlayerCount;
  const editingPlayer = squadPlayers.find(player => player.leaguePlayerId === editingPlayerId) ?? null;
  const selectedEditOwner = owners.find(owner => owner.id === editOwnerId);
  const selectedEditOwnerName = selectedEditOwner?.display_name ?? "Open player";
  const selectedNewPlayerOwner = owners.find(owner => owner.id === newPlayerOwnerId);
  const selectedNewPlayerOwnerName = selectedNewPlayerOwner?.display_name ?? "Open player";
  const addCostValid = minimumSelectionCost > 0 && !!newPlayerCost.trim() && Number.isFinite(Number(newPlayerCost)) && Number(newPlayerCost) >= minimumSelectionCost;
  const addFormValid = !!addingTeam && !!newPlayerName.trim() && addCostValid;
  const addSubmitDisabled = addBusy || !addFormValid;
  const editCostValid = minimumSelectionCost > 0 && !!editCost.trim() && Number.isFinite(Number(editCost)) && Number(editCost) >= minimumSelectionCost;
  const editFormValid = !!editingPlayer && !!editName.trim() && editCostValid;
  const editFormDirty = !!editingPlayer && (editName.trim() !== editingPlayer.name || editRole !== editingPlayer.role || Number(editCost) !== editingPlayer.price || editActive !== editingPlayer.active || (ownershipEnabled && editOwnerId !== (editingPlayer.ownerId || "")));
  const editSubmitDisabled = editBusy || !editFormValid || !editFormDirty;
  return <View>
    <View style={x.directoryHero}>
      <View style={x.directoryHeroGlow} />
      <View style={x.directoryHeroHeading}><View style={x.directoryHeroMark}><Text style={x.directoryHeroMarkText}>◎</Text></View><View style={x.grow}><Text style={x.directoryHeroEyebrow}>LEAGUE DIRECTORY</Text><Text accessibilityRole="header" style={x.directoryHeroTitle}>Player Pool</Text><Text style={x.directoryHeroSubtitle}>Search every league player by team, role, owner and availability.</Text></View></View>
      <View style={x.directoryHeroStats}><FixtureHeroStat label="PLAYERS" value={squadPlayers.length} /><FixtureHeroStat label="ACTIVE" value={activePlayerCount} /><FixtureHeroStat label="INACTIVE" value={inactivePlayerCount} /><FixtureHeroStat label="TEAMS" value={teams.length} /></View>
    </View>
    {squadPlayers.length ? <View style={x.ownerSortCard}>
      <View style={x.historyFilterHeader}>
        <View style={x.grow}><Text style={x.historyFilterTitle}>Find a player</Text><Text style={x.historyFilterSubtitle}>{filteredSquadPlayers.length} of {squadPlayers.length} players · grouped by IPL team</Text></View>
        {displayedTeams.length && !compact ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={allExpanded ? "Collapse all shown teams" : "Expand all shown teams"} accessibilityState={{ expanded: allExpanded }} style={x.squadToggle} onPress={() => setExpandedTeams(current => allExpanded ? current.filter(team => !displayedTeams.includes(team)) : Array.from(new Set([...current, ...displayedTeams])))}><Text style={x.squadToggleText}>{allExpanded ? "Collapse shown" : "Expand shown"}</Text></TouchableOpacity> : null}
        {squadFiltersApplied ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reset player pool filters" style={x.historyClear} onPress={() => { setPlayerSearch(""); setSquadRoleFilter("ALL"); setSquadAvailabilityFilter("ALL"); setSquadOwnerFilter("ALL"); setSquadSortMode("NAME"); }}><Text style={x.historyClearText}>Reset</Text></TouchableOpacity> : null}
      </View>
      <View style={x.playerPoolSearchRow}><TextInput accessibilityLabel="Search players by name" style={x.playerPoolSearchInput} value={playerSearch} onChangeText={setPlayerSearch} placeholder="Search player name" placeholderTextColor="#839089" />{compact ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={filtersExpanded ? "Hide player filters" : "Show player filters"} accessibilityState={{ expanded: filtersExpanded }} style={[x.playerPoolFilterToggle, (filtersExpanded || activeFilterCount > 0) && x.playerPoolFilterToggleActive]} onPress={() => setFiltersExpanded(value => !value)}><Text style={[x.playerPoolFilterToggleText, (filtersExpanded || activeFilterCount > 0) && x.playerPoolFilterToggleTextActive]}>Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}</Text><Text style={[x.playerPoolFilterToggleIcon, (filtersExpanded || activeFilterCount > 0) && x.playerPoolFilterToggleTextActive]}>{filtersExpanded ? "▲" : "▼"}</Text></TouchableOpacity> : null}</View>
      {(!compact || filtersExpanded) ? <>
      <View style={x.squadFilterGroup}>
      <Text style={x.ownerSortLabel}>ROLE</Text>
      <ScrollView style={x.squadFilterScroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.ownerSortOptions}>
        {([['ALL', 'All roles'], ['BA', 'Batters'], ['WK', 'Wicketkeepers'], ['AL', 'All-rounders'], ['BO', 'Bowlers']] as const).map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`Filter by ${label}`} accessibilityState={{ selected: squadRoleFilter === value }} style={[x.ownerSortButton, squadRoleFilter === value && x.ownerSortButtonActive]} onPress={() => setSquadRoleFilter(value)}><Text style={[x.ownerSortButtonText, squadRoleFilter === value && x.ownerSortButtonTextActive]}>{label}</Text></TouchableOpacity>)}
      </ScrollView>
      </View>
      <View style={x.squadFilterGroup}>
      <Text style={x.ownerSortLabel}>AVAILABILITY</Text>
      <ScrollView style={x.squadFilterScroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.ownerSortOptions}>
        {([['ALL', 'All players'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']] as const).map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`Filter by ${label}`} accessibilityState={{ selected: squadAvailabilityFilter === value }} style={[x.ownerSortButton, squadAvailabilityFilter === value && x.ownerSortButtonActive]} onPress={() => setSquadAvailabilityFilter(value)}><Text style={[x.ownerSortButtonText, squadAvailabilityFilter === value && x.ownerSortButtonTextActive]}>{label}</Text></TouchableOpacity>)}
      </ScrollView>
      </View>
      {ownershipEnabled ? <View style={x.squadFilterGroup}><Text style={x.ownerSortLabel}>OWNER</Text>
      <ScrollView style={x.squadFilterScroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.ownerSortOptions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Filter by all owners" accessibilityState={{ selected: squadOwnerFilter === "ALL" }} style={[x.ownerSortButton, squadOwnerFilter === "ALL" && x.ownerSortButtonActive]} onPress={() => setSquadOwnerFilter("ALL")}><Text style={[x.ownerSortButtonText, squadOwnerFilter === "ALL" && x.ownerSortButtonTextActive]}>All owners</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Filter by open players" accessibilityState={{ selected: squadOwnerFilter === "OPEN" }} style={[x.ownerSortButton, squadOwnerFilter === "OPEN" && x.ownerSortButtonActive]} onPress={() => setSquadOwnerFilter("OPEN")}><Text style={[x.ownerSortButtonText, squadOwnerFilter === "OPEN" && x.ownerSortButtonTextActive]}>Open players</Text></TouchableOpacity>
        {owners.map(owner => <TouchableOpacity key={owner.id} accessibilityRole="button" accessibilityLabel={`Filter by owner ${owner.display_name}`} accessibilityState={{ selected: squadOwnerFilter === owner.id }} style={[x.ownerSortButton, squadOwnerFilter === owner.id && x.ownerSortButtonActive]} onPress={() => setSquadOwnerFilter(owner.id)}><Text style={[x.ownerSortButtonText, squadOwnerFilter === owner.id && x.ownerSortButtonTextActive]}>{owner.display_name}</Text></TouchableOpacity>)}
      </ScrollView></View> : null}
      <View style={[x.squadFilterGroup, x.squadFilterGroupLast]}>
      <Text style={x.ownerSortLabel}>SORT WITHIN EACH TEAM</Text>
      <ScrollView style={x.squadFilterScroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.ownerSortOptions}>
        {([['NAME', 'Name A–Z'], ['POINTS', 'Highest points'], ['COST_DESC', 'Highest cost'], ['COST_ASC', 'Lowest cost']] as const).map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`Sort by ${label}`} accessibilityState={{ selected: squadSortMode === value }} style={[x.ownerSortButton, squadSortMode === value && x.ownerSortButtonActive]} onPress={() => setSquadSortMode(value)}><Text style={[x.ownerSortButtonText, squadSortMode === value && x.ownerSortButtonTextActive]}>{label}</Text></TouchableOpacity>)}
      </ScrollView>
      </View>
      </> : null}
      {compact && displayedTeams.length ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={allExpanded ? "Collapse all shown teams" : "Expand all shown teams"} accessibilityState={{ expanded: allExpanded }} style={x.playerPoolExpandButton} onPress={() => setExpandedTeams(current => allExpanded ? current.filter(team => !displayedTeams.includes(team)) : Array.from(new Set([...current, ...displayedTeams])))}><Text style={x.playerPoolExpandButtonText}>{allExpanded ? "Collapse all teams" : `Expand ${displayedTeams.length} shown teams`}</Text></TouchableOpacity> : null}
    </View> : null}
    {availabilityMessage ? <View style={x.squadAvailabilityMessage}><Text style={x.squadAvailabilityMessageText}>{availabilityMessage}</Text></View> : null}
    {!squadPlayers.length ? <Empty text="No squad players have been imported for this league." /> : !displayedTeams.length ? <Empty text="No squad players match these filters." /> : displayedTeams.map(team => {
      const allTeamPlayers = squadPlayers.filter(player => player.team === team);
      const teamPlayers = filteredSquadPlayers.filter(player => player.team === team);
      const collapsed = !expandedTeams.includes(team);
      const colors = teamBadge(team);
      return <View key={team} style={x.squadTeamCard}>
        <View style={[x.squadTeamHeader, { borderLeftColor: colors.backgroundColor }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${team} squad`} accessibilityState={{ expanded: !collapsed }} style={x.squadTeamHeaderMain} onPress={() => toggleTeam(team)}>
            <View style={[x.squadTeamBadge, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}><Text style={[x.squadTeamBadgeText, { color: colors.color }]}>{team}</Text></View>
            <View style={x.squadTeamIdentity}>
              <Text style={x.squadTeamName}>{team} squad</Text>
              <Text style={x.squadTeamSummary}>{squadFiltersApplied ? `${teamPlayers.length} shown · ` : ""}{allTeamPlayers.filter(p => p.active).length}/{allTeamPlayers.length} active · {allTeamPlayers.filter(p => p.role === "BA").length} BA · {allTeamPlayers.filter(p => p.role === "WK").length} WK · {allTeamPlayers.filter(p => p.role === "AL").length} AL · {allTeamPlayers.filter(p => p.role === "BO").length} BO</Text>
            </View>
            <View style={x.squadTeamChevronBubble}><Text style={x.squadTeamChevron}>{collapsed ? "▼" : "▲"}</Text></View>
          </TouchableOpacity>
          {canEdit ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add a ${team} player`} accessibilityHint="Opens the replacement player form" style={x.squadAddPlayerButton} onPress={() => openAddPlayer(team)}><Text style={x.squadAddPlayerButtonText}>+ Add</Text></TouchableOpacity> : null}
        </View>
        {!collapsed ? teamPlayers.map(player => {
          const playerKey = `${team}:${player.name}`;
          const points = playerTotals.get(playerKey) ?? { matches: 0, batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 };
          const royalty = playerRoyaltyTotals.get(player.playerId) ?? 0;
          const royaltyByFixture = playerRoyaltyByFixture.get(player.playerId) ?? new Map<string, number>();
          const playerMatchRows: OwnerPlayerMatchScore[] = (playerMatchPoints.get(playerKey) ?? []).map(row => {
            const matchRoyalty = royaltyMode ? (royaltyByFixture.get(row.fixture_id) ?? 0) : 0;
            return {
              fixtureId: row.fixture_id,
              matchNumber: Number(row.fixture?.match_number ?? 0),
              home: row.fixture?.home?.code ?? "—",
              away: row.fixture?.away?.code ?? "—",
              batting: Number(row.batting_points ?? 0),
              bowling: Number(row.bowling_points ?? 0),
              fielding: Number(row.fielding_points ?? 0),
              bonus: Number(row.bonus_points ?? 0),
              royalty: matchRoyalty,
              total: Number(row.total_points ?? 0),
            };
          });
          const bestMatch = playerMatchRows.reduce<OwnerPlayerMatchScore | null>((best, match) => !best || match.total > best.total ? match : best, null);
          const insights: PlayerPerformanceInsights = { average: points.matches ? points.total / points.matches : 0, bestMatch };
          const career = { matches: points.matches, batting: points.batting, bowling: points.bowling, fielding: points.fielding, bonus: points.bonus, royalty: royaltyMode ? royalty : 0, total: points.total };
          const playerOpen = expandedPlayer === playerKey;
          return <View key={playerKey}>
            <View style={[x.squadPlayerRow, compact && x.playerPoolMobileRow, !player.active && x.squadPlayerRowInactive]}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${player.name}, ${roleLabel[player.role]}, ${fmt(points.total)} fantasy points${royaltyMode ? `, ${fmt(royalty)} royalty generated` : ""}; ${playerOpen ? "hide" : "show"} match history`} accessibilityHint="Shows this player's points for each scored match" accessibilityState={{ expanded: playerOpen }} style={[x.squadPlayerMain, compact && x.playerPoolMobileMain]} onPress={() => setExpandedPlayer(playerOpen ? "" : playerKey)}>
                {compact ? <><View style={x.playerPoolMobileIdentity}>
                  <View style={x.playerPoolMobileNameRow}><Text numberOfLines={2} style={[x.squadPlayerName, x.playerPoolMobileName, !player.active && x.squadPlayerNameInactive]}>{player.name}</Text>{(leagueSpecialLabels[player.name] ?? []).map((label: string) => <SpecialPlayerBadge key={label} label={label} />)}</View>
                  <View style={x.playerPoolMobileMetaRow}>{!player.active ? <Text style={x.squadInactiveLabel}>Inactive</Text> : null}<Text style={[x.roleText, x.playerPoolMobileRole]}>{roleLabel[player.role]}</Text><Text style={x.squadSelectionCost}>₹{player.price.toFixed(1)}m</Text><OwnerBadge owner={player.owner} label={player.owner === "Available" ? "Open player" : player.owner} compact /></View>
                  {player.owner !== "Available" ? <Text numberOfLines={1} style={x.playerPoolMobileBid}>Auction bid {player.bidPrice == null ? "—" : `₹${player.bidPrice.toFixed(1)}m`}</Text> : null}
                </View><View style={[x.squadScoreBlock, x.playerPoolMobileScoreBlock]}>{royaltyMode && royalty > 0 ? <View style={x.playerPoolRoyaltyBlock}><Text style={x.playerPoolRoyaltyValue}>{fmt(royalty)}</Text><Text style={x.playerPoolRoyaltyLabel}>ROY</Text></View> : null}<View style={x.playerPoolFantasyBlock}><Text style={x.squadPlayerPoints}>{fmt(points.total)}</Text><Text style={x.playerPoolFantasyLabel}>FANTASY PTS</Text></View></View><View style={x.playerPoolMobileChevron}><Text style={x.squadPlayerChevron}>{playerOpen ? "▲" : "▼"}</Text></View></> : <><View style={x.grow}><View style={x.squadPlayerNameRow}><Text style={[x.squadPlayerName, !player.active && x.squadPlayerNameInactive]}>{player.name}</Text>{(leagueSpecialLabels[player.name] ?? []).map((label: string) => <SpecialPlayerBadge key={label} label={label} />)}<Text style={x.squadSelectionCost}>₹{player.price.toFixed(1)}m</Text></View><View style={x.squadPlayerOwnerRow}>{!player.active ? <Text style={x.squadInactiveLabel}>Inactive</Text> : null}<OwnerBadge owner={player.owner} label={player.owner === "Available" ? "Open player" : player.owner} compact />{player.owner !== "Available" ? <Text style={x.squadPlayerOwner}>Bid {player.bidPrice == null ? "—" : `₹${player.bidPrice.toFixed(1)}m`}</Text> : null}</View></View><Text style={x.roleText}>{roleLabel[player.role]}</Text><View style={x.squadScoreBlock}>{royaltyMode && royalty > 0 ? <View style={x.playerPoolRoyaltyBlock}><Text style={x.playerPoolRoyaltyValue}>{fmt(royalty)}</Text><Text style={x.playerPoolRoyaltyLabel}>ROY</Text></View> : null}<View style={x.playerPoolFantasyBlock}><Text style={x.squadPlayerPoints}>{fmt(points.total)}</Text><Text style={x.playerPoolFantasyLabel}>FANTASY PTS</Text></View></View><Text style={x.squadPlayerChevron}>{playerOpen ? "▲" : "▼"}</Text></>}
              </TouchableOpacity>
              {canEdit ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${player.name}`} accessibilityHint="Opens the player editor" style={[x.squadEditButton, compact && x.playerPoolMobileEditButton]} onPress={() => openEditPlayer(player)}><Text style={x.squadEditButtonText}>{compact ? "Edit player details" : "Edit"}</Text></TouchableOpacity> : null}
            </View>
            {playerOpen ? <OwnerPlayerMatchBreakdown matches={playerMatchRows} compact={compact} royaltyMode={royaltyMode} career={career} fantasyOnly insights={insights} onOpenScorecard={openScorecard} /> : null}
          </View>;
        }) : null}
      </View>;
    })}
    <Modal visible={!!addingTeam} transparent animationType="fade" statusBarTranslucent onRequestClose={requestCloseAddPlayer}>
      <KeyboardAvoidingView style={x.playerEditModalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close replacement player form" activeOpacity={1} style={StyleSheet.absoluteFill} onPress={requestCloseAddPlayer} />
        {addingTeam ? <View nativeID="player-pool-add-dialog" accessibilityViewIsModal accessibilityLabel={`Add replacement player to ${addingTeam}`} style={[x.playerEditModalCard, compact && x.playerEditModalCardCompact]} onStartShouldSetResponder={() => true}>
          <View style={x.playerEditModalHeader}><View style={x.playerEditModalHeaderIdentity}><IplTeamBadge code={addingTeam} /><View style={x.grow}><Text style={x.playerEditModalEyebrow}>PLAYER POOL ADMIN</Text><Text numberOfLines={2} style={x.playerEditModalTitle}>Add replacement player</Text><Text style={x.playerAddModalTeam}>Assigning to {addingTeam} squad</Text></View></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close replacement player form" disabled={addBusy} style={x.playerEditModalClose} onPress={requestCloseAddPlayer}><Text style={x.playerEditModalCloseText}>×</Text></TouchableOpacity></View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={x.playerEditModalBody}>
            <View style={x.playerAddNotice}><Text style={x.playerAddNoticeIcon}>＋</Text><View style={x.grow}><Text style={x.playerAddNoticeTitle}>New squad entry</Text><Text style={x.playerAddNoticeText}>Use this only when a replacement or newly registered IPL player must be added.</Text></View></View>
            <Text style={x.squadAddLabel}>Player name</Text>
            <TextInput autoFocus accessibilityLabel={`New ${addingTeam} player name`} style={x.squadAddInput} value={newPlayerName} onChangeText={value => { setNewPlayerName(value); if (addMessage) setAddMessage(""); }} placeholder="Enter full player name" placeholderTextColor="#8B9893" />
            <Text style={x.squadAddLabel}>Role</Text>
            <View style={x.squadAddRoles}>{(["BA", "WK", "AL", "BO"] as Player["role"][]).map(role => <TouchableOpacity key={role} accessibilityRole="button" accessibilityLabel={`Set role to ${roleLabel[role]}`} accessibilityState={{ selected: newPlayerRole === role }} style={[x.squadAddRole, newPlayerRole === role && x.squadAddRoleActive]} onPress={() => { setNewPlayerRole(role); if (addMessage) setAddMessage(""); }}><Text style={[x.squadAddRoleText, newPlayerRole === role && x.squadAddRoleTextActive]}>{roleLabel[role]}</Text></TouchableOpacity>)}</View>
            <Text style={x.squadAddLabel}>Selection cost (₹m) · Minimum {minimumSelectionCostLabel}</Text>
            <TextInput accessibilityLabel={`New player selection cost in millions, minimum ${minimumSelectionCostLabel}`} style={x.squadAddInput} value={newPlayerCost} onChangeText={value => { setNewPlayerCost(value); if (addMessage) setAddMessage(""); }} keyboardType="decimal-pad" placeholder={minimumSelectionCostInput || "Selection cost"} placeholderTextColor="#8B9893" />
            {ownershipEnabled ? <><Text style={x.squadAddLabel}>Assigned owner</Text><View style={x.playerEditOwnerSelect}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Assigned owner, ${selectedNewPlayerOwnerName}`} accessibilityHint="Opens the owner picker" accessibilityState={{ expanded: newPlayerOwnerPickerOpen }} style={[x.playerEditOwnerTrigger, newPlayerOwnerPickerOpen && x.playerEditOwnerTriggerOpen]} onPress={() => setNewPlayerOwnerPickerOpen(true)}><View style={x.playerEditOwnerTriggerIdentity}><OwnerBadge owner={selectedNewPlayerOwner?.display_name ?? "Available"} label={selectedNewPlayerOwnerName} /><Text style={x.playerEditOwnerTriggerHint}>Tap to change</Text></View><Text style={x.playerEditOwnerChevron}>⌄</Text></TouchableOpacity></View></> : <Text style={x.squadEditBidNote}>All-open-player league · this player remains open</Text>}
            {addMessage ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={x.playerEditModalError}><Text style={x.playerEditModalErrorText}>{addMessage}</Text></View> : null}
          </ScrollView>
          <View style={x.playerEditModalFooter}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel adding replacement player" accessibilityHint="Closes the form and warns before discarding entered details" disabled={addBusy} style={x.playerEditModalCancel} onPress={requestCloseAddPlayer}><Text style={x.playerEditModalCancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add player to ${addingTeam}`} accessibilityHint={!addFormValid ? "Enter a player name and valid selection cost first" : "Adds this player to the selected IPL squad"} accessibilityState={{ disabled: addSubmitDisabled, busy: addBusy }} disabled={addSubmitDisabled} style={[x.playerEditModalSave, addSubmitDisabled && x.playerEditModalSaveDisabled]} onPress={addReplacementPlayer}>{addBusy ? <ActivityIndicator color="#10251F" /> : <Text style={[x.playerEditModalSaveText, addSubmitDisabled && x.playerEditModalSaveTextDisabled]}>Add to {addingTeam}</Text>}</TouchableOpacity></View>
        </View> : null}
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={!!editingPlayer} transparent animationType="fade" statusBarTranslucent onRequestClose={requestCloseEditPlayer}>
      <KeyboardAvoidingView style={x.playerEditModalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close player editor" activeOpacity={1} style={StyleSheet.absoluteFill} onPress={requestCloseEditPlayer} />
        {editingPlayer ? <View nativeID="player-pool-edit-dialog" accessibilityViewIsModal accessibilityLabel={`Edit ${editingPlayer.name}`} style={[x.playerEditModalCard, compact && x.playerEditModalCardCompact]} onStartShouldSetResponder={() => true}>
          <View style={x.playerEditModalHeader}><View style={x.playerEditModalHeaderIdentity}><IplTeamBadge code={editingPlayer.team} /><View style={x.grow}><Text style={x.playerEditModalEyebrow}>PLAYER POOL ADMIN</Text><Text numberOfLines={2} style={x.playerEditModalTitle}>Edit {editingPlayer.name}</Text></View></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close player editor" disabled={editBusy} style={x.playerEditModalClose} onPress={requestCloseEditPlayer}><Text style={x.playerEditModalCloseText}>×</Text></TouchableOpacity></View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={x.playerEditModalBody}>
            <Text style={x.squadAddLabel}>Player name</Text>
            <TextInput accessibilityLabel={`Player name for ${editingPlayer.name}`} style={x.squadAddInput} value={editName} onChangeText={value => { setEditName(value); if (editMessage) setEditMessage(""); }} placeholder="Player name" placeholderTextColor="#8B9893" />
            <Text style={x.squadAddLabel}>Role</Text>
            <View style={x.squadAddRoles}>{(["BA", "WK", "AL", "BO"] as Player["role"][]).map(role => <TouchableOpacity key={role} accessibilityRole="button" accessibilityLabel={`Set role to ${roleLabel[role]}`} accessibilityState={{ selected: editRole === role }} style={[x.squadAddRole, editRole === role && x.squadAddRoleActive]} onPress={() => { setEditRole(role); if (editMessage) setEditMessage(""); }}><Text style={[x.squadAddRoleText, editRole === role && x.squadAddRoleTextActive]}>{roleLabel[role]}</Text></TouchableOpacity>)}</View>
            <Text style={x.squadAddLabel}>Selection cost (₹m) · Minimum {minimumSelectionCostLabel}</Text>
            <TextInput accessibilityLabel={`Selection cost for ${editingPlayer.name} in millions, minimum ${minimumSelectionCostLabel}`} style={x.squadAddInput} value={editCost} onChangeText={value => { setEditCost(value); if (editMessage) setEditMessage(""); }} keyboardType="decimal-pad" placeholder={minimumSelectionCostInput || "Selection cost"} placeholderTextColor="#8B9893" />
            {ownershipEnabled ? <><Text style={x.squadAddLabel}>Assigned owner</Text><View style={x.playerEditOwnerSelect}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Assigned owner, ${selectedEditOwnerName}`} accessibilityHint="Opens the owner picker" accessibilityState={{ expanded: editOwnerDropdownOpen }} style={[x.playerEditOwnerTrigger, editOwnerDropdownOpen && x.playerEditOwnerTriggerOpen]} onPress={() => setEditOwnerDropdownOpen(true)}><View style={x.playerEditOwnerTriggerIdentity}><OwnerBadge owner={selectedEditOwner?.display_name ?? "Available"} label={selectedEditOwnerName} /><Text style={x.playerEditOwnerTriggerHint}>Tap to change</Text></View><Text style={x.playerEditOwnerChevron}>⌄</Text></TouchableOpacity></View></> : <Text style={x.squadEditBidNote}>All-open-player league · owner assignment is disabled</Text>}
            <Text style={x.squadAddLabel}>Availability</Text>
            <View style={x.squadEditAvailability}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Set player active" accessibilityState={{ selected: editActive }} style={[x.squadEditStatus, editActive && x.squadEditStatusActive]} onPress={() => { setEditActive(true); if (editMessage) setEditMessage(""); }}><Text style={[x.squadEditStatusText, editActive && x.squadEditStatusTextActive]}>Active</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Deactivate player" accessibilityState={{ selected: !editActive }} style={[x.squadEditStatus, !editActive && x.squadEditStatusInactive]} onPress={() => { setEditActive(false); if (editMessage) setEditMessage(""); }}><Text style={[x.squadEditStatusText, !editActive && x.squadEditStatusTextInactive]}>Deactivate</Text></TouchableOpacity></View>
            {ownershipEnabled ? <View style={x.playerEditReadOnly}><Text style={x.playerEditReadOnlyLabel}>AUCTION BID · READ ONLY</Text><Text style={x.playerEditReadOnlyValue}>{editingPlayer.bidPrice == null ? "—" : `₹${editingPlayer.bidPrice.toFixed(1)}m`}</Text></View> : null}
            {editMessage ? <View accessibilityLiveRegion="polite" style={x.playerEditModalError}><Text style={x.playerEditModalErrorText}>{editMessage}</Text></View> : null}
          </ScrollView>
          <View style={x.playerEditModalFooter}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel editing player" accessibilityHint="Closes the editor and warns before discarding unsaved changes" disabled={editBusy} style={x.playerEditModalCancel} onPress={requestCloseEditPlayer}><Text style={x.playerEditModalCancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Save changes to ${editingPlayer.name}`} accessibilityHint={!editFormDirty ? "Change a player detail first" : !editFormValid ? "Correct the invalid fields first" : "Saves these player details"} accessibilityState={{ disabled: editSubmitDisabled, busy: editBusy }} disabled={editSubmitDisabled} style={[x.playerEditModalSave, editSubmitDisabled && x.playerEditModalSaveDisabled]} onPress={() => savePlayer(editingPlayer)}>{editBusy ? <ActivityIndicator color="#10251F" /> : <Text style={[x.playerEditModalSaveText, editSubmitDisabled && x.playerEditModalSaveTextDisabled]}>Save changes</Text>}</TouchableOpacity></View>
        </View> : null}
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={!!discardPrompt} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDiscardPrompt("")}>
      <View style={x.discardPromptOverlay}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss discard confirmation" activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setDiscardPrompt("")} />
        <View accessibilityViewIsModal accessibilityLabel={discardPrompt === "ADD" ? "Discard new player confirmation" : "Discard player changes confirmation"} style={x.discardPromptCard} onStartShouldSetResponder={() => true}>
          <View style={x.discardPromptIcon}><Text style={x.discardPromptIconText}>!</Text></View>
          <Text accessibilityRole="header" style={x.discardPromptTitle}>{discardPrompt === "ADD" ? "Discard new player?" : "Discard player changes?"}</Text>
          <Text style={x.discardPromptMessage}>{discardPrompt === "ADD" ? "The player details you entered will be lost." : "Your unsaved player details will be lost."}</Text>
          <View style={x.discardPromptActions}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Keep editing" style={x.discardPromptKeep} onPress={() => setDiscardPrompt("")}><Text style={x.discardPromptKeepText}>Keep editing</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Discard unsaved changes" style={x.discardPromptDiscard} onPress={() => { const prompt = discardPrompt; setDiscardPrompt(""); if (prompt === "ADD") closeAddPlayer(); else closeEditPlayer(); }}><Text style={x.discardPromptDiscardText}>Discard</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    <OwnerPickerModal visible={!!editingPlayer && editOwnerDropdownOpen} compact={compact} playerName={editingPlayer?.name ?? "this player"} owners={owners} selectedOwnerId={editOwnerId} onSelect={ownerId => { setEditOwnerId(ownerId); setEditOwnerDropdownOpen(false); if (editMessage) setEditMessage(""); }} onClose={() => setEditOwnerDropdownOpen(false)} />
    <OwnerPickerModal visible={!!addingTeam && newPlayerOwnerPickerOpen} compact={compact} playerName={newPlayerName.trim() || `the new ${addingTeam} player`} owners={owners} selectedOwnerId={newPlayerOwnerId} onSelect={ownerId => { setNewPlayerOwnerId(ownerId); setNewPlayerOwnerPickerOpen(false); if (addMessage) setAddMessage(""); }} onClose={() => setNewPlayerOwnerPickerOpen(false)} />
  </View>;
}

export function ProductionHistory({ leagueId, currentOwner, requestedFixtureId = "", requestedScorecardFixtureId = "", scorecardBackRequest = 0, onScorecardStateChange, onCloseRequestedScorecard }: { leagueId: string; currentOwner: string; requestedFixtureId?: string; requestedScorecardFixtureId?: string; scorecardBackRequest?: number; onScorecardStateChange?: (open: boolean) => void; onCloseRequestedScorecard?: () => void }) {
  const { width: historyWidth } = useWindowDimensions();
  const compact = historyWidth < 620;
  const historyScrollRef = useRef<ScrollView>(null);
  const historyMatchPositions = useRef<Record<string, number>>({});
  const lastScrolledFixture = useRef("");
  const [matches, setMatches] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [royaltyAdjustments, setRoyaltyAdjustments] = useState<any[]>([]);
  const [playerOwners, setPlayerOwners] = useState<Record<string, string>>({});
  const [transferPeriods, setTransferPeriods] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [lineupRules, setLineupRules] = useState<any[]>([]);
  const [specialRules, setSpecialRules] = useState<any[]>([]);
  const [leagueFormat, setLeagueFormat] = useState({ ownership_enabled: true, other_owner_deductions_enabled: true });
  const [expandedMatch, setExpandedMatch] = useState("");
  const [expandedOwner, setExpandedOwner] = useState("");
  const [expandedPlayer, setExpandedPlayer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [matchFilter, setMatchFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [scorecardMatchId, setScorecardMatchId] = useState("");
  const specialLabels = useFixtureSpecialLabels(expandedMatch ? [expandedMatch] : []);
  const closeScorecard = () => {
    setScorecardMatchId("");
    onCloseRequestedScorecard?.();
  };
  useEffect(() => {
    onScorecardStateChange?.(!!scorecardMatchId);
    return () => { if (scorecardMatchId) onScorecardStateChange?.(false); };
  }, [scorecardMatchId, onScorecardStateChange]);
  useEffect(() => {
    if (!scorecardBackRequest || !scorecardMatchId) return;
    closeScorecard();
  }, [scorecardBackRequest]);
  useEffect(() => {
    if (!requestedFixtureId || !matches.some(match => match.id === requestedFixtureId)) return;
    setMatchFilter("");
    setPhaseFilter("ALL");
    setStatusFilter("ALL");
    setOwnerFilter("ALL");
    setFiltersExpanded(false);
    setExpandedMatch(requestedFixtureId);
    setExpandedOwner("");
    setExpandedPlayer("");
    setScorecardMatchId(requestedScorecardFixtureId === requestedFixtureId ? requestedFixtureId : "");
  }, [requestedFixtureId, requestedScorecardFixtureId, matches]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMatches([]);
    Promise.all([
      supabase.from("fixtures").select("id,external_ref,match_number,stage,status,scoring_status,lineup_lock_at,scheduled_start,venue,scorecard_source_url,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code),player_match_points(player_id,batting_points,bowling_points,fielding_points,bonus_points,total_points,raw_stats,breakdown,calculation_version,published_at,player:players(id,full_name,role,team:cricket_teams(code))),member_match_scores(lineup_id,total_points,rank,calculation_breakdown),lineup_submissions(id,status,captain_player_id,vice_captain_player_id,impact_player_id,impact_type,member:league_members(id,display_name),lineup_players(slot,player:players(id,full_name,role,team:cricket_teams(code))),lineup_boosters(target_player_id,booster:booster_rules(code,player_multiplier,match_multiplier)))").eq("league_id", leagueId).order("match_number", { ascending: false }),
      supabase.from("transfer_events").select("member_id,transfer_count,transfer_period_id,reason,fixture:fixtures(match_number)").eq("league_id", leagueId).eq("reason", "lineup_change"),
      supabase.from("league_transfer_periods").select("id,name,start_match_number,end_match_number,transfer_limit,first_match_free,sort_order").eq("league_id", leagueId).eq("active", true).order("sort_order"),
      supabase.from("league_phases").select("id,name,start_match_number,end_match_number,sort_order").eq("league_id", leagueId).eq("active", true).order("sort_order"),
      supabase.from("league_players").select("player_id,owner:league_members(display_name)").eq("league_id", leagueId).eq("active", true),
      supabase.from("lineup_rule_sets").select("version,effective_from_match_number,captain_multiplier,vice_captain_multiplier,impact_multiplier,other_owner_penalty_percent,other_owner_minimum_penalty").eq("league_id", leagueId).order("effective_from_match_number").order("version"),
      supabase.from("league_format_configs").select("ownership_enabled,other_owner_deductions_enabled").eq("league_id", leagueId).maybeSingle(),
      supabase.from("special_player_rule_sets").select("version,effective_from_match_number,active,unique_mode_enabled,marquee_mode_enabled,other_player_fee_percent,other_player_minimum_fee").eq("league_id", leagueId).order("effective_from_match_number").order("version"),
      supabase.from("lineup_boosters").select("lineup_id,target_player_id,booster:booster_rules(code,player_multiplier,match_multiplier)").eq("league_id", leagueId),
      supabase.from("special_player_score_adjustments").select("fixture_id,player_id,source_member_id,recipient_member_id,adjustment_type,final_player_contribution,rate_percent,minimum_fee,adjustment_points,calculation_breakdown,source:league_members!special_player_score_adjustments_source_member_id_fkey(display_name),recipient:league_members!special_player_score_adjustments_recipient_member_id_fkey(display_name)").eq("league_id", leagueId).in("adjustment_type", ["regular_royalty", "marquee_royalty"]),
    ]).then(([matchResult, transferResult, periodResult, phaseResult, ownershipResult, ruleResult, formatResult, specialRuleResult, boosterResult, royaltyResult]) => {
      if (cancelled) return;
      const firstError = matchResult.error ?? transferResult.error ?? periodResult.error ?? phaseResult.error ?? ownershipResult.error ?? ruleResult.error ?? formatResult.error ?? specialRuleResult.error ?? boosterResult.error ?? royaltyResult.error;
      if (firstError) { setError(firstError.message); setLoading(false); return; }
      const boostersByLineup = new Map((boosterResult.data ?? []).map((row: any) => [row.lineup_id, row]));
      const matchesWithBoosters = (matchResult.data ?? []).map((match: any) => ({
        ...match,
        lineup_submissions: (match.lineup_submissions ?? []).map((lineup: any) => {
          const savedBooster = boostersByLineup.get(lineup.id);
          return savedBooster ? { ...lineup, lineup_boosters: [savedBooster] } : lineup;
        }),
      }));
      setMatches(matchesWithBoosters.filter((match: any) => match.status !== "scheduled" || (match.lineup_submissions?.some((lineup: any) => lineup.status === "submitted" || lineup.status === "locked") ?? false)));
      setTransfers(transferResult.data ?? []);
      setTransferPeriods(periodResult.data ?? []);
      setPhases(phaseResult.data ?? []);
      setLineupRules(ruleResult.data ?? []);
      setSpecialRules(specialRuleResult.data ?? []);
      setRoyaltyAdjustments(royaltyResult.data ?? []);
      if (formatResult.data) setLeagueFormat(formatResult.data);
      setPlayerOwners(Object.fromEntries((ownershipResult.data ?? []).map((row: any) => [row.player_id, row.owner?.display_name ?? ""])));
      setLoading(false);
    }).catch(reason => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : "Could not load match results.");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [leagueId, reloadKey]);
  const ownerOptions = useMemo(() => Array.from(new Set(matches.flatMap(match => (match.lineup_submissions ?? []).filter((lineup: any) => lineup.status === "submitted" || lineup.status === "locked").map((lineup: any) => lineup.member?.display_name).filter(Boolean) as string[]))).sort((a, b) => a.localeCompare(b)), [matches]);
  const filteredMatches = useMemo(() => matches.filter(match => {
    const numberMatches = !matchFilter.trim() || String(match.match_number) === matchFilter.trim();
    const phaseMatches = phaseFilter === "ALL" || phases.some(phase => phase.id === phaseFilter && Number(match.match_number) >= Number(phase.start_match_number) && Number(match.match_number) <= Number(phase.end_match_number));
    const statusMatches = statusFilter === "ALL" || (statusFilter === "PUBLISHED" ? match.scoring_status === "published" : match.scoring_status !== "published");
    const ownerMatches = ownerFilter === "ALL" || (match.lineup_submissions ?? []).some((lineup: any) => (lineup.status === "submitted" || lineup.status === "locked") && lineup.member?.display_name === ownerFilter);
    return numberMatches && phaseMatches && statusMatches && ownerMatches;
  }), [matches, matchFilter, phaseFilter, phases, statusFilter, ownerFilter]);
  if (loading) return <ScrollView contentContainerStyle={x.screen}><Loading /></ScrollView>;
  if (error) return <ScrollView contentContainerStyle={x.screen}><LoadError message={error} onRetry={() => setReloadKey(value => value + 1)} /></ScrollView>;
  const scorecardMatch = matches.find(match => match.id === scorecardMatchId);
  if (scorecardMatch) return <ProductionScorecard match={scorecardMatch} royaltyAdjustments={royaltyAdjustments.filter(row => row.fixture_id === scorecardMatch.id)} onBack={closeScorecard} />;
  const publishedCount = matches.filter(match => match.scoring_status === "published").length;
  const awaitingCount = matches.length - publishedCount;
  const lineupCount = matches.reduce((total, match) => total + Number(match.lineup_submissions?.filter((lineup: any) => lineup.status === "submitted" || lineup.status === "locked").length ?? 0), 0);
  const yourResultCount = matches.filter(match => (match.lineup_submissions ?? []).some((lineup: any) => (lineup.status === "submitted" || lineup.status === "locked") && String(lineup.member?.display_name ?? "").trim().toLocaleLowerCase() === currentOwner.trim().toLocaleLowerCase())).length;
  const filtersApplied = !!matchFilter || phaseFilter !== "ALL" || statusFilter !== "ALL" || ownerFilter !== "ALL";
  const activeResultFilterCount = Number(phaseFilter !== "ALL") + Number(statusFilter !== "ALL") + Number(ownerFilter !== "ALL");
  const resetResultFilters = () => { setMatchFilter(""); setPhaseFilter("ALL"); setStatusFilter("ALL"); setOwnerFilter("ALL"); };
  return <ScrollView ref={historyScrollRef} contentContainerStyle={x.screen}>
    <View style={x.resultsHero}>
      <View style={x.resultsHeroGlowLarge} /><View style={x.resultsHeroGlowSmall} />
      <View style={x.resultsHeroHeading}><View style={x.resultsHeroMark}><Text style={x.resultsHeroMarkText}>✓</Text></View><View style={x.grow}><Text style={x.resultsHeroEyebrow}>MATCH ARCHIVE</Text><Text accessibilityRole="header" style={x.resultsHeroTitle}>Results centre</Text><Text style={x.resultsHeroSubtitle}>Scores, submitted XIs and transfer records in one place.</Text></View></View>
      <View style={[x.resultsHeroStats, compact && x.resultsHeroStatsCompact]}><ResultsHeroStat compact={compact} label="PUBLISHED" value={String(publishedCount)} detail={publishedCount === 1 ? "match result" : "match results"} /><ResultsHeroStat compact={compact} label="AWAITING" value={String(awaitingCount)} detail="scores pending" /><ResultsHeroStat compact={compact} label="LINEUPS" value={String(lineupCount)} detail="stored entries" /><ResultsHeroStat compact={compact} label="YOUR XIs" value={String(yourResultCount)} detail="match entries" /></View>
    </View>
    {matches.length ? <View style={x.resultsFilters}>
      <View style={x.historyFilterHeader}><View style={x.grow}><Text style={x.historyFilterTitle}>Find a result</Text><Text style={x.historyFilterSubtitle}>{filteredMatches.length} of {matches.length} matches shown</Text></View>{filtersApplied ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear result filters" style={x.historyClear} onPress={resetResultFilters}><Text style={x.historyClearText}>Reset</Text></TouchableOpacity> : null}</View>
      <View style={x.resultsSearchRow}><TextInput accessibilityLabel="Match number filter" style={x.historyMatchInput} value={matchFilter} onChangeText={value => setMatchFilter(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="Match number" placeholderTextColor="#8A9691" />{compact ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={filtersExpanded ? "Hide result filters" : "Show result filters"} accessibilityState={{ expanded: filtersExpanded }} style={[x.playerPoolFilterToggle, (filtersExpanded || activeResultFilterCount > 0) && x.playerPoolFilterToggleActive]} onPress={() => setFiltersExpanded(value => !value)}><Text style={[x.playerPoolFilterToggleText, (filtersExpanded || activeResultFilterCount > 0) && x.playerPoolFilterToggleTextActive]}>Filters{activeResultFilterCount ? ` · ${activeResultFilterCount}` : ""}</Text><Text style={[x.playerPoolFilterToggleIcon, (filtersExpanded || activeResultFilterCount > 0) && x.playerPoolFilterToggleTextActive]}>{filtersExpanded ? "▲" : "▼"}</Text></TouchableOpacity> : null}</View>
      {(!compact || filtersExpanded) ? <View style={x.resultsFilterPanel}><View style={x.resultsStatusGroup}><Text style={x.resultsFilterLabel}>STATUS</Text><View accessibilityRole="tablist" style={x.resultsStatusOptions}>{[["ALL", "All"], ["AWAITING", "Awaiting"], ["PUBLISHED", "Published"]].map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="tab" accessibilityLabel={`${label} status`} accessibilityState={{ selected: statusFilter === value }} style={[x.historyFilterChip, x.resultsStatusChip, statusFilter === value && x.historyFilterChipActive]} onPress={() => setStatusFilter(value)}><Text numberOfLines={1} style={[x.historyFilterChipText, statusFilter === value && x.historyFilterChipTextActive]}>{label}</Text></TouchableOpacity>)}</View></View>
      {phases.length > 1 ? <View style={x.resultsFilterRow}><View style={x.resultsFilterRowHeading}><Text style={x.resultsFilterLabel}>PHASE</Text>{compact ? <Text style={x.resultsFilterSwipe}>SWIPE →</Text> : null}</View><ScrollView horizontal accessibilityRole="tablist" showsHorizontalScrollIndicator={false} contentContainerStyle={x.historyFilterOptions}><TouchableOpacity accessibilityRole="tab" accessibilityLabel="All phases" accessibilityState={{ selected: phaseFilter === "ALL" }} style={[x.historyFilterChip, phaseFilter === "ALL" && x.historyFilterChipActive]} onPress={() => setPhaseFilter("ALL")}><Text style={[x.historyFilterChipText, phaseFilter === "ALL" && x.historyFilterChipTextActive]}>All phases</Text></TouchableOpacity>{phases.map(phase => <TouchableOpacity key={phase.id} accessibilityRole="tab" accessibilityLabel={`${phase.name} phase`} accessibilityState={{ selected: phaseFilter === phase.id }} style={[x.historyFilterChip, phaseFilter === phase.id && x.historyFilterChipActive]} onPress={() => setPhaseFilter(phase.id)}><Text style={[x.historyFilterChipText, phaseFilter === phase.id && x.historyFilterChipTextActive]}>{phase.name}</Text></TouchableOpacity>)}</ScrollView></View> : null}
      {ownerOptions.length > 1 ? <View style={x.resultsFilterRow}><View style={x.resultsFilterRowHeading}><Text style={x.resultsFilterLabel}>OWNER</Text>{compact ? <Text style={x.resultsFilterSwipe}>SWIPE →</Text> : null}</View><ScrollView horizontal accessibilityRole="tablist" showsHorizontalScrollIndicator={false} contentContainerStyle={x.historyFilterOptions}><TouchableOpacity accessibilityRole="tab" accessibilityLabel="All owners" accessibilityState={{ selected: ownerFilter === "ALL" }} style={[x.historyFilterChip, ownerFilter === "ALL" && x.historyFilterChipActive]} onPress={() => setOwnerFilter("ALL")}><Text style={[x.historyFilterChipText, ownerFilter === "ALL" && x.historyFilterChipTextActive]}>All owners</Text></TouchableOpacity>{ownerOptions.map(owner => <TouchableOpacity key={owner} accessibilityRole="tab" accessibilityLabel={`${owner} owner`} accessibilityState={{ selected: ownerFilter === owner }} style={[x.historyFilterChip, ownerFilter === owner && x.historyFilterChipActive]} onPress={() => setOwnerFilter(owner)}><Text style={[x.historyFilterChipText, ownerFilter === owner && x.historyFilterChipTextActive]}>{owner}</Text></TouchableOpacity>)}</ScrollView></View> : null}</View> : null}
    </View> : null}
    {filteredMatches.length ? filteredMatches.map(match => {
      const open = expandedMatch === match.id;
      const noResult = isNoResultFixture(match.status);
      const lineups = [...(match.lineup_submissions ?? [])].filter(lineup => (lineup.status === "submitted" || lineup.status === "locked") && (ownerFilter === "ALL" || lineup.member?.display_name === ownerFilter)).sort((a, b) => {
        const scoreA = (match.member_match_scores ?? []).find((score: any) => score.lineup_id === a.id);
        const scoreB = (match.member_match_scores ?? []).find((score: any) => score.lineup_id === b.id);
        return (scoreA?.rank ?? 999) - (scoreB?.rank ?? 999) || (a.member?.display_name ?? "").localeCompare(b.member?.display_name ?? "");
      });
      const matchRule = [...lineupRules].filter(rule => Number(rule.effective_from_match_number ?? 1) <= Number(match.match_number)).sort((a, b) => Number(b.effective_from_match_number ?? 1) - Number(a.effective_from_match_number ?? 1) || Number(b.version) - Number(a.version))[0];
      const matchSpecialRule = [...specialRules].filter(rule => Number(rule.effective_from_match_number ?? 1) <= Number(match.match_number)).sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)) || Number(b.effective_from_match_number ?? 1) - Number(a.effective_from_match_number ?? 1) || Number(b.version) - Number(a.version))[0];
      const revealTime = new Date(match.lineup_lock_at ?? match.scheduled_start ?? "").getTime();
      const lineupsRevealed = match.status !== "scheduled" || (Number.isFinite(revealTime) && Date.now() >= revealTime);
      const rankedScores = [...(match.member_match_scores ?? [])].filter((score: any) => score.rank != null).sort((left: any, right: any) => Number(left.rank) - Number(right.rank) || Number(right.total_points) - Number(left.total_points));
      const winningScore = rankedScores[0];
      const winningLineup = lineups.find(lineup => lineup.id === winningScore?.lineup_id);
      const published = match.scoring_status === "published";
      const noResultSettled = noResult && published;
      const resultStatus = noResultSettled ? "NO RESULT" : noResult ? "NO RESULT PENDING" : published ? "PUBLISHED" : match.status === "live" ? "LIVE" : lineupsRevealed ? "LOCKED" : "SUBMITTED";
      const resultTone = noResult ? { accent: "#6B756F", wash: "#EEF1EF", strong: "#4F5D56" } : published ? { accent: "#2F8550", wash: "#EAF6EE", strong: "#24683E" } : match.status === "live" ? { accent: "#D26A24", wash: "#FFF0E5", strong: "#924719" } : { accent: "#4B669C", wash: "#EDF1FA", strong: "#354F82" };
      const matchDate = new Date(match.scheduled_start ?? match.lineup_lock_at ?? "");
      const matchDateText = Number.isFinite(matchDate.getTime()) ? matchDate.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Date unavailable";
      return <View key={match.id} style={[x.resultsMatchCard, open && x.resultsMatchCardOpen, { borderLeftColor: resultTone.accent }]} onLayout={event => {
        const matchY = event.nativeEvent.layout.y;
        historyMatchPositions.current[match.id] = matchY;
        if (match.id === requestedFixtureId && lastScrolledFixture.current !== requestedFixtureId) {
          lastScrolledFixture.current = requestedFixtureId;
          setTimeout(() => historyScrollRef.current?.scrollTo({ y: Math.max(0, matchY - 12), animated: true }), 80);
        }
      }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Match ${match.match_number}, ${match.home?.code} versus ${match.away?.code}, ${resultStatus}, ${lineups.length} visible teams`} accessibilityState={{ expanded: open }} style={[x.resultsMatchHeader, compact && x.resultsMatchHeaderCompact]} onPress={() => setExpandedMatch(open ? "" : match.id)}>
          <View style={[x.resultsMatchNumber, { backgroundColor: resultTone.wash }]}><Text style={[x.resultsMatchNumberLabel, { color: resultTone.strong }]}>MATCH</Text><Text style={[x.resultsMatchNumberValue, { color: resultTone.strong }]}>{match.match_number}</Text></View>
          <View style={x.resultsMatchIdentity}><View style={x.resultsMatchTeams}><IplTeamBadge code={match.home?.code} /><Text style={x.resultsMatchVs}>VS</Text><IplTeamBadge code={match.away?.code} /></View><Text numberOfLines={1} style={x.resultsMatchDate}>{matchDateText}</Text></View>
          <View style={x.resultsMatchEnd}><View style={[x.resultsMatchStatus, { backgroundColor: resultTone.wash }]}><View style={[x.resultsMatchStatusDot, { backgroundColor: resultTone.accent }]} /><Text style={[x.resultsMatchStatusText, { color: resultTone.strong }]}>{resultStatus}</Text></View><View style={[x.resultsMatchChevron, { backgroundColor: resultTone.wash }]}><Text style={[x.resultsMatchChevronText, { color: resultTone.strong }]}>{open ? "▲" : "▼"}</Text></View></View>
        </TouchableOpacity>
        <View style={x.resultsMatchSummary}><View style={x.resultsMatchSummaryCopy}><Text style={x.resultsMatchSummaryLabel}>{noResult ? `MATCH ${match.match_number} VOID` : published && winningScore ? "FANTASY WINNER" : `MATCH ${match.match_number} RECORD`}</Text><Text numberOfLines={1} style={x.resultsMatchSummaryValue}>{noResultSettled ? "No winner · all usage refunded" : noResult ? "No winner · settlement pending" : published && winningScore ? `${winningLineup?.member?.display_name ?? "Winner"} · ${fmt(winningScore.total_points)} pts` : `${lineups.length} submitted XI${lineups.length === 1 ? "" : "s"}`}</Text></View>{published && !noResult ? <TouchableOpacity accessibilityRole="link" accessibilityLabel={`Open cricket scorecard for Match ${match.match_number}`} style={x.resultsScorecardLink} onPress={() => setScorecardMatchId(match.id)}><Text style={x.resultsScorecardLinkIcon}>▤</Text><Text style={x.resultsScorecardLinkText}>Scorecard</Text><Text style={x.resultsScorecardLinkArrow}>›</Text></TouchableOpacity> : !compact ? <Text style={x.resultsMatchSummaryMeta}>{noResultSettled ? "Later unlocked XIs reset" : noResult ? "Admin action required" : "Points awaiting publication"}</Text> : null}</View>
        {open ? <><View style={[x.historyVisibility, lineupsRevealed ? x.historyVisibilityRevealed : x.historyVisibilityPrivate]}><View style={[x.historyVisibilityIcon, lineupsRevealed ? x.historyVisibilityIconRevealed : x.historyVisibilityIconPrivate]}><Text style={x.historyVisibilityIconText}>{noResult ? "↺" : lineupsRevealed ? "XI" : "◉"}</Text></View><View style={x.grow}><Text style={x.resultsXiSectionEyebrow}>MATCH {match.match_number} · {match.home?.code} VS {match.away?.code}</Text><Text style={x.historyVisibilityTitle}>{noResultSettled ? "Fixture settled as No Result" : noResult ? "No Result settlement pending" : lineupsRevealed ? "Owner XIs" : "Your XI only"}</Text><Text style={x.historyVisibilityText}>{noResultSettled ? "This XI was cancelled, its usage was returned, later unlocked XIs were reset, and the first later locked XI was recharged against the last valid team." : noResult ? "A league administrator must complete settlement before usage is refunded and later XI charges are corrected." : lineupsRevealed ? `${lineups.length} submitted team${lineups.length === 1 ? "" : "s"} · Tap an owner’s XI to view its players.` : "Only your submitted XI is visible until this match locks."}</Text></View></View>{lineups.length ? <View style={x.resultsOwnerList}>{lineups.map(lineup => {
          const owner = lineup.member?.display_name ?? "Owner";
          const transferPeriod = transferPeriods.find(period => Number(match.match_number) >= period.start_match_number && Number(match.match_number) <= period.end_match_number);
          const periodLimit = Number(transferPeriod?.transfer_limit ?? 0);
          const ownerPeriodTransfers = transfers.filter(event => event.member_id === lineup.member?.id && event.transfer_period_id === transferPeriod?.id);
          const matchTransfers = ownerPeriodTransfers.filter(event => Number(event.fixture?.match_number) === Number(match.match_number)).reduce((sum, event) => sum + Number(event.transfer_count), 0);
          const usedThroughMatch = ownerPeriodTransfers.filter(event => Number(event.fixture?.match_number) <= Number(match.match_number)).reduce((sum, event) => sum + Number(event.transfer_count), 0);
          const score = (match.member_match_scores ?? []).find((item: any) => item.lineup_id === lineup.id);
          const key = `${match.id}:${lineup.id}`;
          const ownerOpen = expandedOwner === key;
          const booster = lineup.lineup_boosters?.[0];
          // Published scoring persists the applied match booster in the score
          // breakdown. Use it as the authoritative fallback when PostgREST does
          // not return the nested lineup_boosters relation (for example, after
          // the lineup has been locked and its score published).
          const scoreBreakdown = score?.calculation_breakdown && typeof score.calculation_breakdown === "object"
            ? score.calculation_breakdown
            : {};
          const boosterCode = booster?.booster?.code ?? scoreBreakdown.booster_code ?? "";
          const ownerColor = ownerTheme(owner);
          const isCurrentOwner = owner.trim().toLocaleLowerCase() === currentOwner.trim().toLocaleLowerCase();
          const rank = Number(score?.rank);
          const rankTone = rank === 1 ? { backgroundColor: "#FFF1B8", color: "#7C5400", borderColor: "#D9AD2A" } : rank === 2 ? { backgroundColor: "#EDF1F5", color: "#4E5E6D", borderColor: "#B5C0CB" } : rank === 3 ? { backgroundColor: "#F8E5DA", color: "#7D4325", borderColor: "#CE8B65" } : { backgroundColor: ownerColor.soft, color: ownerColor.strong, borderColor: ownerColor.border };
          return <View key={key} style={[x.resultsOwnerCard, ownerOpen && x.resultsOwnerCardOpen, ownerOpen && { borderColor: isCurrentOwner ? UI_TOKENS.colors.primary : ownerColor.border }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${owner}’s XI for Match ${match.match_number}, ${lineup.lineup_players?.length ?? 0} players, ${score ? `${fmt(score.total_points)} points` : "points pending"}`} accessibilityState={{ expanded: ownerOpen }} style={[x.resultsOwnerHeader, compact && x.resultsOwnerHeaderCompact, isCurrentOwner && x.resultsOwnerHeaderCurrent, ownerOpen && x.resultsOwnerHeaderOpen]} onPress={() => { setExpandedOwner(ownerOpen ? "" : key); setExpandedPlayer(""); }}>
              <View style={[x.resultsOwnerRank, { backgroundColor: score?.rank ? rankTone.backgroundColor : ownerColor.soft, borderColor: score?.rank ? rankTone.borderColor : ownerColor.border }]}><Text style={[x.resultsOwnerRankText, { color: score?.rank ? rankTone.color : ownerColor.strong }]}>{score?.rank ? `#${score.rank}` : owner.charAt(0).toUpperCase()}</Text></View>
              <View style={[x.resultsOwnerIdentity, compact && x.resultsOwnerIdentityCompact]}><View style={x.ownerNameRow}><Text numberOfLines={1} style={[x.resultsXiName, compact && x.resultsOwnerNameCompact]}>{owner}’s XI</Text>{isCurrentOwner ? <View style={[x.youBadge, { backgroundColor: UI_TOKENS.colors.primary }]}><Text style={x.youBadgeText}>YOU</Text></View> : null}{boosterCode ? <View style={x.historyBoosterBadge}><Text style={x.historyBoosterBadgeText}>{boosterCode}</Text></View> : null}</View><Text numberOfLines={1} style={[x.resultsXiRowMeta, compact && x.resultsOwnerMetaCompact]}>{lineup.lineup_players?.length ?? 0} players · {matchTransfers} match transfer{matchTransfers === 1 ? "" : "s"}</Text></View>
              {score ? <View style={x.resultsOwnerScore}><Text style={x.resultsOwnerPoints}>{fmt(score.total_points)}</Text><Text style={x.resultsOwnerPointsLabel}>PTS</Text></View> : <View style={[x.historyLineupStatus, lineup.status === "locked" ? x.historyLineupStatusLocked : x.historyLineupStatusSubmitted]}><Text style={x.historyLineupStatusText}>{lineup.status.toUpperCase()}</Text></View>}<View style={x.resultsOwnerChevron}><Text style={x.resultsOwnerChevronText}>{ownerOpen ? "▲" : "▼"}</Text></View>
            </TouchableOpacity>
            {ownerOpen ? <><View style={[x.resultsXiContext, { borderLeftColor: isCurrentOwner ? UI_TOKENS.colors.primary : ownerColor.accent }]}><View style={[x.resultsXiContextMark, { backgroundColor: ownerColor.soft }]}><Text style={[x.resultsXiContextMarkText, { color: ownerColor.strong }]}>XI</Text></View><View style={x.grow}><Text style={x.resultsXiContextEyebrow}>VIEWING OWNER TEAM</Text><Text style={[x.resultsXiContextTitle, { color: ownerColor.strong }]}>{owner}’s XI</Text><Text style={x.resultsXiContextMeta}>Match {match.match_number} · {match.home?.code} vs {match.away?.code} · {lineup.lineup_players?.length ?? 0} players</Text><View style={x.resultsXiContextStats}><Text style={x.transferUsed}>{matchTransfers} transfer{matchTransfers === 1 ? "" : "s"} this match</Text><Text style={x.transferBalance}>{transferPeriod ? `Period: ${usedThroughMatch} of ${periodLimit} used` : "Transfer period not configured"}</Text></View></View></View>{(lineup.lineup_players ?? []).sort((a: any, b: any) => a.slot - b.slot).map((entry: any) => {
              const player = entry.player;
              const auctionOwner = playerOwners[player.id] ?? "";
              const ownership = !leagueFormat.ownership_enabled || !auctionOwner ? "Open" : auctionOwner === owner ? "Mine" : auctionOwner;
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
              const matchMultiplier = boosterCode === "2UP" ? Number(booster?.booster?.match_multiplier ?? scoreBreakdown.match_multiplier ?? 2) : 1;
              const contribution = (grossContribution - ownershipDeduction) * matchMultiplier;
              const playerKey = `${key}:${player.id}`;
              const playerOpen = expandedPlayer === playerKey;
              return <View key={player.id}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`${player.full_name}, ${player.team?.code ?? "team unavailable"}, ${playerPoints ? `${fmt(contribution)} points` : "points pending"}`} accessibilityState={{ expanded: playerOpen }} style={[x.historyPlayer, compact && x.resultsPlayerCompact]} onPress={() => setExpandedPlayer(playerOpen ? "" : playerKey)}><Text style={[x.chevron, compact && x.resultsPlayerChevronCompact]}>{playerOpen ? "▲" : "▼"}</Text><View style={[x.grow, compact && x.resultsPlayerMainCompact, { marginLeft: 7 }]}><View style={x.playerLabelRow}><Text numberOfLines={1} style={[x.playerName, compact && x.resultsPlayerNameCompact]}>{entry.slot}. {player.full_name}</Text>{(specialLabels[match.id]?.[player.full_name] ?? []).map(label => <SpecialPlayerBadge key={label} label={label} />)}{markers.map(marker => <Text key={marker} style={x.marker}>{marker}</Text>)}</View><View style={x.playerMetaRow}><IplTeamBadge code={player.team?.code} /><Text style={x.roleText}>{player.role}</Text><OwnerBadge owner={ownership === "Open" ? "Open player" : ownership === "Mine" ? owner : auctionOwner} label={ownership} compact /><Text style={[x.baseText, playerPoints && Number(playerPoints.total_points) < 0 && x.playerValueNegative]}>{playerPoints ? `Base ${fmt(playerPoints.total_points)}` : "Points pending"}</Text></View></View>{playerPoints ? <Text style={[x.playerValue, compact && x.resultsPlayerValueCompact, contribution < 0 && x.playerValueNegative]}>{fmt(contribution)} pts</Text> : null}</TouchableOpacity>{playerOpen && playerPoints ? <View style={x.playerBreakdown}><BreakdownLine label="Batting" value={playerPoints.batting_points} /><BreakdownLine label="Bowling" value={playerPoints.bowling_points} /><BreakdownLine label="Fielding" value={playerPoints.fielding_points} /><BreakdownLine label="Bonus" value={playerPoints.bonus_points} /><BreakdownLine label="Base total" value={playerPoints.total_points} strong />{grossContribution !== Number(playerPoints.total_points) ? <BreakdownLine label="After player multipliers" value={grossContribution} /> : null}{ownershipDeduction > 0 ? <BreakdownLine label={uniqueMode ? "Other-player usage fee" : "Ownership deduction"} value={-ownershipDeduction} /> : null}{matchMultiplier !== 1 ? <BreakdownLine label={`After ${booster?.booster?.code} (${matchMultiplier}×)`} value={contribution} /> : null}<BreakdownLine label="Final player contribution" value={contribution} strong /></View> : null}</View>;
            })}</> : null}
          </View>;
        })}</View> : <Empty title={noResultSettled ? "XIs reset" : undefined} text={noResultSettled ? "No owner XI is retained as the carry-forward source for this fixture." : "No owner lineup is visible for this match."} />}</> : null}
      </View>;
    }) : <Empty text={matches.length ? "No results match these filters." : "No matches have started yet."} />}
  </ScrollView>;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statsFromRaw(rawStats: unknown): PlayerMatchStats | null {
  if (!rawStats || typeof rawStats !== "object") return null;
  const raw = rawStats as Record<string, unknown>;
  if (!["runs", "balls", "fours", "sixes", "ballsBowled", "balls_bowled"].some(key => raw[key] != null)) return null;
  return {
    runs: numberValue(raw.runs), balls: numberValue(raw.balls), fours: numberValue(raw.fours), sixes: numberValue(raw.sixes),
    playerIsBowler: Boolean(raw.playerIsBowler ?? raw.player_is_bowler), dismissal: String(raw.dismissal ?? "none") as PlayerMatchStats["dismissal"],
    bowlerWickets: numberValue(raw.bowlerWickets ?? raw.bowler_wickets), nonBowlerWickets: numberValue(raw.nonBowlerWickets ?? raw.non_bowler_wickets),
    ballsBowled: numberValue(raw.ballsBowled ?? raw.balls_bowled), maxBalls: numberValue(raw.maxBalls ?? raw.max_balls) || 24,
    runsConceded: numberValue(raw.runsConceded ?? raw.runs_conceded), maidens: numberValue(raw.maidens), dots: numberValue(raw.dots),
    catches: numberValue(raw.catches), stumpings: numberValue(raw.stumpings), runOuts: numberValue(raw.runOuts ?? raw.run_outs),
    sharedRunOuts: numberValue(raw.sharedRunOuts ?? raw.shared_run_outs), playerOfMatch: Boolean(raw.playerOfMatch ?? raw.player_of_match), winningXI: Boolean(raw.winningXI ?? raw.winning_xi),
  };
}

function ProductionScorecard({ match, royaltyAdjustments, onBack }: { match: any; royaltyAdjustments: any[]; onBack: () => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 620;
  const scorecard = scorecardForFixture(match);
  const [section, setSection] = useState<"scorecard" | "points">("scorecard");
  const [inningsIndex, setInningsIndex] = useState(0);
  const [expandedPointPlayer, setExpandedPointPlayer] = useState("");
  const matchTeams = new Set([String(match.home?.code ?? ""), String(match.away?.code ?? "")].filter(Boolean));
  const publishedPoints = latestPublishedPlayerPoints<any>(match.player_match_points ?? []).filter((pointRow: any) => {
    const playerTeam = String(pointRow.player?.team?.code ?? "");
    const playerName = String(pointRow.player?.full_name ?? pointRow.raw_stats?.player_name ?? "");
    return matchTeams.has(playerTeam) || (!playerTeam && Boolean(seededPlayerStats(Number(match.match_number), playerName)));
  }).sort((left: any, right: any) => Number(right.total_points) - Number(left.total_points) || String(left.player?.full_name ?? "").localeCompare(String(right.player?.full_name ?? "")));
  const date = new Date(match.scheduled_start ?? match.lineup_lock_at ?? "");
  const dateText = Number.isFinite(date.getTime()) ? date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Date unavailable";
  const sourceUrl = scorecard?.sourceUrl || match.scorecard_source_url || "";
  const innings = scorecard?.innings[inningsIndex];
  const highestPoints = publishedPoints[0];
  const royaltyTotal = royaltyAdjustments.reduce((sum, row) => sum + Number(row.adjustment_points ?? 0), 0);
  return <ScrollView contentContainerStyle={x.scorecardScreen}>
    <View style={x.scorecardTopRow}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Results" style={x.scorecardBack} onPress={onBack}><Text style={x.scorecardBackArrow}>‹</Text><Text style={x.scorecardBackText}>Results</Text></TouchableOpacity>{sourceUrl ? <TouchableOpacity accessibilityRole="link" accessibilityLabel="Open official scorecard source" style={x.scorecardSource} onPress={() => Linking.openURL(sourceUrl)}><Text style={x.scorecardSourceText}>Official source ↗</Text></TouchableOpacity> : null}</View>
    <View style={x.scorecardHero}><View style={x.scorecardHeroGlow} /><Text style={x.scorecardHeroEyebrow}>MATCH {match.match_number} · CRICKET SCORECARD</Text><View style={[x.scorecardHeroMain, compact && x.scorecardHeroMainCompact]}><View style={x.scorecardHeroTeams}><IplTeamBadge code={match.home?.code} /><Text style={x.scorecardHeroVs}>VS</Text><IplTeamBadge code={match.away?.code} /></View>{scorecard ? <View style={x.scorecardWinnerBadge}><Text style={x.scorecardWinnerCheck}>✓</Text><View><Text style={x.scorecardWinnerLabel}>IPL WINNER</Text><Text style={x.scorecardWinnerTeam}>{scorecard.winnerTeam}</Text></View></View> : null}</View><Text style={x.scorecardHeroMeta}>{dateText}{match.venue ? ` · ${match.venue}` : ""}</Text>{scorecard ? <><Text style={x.scorecardResult}>{scorecard.result}</Text><View style={[x.scorecardInningsSummary, compact && x.scorecardInningsSummaryCompact]}>{scorecard.innings.map((item, index) => <View key={item.team} style={x.scorecardSummaryItem}><Text style={x.scorecardSummaryOrder}>{index + 1}{index === 0 ? "ST" : "ND"} INNINGS</Text><View style={x.scorecardSummaryScoreRow}><IplTeamBadge code={item.team} /><Text style={x.scorecardSummaryScore}>{item.score}</Text></View><Text style={x.scorecardSummaryOvers}>{item.overs} overs</Text></View>)}</View><Text style={x.scorecardPom}>★ Player of the Match · {scorecard.playerOfMatch}</Text></> : <Text style={x.scorecardUnavailable}>Detailed innings data has not been imported for this match. Published fantasy points remain available below.</Text>}</View>
    <View accessibilityRole="tablist" style={x.scorecardTabs}>{[["scorecard", "Scorecard"], ["points", "Fantasy points"]].map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: section === value }} style={[x.scorecardTab, section === value && x.scorecardTabActive]} onPress={() => setSection(value as "scorecard" | "points")}><Text style={[x.scorecardTabText, section === value && x.scorecardTabTextActive]}>{label}</Text></TouchableOpacity>)}</View>
    {section === "scorecard" ? scorecard && innings ? <><View accessibilityRole="tablist" style={x.inningsTabs}>{scorecard.innings.map((item, index) => <TouchableOpacity key={`${item.team}:${index}`} accessibilityRole="tab" accessibilityLabel={`${index === 0 ? "First" : "Second"} innings, ${item.team}`} accessibilityState={{ selected: inningsIndex === index }} style={[x.inningsTab, inningsIndex === index && x.inningsTabActive]} onPress={() => setInningsIndex(index)}><Text style={[x.inningsTabEyebrow, inningsIndex === index && x.inningsTabTextActive]}>{index === 0 ? "1ST INNINGS" : "2ND INNINGS"}</Text><View style={x.inningsTabScore}><Text style={[x.inningsTabTeam, inningsIndex === index && x.inningsTabTextActive]}>{item.team}</Text><Text style={[x.inningsTabTotal, inningsIndex === index && x.inningsTabTextActive]}>{item.score}</Text></View></TouchableOpacity>)}</View><ScorecardInningsBlock innings={innings} compact={compact} /></> : <View style={x.scorecardEmpty}><Text style={x.scorecardEmptyTitle}>Scorecard data unavailable</Text><Text style={x.scorecardEmptyText}>The scoring import contains fantasy totals but not both innings. Use the official source for the cricket scorecard.</Text>{sourceUrl ? <TouchableOpacity accessibilityRole="link" style={x.scorecardEmptyButton} onPress={() => Linking.openURL(sourceUrl)}><Text style={x.scorecardEmptyButtonText}>Open official scorecard</Text></TouchableOpacity> : null}</View> : <View><View style={x.pointsIntro}><View style={x.grow}><Text style={x.pointsIntroEyebrow}>VERIFIED FANTASY SCORING</Text><Text style={x.pointsIntroTitle}>Player points breakdown</Text><Text style={x.pointsIntroText}>Tap any player for batting, bowling, fielding, bonus and owner royalty. ROY is credited separately and never changes the player’s fantasy score.</Text></View>{highestPoints ? <View style={x.pointsLeader}><Text style={x.pointsLeaderLabel}>TOP SCORE</Text><Text style={x.pointsLeaderValue}>{fmt(highestPoints.total_points)}</Text><Text numberOfLines={1} style={x.pointsLeaderName}>{highestPoints.player?.full_name ?? "Player"}</Text></View> : null}</View>{royaltyAdjustments.length ? <View style={x.scorecardRoyaltySummary}><View style={x.grow}><Text style={x.scorecardRoyaltySummaryLabel}>OWNER ROYALTY AWARDED</Text><Text style={x.scorecardRoyaltySummaryText}>{royaltyAdjustments.length} borrower credit{royaltyAdjustments.length === 1 ? "" : "s"} paid to player owners</Text></View><View style={x.scorecardRoyaltySummaryMetric}><Text style={x.scorecardRoyaltySummaryValue}>+{fmt(royaltyTotal)}</Text><Text style={x.scorecardRoyaltySummaryUnit}>OWNER ROY</Text></View></View> : null}{publishedPoints.length ? publishedPoints.map((pointRow: any) => <ScorecardPointPlayer key={`${pointRow.player_id}:${pointRow.calculation_version}`} pointRow={pointRow} royaltyRows={royaltyAdjustments.filter(row => row.player_id === pointRow.player_id)} matchNumber={Number(match.match_number)} compact={compact} open={expandedPointPlayer === pointRow.player_id} onToggle={() => setExpandedPointPlayer(expandedPointPlayer === pointRow.player_id ? "" : pointRow.player_id)} />) : <Empty text="Fantasy points have not been published for this match." />}</View>}
  </ScrollView>;
}

function ScorecardInningsBlock({ innings, compact }: { innings: NonNullable<ReturnType<typeof scorecardForFixture>>["innings"][number]; compact: boolean }) {
  return <View style={x.inningsCard}><View style={x.inningsHeading}><View><Text style={x.inningsHeadingEyebrow}>BATTING · {innings.team}</Text><Text style={x.inningsHeadingTitle}>{innings.score}</Text></View><Text style={x.inningsHeadingOvers}>{innings.overs} overs</Text></View><View style={x.scoreTableHeader}><Text style={x.scoreTablePlayerHeader}>BATTER</Text><Text style={x.scoreTableCellHeader}>R</Text><Text style={x.scoreTableCellHeader}>B</Text><Text style={x.scoreTableCellHeader}>4s</Text><Text style={x.scoreTableCellHeader}>6s</Text><Text style={[x.scoreTableCellHeader, x.scoreTableWideCell]}>SR</Text></View>{innings.batting.map((row, index) => { const dismissal = scorecardDismissalLabel(row as unknown as Record<string, unknown>); return <View key={`${row.name}:${index}`} style={[x.scoreTableRow, x.scoreTableBattingRow]}><View style={x.scoreTablePlayer}><Text numberOfLines={1} style={x.scoreTablePlayerName}>{row.name} ({row.role}){row.notOut ? " *" : ""}</Text>{dismissal ? <Text numberOfLines={compact ? 3 : 2} style={x.scoreTableDismissal}>{dismissal}</Text> : null}</View><Text style={[x.scoreTableCell, x.scoreTableRuns]}>{row.runs}</Text><Text style={x.scoreTableCell}>{row.balls}</Text><Text style={x.scoreTableCell}>{row.fours}</Text><Text style={x.scoreTableCell}>{row.sixes}</Text><Text style={[x.scoreTableCell, x.scoreTableWideCell]}>{row.strikeRate.toFixed(1)}</Text></View>; })}{innings.didNotBat?.length ? <View style={x.didNotBat}><Text style={x.didNotBatLabel}>DID NOT BAT</Text><Text style={x.didNotBatNames}>{innings.didNotBat.map(row => `${row.name} (${row.role})`).join(" · ")}</Text></View> : null}<View style={x.bowlingHeading}><Text style={x.bowlingHeadingTitle}>BOWLING · OPPOSITION</Text><Text style={x.bowlingHeadingMeta}>{innings.bowling.length} bowlers used</Text></View><View style={x.scoreTableHeader}><Text style={[x.scoreTablePlayerHeader, compact && x.bowlingPlayerCompact]}>BOWLER</Text><Text style={[x.scoreTableCellHeader, compact && x.bowlingCellCompact]}>O</Text><Text style={[x.scoreTableCellHeader, compact && x.bowlingCellCompact]}>M</Text><Text style={[x.scoreTableCellHeader, compact && x.bowlingCellCompact]}>R</Text><Text style={[x.scoreTableCellHeader, compact && x.bowlingCellCompact]}>W</Text><Text style={[x.scoreTableCellHeader, compact && x.bowlingCellCompact]}>D</Text><Text style={[x.scoreTableCellHeader, x.scoreTableWideCell, compact && x.bowlingWideCellCompact]}>ER</Text></View>{innings.bowling.map((row, index) => <View key={`${row.name}:${index}`} style={x.scoreTableRow}><View style={[x.scoreTablePlayer, compact && x.bowlingPlayerCompact]}><Text numberOfLines={1} style={x.scoreTablePlayerName}>{row.name} ({row.role})</Text></View><Text style={[x.scoreTableCell, compact && x.bowlingCellCompact]}>{row.overs}</Text><Text style={[x.scoreTableCell, compact && x.bowlingCellCompact]}>{row.maidens}</Text><Text style={[x.scoreTableCell, compact && x.bowlingCellCompact]}>{row.runs}</Text><Text style={[x.scoreTableCell, compact && x.bowlingCellCompact, row.wickets > 0 && x.scoreTableRuns]}>{row.wickets}</Text><Text style={[x.scoreTableCell, compact && x.bowlingCellCompact]}>{row.dots}</Text><Text style={[x.scoreTableCell, x.scoreTableWideCell, compact && x.bowlingWideCellCompact]}>{row.economy.toFixed(2)}</Text></View>)}</View>;
}

function ScorecardPointPlayer({ pointRow, royaltyRows, matchNumber, compact, open, onToggle }: { pointRow: any; royaltyRows: any[]; matchNumber: number; compact: boolean; open: boolean; onToggle: () => void }) {
  const playerName = pointRow.player?.full_name ?? pointRow.raw_stats?.player_name ?? "Player";
  const rawStats = statsFromRaw(pointRow.raw_stats);
  const stats = rawStats ?? seededPlayerStats(matchNumber, playerName);
  const details = rawStats ? calculatePointDetails(rawStats) : seededPlayerPointDetails(matchNumber, playerName);
  const seededPoints = seededPlayerPoints(matchNumber, playerName);
  const categoryTotals = { batting: Number(pointRow.batting_points ?? seededPoints?.batting ?? 0), bowling: Number(pointRow.bowling_points ?? seededPoints?.bowling ?? 0), fielding: Number(pointRow.fielding_points ?? seededPoints?.fielding ?? 0), bonus: Number(pointRow.bonus_points ?? seededPoints?.bonus ?? 0) };
  const royaltyTotal = royaltyRows.reduce((sum, row) => sum + Number(row.adjustment_points ?? 0), 0);
  const runs = Number(stats?.runs ?? 0);
  const wickets = Number(stats ? stats.bowlerWickets + stats.nonBowlerWickets : 0);
  const detailSections = details ? [["BATTING", details.batting, categoryTotals.batting], ["BOWLING", details.bowling, categoryTotals.bowling], ["FIELDING", details.fielding, categoryTotals.fielding], ["BONUS", details.bonus, categoryTotals.bonus]] as const : [];
  return <View style={[x.pointPlayerCard, open && x.pointPlayerCardOpen]}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${playerName}, ${fmt(pointRow.total_points)} fantasy points${royaltyTotal ? `, ${fmt(royaltyTotal)} owner royalty points generated` : ""}`} accessibilityState={{ expanded: open }} style={[x.pointPlayerHeader, compact && x.pointPlayerHeaderCompact]} onPress={onToggle}>
      <View style={x.pointPlayerHeaderMain}>
        <View style={x.pointPlayerRank}><Text style={x.pointPlayerRankText}>{String(playerName).charAt(0).toUpperCase()}</Text></View>
        <View style={x.pointPlayerIdentity}><View style={x.pointPlayerNameRow}><Text numberOfLines={1} style={x.pointPlayerName}>{playerName}</Text>{stats?.playerOfMatch ? <Text style={x.pointPomBadge}>POTM</Text> : null}</View><View style={x.pointPlayerMeta}><IplTeamBadge code={pointRow.player?.team?.code} /><Text style={x.roleText}>{pointRow.player?.role ?? "—"}</Text>{stats ? <Text numberOfLines={1} style={x.pointRawSummary}>{runs} {runs === 1 ? "run" : "runs"} · {wickets} {wickets === 1 ? "wkt" : "wkts"}</Text> : null}</View></View>
        {!compact ? <PointPlayerScoreMetrics fantasyPoints={pointRow.total_points} royalty={royaltyTotal} /> : null}
        <View style={x.pointPlayerChevron}><Text style={x.pointPlayerChevronText}>{open ? "▲" : "▼"}</Text></View>
      </View>
      {compact ? <PointPlayerScoreMetrics fantasyPoints={pointRow.total_points} royalty={royaltyTotal} compact /> : null}
    </TouchableOpacity>
    {open ? <View style={x.pointPlayerBody}><View style={[x.pointCategoryGrid, compact && x.pointCategoryGridCompact]}>{[["BAT", categoryTotals.batting, "#946C00"], ["BOWL", categoryTotals.bowling, "#1766A5"], ["FIELD", categoryTotals.fielding, "#2A8751"], ["BONUS", categoryTotals.bonus, "#6B35AD"], ["OWNER ROY", royaltyTotal, "#704091"]].map(([label, value, color]) => <View key={String(label)} style={x.pointCategory}><Text style={[x.pointCategoryLabel, { color: String(color) }]}>{label}</Text><Text style={[x.pointCategoryValue, Number(value) < 0 && x.breakdownNegative]}>{fmt(value)}</Text></View>)}</View>{detailSections.length ? detailSections.map(([title, rows, total]) => <View key={title}><View style={x.pointDetailSection}><View style={x.pointDetailHeading}><Text style={x.pointDetailTitle}>{title}</Text><Text style={x.pointDetailTotal}>{fmt(total)} pts</Text></View>{rows.filter(([, value]) => Number(value) !== 0).length ? rows.filter(([, value]) => Number(value) !== 0).map(([label, value]) => <BreakdownLine key={label} label={label} value={value} />) : <Text style={x.pointDetailEmpty}>No points in this category</Text>}</View></View>) : <View style={x.pointDetailUnavailable}><Text style={x.pointDetailUnavailableTitle}>Source calculation lines unavailable</Text><Text style={x.pointDetailUnavailableText}>{typeof pointRow.breakdown?.detail === "string" ? pointRow.breakdown.detail : "This older import stores the verified category totals but not each underlying scoring line."}</Text></View>}<View style={[x.pointDetailSection, x.pointRoyaltySection]}><View style={x.pointDetailHeading}><Text style={[x.pointDetailTitle, x.pointRoyaltyTitle]}>OWNER ROYALTY (ROY)</Text><Text style={[x.pointDetailTotal, x.pointRoyaltyTitle]}>{fmt(royaltyTotal)} pts</Text></View>{royaltyRows.length ? royaltyRows.map((row, index) => { const source = row.source?.display_name ?? "Borrower"; const recipient = row.recipient?.display_name ?? "Owner"; const royaltyType = row.adjustment_type === "marquee_royalty" ? "Marquee" : "Regular"; const minimum = Number(row.minimum_fee ?? 0); return <View key={`${row.source_member_id}:${row.recipient_member_id}:${index}`} style={x.royaltyAuditRow}><View style={x.grow}><Text style={x.royaltyAuditNames}>{source} → {recipient}</Text><Text style={x.royaltyAuditFormula}>{royaltyType} · {fmt(row.rate_percent)}% of {fmt(row.final_player_contribution)}{minimum ? ` · minimum ${fmt(minimum)}` : ""}</Text></View><Text style={x.royaltyAuditValue}>+{fmt(row.adjustment_points)}</Text></View>; }) : <Text style={x.pointDetailEmpty}>No royalty was generated by this player.</Text>}<Text style={x.royaltyAuditNote}>ROY is credited to the owning member separately; it is not added to the player’s fantasy score.</Text></View><BreakdownLine label="Verified fantasy points" value={pointRow.total_points} strong />{royaltyTotal ? <BreakdownLine label="Total value generated (Fantasy PTS + Owner ROY)" value={Number(pointRow.total_points) + royaltyTotal} strong /> : null}</View> : null}
  </View>;
}
function PointPlayerScoreMetrics({ fantasyPoints, royalty, compact = false }: { fantasyPoints: unknown; royalty: number; compact?: boolean }) {
  return <View style={[x.pointPlayerScoreMetrics, compact && x.pointPlayerScoreMetricsCompact]}>
    <View style={x.pointPlayerScoreMetric}><Text style={[x.pointPlayerTotalValue, Number(fantasyPoints) < 0 && x.breakdownNegative]}>{fmt(fantasyPoints)}</Text><Text style={x.pointPlayerScoreLabel}>FANTASY PTS</Text></View>
    {royalty > 0 ? <View style={[x.pointPlayerScoreMetric, x.pointPlayerRoyaltyMetric]}><Text style={x.pointPlayerRoyaltyValue}>+{fmt(royalty)}</Text><Text style={x.pointPlayerRoyaltyLabel}>OWNER ROY</Text></View> : null}
  </View>;
}
function ResultsHeroStat({ label, value, detail, compact }: { label: string; value: string; detail: string; compact: boolean }) { return <View style={[x.resultsHeroStat, compact ? x.resultsHeroStatCompact : x.resultsHeroStatDesktop]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={x.resultsHeroStatLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={x.resultsHeroStatValue}>{value}</Text><Text numberOfLines={1} style={x.resultsHeroStatDetail}>{detail}</Text></View>; }
function BreakdownLine({ label, value, strong = false }: { label: string; value: unknown; strong?: boolean }) { const negative = Number(value) < 0; return <View style={x.breakdownLine}><Text style={[x.breakdownLabel, strong && x.breakdownStrong]}>{label}</Text><Text style={[x.breakdownValue, strong && x.breakdownStrong, negative && x.breakdownNegative]}>{fmt(value)}</Text></View>; }
const x = StyleSheet.create(normalizeUiStyles({
  ownerBadge: { maxWidth: 155, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  ownerBadgeCompact: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  ownerBadgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  ownerBadgeText: { flexShrink: 1, fontSize: 8, lineHeight: 10, fontWeight: "900" },
  screen: { backgroundColor: UI_TOKENS.colors.canvas, padding: 18, paddingTop: 22, paddingBottom: 110, minHeight: 750 },
  textMutedAccessible: { color: UI_TOKENS.colors.muted },
  title: { color: "#18223B", fontSize: 26, lineHeight: 31, fontWeight: "900", letterSpacing: -0.4 }, subtitle: { color: UI_TOKENS.colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 18 }, section: { color: "#18223B", fontSize: 19, lineHeight: 24, fontWeight: "900", letterSpacing: -0.2, marginTop: 22, marginBottom: 11 },
  hero: { backgroundColor: "#123C31", borderRadius: 22, padding: 20 }, heroLabel: { color: "#9BC1B6", fontSize: 10, fontWeight: "800" }, heroTitle: { color: "white", fontSize: 28, fontWeight: "900", marginTop: 10 }, heroTeams: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }, heroMeta: { color: "#B7CDC6", fontSize: 11, marginTop: 8 }, accent: { color: "#DDFB72", fontSize: 13, fontWeight: "900" }, primary: { backgroundColor: "#DDFB72", borderRadius: 13, padding: 14, alignItems: "center", marginTop: 16 }, primaryText: { color: "#10251F", fontWeight: "900" },
  stats: { flexDirection: "row", gap: 9, marginTop: 13 }, metric: { flex: 1, backgroundColor: "white", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "#E7EAF0" }, metricLabel: { color: "#758091", fontSize: 9, fontWeight: "900", letterSpacing: 0.3 }, metricValue: { color: "#18223B", fontSize: 18, fontWeight: "900", marginTop: 5 },
  fixtureHero: { position: "relative", overflow: "hidden", backgroundColor: "#071C3B", borderRadius: 22, padding: 17, marginBottom: 13, ...CARD_SHADOW },
  fixtureHeroGlow: { position: "absolute", width: 230, height: 230, borderRadius: 115, right: -105, top: -135, backgroundColor: "rgba(216,255,99,0.13)" },
  fixtureHeroHeading: { flexDirection: "row", alignItems: "center" },
  fixtureHeroMark: { width: 44, height: 44, flexShrink: 0, borderRadius: 14, backgroundColor: UI_TOKENS.colors.accent, alignItems: "center", justifyContent: "center", marginRight: 11 },
  fixtureHeroMarkText: { color: "#071C3B", fontSize: 20, lineHeight: 24, fontWeight: "900" },
  fixtureHeroEyebrow: { color: "#AEBBD0", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  fixtureHeroTitle: { color: "#FFFFFF", fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.3, marginTop: 2 },
  fixtureHeroSubtitle: { color: "#C6D0DF", fontSize: 9, lineHeight: 13, marginTop: 3 },
  fixtureHeroStats: { flexDirection: "row", gap: 7, marginTop: 14 },
  fixtureHeroStatsCompact: { gap: 5 },
  fixtureHeroStat: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 11, paddingHorizontal: 8, paddingVertical: 8, alignItems: "center" },
  fixtureHeroStatValue: { color: UI_TOKENS.colors.accent, fontSize: 17, lineHeight: 20, fontWeight: "900" },
  fixtureHeroStatLabel: { width: "100%", color: "#AEBBD0", fontSize: 7, fontWeight: "900", letterSpacing: 0.25, marginTop: 2, textAlign: "center" },
  fixtureHeroAction: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(216,255,99,0.26)", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 11, marginTop: 10 },
  fixtureHeroActionCompact: { flexDirection: "column", alignItems: "stretch" },
  fixtureHeroActionMain: { flex: 1, minWidth: 0 },
  fixtureHeroActionLabel: { color: UI_TOKENS.colors.accent, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  fixtureHeroTeams: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  fixtureHeroMatch: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", marginRight: 2 },
  fixtureHeroVs: { color: "#AEBBD0", fontSize: 8, fontWeight: "900" },
  fixtureHeroDate: { color: "#C6D0DF", fontSize: 8, lineHeight: 12, marginTop: 5 },
  fixtureHeroActionButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: UI_TOKENS.colors.accent, borderRadius: 11, paddingHorizontal: 14, marginLeft: 12 },
  fixtureHeroActionButtonCompact: { width: "100%", marginLeft: 0, marginTop: 10 },
  fixtureHeroActionButtonText: { color: "#071C3B", fontSize: 10, fontWeight: "900" },
  fixtureHeroActionArrow: { color: "#071C3B", fontSize: 17, lineHeight: 18, fontWeight: "900", marginLeft: 6 },
  fixtureOverview: { flexDirection: "row", alignItems: "center", backgroundColor: "#14273F", borderRadius: 17, paddingVertical: 13, marginBottom: 12 }, fixtureOverviewItem: { flex: 1, alignItems: "center" }, fixtureOverviewValue: { color: "#DDFB72", fontSize: 17, fontWeight: "900" }, fixtureOverviewLabel: { color: "#C5CED8", fontSize: 9, fontWeight: "900", marginTop: 3, letterSpacing: 0.4 }, fixtureOverviewDivider: { width: 1, height: 28, backgroundColor: "#34465B" },
  sectionHeadingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }, horizontalScrollHint: { color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 0.5, marginBottom: 10 },
  fixtureFilterPanel: { backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 17, paddingHorizontal: 12, paddingTop: 12, marginBottom: 12, ...CARD_SHADOW },
  fixtureBrowseHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
  fixtureBrowseEyebrow: { color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  fixtureBrowseTitle: { color: "#18223B", fontSize: 15, lineHeight: 19, fontWeight: "900", marginTop: 2 },
  fixtureBrowseCount: { color: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, fontSize: 8, fontWeight: "900" },
  fixtureFilterHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 20 }, fixtureFilterHeadingText: { color: "#5F6D67", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, fixtureFilterScroller: { height: 57, flexGrow: 0, flexShrink: 0 }, fixtureFilters: { height: 57, alignItems: "flex-start", gap: 7, paddingBottom: 13 }, fixtureFilter: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: "#D7DFDB", backgroundColor: "#FFFFFF", paddingHorizontal: 15, alignItems: "center", justifyContent: "center" }, fixtureFilterActive: { backgroundColor: "#174D3D", borderColor: "#174D3D" }, fixtureFilterText: { color: "#4C5F57", fontSize: 10, fontWeight: "900" }, fixtureFilterTextActive: { color: "#DDFB72" },
  resultsHero: { position: "relative", overflow: "hidden", backgroundColor: "#071C3B", borderRadius: 22, padding: 17, marginBottom: 12, ...CARD_SHADOW },
  resultsHeroGlowLarge: { position: "absolute", width: 210, height: 210, borderRadius: 105, right: -95, top: -125, backgroundColor: "rgba(216,255,99,0.12)" },
  resultsHeroGlowSmall: { position: "absolute", width: 110, height: 110, borderRadius: 55, left: "38%", bottom: -86, backgroundColor: "rgba(43,146,255,0.12)" },
  resultsHeroHeading: { flexDirection: "row", alignItems: "center" },
  resultsHeroMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: UI_TOKENS.colors.accent, alignItems: "center", justifyContent: "center", marginRight: 11 },
  resultsHeroMarkText: { color: "#071C3B", fontSize: 20, lineHeight: 24, fontWeight: "900" },
  resultsHeroEyebrow: { color: "#AEBBD0", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  resultsHeroTitle: { color: "#FFFFFF", fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.3, marginTop: 2 },
  resultsHeroSubtitle: { color: "#C6D0DF", fontSize: 9, lineHeight: 13, marginTop: 3 },
  resultsHeroStats: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 15 },
  resultsHeroStatsCompact: { flexWrap: "wrap", gap: 6, marginTop: 12 },
  resultsHeroStat: { minWidth: 0, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  resultsHeroStatDesktop: { flex: 1 },
  resultsHeroStatCompact: { width: "48%", flexGrow: 1, paddingHorizontal: 9 },
  resultsHeroStatLabel: { color: "#95A4B9", fontSize: 7, fontWeight: "900", letterSpacing: 0.35 },
  resultsHeroStatValue: { color: UI_TOKENS.colors.accent, fontSize: 17, lineHeight: 20, fontWeight: "900", marginTop: 3 },
  resultsHeroStatDetail: { color: "#C0CAD8", fontSize: 8, lineHeight: 11, marginTop: 1 },
  resultsFilters: { backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 17, padding: 12, marginBottom: 13, ...CARD_SHADOW },
  resultsPrimaryFilters: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  resultsPrimaryFiltersCompact: { flexDirection: "column", alignItems: "stretch" },
  resultsSearchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultsFilterPanel: { marginTop: 10 },
  resultsStatusGroup: { flex: 1, minWidth: 0 },
  resultsStatusOptions: { flexDirection: "row", gap: 6, marginTop: 5 },
  resultsStatusChip: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  resultsFilterRow: { marginTop: 9 },
  resultsFilterRowHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 17, marginBottom: 5 },
  resultsFilterLabel: { color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  resultsFilterSwipe: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  historyFilters: { backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: UI_TOKENS.radius.card, padding: 13, marginBottom: 14, ...CARD_SHADOW }, historyFilterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }, historyFilterTitle: { color: "#18223B", fontSize: 13, fontWeight: "900" }, historyFilterSubtitle: { color: "#65746E", fontSize: 10, marginTop: 3 }, historyClear: { minHeight: 38, backgroundColor: UI_TOKENS.status.dangerWash, borderRadius: 10, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", marginLeft: 8 }, historyClearText: { color: UI_TOKENS.status.danger, fontSize: 9, fontWeight: "900" }, historyMatchInput: { flex: 1, minWidth: 0, height: 44, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: UI_TOKENS.radius.control, backgroundColor: "#F8FAF8", color: "#173028", fontSize: 12, fontWeight: "800", paddingHorizontal: 12 }, historyMatchInputCompact: { width: "100%" }, historyFilterLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 18 }, historyFilterLabel: { color: "#5F6D67", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, historyFilterOptions: { gap: 6 }, historyFilterChip: { minHeight: 40, borderWidth: 1, borderColor: UI_TOKENS.colors.border, backgroundColor: UI_TOKENS.colors.card, borderRadius: 12, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }, historyFilterChipActive: { borderColor: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.primary }, historyFilterChipText: { color: "#4C5F57", fontSize: 9, fontWeight: "900" }, historyFilterChipTextActive: { color: UI_TOKENS.colors.accent },
  statePanel: { minHeight: 180, backgroundColor: UI_TOKENS.colors.card, borderRadius: UI_TOKENS.radius.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, paddingHorizontal: 22, paddingVertical: 28, alignItems: "center", justifyContent: "center", marginVertical: 8, ...CARD_SHADOW }, stateTitle: { color: "#18223B", fontSize: 16, fontWeight: "900", marginTop: 13 }, stateText: { color: "#65746E", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 5 },
  empty: { minHeight: 145, backgroundColor: UI_TOKENS.colors.card, borderRadius: UI_TOKENS.radius.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, paddingHorizontal: 20, paddingVertical: 22, alignItems: "center", justifyContent: "center", marginVertical: 8 }, emptyIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: UI_TOKENS.status.neutralWash, alignItems: "center", justifyContent: "center" }, emptyIconText: { color: UI_TOKENS.status.neutral, fontSize: 20, lineHeight: 22, fontWeight: "900" }, emptyTitle: { color: "#18223B", fontSize: 14, fontWeight: "900", marginTop: 10 }, emptyText: { color: "#65746E", fontSize: 11, lineHeight: 17, marginTop: 5, textAlign: "center" },
  loadError: { minHeight: 190, backgroundColor: UI_TOKENS.colors.card, borderRadius: UI_TOKENS.radius.card, borderWidth: 1, borderColor: "#E7D6D2", paddingHorizontal: 22, paddingVertical: 26, alignItems: "center", justifyContent: "center", marginVertical: 8, ...CARD_SHADOW }, loadErrorIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: UI_TOKENS.status.dangerWash, alignItems: "center", justifyContent: "center" }, loadErrorIconText: { color: UI_TOKENS.status.danger, fontSize: 22, fontWeight: "900" }, loadErrorTitle: { color: "#18223B", fontSize: 17, fontWeight: "900", marginTop: 13 }, loadErrorText: { color: "#65746E", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 5 }, loadErrorRetry: { minWidth: 120, minHeight: 44, backgroundColor: UI_TOKENS.colors.primary, borderRadius: UI_TOKENS.radius.control, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 16 }, loadErrorRetryText: { color: UI_TOKENS.colors.accent, fontSize: 10, fontWeight: "900" }, loadErrorDetail: { color: "#8B6F69", fontSize: 8, lineHeight: 11, textAlign: "center", marginTop: 13 },
  fixtureMatchCard: { overflow: "hidden", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderLeftWidth: 5, borderColor: UI_TOKENS.colors.border, borderRadius: 17, marginBottom: 11, ...CARD_SHADOW },
  fixtureMatchCardOpen: { borderColor: UI_TOKENS.colors.borderStrong, shadowOpacity: 0.12, elevation: 4 },
  fixtureMatchHeader: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  fixtureMatchHeaderCompact: { minHeight: 72, paddingHorizontal: 10, paddingVertical: 9 },
  fixtureMatchNumber: { width: 48, height: 48, flexShrink: 0, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 11 },
  fixtureMatchNumberLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  fixtureMatchNumberValue: { fontSize: 17, lineHeight: 20, fontWeight: "900", marginTop: 1 },
  fixtureMatchIdentity: { flex: 1, minWidth: 0 },
  fixtureMatchTeams: { flexDirection: "row", alignItems: "center", gap: 6 },
  fixtureMatchVs: { color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "900" },
  fixtureMatchDate: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, fontWeight: "700", marginTop: 5 },
  fixtureMatchEnd: { flexShrink: 0, alignItems: "flex-end", marginLeft: 7 },
  fixtureMatchStatus: { maxWidth: 145, flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  fixtureMatchStatusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  fixtureMatchStatusText: { flexShrink: 1, fontSize: 7, fontWeight: "900", letterSpacing: 0.3 },
  fixtureMatchDisclosure: { minHeight: 30, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: UI_TOKENS.colors.border, backgroundColor: UI_TOKENS.colors.surface, borderRadius: 9, paddingHorizontal: 8, marginTop: 6 },
  fixtureMatchDisclosureText: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  fixtureMatchDisclosureIcon: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900", marginLeft: 5 },
  card: { backgroundColor: UI_TOKENS.colors.card, borderRadius: UI_TOKENS.radius.card, overflow: "hidden", borderWidth: 1, borderColor: UI_TOKENS.colors.border }, cardBlock: { backgroundColor: UI_TOKENS.colors.card, borderRadius: UI_TOKENS.radius.card, overflow: "hidden", marginBottom: 11, borderWidth: 1, borderColor: UI_TOKENS.colors.border, ...CARD_SHADOW }, row: { flexDirection: "row", alignItems: "center", padding: 13, borderBottomWidth: 1, borderBottomColor: "#ECEFF3" }, matchHeader: { flexDirection: "row", alignItems: "center", padding: 13 }, matchNumberBadge: { width: 43, height: 43, borderRadius: UI_TOKENS.radius.control, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center", marginRight: 11 }, matchNumberLabel: { color: "#65756E", fontSize: 8, fontWeight: "900", letterSpacing: 0.4 }, matchNumberValue: { color: "#173F35", fontSize: 16, fontWeight: "900", marginTop: 1 }, matchTeams: { flexDirection: "row", alignItems: "center", gap: 7 }, matchDate: { color: "#5F6E68", fontSize: 10, fontWeight: "700", marginTop: 6 }, matchHeaderEnd: { alignItems: "flex-end", marginLeft: 7 }, matchStatusBadge: { borderRadius: UI_TOKENS.radius.small, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 8 }, matchStatusPublished: { backgroundColor: UI_TOKENS.status.successWash }, matchStatusCompleted: { backgroundColor: UI_TOKENS.status.neutralWash }, matchStatusUpcoming: { backgroundColor: UI_TOKENS.status.warningWash }, matchStatusText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.25 }, matchStatusPublishedText: { color: UI_TOKENS.status.success }, matchStatusCompletedText: { color: UI_TOKENS.status.neutral }, matchStatusUpcomingText: { color: UI_TOKENS.status.warning }, vsText: { color: "#596861", fontSize: 10, fontWeight: "900" }, inlineMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 }, grow: { flex: 1 }, name: { color: "#18223B", fontSize: 13, lineHeight: 17, fontWeight: "900" }, meta: { color: "#65746E", fontSize: 10, lineHeight: 15, marginTop: 3 }, value: { color: "#273652", fontSize: 12, fontWeight: "900", marginHorizontal: 7 }, chevron: { color: "#596861", fontSize: 12 }, rank: { width: 34, color: "#596861", fontWeight: "900" }, avatar: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#EEF0FA", alignItems: "center", justifyContent: "center", marginRight: 9 }, avatarText: { color: "#5364A0", fontWeight: "900" },
  resultsMatchCard: { overflow: "hidden", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderLeftWidth: 6, borderColor: UI_TOKENS.colors.borderStrong, borderRadius: 18, marginBottom: 18, ...CARD_SHADOW },
  resultsMatchCardOpen: { borderWidth: 2, borderLeftWidth: 7, borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: "#EEF3F0", shadowOpacity: 0.14, elevation: 5 },
  resultsMatchHeader: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  resultsMatchHeaderCompact: { minHeight: 66, paddingHorizontal: 9, paddingVertical: 8 },
  resultsMatchNumber: { width: 47, height: 47, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 11 },
  resultsMatchNumberLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  resultsMatchNumberValue: { fontSize: 17, lineHeight: 20, fontWeight: "900", marginTop: 1 },
  resultsMatchIdentity: { flex: 1, minWidth: 0 },
  resultsMatchTeams: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultsMatchVs: { color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "900" },
  resultsMatchDate: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 5 },
  resultsMatchEnd: { alignItems: "flex-end", marginLeft: 7 },
  resultsMatchStatus: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  resultsMatchStatusDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  resultsMatchStatusText: { fontSize: 7, fontWeight: "900", letterSpacing: 0.4 },
  resultsMatchChevron: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", marginTop: 6 },
  resultsMatchChevronText: { fontSize: 8, fontWeight: "900" },
  resultsMatchSummary: { minHeight: 46, flexDirection: "row", alignItems: "center", backgroundColor: "#F7F9F8", borderTopWidth: 1, borderTopColor: "#E7ECE9", paddingHorizontal: 12, paddingVertical: 7 },
  resultsMatchSummaryCopy: { flex: 1, minWidth: 0 },
  resultsMatchSummaryLabel: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.6, marginRight: 9 },
  resultsMatchSummaryValue: { flex: 1, minWidth: 0, color: "#18223B", fontSize: 10, fontWeight: "900" },
  resultsMatchSummaryMeta: { color: UI_TOKENS.colors.muted, fontSize: 8, marginLeft: 9 },
  resultsScorecardLink: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#AFC8C0", backgroundColor: "#E8F2EE", borderRadius: 10, paddingHorizontal: 10, marginLeft: 8 },
  resultsScorecardLinkIcon: { color: UI_TOKENS.colors.primary, fontSize: 11, fontWeight: "900", marginRight: 5 },
  resultsScorecardLinkText: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900" },
  resultsScorecardLinkArrow: { color: UI_TOKENS.colors.primary, fontSize: 15, lineHeight: 16, fontWeight: "900", marginLeft: 5 },
  historyVisibility: { flexDirection: "row", alignItems: "center", paddingHorizontal: 13, paddingVertical: 11, borderTopWidth: 1, borderBottomWidth: 1 }, historyVisibilityPrivate: { backgroundColor: "#FFF8E6", borderColor: "#E9D79A" }, historyVisibilityRevealed: { backgroundColor: "#EAF6EE", borderColor: "#B8D9C2" }, historyVisibilityIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 9 }, historyVisibilityIconPrivate: { backgroundColor: "#D9A400" }, historyVisibilityIconRevealed: { backgroundColor: "#2D8650" }, historyVisibilityIconText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" }, historyVisibilityTitle: { color: "#233C34", fontSize: 10, fontWeight: "900" }, historyVisibilityText: { color: "#66776F", fontSize: 8, lineHeight: 12, marginTop: 2 }, historyLineupStatus: { flexShrink: 0, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 7 }, historyLineupStatusLocked: { backgroundColor: UI_TOKENS.status.neutralWash, borderWidth: 1, borderColor: "#CDD4E1" }, historyLineupStatusSubmitted: { backgroundColor: UI_TOKENS.status.successWash, borderWidth: 1, borderColor: "#BDD8C5" }, historyLineupStatusText: { color: UI_TOKENS.status.neutral, fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  resultsXiSectionEyebrow: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 0.8, marginBottom: 2 },
  resultsOwnerList: { backgroundColor: "#EEF3F0", paddingHorizontal: 10, paddingTop: 11, paddingBottom: 1 },
  resultsOwnerCard: { overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, borderRadius: 14, marginBottom: 11, ...CARD_SHADOW },
  resultsOwnerCardOpen: { borderWidth: 2, shadowOpacity: 0.13, elevation: 4 },
  resultsOwnerHeader: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  resultsOwnerHeaderCompact: { minHeight: 74, paddingHorizontal: 10, paddingVertical: 9 },
  resultsOwnerHeaderCurrent: { backgroundColor: UI_TOKENS.colors.primarySoft },
  resultsOwnerHeaderOpen: { borderBottomWidth: 1, borderBottomColor: UI_TOKENS.colors.borderStrong },
  resultsOwnerRank: { width: 40, height: 40, flexShrink: 0, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginRight: 11 },
  resultsOwnerRankText: { fontSize: 10, fontWeight: "900" },
  resultsOwnerIdentity: { flex: 1, minWidth: 0 },
  resultsOwnerIdentityCompact: { justifyContent: "center" },
  resultsOwnerNameCompact: { flexShrink: 1, minWidth: 0 },
  resultsOwnerMetaCompact: { marginTop: 2 },
  resultsXiName: { flexShrink: 1, minWidth: 0, color: UI_TOKENS.colors.ink, fontSize: 14, lineHeight: 18, fontWeight: "900" },
  resultsXiRowMeta: { color: UI_TOKENS.colors.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  resultsOwnerScore: { minWidth: 57, flexShrink: 0, alignItems: "flex-end", marginLeft: 7 },
  resultsOwnerPoints: { color: UI_TOKENS.colors.primary, fontSize: 16, lineHeight: 19, fontWeight: "900" },
  resultsOwnerPointsLabel: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  resultsOwnerChevron: { width: 32, height: 32, flexShrink: 0, borderRadius: 10, borderWidth: 1, borderColor: UI_TOKENS.colors.border, backgroundColor: UI_TOKENS.colors.surface, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  resultsOwnerChevronText: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900" },
  resultsXiContext: { minHeight: 64, flexDirection: "row", alignItems: "center", backgroundColor: "#F4F8F6", borderBottomWidth: 1, borderLeftWidth: 5, borderColor: UI_TOKENS.colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  resultsXiContextMark: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 10 },
  resultsXiContextMarkText: { fontSize: 10, fontWeight: "900" },
  resultsXiContextEyebrow: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  resultsXiContextTitle: { fontFamily: OWNER_FONT, fontSize: 15, lineHeight: 19, fontWeight: "700", marginTop: 2 },
  resultsXiContextMeta: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 2 },
  resultsXiContextStats: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 7 },
  resultsPlayerCompact: { minHeight: 76, alignItems: "flex-start", paddingHorizontal: 10, paddingVertical: 10 },
  resultsPlayerChevronCompact: { alignSelf: "flex-start", marginTop: 4 },
  resultsPlayerMainCompact: { minWidth: 0 },
  resultsPlayerNameCompact: { flexShrink: 1, minWidth: 0 },
  resultsPlayerValueCompact: { minWidth: 54, flexShrink: 0, alignSelf: "flex-start", textAlign: "right", marginLeft: 6, marginRight: 0, marginTop: 3, fontSize: 11 },
  scorecardScreen: { backgroundColor: UI_TOKENS.colors.canvas, padding: 18, paddingTop: 16, paddingBottom: 120, minHeight: 750 },
  scorecardTopRow: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  scorecardBack: { minHeight: 40, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: UI_TOKENS.colors.border, backgroundColor: UI_TOKENS.colors.card, borderRadius: 11, paddingHorizontal: 12 },
  scorecardBackArrow: { color: UI_TOKENS.colors.primary, fontSize: 22, lineHeight: 24, fontWeight: "900", marginRight: 5 },
  scorecardBackText: { color: UI_TOKENS.colors.primary, fontSize: 10, fontWeight: "900" },
  scorecardSource: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  scorecardSourceText: { color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900", textDecorationLine: "underline" },
  scorecardHero: { position: "relative", overflow: "hidden", backgroundColor: "#071C3B", borderRadius: 22, padding: 18, marginBottom: 12, ...CARD_SHADOW },
  scorecardHeroGlow: { position: "absolute", width: 250, height: 250, borderRadius: 125, right: -115, top: -150, backgroundColor: "rgba(216,255,99,0.12)" },
  scorecardHeroEyebrow: { color: "#AEBBD0", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  scorecardHeroMain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  scorecardHeroMainCompact: { alignItems: "flex-start" },
  scorecardHeroTeams: { flexDirection: "row", alignItems: "center", gap: 7 },
  scorecardHeroVs: { color: "#AEBBD0", fontSize: 9, fontWeight: "900" },
  scorecardWinnerBadge: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(216,255,99,0.35)", backgroundColor: "rgba(216,255,99,0.10)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  scorecardWinnerCheck: { color: UI_TOKENS.colors.accent, fontSize: 14, fontWeight: "900", marginRight: 7 },
  scorecardWinnerLabel: { color: "#AEBBD0", fontSize: 6, fontWeight: "900", letterSpacing: 0.7 },
  scorecardWinnerTeam: { color: UI_TOKENS.colors.accent, fontSize: 13, fontWeight: "900", marginTop: 1 },
  scorecardHeroMeta: { color: "#AEBBD0", fontSize: 8, lineHeight: 12, marginTop: 9 },
  scorecardResult: { color: "#FFFFFF", fontSize: 17, lineHeight: 22, fontWeight: "900", marginTop: 12 },
  scorecardUnavailable: { color: "#D3DBE5", fontSize: 10, lineHeight: 15, marginTop: 13 },
  scorecardInningsSummary: { flexDirection: "row", gap: 8, marginTop: 13 },
  scorecardInningsSummaryCompact: { gap: 6 },
  scorecardSummaryItem: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 10 },
  scorecardSummaryOrder: { color: "#95A4B9", fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  scorecardSummaryScoreRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 7 },
  scorecardSummaryScore: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  scorecardSummaryOvers: { color: "#C6D0DF", fontSize: 7, marginTop: 5 },
  scorecardPom: { color: UI_TOKENS.colors.accent, fontSize: 9, fontWeight: "900", marginTop: 12 },
  scorecardTabs: { flexDirection: "row", borderWidth: 1, borderColor: UI_TOKENS.colors.border, backgroundColor: "#E9EFEC", borderRadius: 14, padding: 4, marginBottom: 12 },
  scorecardTab: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  scorecardTabActive: { backgroundColor: UI_TOKENS.colors.primary, ...CARD_SHADOW },
  scorecardTabText: { color: UI_TOKENS.colors.muted, fontSize: 10, fontWeight: "900" },
  scorecardTabTextActive: { color: UI_TOKENS.colors.accent },
  inningsTabs: { flexDirection: "row", gap: 8, marginBottom: 10 },
  inningsTab: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: UI_TOKENS.colors.border, backgroundColor: UI_TOKENS.colors.card, borderRadius: 13, padding: 10 },
  inningsTabActive: { borderColor: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.primary },
  inningsTabEyebrow: { color: UI_TOKENS.colors.muted, fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  inningsTabTextActive: { color: UI_TOKENS.colors.accent },
  inningsTabScore: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 5 },
  inningsTabTeam: { color: UI_TOKENS.colors.ink, fontSize: 11, fontWeight: "900" },
  inningsTabTotal: { color: UI_TOKENS.colors.primary, fontSize: 14, fontWeight: "900" },
  inningsCard: { overflow: "hidden", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 17, ...CARD_SHADOW },
  inningsHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", backgroundColor: "#F0F5F2", paddingHorizontal: 13, paddingVertical: 11 },
  inningsHeadingEyebrow: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  inningsHeadingTitle: { color: UI_TOKENS.colors.ink, fontSize: 18, fontWeight: "900", marginTop: 3 },
  inningsHeadingOvers: { color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "800" },
  scoreTableHeader: { minHeight: 32, flexDirection: "row", alignItems: "center", backgroundColor: "#071C3B", paddingHorizontal: 10 },
  scoreTablePlayerHeader: { flex: 1, minWidth: 100, color: "#AEBBD0", fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  scoreTableCellHeader: { width: 34, flexShrink: 0, color: "#AEBBD0", fontSize: 7, fontWeight: "900", textAlign: "right" },
  scoreTableWideCell: { width: 46 },
  scoreTableRow: { minHeight: 54, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E5EBE7", paddingHorizontal: 10, paddingVertical: 7 },
  scoreTableBattingRow: { minHeight: 62 },
  scoreTablePlayer: { flex: 1, minWidth: 100, paddingRight: 7 },
  bowlingPlayerCompact: { minWidth: 82 },
  bowlingCellCompact: { width: 26 },
  bowlingWideCellCompact: { width: 38 },
  scoreTablePlayerName: { color: UI_TOKENS.colors.ink, fontSize: 10, fontWeight: "900" },
  scoreTablePlayerMeta: { color: UI_TOKENS.colors.muted, fontSize: 7, lineHeight: 10, marginTop: 2 },
  scoreTableDismissal: { color: "#53645E", fontSize: 7, lineHeight: 10, fontWeight: "700", marginTop: 2 },
  didNotBat: { backgroundColor: "#F5F8F6", borderTopWidth: 1, borderTopColor: "#E5EBE7", paddingHorizontal: 10, paddingVertical: 9 },
  didNotBatLabel: { color: UI_TOKENS.colors.primary, fontSize: 7, lineHeight: 10, fontWeight: "900", letterSpacing: 0.6 },
  didNotBatNames: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, fontWeight: "700", marginTop: 3 },
  scoreTableCell: { width: 34, flexShrink: 0, color: UI_TOKENS.colors.ink, fontSize: 9, fontWeight: "700", textAlign: "right" },
  scoreTableRuns: { color: UI_TOKENS.colors.primary, fontWeight: "900" },
  bowlingHeading: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#E8F2EE", paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  bowlingHeadingTitle: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  bowlingHeadingMeta: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "800" },
  scorecardEmpty: { alignItems: "center", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 17, padding: 24 },
  scorecardEmptyTitle: { color: UI_TOKENS.colors.ink, fontSize: 15, fontWeight: "900" },
  scorecardEmptyText: { color: UI_TOKENS.colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 6 },
  scorecardEmptyButton: { minHeight: 42, alignItems: "center", justifyContent: "center", backgroundColor: UI_TOKENS.colors.primary, borderRadius: 11, paddingHorizontal: 16, marginTop: 14 },
  scorecardEmptyButtonText: { color: UI_TOKENS.colors.accent, fontSize: 9, fontWeight: "900" },
  pointsIntro: { flexDirection: "row", alignItems: "center", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 16, padding: 13, marginBottom: 10, ...CARD_SHADOW },
  pointsIntroEyebrow: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  pointsIntroTitle: { color: UI_TOKENS.colors.ink, fontSize: 15, fontWeight: "900", marginTop: 2 },
  pointsIntroText: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 3 },
  pointsLeader: { width: 84, flexShrink: 0, alignItems: "flex-end", borderLeftWidth: 1, borderLeftColor: UI_TOKENS.colors.border, paddingLeft: 10, marginLeft: 10 },
  pointsLeaderLabel: { color: UI_TOKENS.colors.muted, fontSize: 6, fontWeight: "900", letterSpacing: 0.5 },
  pointsLeaderValue: { color: UI_TOKENS.colors.primary, fontSize: 19, fontWeight: "900", marginTop: 2 },
  pointsLeaderName: { width: "100%", color: UI_TOKENS.colors.ink, fontSize: 7, fontWeight: "800", textAlign: "right" },
  scorecardRoyaltySummary: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8F2FF", borderWidth: 1, borderColor: "#DFCDEE", borderRadius: 13, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  scorecardRoyaltySummaryLabel: { color: "#704091", fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  scorecardRoyaltySummaryText: { color: "#6C5D73", fontSize: 8, marginTop: 2 },
  scorecardRoyaltySummaryMetric: { flexShrink: 0, alignItems: "flex-end", marginLeft: 12 },
  scorecardRoyaltySummaryValue: { color: "#704091", fontSize: 14, fontWeight: "900" },
  scorecardRoyaltySummaryUnit: { color: "#85619A", fontSize: 6, fontWeight: "900", letterSpacing: 0.5, marginTop: 1 },
  pointPlayerCard: { overflow: "hidden", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 14, marginBottom: 9 },
  pointPlayerCardOpen: { borderWidth: 2, borderColor: UI_TOKENS.colors.primary, ...CARD_SHADOW },
  pointPlayerHeader: { minHeight: 68, paddingHorizontal: 10, paddingVertical: 9 },
  pointPlayerHeaderCompact: { paddingBottom: 7 },
  pointPlayerHeaderMain: { flexDirection: "row", alignItems: "center" },
  pointPlayerRank: { width: 36, height: 36, flexShrink: 0, borderRadius: 11, backgroundColor: UI_TOKENS.colors.primarySoft, alignItems: "center", justifyContent: "center", marginRight: 9 },
  pointPlayerRankText: { color: UI_TOKENS.colors.primary, fontSize: 12, fontWeight: "900" },
  pointPlayerIdentity: { flex: 1, minWidth: 0 },
  pointPlayerNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  pointPlayerName: { flexShrink: 1, color: UI_TOKENS.colors.ink, fontSize: 11, fontWeight: "900" },
  pointPomBadge: { color: "#694F00", backgroundColor: "#FFF0A6", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontSize: 6, fontWeight: "900" },
  pointPlayerMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 5 },
  pointRawSummary: { flexShrink: 1, color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "700" },
  pointPlayerTotalValue: { color: UI_TOKENS.colors.primary, fontSize: 15, fontWeight: "900" },
  pointPlayerScoreMetrics: { minWidth: 160, flexShrink: 0, flexDirection: "row", justifyContent: "flex-end", alignItems: "stretch", marginLeft: 12 },
  pointPlayerScoreMetricsCompact: { minWidth: 0, alignSelf: "stretch", justifyContent: "flex-end", marginLeft: 45, marginRight: 37, marginTop: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: UI_TOKENS.colors.border },
  pointPlayerScoreMetric: { minWidth: 72, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 9 },
  pointPlayerScoreLabel: { color: UI_TOKENS.colors.muted, fontSize: 6, fontWeight: "900", letterSpacing: 0.4, marginTop: 1 },
  pointPlayerRoyaltyMetric: { borderLeftWidth: 1, borderLeftColor: "#DFCDEE" },
  pointPlayerRoyaltyValue: { color: "#704091", fontSize: 15, fontWeight: "900" },
  pointPlayerRoyaltyLabel: { color: "#85619A", fontSize: 6, fontWeight: "900", letterSpacing: 0.4, marginTop: 1 },
  pointPlayerChevron: { width: 30, height: 30, flexShrink: 0, borderRadius: 9, backgroundColor: UI_TOKENS.colors.surface, alignItems: "center", justifyContent: "center", marginLeft: 7 },
  pointPlayerChevronText: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900" },
  pointPlayerBody: { backgroundColor: "#F4F8F6", borderTopWidth: 1, borderTopColor: UI_TOKENS.colors.border, padding: 10 },
  pointCategoryGrid: { flexDirection: "row", gap: 6, marginBottom: 9 },
  pointCategoryGridCompact: { gap: 5 },
  pointCategory: { flex: 1, minWidth: 0, alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 3 },
  pointCategoryLabel: { fontSize: 6, fontWeight: "900", letterSpacing: 0.4 },
  pointCategoryValue: { color: UI_TOKENS.colors.ink, fontSize: 13, fontWeight: "900", marginTop: 2 },
  pointDetailSection: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 11, paddingHorizontal: 9, paddingTop: 8, marginBottom: 7 },
  pointDetailHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: UI_TOKENS.colors.border, paddingBottom: 6 },
  pointDetailTitle: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  pointDetailTotal: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900" },
  pointDetailEmpty: { color: UI_TOKENS.colors.muted, fontSize: 8, fontStyle: "italic", paddingVertical: 8 },
  pointDetailUnavailable: { backgroundColor: "#FFF9E7", borderWidth: 1, borderColor: "#E7DCA7", borderRadius: 11, padding: 10, marginBottom: 8 },
  pointDetailUnavailableTitle: { color: "#6B5510", fontSize: 8, fontWeight: "900" },
  pointDetailUnavailableText: { color: "#796B39", fontSize: 8, lineHeight: 12, marginTop: 3 },
  pointRoyaltySection: { borderColor: "#DFCDEE", backgroundColor: "#FCF9FF" },
  pointRoyaltyTitle: { color: "#704091" },
  royaltyAuditRow: { minHeight: 42, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E9DFF0", paddingVertical: 7 },
  royaltyAuditNames: { color: "#3D2A49", fontSize: 8, fontWeight: "900" },
  royaltyAuditFormula: { color: "#74667B", fontSize: 7, lineHeight: 11, marginTop: 2 },
  royaltyAuditValue: { color: "#704091", fontSize: 11, fontWeight: "900", marginLeft: 8 },
  royaltyAuditNote: { color: "#74667B", fontSize: 7, lineHeight: 11, paddingVertical: 7 },
  playerValueNegative: { color: UI_TOKENS.status.danger },
  rankingScreen: { paddingTop: 2 },
  rankingHero: { position: "relative", overflow: "hidden", backgroundColor: "#071C3B", borderRadius: 22, padding: 17, ...CARD_SHADOW },
  rankingHeroGlowLarge: { position: "absolute", width: 220, height: 220, borderRadius: 110, right: -94, top: -120, backgroundColor: "rgba(216,255,99,0.12)" },
  rankingHeroGlowSmall: { position: "absolute", width: 110, height: 110, borderRadius: 55, left: "38%", bottom: -82, backgroundColor: "rgba(43,146,255,0.13)" },
  rankingHeroHeading: { flexDirection: "row", alignItems: "center" },
  rankingHeroMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: UI_TOKENS.colors.accent, alignItems: "center", justifyContent: "center", marginRight: 11 },
  rankingHeroMarkTop: { color: "#071C3B", fontSize: 18, lineHeight: 21, fontWeight: "900", marginTop: -3 },
  rankingHeroMarkBase: { width: 18, height: 4, borderRadius: 2, backgroundColor: "#071C3B", marginTop: 1 },
  rankingHeroEyebrow: { color: "#AEBBD0", fontSize: 8, lineHeight: 11, fontWeight: "900", letterSpacing: 1.2 },
  rankingHeroTitle: { color: "#FFFFFF", fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.3, marginTop: 2 },
  rankingHeroPeriod: { color: "#C6D0DF", fontSize: 9, lineHeight: 13, marginTop: 3 },
  rankingHeroLive: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(216,255,99,0.24)", backgroundColor: "rgba(216,255,99,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginLeft: 9 },
  rankingHeroLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: UI_TOKENS.colors.accent, marginRight: 6 },
  rankingHeroLiveText: { color: UI_TOKENS.colors.accent, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  rankingHeroBody: { flexDirection: "row", alignItems: "stretch", gap: 9, marginTop: 16 },
  rankingHeroBodyCompact: { flexDirection: "column" },
  rankingOwnerSpotlight: { flex: 0.9, minWidth: 0, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 15, paddingHorizontal: 13, paddingVertical: 11 },
  rankingOwnerSpotlightCompact: { flex: 0, width: "100%" },
  rankingOwnerSpotlightLabel: { color: "#AEBBD0", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  rankingOwnerSpotlightMain: { flexDirection: "row", alignItems: "flex-end", marginTop: 5 },
  rankingOwnerSpotlightRank: { color: UI_TOKENS.colors.accent, fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 },
  rankingOwnerSpotlightScore: { marginLeft: 12, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.18)" },
  rankingOwnerSpotlightPoints: { color: "#FFFFFF", fontSize: 18, lineHeight: 21, fontWeight: "900" },
  rankingOwnerSpotlightPointsLabel: { color: "#98A6BA", fontSize: 7, fontWeight: "900", letterSpacing: 0.7, marginTop: 1 },
  rankingOwnerSpotlightEmpty: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", marginTop: 7 },
  rankingOwnerSpotlightMeta: { color: "#C9D2DF", fontSize: 9, lineHeight: 13, marginTop: 6 },
  rankingHeroStats: { flex: 1.4, minWidth: 0, flexDirection: "row", gap: 7 },
  rankingHeroStat: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 13, paddingHorizontal: 10, paddingVertical: 10, justifyContent: "center" },
  rankingHeroStatLabel: { color: "#92A1B6", fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  rankingHeroStatValue: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "900", marginTop: 5 },
  rankingHeroStatDetail: { color: "#BBC5D4", fontSize: 8, lineHeight: 11, marginTop: 2 },
  rankingPhasePanel: { backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 17, paddingHorizontal: 12, paddingTop: 12, marginTop: 12, ...CARD_SHADOW },
  rankingPhaseHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  rankingPhaseEyebrow: { color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  rankingPhaseTitle: { color: "#18223B", fontSize: 13, lineHeight: 17, fontWeight: "900", marginTop: 2 },
  rankingPhaseCount: { color: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, fontSize: 8, fontWeight: "900" },
  rankingPhaseSwipe: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  rankingTrendCard: { position: "relative", overflow: "hidden", backgroundColor: "#071C3B", borderWidth: 1, borderColor: "#17395F", borderRadius: 20, paddingHorizontal: 12, paddingTop: 13, paddingBottom: 12, marginTop: 12, ...CARD_SHADOW },
  rankingTrendGlowLarge: { position: "absolute", width: 210, height: 210, borderRadius: 105, right: -95, top: -130, backgroundColor: "rgba(216,255,99,0.10)" },
  rankingTrendGlowSmall: { position: "absolute", width: 120, height: 120, borderRadius: 60, left: "42%", bottom: -88, backgroundColor: "rgba(43,146,255,0.10)" },
  rankingTrendHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 9 },
  rankingTrendEyebrow: { color: "#AAB9CE", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  rankingTrendTitle: { color: "#FFFFFF", fontSize: 17, lineHeight: 21, fontWeight: "900", marginTop: 2 },
  rankingTrendSubtitle: { color: "#B9C6D8", fontSize: 8, lineHeight: 12, marginTop: 2 },
  rankingTrendLive: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(216,255,99,0.25)", backgroundColor: "rgba(216,255,99,0.08)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  rankingTrendLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: UI_TOKENS.colors.accent, marginRight: 5 },
  rankingTrendLiveText: { color: UI_TOKENS.colors.accent, fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  rankingTrendToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7, marginBottom: 8 },
  rankingTrendTabs: { flex: 1, minWidth: 0, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, padding: 3 },
  rankingTrendTab: { flex: 1, minHeight: 30, alignItems: "center", justifyContent: "center", borderRadius: 8, paddingHorizontal: 5 },
  rankingTrendTabActive: { backgroundColor: UI_TOKENS.colors.accent },
  rankingTrendTabText: { color: "#B9C6D8", fontSize: 7, fontWeight: "900", letterSpacing: 0.35 },
  rankingTrendTabTextActive: { color: "#071C3B" },
  rankingTrendToggle: { minHeight: 36, flexShrink: 0, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 9, paddingHorizontal: 9 },
  rankingTrendToggleText: { color: "#FFFFFF", fontSize: 7, fontWeight: "900", letterSpacing: 0.4 },
  rankingTrendPlot: { position: "relative", overflow: "hidden", width: "100%", backgroundColor: "rgba(3,14,34,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 13 },
  rankingTrendGridLine: { position: "absolute", height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  rankingTrendAxisValue: { position: "absolute", left: 0, color: "#8FA0B8", fontSize: 7, lineHeight: 14, fontWeight: "800", textAlign: "right" },
  rankingTrendSelectionBand: { position: "absolute", width: 18, borderRadius: 8, backgroundColor: "rgba(216,255,99,0.06)", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "rgba(216,255,99,0.13)" },
  rankingTrendSegment: { position: "absolute", height: 2, borderRadius: 2, opacity: 0.82 },
  rankingTrendSegmentCurrent: { height: 3, opacity: 1 },
  rankingTrendDotHit: { position: "absolute", width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  rankingTrendDot: { width: 6, height: 6, borderRadius: 3 },
  rankingTrendDotCurrent: { width: 8, height: 8, borderRadius: 4 },
  rankingTrendDotSelected: { borderWidth: 2, borderColor: "#FFFFFF", shadowColor: "#FFFFFF", shadowOpacity: 0.5, shadowRadius: 4, elevation: 3 },
  rankingTrendBaseline: { position: "absolute", height: 1, backgroundColor: "rgba(255,255,255,0.28)" },
  rankingFormBarHit: { position: "absolute", minHeight: 2 },
  rankingFormBar: { flex: 1, width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3, opacity: 0.72 },
  rankingFormBarCurrent: { opacity: 1, borderWidth: 1, borderColor: "#FFFFFF" },
  rankingFormBarSelected: { opacity: 1, shadowColor: "#FFFFFF", shadowOpacity: 0.35, shadowRadius: 3, elevation: 2 },
  rankingTrendMatchLabel: { position: "absolute", width: 30, color: "#8091AA", fontSize: 7, lineHeight: 12, fontWeight: "900", textAlign: "center" },
  rankingTrendMatchLabelActive: { color: UI_TOKENS.colors.accent },
  rankingTrendInsights: { flexDirection: "row", gap: 6, marginTop: 8 },
  rankingTrendInsight: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: "rgba(255,255,255,0.11)", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  rankingTrendInsightYou: { borderColor: "rgba(216,255,99,0.25)", backgroundColor: "rgba(216,255,99,0.08)" },
  rankingTrendInsightLabel: { color: "#91A1B8", fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  rankingTrendInsightValue: { color: "#FFFFFF", fontSize: 10, lineHeight: 13, fontWeight: "900", marginTop: 3 },
  rankingTrendInsightDetail: { color: "#B9C6D8", fontSize: 6, lineHeight: 9, marginTop: 2 },
  rankingTrendLegend: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  rankingTrendLegendItem: { minWidth: 105, flexGrow: 1, flexBasis: 125, minHeight: 30, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 9, paddingHorizontal: 8 },
  rankingTrendLegendCurrent: { borderColor: "rgba(216,255,99,0.35)", backgroundColor: "rgba(216,255,99,0.08)" },
  rankingTrendLegendDot: { width: 7, height: 7, flexShrink: 0, borderRadius: 4, marginRight: 6 },
  rankingTrendLegendName: { flex: 1, minWidth: 0, color: "#D8E0EC", fontSize: 8, fontWeight: "900" },
  rankingTrendLegendScore: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", marginLeft: 6 },
  rankingRecordsSection: { marginTop: 18 },
  rankingRecordsHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginBottom: 9, paddingHorizontal: 2 },
  rankingRecordsTitle: { color: "#18223B", fontSize: 16, lineHeight: 20, fontWeight: "900", marginTop: 2 },
  rankingRecordsPeriod: { flexShrink: 1, color: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 6, fontWeight: "900", letterSpacing: 0.4 },
  rankingRecordsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rankingRecordCard: { width: "24.2%", minWidth: 150, flexGrow: 1, minHeight: 94, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 10, ...CARD_SHADOW },
  rankingRecordCardCompact: { width: "48.5%", minWidth: 0, minHeight: 86, paddingHorizontal: 8, paddingVertical: 8 },
  rankingRecordGreen: { backgroundColor: "#EAF6EF", borderColor: "#A8D2B9" },
  rankingRecordGold: { backgroundColor: "#FFF5D7", borderColor: "#E4C36A" },
  rankingRecordBlue: { backgroundColor: "#EAF3FF", borderColor: "#A6C4EA" },
  rankingRecordPurple: { backgroundColor: "#F2ECFF", borderColor: "#C2AFE8" },
  rankingRecordIcon: { width: 34, height: 34, flexShrink: 0, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.72)", marginRight: 9 },
  rankingRecordIconText: { color: UI_TOKENS.colors.primary, fontSize: 17, lineHeight: 21, fontWeight: "900" },
  rankingRecordLabel: { color: "#68766F", fontSize: 6, fontWeight: "900", letterSpacing: 0.55 },
  rankingRecordValue: { color: "#18223B", fontFamily: OWNER_FONT, fontSize: 14, lineHeight: 18, fontWeight: "900", marginTop: 3 },
  rankingRecordDetail: { minHeight: 20, color: "#66736D", fontSize: 7, lineHeight: 10, fontWeight: "700", marginTop: 2 },
  rankingFactsPanel: { position: "relative", overflow: "hidden", backgroundColor: "#071C3B", borderWidth: 1, borderColor: "#183B62", borderRadius: 18, paddingTop: 12, paddingBottom: 12, marginTop: 12, ...CARD_SHADOW },
  rankingFactsGlow: { position: "absolute", width: 190, height: 190, borderRadius: 95, right: -95, top: -115, backgroundColor: "rgba(216,255,99,0.09)" },
  rankingFactsHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, paddingHorizontal: 13, marginBottom: 9 },
  rankingFactsEyebrow: { color: UI_TOKENS.colors.accent, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  rankingFactsTitle: { color: "#FFFFFF", fontSize: 15, lineHeight: 19, fontWeight: "900", marginTop: 2 },
  rankingFactsHint: { flexShrink: 0, color: "#AEBBD0", fontSize: 6, fontWeight: "900", letterSpacing: 0.55, marginBottom: 2 },
  rankingFactsScroller: { gap: 8, paddingHorizontal: 12, paddingRight: 20 },
  rankingFactCard: { width: 178, minHeight: 116, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 10 },
  rankingFactCardCompact: { width: 148, minHeight: 108, paddingHorizontal: 9, paddingVertical: 9 },
  rankingFactLime: { backgroundColor: "rgba(216,255,99,0.12)", borderColor: "rgba(216,255,99,0.30)" },
  rankingFactGold: { backgroundColor: "rgba(255,190,56,0.13)", borderColor: "rgba(255,190,56,0.32)" },
  rankingFactBlue: { backgroundColor: "rgba(62,159,255,0.14)", borderColor: "rgba(62,159,255,0.32)" },
  rankingFactPurple: { backgroundColor: "rgba(151,103,255,0.14)", borderColor: "rgba(151,103,255,0.32)" },
  rankingFactOrange: { backgroundColor: "rgba(255,111,62,0.13)", borderColor: "rgba(255,111,62,0.32)" },
  rankingFactPink: { backgroundColor: "rgba(242,95,159,0.13)", borderColor: "rgba(242,95,159,0.32)" },
  rankingFactIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)", marginBottom: 8 },
  rankingFactIconText: { color: "#FFFFFF", fontSize: 15, lineHeight: 18, fontWeight: "900" },
  rankingFactLabel: { color: "#AEBBD0", fontSize: 6, fontWeight: "900", letterSpacing: 0.65 },
  rankingFactValue: { color: "#FFFFFF", fontFamily: OWNER_FONT, fontSize: 14, lineHeight: 18, fontWeight: "900", marginTop: 4 },
  rankingFactDetail: { color: "#C8D2E1", fontSize: 7, lineHeight: 10, fontWeight: "700", marginTop: 3 },
  rankingSectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 20, marginBottom: 9, paddingHorizontal: 2 },
  rankingSectionEyebrow: { color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  rankingSectionTitle: { color: "#18223B", fontSize: 18, lineHeight: 22, fontWeight: "900", marginTop: 2 },
  rankingSectionMeta: { flexShrink: 0, color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900", marginLeft: 10, marginBottom: 2 },
  rankingPodium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 12, paddingTop: 18 },
  rankingPodiumShort: { alignItems: "stretch", paddingTop: 0 },
  rankingPodiumCard: { position: "relative", flex: 1, maxWidth: 420, minWidth: 0, minHeight: 205, overflow: "hidden", alignItems: "center", justifyContent: "flex-end", borderWidth: 1.5, borderRadius: 22, paddingHorizontal: 14, paddingTop: 24, paddingBottom: 17, ...CARD_SHADOW },
  rankingPodiumCardCompact: { minHeight: 119, borderRadius: 14, paddingHorizontal: 5, paddingTop: 11, paddingBottom: 7 },
  rankingPodiumCardWinner: { minHeight: 230, transform: [{ translateY: -12 }], shadowOpacity: 0.14, elevation: 6 },
  rankingPodiumCardWinnerCompact: { minHeight: 128, transform: [{ translateY: -4 }] },
  rankingPodiumCardCurrent: { borderWidth: 2.5, borderColor: UI_TOKENS.colors.primary },
  rankingPodiumTopBar: { position: "absolute", left: 0, right: 0, top: 0, height: 5 },
  rankingPodiumGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90, right: -70, bottom: -105 },
  rankingPodiumYou: { position: "absolute", top: 10, right: 10, borderRadius: 9, backgroundColor: UI_TOKENS.colors.primary, paddingHorizontal: 9, paddingVertical: 5 },
  rankingPodiumYouText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  rankingMedal: { position: "absolute", top: 14, left: 13, width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  rankingMedalCompact: { top: 7, left: 6, width: 24, height: 24, borderRadius: 12 },
  rankingMedalRank: { fontSize: 15, lineHeight: 18, fontWeight: "900" },
  rankingMedalRankCompact: { fontSize: 10, lineHeight: 12 },
  rankingMedalRibbon: { position: "absolute", bottom: -8, width: 14, height: 10, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  rankingPodiumAvatar: { width: 66, height: 66, borderRadius: 22, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  rankingPodiumAvatarCompact: { width: 36, height: 36, borderRadius: 12, marginBottom: 5 },
  rankingPodiumAvatarText: { fontFamily: OWNER_FONT, fontSize: 25, lineHeight: 30, fontWeight: "900" },
  rankingPodiumAvatarTextCompact: { fontSize: 15, lineHeight: 18 },
  rankingPodiumName: { width: "100%", color: "#18223B", fontFamily: OWNER_FONT, fontSize: 17, lineHeight: 22, fontWeight: "700", textAlign: "center" },
  rankingPodiumNameCompact: { fontSize: 11, lineHeight: 14 },
  rankingPodiumPoints: { fontSize: 29, lineHeight: 34, fontWeight: "900", marginTop: 7 },
  rankingPodiumPointsCompact: { fontSize: 16, lineHeight: 19, marginTop: 2 },
  rankingPodiumPointsLabel: { color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  rankingPodiumMeta: { color: UI_TOKENS.colors.muted, fontSize: 10, lineHeight: 13, textAlign: "center", marginTop: 7 },
  rankingPodiumLeaderGap: { width: "100%", flexShrink: 1, color: "#7A5417", fontSize: 10, lineHeight: 13, fontWeight: "900", textAlign: "center", marginTop: 4 },
  rankingPodiumCompactBadgeText: { fontSize: 8, lineHeight: 10, marginTop: 2 },
  rankingPodiumLeader: { color: UI_TOKENS.colors.primary, letterSpacing: 0.6 },
  rankingChaserGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", justifyContent: "space-between", gap: 9 },
  rankingChaserCard: { position: "relative", overflow: "hidden", borderWidth: 1, borderRadius: 17, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 11, ...CARD_SHADOW },
  rankingChaserCardDesktop: { width: "49.4%" },
  rankingChaserCardCompact: { width: "100%", borderRadius: 14, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 8 },
  rankingChaserCardCurrent: { borderWidth: 2, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10, shadowOpacity: 0.11, elevation: 4 },
  rankingChaserAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  rankingChaserTop: { flexDirection: "row", alignItems: "center" },
  rankingChaserRank: { width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 9 },
  rankingChaserRankText: { fontSize: 11, fontWeight: "900" },
  rankingChaserIdentity: { flex: 1, minWidth: 0 },
  rankingChaserName: { flexShrink: 1, color: "#18223B", fontFamily: OWNER_FONT, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  rankingChaserNameCompact: { fontSize: 12, lineHeight: 15 },
  rankingChaserMeta: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 3 },
  rankingChaserScore: { minWidth: 58, alignItems: "flex-end", marginLeft: 8 },
  rankingChaserPoints: { color: UI_TOKENS.colors.primary, fontSize: 18, lineHeight: 22, fontWeight: "900" },
  rankingChaserPointsCompact: { fontSize: 15, lineHeight: 18 },
  rankingChaserPointsLabel: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  rankingChaserCompactBadgeText: { fontSize: 8, lineHeight: 10 },
  rankingChaserCompactMetrics: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(240,244,242,0.82)", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, marginTop: 7 },
  rankingChaserCompactMetricText: { flex: 1, minWidth: 0, color: "#51625B", fontSize: 9, lineHeight: 11, fontWeight: "900", textAlign: "center" },
  rankingChaserCompactMetricDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#A6B1AC", marginHorizontal: 5 },
  rankingChaserCompactProgress: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  rankingChaserCompactTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "#E2E8E5" },
  rankingChaserCompactProgressText: { width: 34, color: UI_TOKENS.colors.primary, fontSize: 9, lineHeight: 11, fontWeight: "900", textAlign: "right", marginLeft: 7 },
  rankingChaserMetrics: { minHeight: 49, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(240,244,242,0.82)", borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10 },
  rankingChaserMetric: { flex: 1, minWidth: 0 },
  rankingChaserMetricDivider: { width: 1, height: 31, backgroundColor: "#D8E0DC", marginHorizontal: 10 },
  rankingChaserMetricLabel: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  rankingChaserMetricValue: { color: "#273652", fontSize: 12, lineHeight: 15, fontWeight: "900", marginTop: 2 },
  rankingChaserMetricDetail: { color: "#7A6750", fontSize: 7, lineHeight: 10, fontWeight: "800", marginTop: 1 },
  rankingChaserProgressHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9, marginBottom: 5 },
  rankingChaserProgressLabel: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  rankingChaserProgressValue: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900" },
  rankingChaserProgressTrack: { width: "100%", height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: "#E2E8E5" },
  rankingChaserProgressFill: { height: 5, borderRadius: 3 },
  rankingTable: { overflow: "hidden", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 17, ...CARD_SHADOW },
  rankingTableRow: { minHeight: 78, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#E9EEEB", backgroundColor: "#FFFFFF" },
  rankingTableRowCurrent: { backgroundColor: UI_TOKENS.colors.primarySoft, borderLeftWidth: 5, borderLeftColor: UI_TOKENS.colors.primary, paddingLeft: 7 },
  rankingPositionBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EEF2F0", alignItems: "center", justifyContent: "center", marginRight: 9 },
  rankingPositionBadgeCurrent: { backgroundColor: UI_TOKENS.colors.primary },
  rankingPositionText: { color: "#53645D", fontSize: 11, fontWeight: "900" },
  rankingPositionTextCurrent: { color: UI_TOKENS.colors.accent },
  rankingTableIdentity: { flex: 1, minWidth: 0 },
  rankingOwnerLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  rankingTableOwner: { flexShrink: 1, color: "#18223B", fontFamily: OWNER_FONT, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  rankingYouBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, minWidth: 32, alignItems: "center", backgroundColor: UI_TOKENS.colors.primary },
  rankingTableMeta: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 3 },
  rankingProgressTrack: { width: "100%", maxWidth: 330, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "#E7ECE9", marginTop: 6 },
  rankingProgressFill: { height: 4, borderRadius: 2, backgroundColor: "#93A59D" },
  rankingProgressFillCurrent: { backgroundColor: UI_TOKENS.colors.primary },
  rankingTableScore: { minWidth: 78, alignItems: "flex-end", marginLeft: 9 },
  rankingTablePoints: { color: UI_TOKENS.colors.primary, fontSize: 16, lineHeight: 19, fontWeight: "900" },
  rankingTablePointsCurrent: { color: UI_TOKENS.colors.primary },
  rankingTablePointsLabel: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  rankingGap: { color: "#8A6112", fontSize: 7, lineHeight: 10, fontWeight: "900", marginTop: 4 },
  rankingGapTied: { color: UI_TOKENS.status.neutral },
  rankingLeaderGap: { color: UI_TOKENS.colors.muted, fontSize: 7, lineHeight: 10, fontWeight: "800", marginTop: 2 },
  rankingEmpty: { minHeight: 210, alignItems: "center", justifyContent: "center", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 18, paddingHorizontal: 24, paddingVertical: 24, marginTop: 16, ...CARD_SHADOW },
  rankingEmptyMark: { width: 52, height: 52, borderRadius: 17, backgroundColor: UI_TOKENS.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  rankingEmptyMarkText: { color: UI_TOKENS.colors.primary, fontSize: 14, fontWeight: "900" },
  rankingEmptyTitle: { color: "#18223B", fontSize: 17, lineHeight: 21, fontWeight: "900", marginTop: 12 },
  rankingEmptyText: { maxWidth: 520, color: UI_TOKENS.colors.muted, fontSize: 10, lineHeight: 16, textAlign: "center", marginTop: 6 },
  rankingRow: { minHeight: 62, backgroundColor: UI_TOKENS.colors.card, borderLeftWidth: 4, borderLeftColor: "transparent" }, rankingRowPodium: { backgroundColor: "#FBFCF8" }, rankingRowCurrent: { backgroundColor: UI_TOKENS.colors.primarySoft, borderLeftColor: UI_TOKENS.colors.primary }, rankingValue: { color: UI_TOKENS.colors.primary, fontSize: 13, fontWeight: "900", marginLeft: 8 }, currentRankingRow: { backgroundColor: UI_TOKENS.colors.primarySoft, borderLeftWidth: 4, borderLeftColor: UI_TOKENS.colors.primary, paddingLeft: 9 }, currentRankingRank: { color: UI_TOKENS.colors.primary }, currentRankingAvatar: { backgroundColor: UI_TOKENS.colors.primary }, currentRankingAvatarText: { color: "#FFFFFF" }, currentRankingMeta: { color: UI_TOKENS.colors.muted }, currentRankingValue: { color: UI_TOKENS.colors.primary }, rankSlot: { width: 34, alignItems: "flex-start", justifyContent: "center" }, rankMedal: { fontSize: 22, lineHeight: 27 }, youBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, minWidth: 34, alignItems: "center" }, youBadgeText: { color: "#FFFFFF", fontSize: 9, lineHeight: 11, fontWeight: "900", letterSpacing: 0.7 },
  ownerSquadsHero: { position: "relative", overflow: "hidden", backgroundColor: "#071C3B", borderRadius: 22, padding: 17, marginBottom: 13, ...CARD_SHADOW },
  ownerSquadsHeroGlow: { position: "absolute", width: 260, height: 260, borderRadius: 130, right: -125, top: -145, backgroundColor: "rgba(111,73,190,0.24)" },
  ownerSquadsRoyaltyCallout: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", marginTop: 12, paddingTop: 10 },
  ownerSquadsRoyaltyLabel: { color: "#AEBBD0", fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  ownerSquadsRoyaltyValue: { color: "#D5A8F0", fontSize: 10, fontWeight: "900" },
  ownerSortCard: { backgroundColor: "#F3F6F4", borderWidth: 1, borderColor: "#DFE7E2", borderRadius: 14, paddingVertical: 10, marginBottom: 12 },
  ownerSquadsFilterHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 8 },
  ownerSquadsFilterReset: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: UI_TOKENS.colors.card, alignItems: "center", justifyContent: "center", marginHorizontal: 10, marginTop: 11 },
  ownerSquadsFilterResetText: { color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900" },
  ownerSortLabel: { color: "#5F6E68", fontSize: 9, fontWeight: "900", letterSpacing: 0.8, marginHorizontal: 12, marginBottom: 7 }, ownerSortOptions: { paddingHorizontal: 10, gap: 7 }, ownerSortButton: { minHeight: 44, borderWidth: 1, borderColor: "#CFD9D3", backgroundColor: "#FFFFFF", borderRadius: 22, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" }, ownerSortButtonActive: { borderColor: "#174D3D", backgroundColor: "#174D3D" }, ownerSortButtonText: { color: "#465A52", fontSize: 10, fontWeight: "900" }, ownerSortButtonTextActive: { color: "#DDFB72" },
  ownerSquadCard: { overflow: "hidden", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderLeftWidth: 6, borderColor: UI_TOKENS.colors.border, borderRadius: 17, marginBottom: 11, ...CARD_SHADOW },
  ownerSquadCardOpen: { borderColor: UI_TOKENS.colors.borderStrong, shadowOpacity: 0.12, elevation: 3 },
  ownerSquadCardCurrent: { borderTopColor: UI_TOKENS.colors.borderStrong, borderRightColor: UI_TOKENS.colors.borderStrong, borderBottomColor: UI_TOKENS.colors.borderStrong },
  ownerSquadHeader: { minHeight: 82, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, paddingVertical: 11 },
  ownerSquadHeaderCompact: { minHeight: 66, paddingHorizontal: 9, paddingVertical: 8 },
  ownerSquadIdentity: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  ownerDisplayNameCompact: { flexShrink: 1, fontFamily: undefined, fontSize: 13, lineHeight: 17, fontWeight: "900", letterSpacing: 0 },
  ownerYouBadgeCompact: { minWidth: 29, paddingHorizontal: 6, paddingVertical: 3 },
  ownerSquadMetaCompact: { fontSize: 8, lineHeight: 11, marginTop: 2 },
  ownerSquadScore: { minWidth: 50, flexShrink: 0, alignItems: "flex-end" },
  ownerSquadRoyalty: { color: "#704091", fontSize: 6, fontWeight: "900", letterSpacing: 0.3, marginBottom: 2 },
  ownerSquadPoints: { color: UI_TOKENS.colors.primary, fontSize: 17, lineHeight: 20, fontWeight: "900" },
  ownerSquadPointsLabel: { color: UI_TOKENS.colors.muted, fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  ownerSquadChevron: { width: 34, height: 34, flexShrink: 0, borderRadius: 11, backgroundColor: UI_TOKENS.colors.surface, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  ownerSquadChevronText: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900" },
  ownerSquadPlayerCard: { backgroundColor: UI_TOKENS.colors.card, borderTopWidth: 1, borderTopColor: UI_TOKENS.colors.border, paddingHorizontal: 10, paddingVertical: 7 },
  ownerSquadPlayerTop: { flexDirection: "row", alignItems: "center", minHeight: 54, paddingHorizontal: 2, paddingVertical: 4 },
  ownerSquadPlayerIdentity: { flex: 1, minWidth: 0, paddingRight: 7 },
  ownerSquadPlayerName: { flexShrink: 1, minWidth: 0, color: UI_TOKENS.colors.ink, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  ownerSquadPlayerMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 5 },
  ownerSquadPlayerTotal: { minWidth: 45, flexShrink: 0, alignItems: "flex-end" },
  ownerSquadPlayerTotalValue: { color: UI_TOKENS.colors.primary, fontSize: 16, lineHeight: 19, fontWeight: "900" },
  ownerSquadPlayerTotalLabel: { color: UI_TOKENS.colors.muted, fontSize: 6, fontWeight: "900", letterSpacing: 0.6 },
  ownerSquadPlayerDisclosure: { width: 32, height: 32, flexShrink: 0, borderRadius: 10, backgroundColor: UI_TOKENS.colors.surface, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  ownerSquadPlayerDisclosureText: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900" },
  ownerSquadPlayerMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  ownerMatchLedgerEmpty: { backgroundColor: "#F5F8F6", borderTopWidth: 1, borderTopColor: UI_TOKENS.colors.border, paddingHorizontal: 14, paddingVertical: 13 },
  ownerMatchLedgerEmptyTitle: { color: UI_TOKENS.colors.ink, fontSize: 9, fontWeight: "900" },
  ownerMatchLedgerEmptyText: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 3 },
  ownerMatchLedger: { backgroundColor: "#F5F8F6", borderTopWidth: 1, borderTopColor: UI_TOKENS.colors.border, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  ownerMatchLedgerCompact: { borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 12, marginTop: 7, padding: 9 },
  ownerMatchLedgerHeading: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  ownerMatchLedgerEyebrow: { color: UI_TOKENS.colors.muted, fontSize: 6, fontWeight: "900", letterSpacing: 0.8 },
  ownerMatchLedgerTitle: { color: UI_TOKENS.colors.ink, fontSize: 11, fontWeight: "900", marginTop: 2 },
  ownerMatchLedgerCount: { color: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.primarySoft, borderRadius: 9, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, fontSize: 7, fontWeight: "900" },
  playerPoolInsights: { flexDirection: "row", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 10, marginBottom: 9, overflow: "hidden" },
  playerPoolInsightsCompact: { flexWrap: "wrap" },
  playerPoolInsight: { flex: 1, minWidth: 105, paddingHorizontal: 10, paddingVertical: 9, borderRightWidth: 1, borderRightColor: UI_TOKENS.colors.border },
  playerPoolRoyaltyInsight: { backgroundColor: "#F7F0FC" },
  playerPoolInsightLabel: { color: UI_TOKENS.colors.muted, fontSize: 6, fontWeight: "900", letterSpacing: 0.55 },
  playerPoolInsightValue: { color: UI_TOKENS.colors.ink, fontSize: 13, lineHeight: 16, fontWeight: "900", marginTop: 3, fontVariant: ["tabular-nums"] },
  playerPoolInsightMeta: { color: UI_TOKENS.colors.muted, fontSize: 7, lineHeight: 10, fontWeight: "700", marginTop: 1 },
  playerPoolFormCard: { backgroundColor: "#071C3B", borderWidth: 1, borderColor: "#17395F", borderRadius: 12, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 9, marginBottom: 9, overflow: "hidden" },
  playerPoolFormCardCompact: { paddingHorizontal: 10, paddingTop: 10 },
  playerPoolFormHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  playerPoolFormEyebrow: { color: "#9EB0C7", fontSize: 6, fontWeight: "900", letterSpacing: 0.75 },
  playerPoolFormTitle: { color: "#FFFFFF", fontSize: 11, lineHeight: 14, fontWeight: "900", marginTop: 2 },
  playerPoolFormPlot: { minHeight: 66, flexDirection: "row", alignItems: "flex-end", gap: 7, backgroundColor: "rgba(2, 13, 33, 0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", borderRadius: 10, paddingHorizontal: 9, paddingTop: 6, paddingBottom: 5 },
  playerPoolFormPoint: { flex: 1, minWidth: 0, alignItems: "center" },
  playerPoolFormValue: { color: "#FFFFFF", fontSize: 7, lineHeight: 9, fontWeight: "900", fontVariant: ["tabular-nums"] },
  playerPoolFormValueNegative: { color: "#FFB2B2" },
  playerPoolFormTrack: { height: 42, width: "62%", minWidth: 8, maxWidth: 20, justifyContent: "flex-end", marginTop: 2 },
  playerPoolFormTrackCompact: { height: 36 },
  playerPoolFormBar: { width: "100%", minHeight: 5, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  playerPoolFormBarPositive: { backgroundColor: UI_TOKENS.colors.accent },
  playerPoolFormBarNegative: { backgroundColor: "#FF7171" },
  playerPoolFormBarZero: { backgroundColor: "#62738B" },
  playerPoolFormMatch: { color: "#91A3BC", fontSize: 6, lineHeight: 8, fontWeight: "900", marginTop: 3 },
  playerPoolFormCaption: { color: "#91A3BC", fontSize: 6, lineHeight: 9, fontWeight: "700", marginTop: 6 },
  ownerMatchCard: { backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 10, padding: 9, marginBottom: 7 },
  ownerMatchCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  ownerMatchCardNumber: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  ownerMatchCardTeams: { color: UI_TOKENS.colors.ink, fontSize: 10, fontWeight: "900", marginTop: 2 },
  ownerMatchCardTotal: { alignItems: "flex-end", marginLeft: 10 },
  ownerMatchCardTotalValue: { color: UI_TOKENS.colors.primary, fontSize: 15, lineHeight: 17, fontWeight: "900", fontVariant: ["tabular-nums"] },
  ownerMatchCardTotalLabel: { color: UI_TOKENS.colors.muted, fontSize: 5, fontWeight: "900", letterSpacing: 0.6 },
  playerPoolScorecardButton: { minHeight: 44, flexDirection: "row", alignItems: "center", marginTop: 8, paddingHorizontal: 12, borderRadius: 9, backgroundColor: UI_TOKENS.colors.primarySoft, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong },
  playerPoolScorecardIcon: { color: UI_TOKENS.colors.primary, fontSize: 14, fontWeight: "900", marginRight: 8 },
  playerPoolScorecardText: { flex: 1, color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900" },
  playerPoolScorecardArrow: { color: UI_TOKENS.colors.primary, fontSize: 18, lineHeight: 20, fontWeight: "900" },
  playerPoolScorecardInline: { alignSelf: "flex-start", minHeight: 28, justifyContent: "center", marginTop: 3, paddingHorizontal: 7, borderRadius: 7, backgroundColor: UI_TOKENS.colors.primarySoft, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong },
  playerPoolScorecardInlineText: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900" },
  ownerMatchCareerCompact: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: UI_TOKENS.colors.primary, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  ownerMatchCareerCompactLabel: { color: "#D9E8E2", fontSize: 7, fontWeight: "900", letterSpacing: 0.45 },
  ownerMatchCareerCompactValue: { color: UI_TOKENS.colors.accent, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] },
  ownerMatchTableHead: { minHeight: 34, flexDirection: "row", alignItems: "center", backgroundColor: "#E7EEEA", borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderTopLeftRadius: 9, borderTopRightRadius: 9, paddingHorizontal: 10 },
  ownerMatchTableMatchHead: { flex: 1, minWidth: 0, color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.55 },
  ownerMatchTableRow: { minHeight: 47, flexDirection: "row", alignItems: "center", backgroundColor: UI_TOKENS.colors.card, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: UI_TOKENS.colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  ownerMatchTableMatch: { flex: 1, minWidth: 0, paddingRight: 8 },
  ownerMatchTableNumber: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 0.35 },
  ownerMatchTableTeams: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "800", marginTop: 2 },
  ownerMatchCareerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", backgroundColor: UI_TOKENS.colors.primarySoft, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  ownerMatchCareerLabel: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  ownerMatchCareerMetric: { width: 58, flexShrink: 0, textAlign: "center", color: UI_TOKENS.colors.ink, fontSize: 9, fontWeight: "900", fontVariant: ["tabular-nums"] },
  ownerMatchCareerTotal: { width: 64, flexShrink: 0, textAlign: "center", color: UI_TOKENS.colors.primary, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] },
  ownerSquadPlayerSelect: { alignSelf: "flex-start", minHeight: 34, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: UI_TOKENS.colors.card, borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 11, marginTop: 3, marginBottom: 2 },
  ownerSquadTableHead: { minHeight: 40, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, backgroundColor: "#EEF2EF", borderTopWidth: 1, borderTopColor: UI_TOKENS.colors.border },
  ownerSquadTablePlayerHead: { flex: 1, minWidth: 0, color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  ownerSquadTableMetricHead: { width: 58, flexShrink: 0, textAlign: "center", color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.35 },
  ownerSquadTableTotalHead: { width: 64, flexShrink: 0, textAlign: "center", color: UI_TOKENS.colors.ink, fontSize: 8, fontWeight: "900", letterSpacing: 0.35 },
  ownerSquadTableRow: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#E7ECE9", backgroundColor: UI_TOKENS.colors.card },
  ownerSquadTablePlayer: { flex: 1, minWidth: 0, paddingRight: 14 },
  ownerSquadTableMetric: { width: 58, flexShrink: 0, textAlign: "center", color: UI_TOKENS.colors.muted, fontSize: 10, fontVariant: ["tabular-nums"] },
  ownerSquadTableTotal: { width: 64, flexShrink: 0, textAlign: "center", color: UI_TOKENS.colors.primary, fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] },
  squadFilterGroup: { marginTop: 8, minHeight: 54 }, squadFilterGroupLast: { paddingBottom: 2 }, squadFilterScroller: { flexGrow: 0, minHeight: 38 },
  ownerSubmissionBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52, paddingHorizontal: 13, paddingVertical: 6, backgroundColor: "#F7F9F7", borderTopWidth: 1, borderTopColor: "#E7ECE9" },
  ownerSubmissionIdentity: { flexDirection: "row", alignItems: "center", gap: 7 }, ownerSubmissionLabel: { color: "#596861", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }, ownerSubmissionPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }, ownerSubmissionDone: { backgroundColor: "#E1F2E4" }, ownerSubmissionNeeded: { backgroundColor: "#FFF0C8" }, ownerSubmissionMissed: { backgroundColor: "#F7E5E2" }, ownerSubmissionLater: { backgroundColor: "#E8EDF2" }, ownerSubmissionPillText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.25 }, ownerSubmissionDoneText: { color: "#2D6A3B" }, ownerSubmissionNeededText: { color: "#8A6112" }, ownerSubmissionMissedText: { color: "#8B4439" }, ownerSubmissionLaterText: { color: "#526170" },
  ownerSubmissionAction: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#174D3D", borderRadius: 11, paddingHorizontal: 12 }, ownerSubmissionActionText: { color: "#DDFB72", fontSize: 10, fontWeight: "900" }, ownerSubmissionActionArrow: { color: "#DDFB72", fontSize: 16, lineHeight: 16, fontWeight: "900", marginLeft: 5 }, ownerSubmissionLocked: { color: "#66756F", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  fixtureScores: { backgroundColor: "#EEF3F0", borderTopWidth: 1, borderTopColor: UI_TOKENS.colors.borderStrong, padding: 9 },
  fixtureScoreIntro: { backgroundColor: UI_TOKENS.colors.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  fixtureScoreIntroTitle: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  fixtureScoreIntroText: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 2 },
  fixtureScoreCard: { backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 12, padding: 10, marginBottom: 8 },
  fixtureScoreTop: { flexDirection: "row", alignItems: "flex-start" },
  fixtureScoreIdentity: { flex: 1, minWidth: 0, paddingRight: 8 },
  fixtureScoreName: { flexShrink: 1, minWidth: 0, color: UI_TOKENS.colors.ink, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  fixtureScoreTotal: { minWidth: 52, flexShrink: 0, alignItems: "flex-end" },
  fixtureScoreTotalValue: { color: UI_TOKENS.colors.primary, fontSize: 17, lineHeight: 20, fontWeight: "900" },
  fixtureScoreTotalLabel: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  fixtureScoreMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 9 },
  fixtureScoreMetric: { minWidth: 48, flexGrow: 1, flexBasis: 48, backgroundColor: UI_TOKENS.colors.surface, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 6 },
  fixtureScoreMetricAccent: { backgroundColor: "#F4ECFA", borderColor: "#D8BEE8" },
  fixtureScoreMetricLabel: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.4 },
  fixtureScoreMetricLabelAccent: { color: "#704091" },
  fixtureScoreMetricValue: { color: UI_TOKENS.colors.ink, fontSize: 11, lineHeight: 14, fontWeight: "900", marginTop: 2 },
  fixtureScoreMetricValueAccent: { color: "#704091" },
  fixtureLoadMore: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 15, padding: 12, marginTop: 2, ...CARD_SHADOW },
  fixtureLoadMoreTitle: { color: UI_TOKENS.colors.ink, fontSize: 11, fontWeight: "900" },
  fixtureLoadMoreText: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 2 },
  fixtureLoadMoreButton: { minHeight: 44, borderRadius: 11, backgroundColor: UI_TOKENS.colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 13, marginLeft: 10 },
  fixtureLoadMoreButtonText: { color: UI_TOKENS.colors.accent, fontSize: 9, fontWeight: "900" },
  chips: { gap: 7, paddingBottom: 12 }, chip: { position: "relative", minWidth: 112, minHeight: 51, overflow: "hidden", backgroundColor: "#F1F4F2", borderWidth: 1, borderColor: "#DCE4E0", borderRadius: 13, paddingHorizontal: 12, paddingVertical: 8, justifyContent: "center" }, chipActive: { backgroundColor: "#173F35", borderColor: "#173F35" }, chipIndicator: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: "transparent" }, chipIndicatorActive: { backgroundColor: UI_TOKENS.colors.accent }, chipLabel: { color: "#315047", fontSize: 10, fontWeight: "900" }, chipLabelActive: { color: "#FFFFFF" }, chipDetail: { color: "#68766F", fontSize: 8, marginTop: 2 }, chipDetailActive: { color: UI_TOKENS.colors.accent },
  pointHead: { flexDirection: "row", padding: 9, backgroundColor: "#EEF2EF" }, pointRow: { flexDirection: "row", alignItems: "center", padding: 9, borderTopWidth: 1, borderTopColor: "#EDF0EA" }, pointPlayer: { flex: 1, minWidth: 0, paddingRight: 5 }, pointCell: { width: 27, textAlign: "right", color: "#52635B", fontSize: 8 }, royaltyColumn: { color: "#704091", fontWeight: "900" }, pointTotal: { width: 35, textAlign: "right", color: "#173028", fontSize: 9, fontWeight: "900" },
  ownerTotalsSection: { backgroundColor: "#F8FAF7", borderTopWidth: 1, borderTopColor: "#E2E8E4", paddingHorizontal: 12, paddingVertical: 8 }, ownerTotalRow: { flexDirection: "row", alignItems: "center", minHeight: 40, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#E8EDE9" }, ownerTotalValues: { flexDirection: "row", alignItems: "center", gap: 9 }, ownerTotalName: { color: "#173028", fontSize: 10, fontWeight: "800" }, ownerTotalPoints: { color: "#174D3D", fontSize: 12, fontWeight: "900", marginLeft: 10 }, ownerRoyaltyMeta: { color: "#704091", fontSize: 8, fontWeight: "800", marginTop: 2 },
  playerRoyaltySection: { backgroundColor: "#F8F2FF", borderTopWidth: 1, borderTopColor: "#E7D8F3", paddingHorizontal: 12, paddingVertical: 4 }, royaltySectionTitle: { color: "#704091", fontSize: 8, fontWeight: "900", marginTop: 4, marginBottom: 3, letterSpacing: 0.4 }, royaltyDetailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2 }, royaltyDetailText: { flex: 1, color: "#665273", fontSize: 8 }, royaltyValue: { color: "#704091", fontSize: 8, fontWeight: "900", marginLeft: 5 }, compactRoyalty: { color: "#704091", fontSize: 8, fontWeight: "900", marginTop: 4 },
  playerLabelRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 }, specialPlayerBadge: { color: "#6B4E00", backgroundColor: "#FFF0A8", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontWeight: "900", overflow: "hidden" }, marqueePlayerBadge: { color: "#FFFFFF", backgroundColor: "#7B3FA1" },
  ownerDisplayName: { color: "#10251F", fontFamily: OWNER_FONT, fontSize: 15, fontWeight: "700", letterSpacing: 0.25 },
  playerListName: { flex: 1, color: "#173028", fontSize: 11, fontWeight: "900" },
  ownerPlayerNameRow: { flexDirection: "row", alignItems: "center", minWidth: 0 }, ownerPlayerChevron: { color: "#61756D", fontSize: 7, fontWeight: "900", marginLeft: 4 }, ownerPlayerTeamRole: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 5 }, ownerPlayerRole: { color: "#536B62", fontSize: 8, fontWeight: "800" }, ownerPlayerCosts: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 11, marginTop: 4 },
  marqueeHeroCard: { backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, borderRadius: UI_TOKENS.radius.card, padding: 14, marginBottom: 14, ...CARD_SHADOW },
  marqueeCurrentBlock: { backgroundColor: UI_TOKENS.colors.surface, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: 14, padding: 12 },
  marqueeCurrentHeading: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  marqueeCurrentLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#33A267", marginRight: 6 },
  marqueeCurrentEyebrow: { flex: 1, color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  marqueeCurrentBadge: { backgroundColor: "#DDF4E5", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  marqueeCurrentBadgeText: { color: "#237347", fontSize: 6, fontWeight: "900", letterSpacing: 0.5 },
  marqueeCurrentTitle: { color: UI_TOKENS.colors.ink, fontSize: 13, fontWeight: "900" },
  marqueeCurrentSlots: { flexDirection: "row", gap: 8, marginTop: 10 },
  marqueeCurrentSlot: { flex: 1, minWidth: 0, minHeight: 42, flexDirection: "row", alignItems: "center", borderRadius: 11, backgroundColor: UI_TOKENS.colors.primarySoft, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, paddingHorizontal: 9 },
  marqueeCurrentSlotNumber: { width: 21, height: 21, borderRadius: 11, textAlign: "center", textAlignVertical: "center", color: UI_TOKENS.colors.accent, backgroundColor: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900", marginRight: 7 },
  marqueeCurrentSlotName: { flex: 1, color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900" },
  marqueeCurrentHelp: { color: "#74667C", fontSize: 7, lineHeight: 11, marginTop: 8 },
  marqueeHeroDivider: { height: 1, backgroundColor: UI_TOKENS.colors.border, marginVertical: 14 },
  marqueeHeroTop: { flexDirection: "row", alignItems: "center" }, marqueeHeroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: UI_TOKENS.colors.primary, alignItems: "center", justifyContent: "center", marginRight: 10 }, marqueeHeroIconText: { color: UI_TOKENS.colors.accent, fontFamily: OWNER_FONT, fontSize: 21, fontWeight: "900" }, marqueeHeroEyebrow: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 1, marginBottom: 3 }, marqueeHeroTitle: { color: UI_TOKENS.colors.ink, fontSize: 14, fontWeight: "900" }, marqueeHeroCount: { minWidth: 49, borderRadius: 12, backgroundColor: UI_TOKENS.colors.surface, borderWidth: 1, borderColor: UI_TOKENS.colors.border, alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, marginLeft: 8 }, marqueeHeroCountValue: { color: UI_TOKENS.colors.primary, fontSize: 14, fontWeight: "900" }, marqueeHeroCountLabel: { color: UI_TOKENS.colors.muted, fontSize: 5, fontWeight: "900", letterSpacing: 0.5 },
  marqueeHeroSlots: { flexDirection: "row", gap: 8, marginTop: 13 }, marqueeHeroSlot: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: "row", alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: UI_TOKENS.colors.card, borderRadius: 11, paddingHorizontal: 9 }, marqueeHeroSlotFilled: { borderStyle: "solid", borderColor: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.primarySoft }, marqueeHeroSlotNumber: { width: 22, height: 22, borderRadius: 11, textAlign: "center", textAlignVertical: "center", color: UI_TOKENS.colors.accent, backgroundColor: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900", marginRight: 7 }, marqueeHeroSlotName: { flex: 1, color: UI_TOKENS.colors.subtle, fontSize: 8, fontWeight: "800" }, marqueeHeroSlotNameFilled: { color: UI_TOKENS.colors.primary, fontWeight: "900" }, marqueeHeroHelp: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 10 }, marqueeHeroDeadline: { color: UI_TOKENS.status.warning, fontSize: 8, fontWeight: "900", marginTop: 4 }, marqueeHeroSave: { minHeight: 44, borderRadius: 11, backgroundColor: UI_TOKENS.colors.primary, alignItems: "center", justifyContent: "center", marginTop: 11 }, marqueeHeroSaveDisabled: { backgroundColor: UI_TOKENS.colors.borderStrong }, marqueeHeroSaveText: { color: UI_TOKENS.colors.accent, fontSize: 10, fontWeight: "900" }, marqueeHeroLocked: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 10 },
  specialSelectionBanner: { backgroundColor: UI_TOKENS.colors.primarySoft, borderBottomWidth: 1, borderBottomColor: UI_TOKENS.colors.border, paddingHorizontal: 13, paddingVertical: 13 }, specialSelectionHeader: { flexDirection: "row", alignItems: "center" }, specialSelectionEyebrow: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 0.8, marginBottom: 4 }, specialSelectionTitle: { color: UI_TOKENS.colors.ink, fontSize: 13, fontWeight: "900" }, specialSelectionText: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 7 }, specialSelectionCount: { minWidth: 48, borderRadius: 11, backgroundColor: UI_TOKENS.colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 7, marginLeft: 10 }, specialSelectionCountValue: { color: UI_TOKENS.colors.accent, fontSize: 13, fontWeight: "900" }, specialSelectionCountLabel: { color: "#E4EEDC", fontSize: 5, fontWeight: "900", letterSpacing: 0.5, marginTop: 1 }, specialSelectionSlots: { flexDirection: "row", gap: 7, marginTop: 11 }, specialSelectionSlot: { flex: 1, minWidth: 0, borderWidth: 1, borderStyle: "dashed", borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: UI_TOKENS.colors.card, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 8 }, specialSelectionSlotFilled: { borderStyle: "solid", borderColor: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.surface }, specialSelectionSlotText: { color: UI_TOKENS.colors.subtle, fontSize: 8, fontWeight: "800" }, specialSelectionSlotTextFilled: { color: UI_TOKENS.colors.primary, fontWeight: "900" }, specialSelectionDeadline: { color: UI_TOKENS.status.warning, fontSize: 8, fontWeight: "900", marginTop: 9 }, specialSelectionHelp: { color: UI_TOKENS.colors.muted, fontSize: 7, lineHeight: 10, marginTop: 3 }, specialSelectionSave: { minHeight: 44, borderRadius: 9, backgroundColor: UI_TOKENS.colors.primary, alignItems: "center", justifyContent: "center", marginTop: 10 }, specialSelectionSaveDisabled: { backgroundColor: UI_TOKENS.colors.borderStrong }, specialSelectionSaveText: { color: UI_TOKENS.colors.accent, fontSize: 9, fontWeight: "900" }, specialSelectionInlineMessage: { color: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.surface, borderRadius: 7, fontSize: 8, lineHeight: 11, fontWeight: "800", paddingHorizontal: 9, paddingVertical: 7, marginTop: 8 }, specialSelectButton: { alignSelf: "flex-start", minHeight: 44, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: UI_TOKENS.colors.card, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, marginTop: 7, justifyContent: "center" }, specialSelectButtonChecked: { backgroundColor: UI_TOKENS.colors.primary, borderColor: UI_TOKENS.colors.primary }, specialSelectButtonDisabled: { opacity: 0.38 }, specialSelectButtonText: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900" }, specialSelectButtonTextChecked: { color: UI_TOKENS.colors.accent }, specialSelectionActions: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, backgroundColor: UI_TOKENS.colors.primarySoft }, specialSelectionMessage: { color: UI_TOKENS.colors.primary, backgroundColor: UI_TOKENS.colors.primarySoft, fontSize: 9, fontWeight: "800", paddingHorizontal: 12, paddingVertical: 9 },
  directoryHero: { position: "relative", overflow: "hidden", backgroundColor: "#071C3B", borderRadius: 22, padding: 17, marginBottom: 13, ...CARD_SHADOW },
  directoryHeroGlow: { position: "absolute", width: 230, height: 230, borderRadius: 115, right: -105, top: -135, backgroundColor: "rgba(76,198,155,0.17)" },
  directoryHeroHeading: { flexDirection: "row", alignItems: "center" },
  directoryHeroMark: { width: 44, height: 44, flexShrink: 0, borderRadius: 14, backgroundColor: UI_TOKENS.colors.accent, alignItems: "center", justifyContent: "center", marginRight: 11 },
  directoryHeroMarkText: { color: "#071C3B", fontSize: 21, lineHeight: 25, fontWeight: "900" },
  directoryHeroEyebrow: { color: "#AEBBD0", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  directoryHeroTitle: { color: "#FFFFFF", fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.3, marginTop: 2 },
  directoryHeroSubtitle: { color: "#C6D0DF", fontSize: 9, lineHeight: 13, marginTop: 3 },
  directoryHeroStats: { flexDirection: "row", gap: 7, marginTop: 14 },
  playerPoolSearchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  playerPoolSearchInput: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: UI_TOKENS.colors.card, borderRadius: 12, color: UI_TOKENS.colors.ink, fontSize: 11, fontWeight: "800", paddingHorizontal: 12 },
  playerPoolFilterToggle: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: UI_TOKENS.colors.surface, borderRadius: 12, paddingHorizontal: 11 },
  playerPoolFilterToggleActive: { backgroundColor: UI_TOKENS.colors.primary, borderColor: UI_TOKENS.colors.primary },
  playerPoolFilterToggleText: { color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900" },
  playerPoolFilterToggleTextActive: { color: UI_TOKENS.colors.accent },
  playerPoolFilterToggleIcon: { color: UI_TOKENS.colors.primary, fontSize: 8, fontWeight: "900", marginLeft: 6 },
  playerPoolExpandButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: UI_TOKENS.colors.surface, alignItems: "center", justifyContent: "center", marginTop: 10 },
  playerPoolExpandButtonText: { color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900" },
  squadHero: { backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.border, borderRadius: UI_TOKENS.radius.card, padding: 16, marginBottom: 14, ...CARD_SHADOW },
  squadTitleRow: { flexDirection: "row", alignItems: "flex-start" }, squadEyebrow: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 1.1 }, squadTitle: { color: "#18223B", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 4 }, squadSubtitle: { color: "#687384", fontSize: 10, lineHeight: 15, marginTop: 4, maxWidth: 480 }, squadToggle: { backgroundColor: "#EEF2EF", borderWidth: 1, borderColor: "#D7DFDB", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginLeft: 10 }, squadToggleText: { color: "#315047", fontSize: 8, fontWeight: "900" },
  squadOverview: { flexDirection: "row", alignItems: "center", backgroundColor: "#14273F", borderRadius: 15, paddingVertical: 12, marginTop: 14 }, squadOverviewItem: { flex: 1, alignItems: "center" }, squadOverviewValue: { color: "#DDFB72", fontSize: 16, fontWeight: "900" }, squadOverviewLabel: { color: "#C5CED8", fontSize: 8, fontWeight: "900", letterSpacing: 0.4, marginTop: 3 }, squadOverviewDivider: { width: 1, height: 27, backgroundColor: "#34465B" },
  squadTeamCard: { backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", marginBottom: 11, borderWidth: 1, borderColor: "#E0E6E2", shadowColor: "#0E2F25", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, squadTeamHeader: { minHeight: 68, borderLeftWidth: 6, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, paddingVertical: 9, backgroundColor: "#FFFFFF" }, squadTeamHeaderMain: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center" }, squadTeamCode: { width: 45, fontSize: 14, fontWeight: "900" }, squadTeamBadge: { minWidth: 48, height: 38, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, marginRight: 10 }, squadTeamBadgeText: { fontSize: 11, fontWeight: "900" }, squadTeamIdentity: { flex: 1, minWidth: 0 }, squadTeamName: { color: "#18223B", fontSize: 12, fontWeight: "900" }, squadTeamSummary: { color: "#5F6E68", fontSize: 9, lineHeight: 13, fontWeight: "800", marginTop: 3 }, squadTeamChevronBubble: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center", marginLeft: 7 }, squadTeamChevron: { color: "#465A52", fontSize: 10, fontWeight: "900" }, squadAddPlayerButton: { minWidth: 64, minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: "#C9D5CF", backgroundColor: "#F7F9F7", alignItems: "center", justifyContent: "center", marginLeft: 8, paddingHorizontal: 10 }, squadAddPlayerButtonText: { color: "#315047", fontSize: 9, fontWeight: "900" },
  squadAddInput: { minHeight: 44, backgroundColor: "white", borderWidth: 1, borderColor: "#D5DED9", borderRadius: 10, color: "#173028", fontSize: 12, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 8 }, squadAddRoles: { flexDirection: "row", gap: 5, marginBottom: 8 }, squadAddRole: { flex: 1, minHeight: 44, backgroundColor: "#E5ECE8", borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }, squadAddRoleActive: { backgroundColor: "#174D3D" }, squadAddRoleText: { color: "#465A52", fontSize: 9, fontWeight: "900" }, squadAddRoleTextActive: { color: "#DDFB72" }, squadAddLabel: { color: "#52645C", fontSize: 9, fontWeight: "900", marginBottom: 6 },
  squadPlayerRow: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: "#E8EDE9" }, squadPlayerMain: { flex: 1, minHeight: 40, flexDirection: "row", alignItems: "center", paddingRight: 8 }, squadPlayerNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }, squadPlayerName: { color: "#173028", fontSize: 13, fontWeight: "900" }, squadSelectionCost: { color: "#655B25", backgroundColor: "#F5EFD2", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontWeight: "900" }, squadPlayerOwnerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 4 }, squadPlayerOwner: { color: "#72827B", fontSize: 8, fontWeight: "700" }, squadInactiveLabel: { color: "#8E3D35", backgroundColor: "#FBE9E5", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontWeight: "900" },
  squadScoreBlock: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }, squadRoyaltyPoints: { color: "#704091", fontSize: 7, fontWeight: "900" }, playerPoolRoyaltyBlock: { alignItems: "flex-end" }, playerPoolRoyaltyValue: { color: "#704091", fontSize: 9, lineHeight: 11, fontWeight: "900", fontVariant: ["tabular-nums"] }, playerPoolRoyaltyLabel: { color: "#704091", fontSize: 5, fontWeight: "900", letterSpacing: 0.45 }, playerPoolFantasyBlock: { alignItems: "flex-end", minWidth: 46 }, squadPlayerPoints: { color: "#174D3D", fontSize: 11, lineHeight: 13, fontWeight: "900", fontVariant: ["tabular-nums"] }, playerPoolFantasyLabel: { color: UI_TOKENS.colors.muted, fontSize: 5, fontWeight: "900", letterSpacing: 0.35 }, squadPointsPending: { color: "#8A9691", fontSize: 11, textAlign: "right", fontWeight: "800", marginLeft: 9 }, squadPlayerChevron: { color: "#61756D", fontSize: 9, fontWeight: "900", marginLeft: 7 }, squadPointsBreakdown: { backgroundColor: "#F0F4F1", paddingHorizontal: 28, paddingVertical: 8 }, squadPointsWarning: { backgroundColor: "#FFF0EC", borderRadius: 10, padding: 10, marginBottom: 10 }, squadPointsWarningText: { color: "#7A4036", fontSize: 9, fontWeight: "700" },
  playerPoolMobileRow: { minHeight: 0, flexDirection: "column", alignItems: "stretch", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  playerPoolMobileMain: { width: "100%", minHeight: 82, flexDirection: "row", alignItems: "center", paddingRight: 0 },
  playerPoolMobileIdentity: { flex: 1, minWidth: 0, paddingRight: 8 },
  playerPoolMobileNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  playerPoolMobileName: { flexShrink: 1, minWidth: 100, fontSize: 12, lineHeight: 16 },
  playerPoolMobileMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 7 },
  playerPoolMobileRole: { fontSize: 8, paddingHorizontal: 6, paddingVertical: 3 },
  playerPoolMobileBid: { color: UI_TOKENS.colors.muted, fontSize: 8, fontWeight: "700", marginTop: 6 },
  playerPoolMobileScoreBlock: { width: 104, flexShrink: 0, justifyContent: "flex-end", gap: 9, marginLeft: 0 },
  playerPoolMobileChevron: { width: 28, minHeight: 44, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  playerPoolMobileEditButton: { width: "100%", minHeight: 44, borderRadius: 9 },
  playerEditModalOverlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(2, 16, 13, 0.72)", padding: 16 },
  playerEditModalCard: { width: "100%", maxWidth: 620, maxHeight: "88%", backgroundColor: UI_TOKENS.colors.card, borderRadius: 18, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, overflow: "hidden", ...CARD_SHADOW },
  playerEditModalCardCompact: { maxHeight: "92%", borderRadius: 15 },
  playerEditModalHeader: { minHeight: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#071C3B", paddingHorizontal: 16, paddingVertical: 12 },
  playerEditModalHeaderIdentity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 10 },
  playerEditModalEyebrow: { color: "#AAB9CE", fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  playerEditModalTitle: { color: "#FFFFFF", fontSize: 16, lineHeight: 20, fontWeight: "900", marginTop: 2 },
  playerAddModalTeam: { color: "#C7D2E1", fontSize: 7, lineHeight: 10, fontWeight: "800", marginTop: 2 },
  playerEditModalClose: { width: 44, height: 44, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  playerEditModalCloseText: { color: "#FFFFFF", fontSize: 24, lineHeight: 25, fontWeight: "500" },
  playerEditModalBody: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  playerAddNotice: { flexDirection: "row", alignItems: "center", backgroundColor: UI_TOKENS.colors.primarySoft, borderWidth: 1, borderColor: "#C9DDD3", borderRadius: 11, padding: 10, marginBottom: 13 },
  playerAddNoticeIcon: { width: 32, height: 32, lineHeight: 31, borderRadius: 10, overflow: "hidden", backgroundColor: UI_TOKENS.colors.primary, color: UI_TOKENS.colors.accent, fontSize: 17, fontWeight: "900", textAlign: "center", marginRight: 9 },
  playerAddNoticeTitle: { color: UI_TOKENS.colors.ink, fontSize: 9, fontWeight: "900" },
  playerAddNoticeText: { color: UI_TOKENS.colors.muted, fontSize: 7, lineHeight: 10, marginTop: 2 },
  playerEditOwnerSelect: { position: "relative", marginBottom: 10 },
  playerEditOwnerTrigger: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: "#C8D4CE", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6 },
  playerEditOwnerTriggerOpen: { borderColor: UI_TOKENS.colors.primary, borderWidth: 1.5 },
  playerEditOwnerTriggerIdentity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  playerEditOwnerTriggerHint: { color: UI_TOKENS.colors.muted, fontSize: 7, fontWeight: "800" },
  playerEditOwnerChevron: { color: UI_TOKENS.colors.primary, fontSize: 18, lineHeight: 20, fontWeight: "900", marginLeft: 10, marginTop: -5 },
  playerEditOwnerPickerOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2, 16, 13, 0.62)" },
  playerEditOwnerPickerOverlayWide: { alignItems: "center", justifyContent: "center", padding: 24 },
  playerEditOwnerPickerSheet: { width: "100%", maxHeight: "72%", backgroundColor: UI_TOKENS.colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden", ...CARD_SHADOW },
  playerEditOwnerPickerSheetWide: { maxWidth: 460, maxHeight: "76%", borderRadius: 18 },
  playerEditOwnerPickerHeader: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 18, paddingTop: 17, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: UI_TOKENS.colors.border },
  playerEditOwnerPickerEyebrow: { color: UI_TOKENS.colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  playerEditOwnerPickerTitle: { color: UI_TOKENS.colors.ink, fontSize: 17, lineHeight: 21, fontWeight: "900", marginTop: 2 },
  playerEditOwnerPickerSubtitle: { color: UI_TOKENS.colors.muted, fontSize: 8, lineHeight: 12, marginTop: 3, paddingRight: 8 },
  playerEditOwnerPickerClose: { width: 44, height: 44, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: UI_TOKENS.colors.surface, borderWidth: 1, borderColor: UI_TOKENS.colors.border },
  playerEditOwnerPickerCloseText: { color: UI_TOKENS.colors.primary, fontSize: 23, lineHeight: 24, fontWeight: "500" },
  playerEditOwnerPickerList: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 18 },
  playerEditOwnerPickerOption: { minHeight: 58, flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 3 },
  playerEditOwnerPickerOptionSelected: { backgroundColor: UI_TOKENS.colors.primarySoft },
  playerEditOwnerPickerAvatar: { width: 38, height: 38, flexShrink: 0, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", marginRight: 10 },
  playerEditOwnerPickerAvatarText: { fontSize: 13, fontWeight: "900" },
  playerEditOwnerPickerName: { color: UI_TOKENS.colors.ink, fontSize: 11, lineHeight: 14, fontWeight: "900" },
  playerEditOwnerPickerDescription: { color: UI_TOKENS.colors.muted, fontSize: 7, lineHeight: 10, marginTop: 2 },
  playerEditOwnerPickerRadio: { width: 21, height: 21, flexShrink: 0, borderRadius: 11, borderWidth: 1.5, borderColor: UI_TOKENS.colors.borderStrong, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  playerEditOwnerPickerRadioSelected: { borderColor: UI_TOKENS.colors.primary },
  playerEditOwnerPickerRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: UI_TOKENS.colors.primary },
  playerEditReadOnly: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52, backgroundColor: "#F5EFD2", borderWidth: 1, borderColor: "#E8DDA8", borderRadius: 10, paddingHorizontal: 12, marginTop: 2, marginBottom: 9 },
  playerEditReadOnlyLabel: { color: "#756523", fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  playerEditReadOnlyValue: { color: "#56470D", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  playerEditModalError: { backgroundColor: UI_TOKENS.status.dangerWash, borderWidth: 1, borderColor: "#E3B4AE", borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, marginTop: 2 },
  playerEditModalErrorText: { color: UI_TOKENS.status.danger, fontSize: 9, lineHeight: 13, fontWeight: "800" },
  playerEditModalFooter: { minHeight: 68, flexDirection: "row", gap: 8, backgroundColor: "#F2F6F3", borderTopWidth: 1, borderTopColor: UI_TOKENS.colors.border, padding: 12 },
  playerEditModalCancel: { minWidth: 100, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, backgroundColor: UI_TOKENS.colors.card, borderRadius: 10, paddingHorizontal: 14 },
  playerEditModalCancelText: { color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900" },
  playerEditModalSave: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: UI_TOKENS.colors.accent, borderRadius: 10, paddingHorizontal: 14 },
  playerEditModalSaveText: { color: "#10251F", fontSize: 9, fontWeight: "900" },
  playerEditModalSaveDisabled: { backgroundColor: "#DCE4DF" },
  playerEditModalSaveTextDisabled: { color: "#718079" },
  discardPromptOverlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(2, 16, 13, 0.76)", padding: 20 },
  discardPromptCard: { width: "100%", maxWidth: 390, alignItems: "center", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: "#E0B9B2", borderRadius: 18, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, ...CARD_SHADOW },
  discardPromptIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: UI_TOKENS.status.dangerWash, borderRadius: 14 },
  discardPromptIconText: { color: UI_TOKENS.status.danger, fontSize: 23, lineHeight: 25, fontWeight: "900" },
  discardPromptTitle: { color: UI_TOKENS.colors.ink, fontSize: 17, lineHeight: 22, fontWeight: "900", textAlign: "center", marginTop: 13 },
  discardPromptMessage: { color: UI_TOKENS.colors.muted, fontSize: 9, lineHeight: 14, textAlign: "center", marginTop: 6 },
  discardPromptActions: { width: "100%", flexDirection: "row", gap: 8, marginTop: 20 },
  discardPromptKeep: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: UI_TOKENS.colors.card, borderWidth: 1, borderColor: UI_TOKENS.colors.borderStrong, borderRadius: 11, paddingHorizontal: 12 },
  discardPromptKeepText: { color: UI_TOKENS.colors.primary, fontSize: 9, fontWeight: "900" },
  discardPromptDiscard: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: UI_TOKENS.status.danger, borderRadius: 11, paddingHorizontal: 12 },
  discardPromptDiscardText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  squadPlayerRowInactive: { backgroundColor: "#F0F1EF", opacity: 0.75 }, squadPlayerNameInactive: { color: "#7F8985", textDecorationLine: "line-through" }, squadEditButton: { minWidth: 50, minHeight: 28, borderRadius: 7, borderWidth: 1, borderColor: "#A9BBB3", backgroundColor: "#F5F8F6", alignItems: "center", justifyContent: "center", paddingHorizontal: 7 }, squadEditButtonText: { color: "#315047", fontSize: 8, fontWeight: "900" }, squadEditAvailability: { flexDirection: "row", gap: 7, marginBottom: 9 }, squadEditStatus: { flex: 1, minHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: "#CBD6D0", alignItems: "center", justifyContent: "center" }, squadEditStatusActive: { backgroundColor: "#EAF6E5", borderColor: "#9FC694" }, squadEditStatusInactive: { backgroundColor: "#FFF0EC", borderColor: "#E0AFA4" }, squadEditStatusText: { color: "#65766F", fontSize: 8, fontWeight: "900" }, squadEditStatusTextActive: { color: "#285F39" }, squadEditStatusTextInactive: { color: "#7A4036" }, squadEditBidNote: { color: "#7A6A31", fontSize: 8, fontWeight: "800", marginBottom: 9 }, squadAvailabilityMessage: { backgroundColor: "#EAF6E5", borderRadius: 10, padding: 10, marginBottom: 10 }, squadAvailabilityMessageText: { color: "#285F39", fontSize: 9, fontWeight: "800" },
  ownerBlock: { borderTopWidth: 1, borderTopColor: "#DCE4DF" }, ownerNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 }, ownerName: { color: "#10251F", fontFamily: OWNER_FONT, fontSize: 15, fontWeight: "700", letterSpacing: 0.25 }, historyBoosterBadge: { backgroundColor: "#6D44C5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }, historyBoosterBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }, ownerMeta: { color: "#5F6E68", fontSize: 10, lineHeight: 14, marginTop: 4 }, transferSummary: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }, transferUsed: { color: "#254D42", backgroundColor: "#E4F0EB", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: "800" }, transferBalance: { color: "#5D4E13", backgroundColor: "#F5EFD2", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: "900" }, historyPlayer: { flexDirection: "row", alignItems: "center", minHeight: 62, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FAFBF8", borderTopWidth: 1, borderTopColor: "#E4EAE6" }, playerName: { color: "#173028", fontSize: 13, lineHeight: 18, fontWeight: "800" }, playerMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }, teamBadge: { overflow: "hidden", borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: "900" }, roleText: { color: "#465A52", backgroundColor: "#E7EEE9", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 9, fontWeight: "700" }, ownershipText: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, fontSize: 9, fontWeight: "800" }, ownershipMine: { color: "#285F39", backgroundColor: "#DFF0DD" }, ownershipOpen: { color: "#465A52", backgroundColor: "#E7ECE9" }, ownershipOther: { color: "#74463D", backgroundColor: "#F8E6E1" }, baseText: { color: "#65746E", fontSize: 10, fontWeight: "600" }, playerValue: { color: "#174D3D", fontSize: 13, fontWeight: "900", marginHorizontal: 8 }, marker: { color: "#173028", backgroundColor: "#DDFB72", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: "900" }, playerBreakdown: { backgroundColor: "#F0F4F1", paddingHorizontal: 34, paddingVertical: 8 }, breakdownLine: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#E1E7E3" }, breakdownLabel: { flex: 1, color: "#53675F", fontSize: 10 }, breakdownValue: { color: "#334C43", fontSize: 10 }, breakdownStrong: { color: "#173028", fontWeight: "900" }, breakdownNegative: { color: UI_TOKENS.status.danger },
}));
