import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, ImageBackground, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { Player, Role, squadPlayers as players } from "./squadData";
import { completedMatchPoints, completedMatchStats } from "./completedMatchPoints";
import { calculatePlayerPoints, calculatePointDetails, defaultScoringRules, ScoringRulesDocument } from "./scoringRules";
import { iplFixtures } from "./iplFixtures";
import { ipl2026Members } from "./leagueMembers";
import { supabase } from "./supabase";
import { IplTeamBadge, OwnerBadge, SpecialPlayerBadge, ProductionDashboard, ProductionHistory, ProductionMatches, ProductionPlayerSquad, ProductionRanking, ProductionSquads, teamBadge } from "./SupabaseScreens";
import { userActionError } from "./errorMessages";

type Tab = "Home" | "Auction" | "Team" | "Matches" | "Ranking" | "PlayerSquad" | "Squads" | "History" | "Admin";
type ImpactType = "BAI" | "BOI" | "";
type BoosterCode = "3X" | "2UP" | "SUP-TR" | "";
type PlayerRoleFilter = "ALL" | Role;
type PlayerOwnershipFilter = "ALL" | "MINE" | "OPEN" | "OTHER";
type PlayerSort = "NAME" | "COST" | "POINTS";
type MembershipStatus = "invited" | "accepted" | "declined" | "active" | "suspended" | "withdrawn" | "disabled";
type DatabaseMembership = {
  id: string;
  league_id: string;
  display_name: string;
  email: string;
  role: "league_admin" | "owner" | "viewer";
  status: MembershipStatus;
  league: { id: string; slug: string; name: string; competition: string; season_year: number; status: "setup" | "active" | "completed" | "archived"; timezone: string };
};
type SelectionRules = { version: number; effective_from_match_number: number; lineup_size: number; lineup_budget: number; min_batters: number; min_bowlers: number; min_wicketkeepers: number; min_all_rounders: number; max_from_one_team: number; captain_multiplier: number; vice_captain_multiplier: number };

const standardTabs: Tab[] = ["Ranking", "Team", "Matches", "PlayerSquad", "Squads", "History", "Admin"];
const tabLabels: Partial<Record<Tab, string>> = { Team: "League", Matches: "Fixtures", Ranking: "Ranking", PlayerSquad: "Squad", Squads: "Owner", Admin: "Rules" };
const IPL_2026_DATABASE_ID = "10000000-0000-4000-8000-000000002026";
const OWNER_FONT = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const useActionGuard = () => {
  const locked = useRef(false);
  return async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    try { await action(); } finally { locked.current = false; }
  };
};
const UI = {
  canvas: "#E9EEEA",
  surface: "#F7F8F4",
  card: "#FFFFFF",
  ink: "#102A22",
  muted: "#6C7C75",
  border: "#DCE4DF",
  primary: "#0B493A",
  primaryDeep: "#061F19",
  accent: "#D8FF63",
};
const LEAGUE_BADGE_COLORS = [
  { primary: "#5B2AA8", dark: "#26104D", accent: "#F5C84B" },
  { primary: "#C93648", dark: "#5E1221", accent: "#FFD166" },
  { primary: "#087F8C", dark: "#063F46", accent: "#7EF0D2" },
  { primary: "#D56B16", dark: "#6B2E06", accent: "#FFE08A" },
  { primary: "#1769AA", dark: "#082F57", accent: "#78D5FF" },
  { primary: "#9A3565", dark: "#49152F", accent: "#FF9BCB" },
  { primary: "#358447", dark: "#153E22", accent: "#B9ED72" },
  { primary: "#75631B", dark: "#3B310A", accent: "#F2DA61" },
];
const leagueBadge = (league: DatabaseMembership["league"]) => {
  const year = String(league.season_year).slice(-2);
  const identity = `${league.slug}:${league.season_year}`;
  const colorIndex = [...identity].reduce((sum, character) => sum + character.charCodeAt(0), 0) % LEAGUE_BADGE_COLORS.length;
  const source = `${league.name} ${league.competition}`;
  const competitionCode = /world\s*cup/i.test(source) ? "WC" : /\bipl\b/i.test(source) ? "IPL" : league.competition.split(/\s+/).filter(Boolean).map(word => word[0]).join("").slice(0, 3).toUpperCase();
  return { competitionCode, year, ...LEAGUE_BADGE_COLORS[colorIndex] };
};
const leagueFormatNote = (league: DatabaseMembership["league"]) => {
  const identity = `${league.slug} ${league.name}`.toLowerCase();
  if (identity.includes("open")) return "All IPL players are open to everyone; no auction ownership.";
  if (identity.includes("unique")) return "Owned squads with phase Unique Players and borrowing penalties.";
  if (identity.includes("royalty")) return "Owned squads earn royalty when other owners use their players.";
  return "";
};

function LeagueEmblem({ league }: { league: DatabaseMembership["league"] }) {
  const badge = leagueBadge(league);
  return <View style={[s.leagueEmblemShadow, { shadowColor: badge.dark }]}>
    <View style={[s.leagueEmblem, { backgroundColor: badge.dark, borderColor: badge.accent }]}>
      <View style={[s.leagueEmblemStripe, { backgroundColor: badge.primary }]} />
      <View style={[s.leagueEmblemGlow, { backgroundColor: badge.accent }]} />
      <View style={s.leagueBall}>
        <View style={s.leagueBallSeam} />
        <View style={[s.leagueBallStitch, s.leagueBallStitchOne]} />
        <View style={[s.leagueBallStitch, s.leagueBallStitchTwo]} />
      </View>
      <Text style={[s.leagueEmblemCode, { color: badge.accent }]}>{badge.competitionCode}</Text>
      <View style={[s.leagueEmblemYearRibbon, { backgroundColor: badge.accent }]}>
        <Text style={[s.leagueEmblemYear, { color: badge.dark }]}>{badge.year}</Text>
      </View>
    </View>
  </View>;
}

function CricketTabIcon({ item, active }: { item: Tab; active: boolean }) {
  const identity: Record<Tab, { glyph: string; color: string; tint: string }> = {
    Home: { glyph: "⌂", color: "#1F2937", tint: "#EEF1F5" },
    Ranking: { glyph: "♛", color: "#6D44C5", tint: "#F0EAFE" },
    Team: { glyph: "XI", color: "#E26836", tint: "#FFF0E8" },
    Matches: { glyph: "▦", color: "#2878D0", tint: "#E8F3FF" },
    PlayerSquad: { glyph: "◈", color: "#D64275", tint: "#FDEAF1" },
    Squads: { glyph: "♟", color: "#138B83", tint: "#E6F7F5" },
    History: { glyph: "↺", color: "#B57A17", tint: "#FFF4DA" },
    Admin: { glyph: "☷", color: "#536171", tint: "#EDF1F5" },
    Auction: { glyph: "◆", color: "#8A4BBD", tint: "#F4EAFE" },
  };
  const icon = identity[item];
  return <View style={[s.navIconShell, { backgroundColor: active ? icon.color : icon.tint }, active && s.navIconShellActive]}>
    <Text style={[s.navIconGlyph, { color: active ? "#FFFFFF" : icon.color }, item === "Team" && s.navIconGlyphSmall]}>{icon.glyph}</Text>
    {item === "Matches" ? <View style={[s.navIconCalendarTop, { backgroundColor: active ? "#FFFFFF" : icon.color }]} /> : null}
  </View>;
}

function tabAccent(item: Tab) {
  return ({ Ranking: "#6D44C5", Team: "#E26836", Matches: "#2878D0", PlayerSquad: "#D64275", Squads: "#138B83", History: "#B57A17", Admin: "#536171" } as Partial<Record<Tab, string>>)[item] ?? "#536171";
}

function HomeIcon() {
  return <View style={s.homeIcon}>
    <View style={s.homeIconRoof} />
    <View style={s.homeIconBody}>
      <View style={s.homeIconDoor} />
    </View>
  </View>;
}
const defaultSelectionRules: SelectionRules = { version: 1, effective_from_match_number: 1, lineup_size: 11, lineup_budget: 100, min_batters: 2, min_bowlers: 2, min_wicketkeepers: 1, min_all_rounders: 1, max_from_one_team: 7, captain_multiplier: 2, vice_captain_multiplier: 1.5 };
const allTeams = ["CSK", "DC", "GT", "KKR", "LSG", "MI", "PBKS", "RCB", "RR", "SRH"];
const upcomingMatches = [
  { id: "M6", home: "KKR", away: "SRH", day: "Apr 2", time: "7:30 PM" },
  { id: "M7", home: "CSK", away: "PBKS", day: "Apr 3", time: "7:30 PM" },
  { id: "M8", home: "DC", away: "MI", day: "Apr 4", time: "3:30 PM" },
  { id: "M9", home: "GT", away: "RR", day: "Apr 4", time: "7:30 PM" },
  { id: "M10", home: "SRH", away: "LSG", day: "Apr 5", time: "3:30 PM" },
  { id: "M11", home: "RCB", away: "CSK", day: "Apr 5", time: "7:30 PM" },
  { id: "M12", home: "KKR", away: "PBKS", day: "Apr 6", time: "7:30 PM" },
];
type UpcomingMatch = typeof upcomingMatches[number] & { databaseId?: string; stage?: "league" | "playoff" | "final"; lineupLockAt?: string };
const leagueOwners = ipl2026Members.filter(member => member.status === "active" && member.role !== "viewer").map(member => member.name);
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!authReady) return <AuthLoading />;
  if (!session) return <LoginScreen />;
  return <MembershipGate session={session} />;
}

function MembershipGate({ session }: { session: Session }) {
  const [memberships, setMemberships] = useState<DatabaseMembership[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const loadMemberships = async () => {
    setBusy(true); setMessage("");
    const { data, error } = await supabase.from("league_members")
      .select("id,league_id,display_name,email,role,status,league:leagues(id,slug,name,competition,season_year,status,timezone)")
      .eq("user_id", session.user.id).order("created_at");
    if (error) setMessage(userActionError(error, "League list refresh"));
    else {
      const availableMemberships = ((data ?? []) as unknown as DatabaseMembership[])
        .filter(membership => membership.league.status !== "archived");
      setMemberships(availableMemberships);
    }
    setBusy(false);
  };
  useEffect(() => { loadMemberships(); }, [session.user.id]);
  if (busy) return <AuthLoading />;
  if (message) return <AccessDenied email={session.user.email ?? ""} detail={message} />;
  if (!memberships.length) return <AccessDenied email={session.user.email ?? ""} />;
  return <FantasyApp session={session} memberships={memberships} refreshMemberships={loadMemberships} />;
}

function FantasyApp({ session, memberships, refreshMemberships }: { session: Session; memberships: DatabaseMembership[]; refreshMemberships: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("Home");
  const [showNavigationMenu, setShowNavigationMenu] = useState(false);
  const [activeLeagueId, setActiveLeagueId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [captain, setCaptain] = useState("");
  const [vice, setVice] = useState("");
  const [lineupSubmitted, setLineupSubmitted] = useState(false);
  const [impactPlayer, setImpactPlayer] = useState("");
  const [impactType, setImpactType] = useState<ImpactType>("");
  const [boosterCode, setBoosterCode] = useState<BoosterCode>("");
  const [boosterPlayer, setBoosterPlayer] = useState("");
  const [selectionRuleVersions, setSelectionRuleVersions] = useState<SelectionRules[]>([defaultSelectionRules]);
  const [rulesLoadMessage, setRulesLoadMessage] = useState("");
  const [teamFixtures, setTeamFixtures] = useState<UpcomingMatch[]>([]);
  const [leagueRoster, setLeagueRoster] = useState<Player[]>([]);
  const [rosterRefreshVersion, setRosterRefreshVersion] = useState(0);
  const [ownershipEnabled, setOwnershipEnabled] = useState<boolean | null>(null);
  const [requestedTeamFixtureId, setRequestedTeamFixtureId] = useState("");
  const [requestedHistoryFixtureId, setRequestedHistoryFixtureId] = useState("");
  const activeMembership = memberships.find(item => item.league_id === activeLeagueId && item.status === "active");
  const activeLeague = activeMembership?.league;
  const memberName = activeMembership?.display_name ?? memberships.find(item => item.status === "active")?.display_name ?? memberships[0]?.display_name ?? session.user.email?.split("@")[0] ?? "Owner";
  const leagueDatabaseId = activeLeague?.id ?? "";
  const tabs = ownershipEnabled === false ? standardTabs.filter(item => item !== "Squads") : standardTabs;
  const resetLineupState = () => {
    setSelected([]); setCaptain(""); setVice(""); setLineupSubmitted(false);
    setImpactPlayer(""); setImpactType(""); setBoosterCode(""); setBoosterPlayer("");
  };
  const selectLeague = (leagueId: string) => { resetLineupState(); setRequestedTeamFixtureId(""); setOwnershipEnabled(null); setActiveLeagueId(leagueId); setTab("Team"); };
  useEffect(() => {
    if (!leagueDatabaseId) return;
    let cancelled = false;
    setOwnershipEnabled(null);
    supabase.from("league_format_configs").select("ownership_enabled").eq("league_id", leagueDatabaseId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { setOwnershipEnabled(true); return; }
      setOwnershipEnabled(data.ownership_enabled !== false);
    });
    return () => { cancelled = true; };
  }, [leagueDatabaseId]);
  useEffect(() => {
    if (ownershipEnabled === false && tab === "Squads") setTab("Ranking");
  }, [ownershipEnabled, tab]);
  useEffect(() => {
    if (!leagueDatabaseId) return;
    let cancelled = false;
    setTeamFixtures([]);
    const loadOpenFixtures = () => {
      const now = new Date().toISOString();
      supabase.from("fixtures").select("id,match_number,stage,scheduled_start,lineup_lock_at,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code)").eq("league_id", leagueDatabaseId).eq("status", "scheduled").gt("lineup_lock_at", now).order("match_number").limit(7).then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.length) { setTeamFixtures([]); return; }
        setTeamFixtures((data as any[]).map(row => { const start = new Date(row.scheduled_start); return { id: `M${row.match_number}`, databaseId: row.id, stage: row.stage, lineupLockAt: row.lineup_lock_at, home: row.home?.code ?? "TBD", away: row.away?.code ?? "TBD", day: start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" }), time: start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) }; }));
      });
    };
    loadOpenFixtures();
    const refreshTimer = setInterval(loadOpenFixtures, 30_000);
    return () => { cancelled = true; clearInterval(refreshTimer); };
  }, [leagueDatabaseId]);
  useEffect(() => {
    if (!leagueDatabaseId) return;
    let cancelled = false;
    setLeagueRoster([]);
    supabase.from("league_players").select("acquisition_price,bid_price,owner:league_members(display_name),player:players(full_name,role,team:cricket_teams(code))").eq("league_id", leagueDatabaseId).eq("active", true).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.length) { setLeagueRoster([]); return; }
      setLeagueRoster((data as any[]).map(row => ({ name: row.player.full_name, team: row.player.team?.code ?? "—", role: row.player.role as Role, price: Number(row.acquisition_price), bidPrice: row.bid_price == null ? null : Number(row.bid_price), owner: row.owner?.display_name ?? "Available" })).sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name)));
    });
    return () => { cancelled = true; };
  }, [leagueDatabaseId, rosterRefreshVersion]);
  useEffect(() => {
    if (tab !== "Team" || !leagueDatabaseId) return;
    setRulesLoadMessage("");
    supabase.from("lineup_rule_sets").select("version,effective_from_match_number,lineup_size,lineup_budget,min_batters,min_bowlers,min_wicketkeepers,min_all_rounders,max_from_one_team,captain_multiplier,vice_captain_multiplier").eq("league_id", leagueDatabaseId).order("effective_from_match_number").then(({ data, error }) => {
      if (error) setRulesLoadMessage(userActionError(error, "Playing rules refresh"));
      else if (data?.length) setSelectionRuleVersions(data as SelectionRules[]);
    });
  }, [tab, leagueDatabaseId]);
  const leagueContent = tab === "Home" || !activeLeague ? <LeaguePicker memberships={memberships} activeLeagueId={activeLeagueId} onSelect={selectLeague} onChanged={refreshMemberships} /> : tab === "Team" ? <TeamSelection key={leagueDatabaseId} requestedFixtureId={requestedTeamFixtureId} leagueId={leagueDatabaseId} memberId={activeMembership.id} ownershipEnabled={ownershipEnabled !== false} ownerName={memberName} roster={leagueRoster} fixtures={teamFixtures} ruleVersions={selectionRuleVersions} rulesLoadMessage={rulesLoadMessage} selected={selected} setSelected={setSelected} captain={captain} setCaptain={setCaptain} vice={vice} setVice={setVice} submitted={lineupSubmitted} setSubmitted={setLineupSubmitted} impactPlayer={impactPlayer} setImpactPlayer={setImpactPlayer} impactType={impactType} setImpactType={setImpactType} boosterCode={boosterCode} setBoosterCode={setBoosterCode} boosterPlayer={boosterPlayer} setBoosterPlayer={setBoosterPlayer} /> : tab === "Matches" ? <ProductionMatches leagueId={leagueDatabaseId} memberId={activeMembership.id} roster={leagueRoster} availableFixtureIds={teamFixtures.map(match => match.databaseId)} openTeam={(fixtureId) => { setRequestedTeamFixtureId(fixtureId); setTab("Team"); }} openHistory={(fixtureId) => { setRequestedHistoryFixtureId(fixtureId); setTab("History"); }} /> : tab === "History" ? <ProductionHistory leagueId={leagueDatabaseId} currentOwner={memberName} requestedFixtureId={requestedHistoryFixtureId} /> : tab === "Admin" ? <LeagueAdminScreen leagueId={leagueDatabaseId} leagueName={activeLeague.name} canEdit={activeMembership.role === "league_admin"} onLeaguesChanged={refreshMemberships} /> : tab === "Ranking" ? <ScrollView contentContainerStyle={s.content}><ProductionRanking leagueId={leagueDatabaseId} currentOwner={memberName} /></ScrollView> : tab === "PlayerSquad" ? <ScrollView contentContainerStyle={s.content}><ProductionPlayerSquad leagueId={leagueDatabaseId} canEdit={activeMembership.role === "league_admin"} onAvailabilityChanged={() => setRosterRefreshVersion(version => version + 1)} /></ScrollView> : tab === "Squads" ? <ScrollView contentContainerStyle={s.content}><OwnerTabContent leagueId={leagueDatabaseId} currentOwner={memberName} roster={leagueRoster} /></ScrollView> : <ScrollView contentContainerStyle={s.content}><ProductionDashboard leagueId={leagueDatabaseId} leagueName={activeLeague.name} memberName={memberName} openTeam={() => setTab("Team")} /></ScrollView>;
  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="light-content" />
    <View style={s.appShell}>
      <View style={[s.header, s.headerModern]}><View pointerEvents="none" style={[s.headerAccent, { backgroundColor: activeLeague ? tabAccent(tab) : "#6D44C5" }]} /><TouchableOpacity accessibilityRole="button" accessibilityLabel="Home" style={[s.logo, s.logoModern, tab === "Home" && s.logoHomeActive]} onPress={() => setTab("Home")}><HomeIcon /></TouchableOpacity><View style={s.headerIdentity}><Text style={[s.eyebrow, s.eyebrowModern]}>{activeLeague ? activeLeague.competition.toUpperCase() : "PRIVATE FANTASY"}</Text><Text style={[s.brand, s.brandModern]} numberOfLines={1}>{activeLeague?.name ?? "Cricket Fantasy"}</Text><View style={s.headerMetaRow}><Text style={[s.signedInAs, s.signedInAsModern]} numberOfLines={1}>{memberName}</Text>{activeLeague && tab !== "Home" ? <View style={[s.headerPageChip, { backgroundColor: `${tabAccent(tab)}28` }]}><Text style={[s.headerPageChipText, { color: tabAccent(tab) }]}>{tabLabels[tab] ?? tab}</Text></View> : null}</View></View><View style={s.headerActions}>{activeLeague?.status === "active" && tab !== "Home" ? <View style={s.livePill}><View style={s.liveDot} /><Text style={s.live}>Live</Text></View> : null}{activeLeague && tab !== "Home" ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open navigation menu" style={s.navigationMenuButton} onPress={() => setShowNavigationMenu(true)}><Text style={s.navigationMenuButtonIcon}>☰</Text><Text style={s.navigationMenuButtonText}>Menu</Text></TouchableOpacity> : <TouchableOpacity accessibilityRole="button" style={[s.signOutButton, s.signOutButtonModern]} onPress={() => supabase.auth.signOut()}><Text style={[s.signOutText, s.signOutTextModern]}>Sign out</Text></TouchableOpacity>}</View></View>
      {leagueContent}
      <Modal visible={showNavigationMenu} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowNavigationMenu(false)}>
        <TouchableOpacity activeOpacity={1} style={s.navigationMenuOverlay} onPress={() => setShowNavigationMenu(false)}>
          <View style={s.navigationMenuCard} onStartShouldSetResponder={() => true}>
            <View style={s.navigationMenuHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.navigationMenuEyebrow}>LEAGUE MENU</Text>
                <Text style={s.navigationMenuLeague} numberOfLines={2}>{activeLeague?.name}</Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close menu" style={s.navigationMenuClose} onPress={() => setShowNavigationMenu(false)}>
                <Text style={s.navigationMenuCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={s.navigationMenuScroll}>
              {tabs.map(item => {
                const active = tab === item;
                const accent = tabAccent(item);
                const menuLabel = item === "Team" ? "Select XI" : tabLabels[item] ?? item;
                return <TouchableOpacity key={item} style={[s.navigationMenuItem, active && { backgroundColor: `${accent}18`, borderColor: `${accent}55` }]} onPress={() => { setTab(item); setShowNavigationMenu(false); }}>
                  <CricketTabIcon item={item} active={active} />
                  <Text style={[s.navigationMenuItemText, active && { color: accent, fontWeight: "900" }]}>{menuLabel}</Text>
                  {active ? <View style={[s.navigationMenuCheck, { backgroundColor: accent }]}><Text style={s.navigationMenuCheckText}>✓</Text></View> : <Text style={s.navigationMenuArrow}>›</Text>}
                </TouchableOpacity>;
              })}
              <View style={s.navigationMenuDivider} />
              <TouchableOpacity style={s.navigationMenuHome} onPress={() => { setTab("Home"); setShowNavigationMenu(false); }}><Text style={s.navigationMenuHomeIcon}>⌂</Text><Text style={s.navigationMenuHomeText}>All leagues</Text></TouchableOpacity>
              <TouchableOpacity style={s.navigationMenuSignOut} onPress={() => supabase.auth.signOut()}><Text style={s.navigationMenuSignOutText}>Sign out</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  </SafeAreaView>;
}

function AuthLoading() {
  return <SafeAreaView style={s.authSafe}><StatusBar barStyle="light-content" /><ActivityIndicator color="#DDFB72" size="large" /><Text style={s.authLoadingText}>Opening your league…</Text></SafeAreaView>;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const sendCode = async () => {
    if (!normalizedEmail.includes("@")) { setMessage("Enter a valid email address."); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setMessage(userActionError(error, "Login code request"));
    else { setCodeSent(true); setMessage("A login code was sent to your email."); }
  };
  const verifyCode = async () => {
    if (code.trim().length < 6) { setMessage("Enter the complete code from your email."); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setMessage(userActionError(error, "Sign in"));
  };

  return <SafeAreaView style={s.authSafe}><StatusBar barStyle="light-content" /><KeyboardAvoidingView style={s.authKeyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets><View style={s.authCard}><View style={s.authLogo}><Text style={s.authLogoText}>CP</Text></View><Text style={s.authTitle}>Cricket Private Fantasy</Text><Text style={s.authSubtitle}>{codeSent ? `Enter the code sent to ${normalizedEmail}` : "Sign in with your registered league email"}</Text><TextInput value={email} onChangeText={value => { setEmail(value); setCodeSent(false); setCode(""); setMessage(""); }} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email address" placeholderTextColor="#8B9893" style={s.authInput} />{codeSent && <TextInput value={code} onChangeText={setCode} editable={!busy} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="Email code" placeholderTextColor="#8B9893" style={s.authInput} />}{message ? <Text style={[s.authMessage, message.startsWith("A login") && s.authSuccess]}>{message}</Text> : null}<TouchableOpacity disabled={busy} style={[s.authButton, busy && s.disabled]} onPress={codeSent ? verifyCode : sendCode}>{busy ? <ActivityIndicator color="#10251F" /> : <Text style={s.authButtonText}>{codeSent ? "Verify and sign in" : "Send login code"}</Text>}</TouchableOpacity>{codeSent && <TouchableOpacity disabled={busy} onPress={sendCode}><Text style={s.authLink}>Send a new code</Text></TouchableOpacity>}</View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function AccessDenied({ email, detail }: { email: string; detail?: string }) {
  return <SafeAreaView style={s.authSafe}><View style={s.authCard}><Text style={s.authTitle}>Access unavailable</Text><Text style={s.authSubtitle}>{detail ?? `${email} has no league invitation. Ask a league administrator to invite this email.`}</Text><TouchableOpacity style={s.authButton} onPress={() => supabase.auth.signOut()}><Text style={s.authButtonText}>Sign out</Text></TouchableOpacity></View></SafeAreaView>;
}

function LeaguePicker({ memberships, activeLeagueId, onSelect, onChanged }: { memberships: DatabaseMembership[]; activeLeagueId: string; onSelect: (id: string) => void; onChanged: () => Promise<void> }) {
  const [responding, setResponding] = useState("");
  const [message, setMessage] = useState("");
  const respond = async (membership: DatabaseMembership, accept: boolean) => {
    setResponding(membership.id); setMessage("");
    const { error } = await supabase.rpc("respond_to_league_invitation", { p_league_id: membership.league_id, p_accept: accept });
    if (error) setMessage(userActionError(error, accept ? "Invitation acceptance" : "Invitation decline"));
    else { setMessage(accept ? `Accepted ${membership.league.name}. Waiting for administrator activation.` : `Declined ${membership.league.name}.`); await onChanged(); }
    setResponding("");
  };
  const ordered = [...memberships].sort((a, b) => {
    const order: Record<MembershipStatus, number> = { invited: 0, accepted: 1, active: 2, suspended: 3, declined: 4, withdrawn: 5, disabled: 6 };
    return order[a.status] - order[b.status] || a.league.name.localeCompare(b.league.name);
  });
  return <ImageBackground source={require("./assets/cricket-home-background-v2.png")} resizeMode="cover" style={s.homeBackground} imageStyle={s.homeBackgroundImage}>
    <View pointerEvents="none" style={s.homeBackgroundShade} />
    <ScrollView contentContainerStyle={[s.content, s.homeContent]}><Text style={s.homeGreeting}>Your leagues</Text><Text style={s.homeSubtitle}>Accept invitations or open a league where your participation is active.</Text>{message ? <View style={s.adminMessage}><Text style={s.adminMessageText}>{message}</Text></View> : null}{ordered.map(membership => { const league = membership.league; const active = membership.status === "active"; const formatNote = leagueFormatNote(league); const statusLabel = membership.status === "accepted" ? "Accepted · waiting for activation" : membership.status === "suspended" ? "Deactivated" : membership.status.charAt(0).toUpperCase() + membership.status.slice(1); return <View key={membership.id} style={[s.leagueCard, s.homeLeagueCard, s.leagueCardModern, activeLeagueId === league.id && s.leagueCardSelected]}><View pointerEvents="none" style={[s.leagueCardAccent, { backgroundColor: leagueBadge(league).primary }]} /><TouchableOpacity disabled={!active} style={s.leagueCardMain} onPress={() => onSelect(league.id)}><LeagueEmblem league={league} /><View style={{ flex: 1 }}><Text style={s.leagueName}>{league.name}</Text><Text style={s.leagueMeta}>{league.competition} · {league.season_year} · {membership.role === "league_admin" ? "Admin" : "Owner"}</Text>{formatNote ? <Text style={s.leagueFormatNote} numberOfLines={2}>{formatNote}</Text> : null}<Text style={[s.leagueStatus, active ? s.leagueStatusActive : s.leagueStatusPending]}>{statusLabel}</Text></View>{active ? <Text style={s.leagueArrow}>›</Text> : null}</TouchableOpacity>{membership.status === "invited" ? <View style={s.invitationActions}><TouchableOpacity disabled={responding === membership.id} style={s.invitationDecline} onPress={() => respond(membership, false)}><Text style={s.invitationDeclineText}>Decline</Text></TouchableOpacity><TouchableOpacity disabled={responding === membership.id} style={s.invitationAccept} onPress={() => respond(membership, true)}>{responding === membership.id ? <ActivityIndicator color="#10251F" /> : <Text style={s.invitationAcceptText}>Accept invitation</Text>}</TouchableOpacity></View> : null}</View>; })}</ScrollView>
  </ImageBackground>;
}
function LeagueSetupPending({ league }: { league: { name: string; format: string; season: string } }) {
  return <ScrollView contentContainerStyle={s.content}><View style={s.pendingLeague}><Text style={s.pendingLeagueEyebrow}>SELECTED LEAGUE</Text><Text style={s.pendingLeagueTitle}>{league.name}</Text><Text style={s.pendingLeagueMeta}>{league.format} · {league.season}</Text><Text style={s.pendingLeagueText}>This league workspace is ready to configure. Add its owners, squads, fixtures and scoring rules before team selection begins.</Text></View></ScrollView>;
}

type AdminSection = "format" | "special" | "playing" | "points" | "phases" | "transfers" | "owners" | "templates" | "scoring";
type PhaseForm = { id?: string; code: string; name: string; start: string; end: string };
type TransferPeriodForm = { id?: string; code: string; name: string; start: string; end: string; limit: string; firstMatchFree: boolean };
type TransferPeriod = { id: string; code: string; name: string; start_match_number: number; end_match_number: number; transfer_limit: number; first_match_free: boolean };
type LeaguePhase = { code: string; name: string; start_match_number: number; end_match_number: number };
type BoosterRuleSetting = { code: Exclude<BoosterCode, "">; total_usage_limit: number; phase_usage_limits: Record<string, number> };
type PlayingRuleForm = Record<"lineup_size" | "lineup_budget" | "min_batters" | "min_bowlers" | "min_wicketkeepers" | "min_all_rounders" | "max_from_one_team" | "captain_multiplier" | "vice_captain_multiplier" | "impact_multiplier" | "other_owner_penalty_percent" | "other_owner_minimum_penalty", string>;
type PointRuleForm = Record<"run" | "four_bonus" | "six_bonus" | "duck" | "golden_duck" | "bowler_wicket" | "non_bowler_wicket" | "maiden" | "dot_ball" | "catch" | "stumping" | "run_out" | "player_of_match" | "winning_participant", string>;
type LeagueFormatForm = { acquisition_mode: "auction" | "all_open"; bidding_enabled: boolean; other_owner_deductions_enabled: boolean; marquee_enabled: boolean; unique_players_enabled: boolean; unique_scope: "match" | "phase" | "league"; royalty_enabled: boolean };
type SpecialPlayerRuleForm = {
  unique_mode_enabled: boolean; unique_players_per_owner: string;
  other_player_fee_percent: string; other_player_minimum_fee: string;
  unique_restrict_captain: boolean; unique_restrict_vice_captain: boolean;
  unique_restrict_impact: boolean; unique_restrict_3x: boolean;
  marquee_mode_enabled: boolean; marquee_players_per_owner: string;
  regular_royalty_percent: string; regular_minimum_royalty: string;
  marquee_royalty_percent: string; marquee_minimum_royalty: string;
  royalty_zero_floor: boolean; royalty_rounding: "immediate_whole_point" | "final_total_whole_point" | "none";
  automatic_unique_enabled: boolean; automatic_unique_usage_threshold: string;
  phase_change_deadline_hours: string; mid_phase_replacement_allowed: boolean;
};
const defaultPlayingRules: PlayingRuleForm = { lineup_size: "11", lineup_budget: "100", min_batters: "2", min_bowlers: "2", min_wicketkeepers: "1", min_all_rounders: "1", max_from_one_team: "7", captain_multiplier: "2", vice_captain_multiplier: "1.5", impact_multiplier: "2", other_owner_penalty_percent: "30", other_owner_minimum_penalty: "15" };
const defaultPointRules: PointRuleForm = { run: "1", four_bonus: "1", six_bonus: "2", duck: "-2", golden_duck: "-4", bowler_wicket: "15", non_bowler_wicket: "20", maiden: "10", dot_ball: "2", catch: "10", stumping: "10", run_out: "10", player_of_match: "15", winning_participant: "2" };
const defaultSpecialPlayerRules: SpecialPlayerRuleForm = { unique_mode_enabled: false, unique_players_per_owner: "2", other_player_fee_percent: "30", other_player_minimum_fee: "15", unique_restrict_captain: true, unique_restrict_vice_captain: true, unique_restrict_impact: true, unique_restrict_3x: true, marquee_mode_enabled: false, marquee_players_per_owner: "2", regular_royalty_percent: "5", regular_minimum_royalty: "5", marquee_royalty_percent: "15", marquee_minimum_royalty: "15", royalty_zero_floor: true, royalty_rounding: "immediate_whole_point", automatic_unique_enabled: true, automatic_unique_usage_threshold: "48", phase_change_deadline_hours: "24", mid_phase_replacement_allowed: false };
const AdminEditContext = React.createContext(true);

type ManagedLeagueMember = { id: string; display_name: string; email: string; role: "league_admin" | "owner" | "viewer"; status: MembershipStatus };

function OwnerManagement({ leagueId, canEdit, onMembersChanged }: { leagueId: string; canEdit: boolean; onMembersChanged: () => Promise<void> }) {
  const [members, setMembers] = useState<ManagedLeagueMember[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"owner" | "league_admin">("owner");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editingMemberId, setEditingMemberId] = useState("");
  const [editingName, setEditingName] = useState("");
  const runAction = useActionGuard();
  const load = async () => {
    const { data, error } = await supabase.from("league_members")
      .select("id,display_name,email,role,status").eq("league_id", leagueId).order("display_name");
    if (error) setMessage(userActionError(error, "Owner list refresh"));
    else setMembers((data ?? []) as ManagedLeagueMember[]);
  };
  useEffect(() => {
    load();
    const channel = supabase.channel(`league-members:${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "league_members", filter: `league_id=eq.${leagueId}` }, () => { load(); })
      .subscribe();
    const appStateSubscription = AppState.addEventListener("change", state => { if (state === "active") load(); });
    return () => { appStateSubscription.remove(); supabase.removeChannel(channel); };
  }, [leagueId]);
  const invite = async () => {
    if (!email.trim().includes("@") || !name.trim()) { const detail = "Enter the owner's name and valid email."; setMessage(detail); Alert.alert("Invitation not created", detail); return; }
    const normalizedName = name.trim().toLocaleLowerCase();
    const sameName = members.find(member => member.display_name.trim().toLocaleLowerCase() === normalizedName && member.email.trim().toLocaleLowerCase() !== email.trim().toLocaleLowerCase());
    if (sameName) { const detail = `Owner name “${name.trim()}” is already used by ${sameName.email}. Choose a different name.`; setMessage(detail); Alert.alert("Duplicate owner name", detail); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("invite_league_member", {
      p_league_id: leagueId, p_email: email.trim().toLowerCase(), p_display_name: name.trim(),
      p_role: role, p_invitation_expires_at: null,
    });
    if (error) { const detail = userActionError(error, "Invitation"); setMessage(detail); Alert.alert("Invitation not created", detail); }
    else { setEmail(""); setName(""); setMessage(`Invitation created for ${name.trim()}.`); await load(); }
    setBusy(false);
  };
  const changeStatus = async (member: ManagedLeagueMember, status: "active" | "suspended" | "withdrawn") => {
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("set_league_member_participation", { p_league_id: leagueId, p_member_id: member.id, p_status: status });
    if (error) setMessage(userActionError(error, "Member status change"));
    else { setMessage(status === "suspended" ? `${member.display_name} has been deactivated.` : status === "active" ? `${member.display_name} has been activated.` : `${member.display_name} is now ${status}.`); await load(); }
    setBusy(false);
  };
  const beginRename = (member: ManagedLeagueMember) => { setEditingMemberId(member.id); setEditingName(member.display_name); setMessage(""); };
  const renameMember = async (member: ManagedLeagueMember) => {
    const nextName = editingName.trim();
    if (!nextName) { setMessage("Owner display name is required."); return; }
    const duplicate = members.find(item => item.id !== member.id && item.display_name.trim().toLocaleLowerCase() === nextName.toLocaleLowerCase());
    if (duplicate) { setMessage(`Owner name “${nextName}” is already used by ${duplicate.email}.`); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("rename_league_member", { p_league_id: leagueId, p_member_id: member.id, p_display_name: nextName });
    if (error) { const detail = userActionError(error, "Display-name change"); setMessage(detail); Alert.alert("Name not changed", detail); }
    else { setEditingMemberId(""); setEditingName(""); setMessage(`Display name changed to ${nextName}.`); await Promise.all([load(), onMembersChanged()]); }
    setBusy(false);
  };
  return <View>
    {canEdit ? <View style={s.adminCard}><Text style={s.adminGroupTitle}>Invite owner</Text><TextInput style={s.ownerAdminInput} value={name} onChangeText={value => { setName(value); setMessage(""); }} placeholder="Owner name" placeholderTextColor="#8B9893" /><TextInput style={s.ownerAdminInput} value={email} onChangeText={value => { setEmail(value); setMessage(""); }} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#8B9893" /><View style={s.ownerRoleRow}><TouchableOpacity style={[s.ownerRoleButton, role === "owner" && s.ownerRoleButtonActive]} onPress={() => setRole("owner")}><Text style={s.ownerRoleText}>Owner</Text></TouchableOpacity><TouchableOpacity style={[s.ownerRoleButton, role === "league_admin" && s.ownerRoleButtonActive]} onPress={() => setRole("league_admin")}><Text style={s.ownerRoleText}>League admin</Text></TouchableOpacity></View><TouchableOpacity disabled={busy} style={[s.primary, busy && s.disabled]} onPress={() => runAction(invite)}>{busy ? <ActivityIndicator color="#10251F" /> : <Text style={s.primaryText}>Create invitation</Text>}</TouchableOpacity>{message ? <View style={[s.ownerInviteMessage, message.startsWith("Invitation created") && s.adminMessageSuccess]}><Text style={s.adminMessageText}>{message}</Text></View> : null}</View> : null}
    <View style={s.adminPhaseHeader}><Text style={s.adminGroupTitle}>League participants</Text><TouchableOpacity style={s.resetButton} onPress={load}><Text style={s.resetButtonText}>Refresh</Text></TouchableOpacity></View>
    {members.map(member => <View key={member.id} style={s.ownerAdminRow}><View style={s.badge}><Text style={s.badgeText}>{member.display_name[0]}</Text></View><View style={{ flex: 1, marginLeft: 9 }}>{editingMemberId === member.id ? <View style={s.ownerRenamePanel}><TextInput autoFocus maxLength={60} selectTextOnFocus style={s.ownerRenameInput} value={editingName} onChangeText={setEditingName} placeholder="Display name" placeholderTextColor="#8B9893" /><View style={s.ownerRenameActions}><TouchableOpacity disabled={busy} style={s.ownerRenameCancel} onPress={() => { setEditingMemberId(""); setEditingName(""); }}><Text style={s.ownerRenameCancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={busy} style={s.ownerRenameSave} onPress={() => runAction(() => renameMember(member))}>{busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={s.ownerRenameSaveText}>Save name</Text>}</TouchableOpacity></View></View> : <><Text style={s.ownerDisplayName}>{member.display_name}</Text><Text style={s.meta}>{member.email} · {member.role === "league_admin" ? "Admin" : "Owner"}</Text><Text style={[s.leagueStatus, member.status === "active" ? s.leagueStatusActive : s.leagueStatusPending]}>{member.status === "suspended" ? "deactivated" : member.status}</Text></>}</View>{canEdit && editingMemberId !== member.id ? <View style={s.ownerAdminActions}><TouchableOpacity disabled={busy} style={s.ownerEditName} onPress={() => beginRename(member)}><Text style={s.ownerEditNameText}>Edit name</Text></TouchableOpacity>{member.status === "accepted" ? <TouchableOpacity disabled={busy} style={s.ownerActivate} onPress={() => runAction(() => changeStatus(member, "active"))}><Text style={s.ownerActivateText}>Activate</Text></TouchableOpacity> : member.status === "active" && member.role !== "league_admin" ? <TouchableOpacity disabled={busy} style={s.ownerSuspend} onPress={() => runAction(() => changeStatus(member, "suspended"))}><Text style={s.ownerSuspendText}>Deactivate</Text></TouchableOpacity> : member.status === "suspended" ? <TouchableOpacity disabled={busy} style={s.ownerActivate} onPress={() => runAction(() => changeStatus(member, "active"))}><Text style={s.ownerActivateText}>Reactivate</Text></TouchableOpacity> : null}</View> : null}</View>)}
    {!canEdit && message ? <View style={s.adminMessage}><Text style={s.adminMessageText}>{message}</Text></View> : null}
  </View>;
}

type LeagueTemplateSummary = { id: string; name: string; description: string | null; version: number; source_league_id: string | null; created_at: string };

function LeagueTemplateManagement({ leagueId, leagueName, canEdit, onLeaguesChanged }: { leagueId: string; leagueName: string; canEdit: boolean; onLeaguesChanged: () => Promise<void> }) {
  const [templates, setTemplates] = useState<LeagueTemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState(`${leagueName} rules`);
  const [templateDescription, setTemplateDescription] = useState("");
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueSlug, setNewLeagueSlug] = useState("");
  const [newSeason, setNewSeason] = useState(String(new Date().getFullYear() + 1));
  const [copyOwners, setCopyOwners] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const runAction = useActionGuard();
  const load = async () => {
    const { data, error } = await supabase.from("league_templates")
      .select("id,name,description,version,source_league_id,created_at").eq("active", true).order("created_at", { ascending: false });
    if (error) setMessage(userActionError(error, "Template list refresh"));
    else { const rows = (data ?? []) as LeagueTemplateSummary[]; setTemplates(rows); setSelectedTemplateId(current => current || rows[0]?.id || ""); }
  };
  useEffect(() => { load(); }, [leagueId]);
  const saveTemplate = async () => {
    if (!templateName.trim()) { setMessage("Template name is required."); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("save_league_template", { p_source_league_id: leagueId, p_name: templateName.trim(), p_description: templateDescription.trim() || null, p_is_public: false });
    if (error) { const detail = userActionError(error, "Template save"); setMessage(detail); Alert.alert("Template not saved", detail); }
    else { setMessage(`Saved a configuration snapshot of ${leagueName}.`); await load(); }
    setBusy(false);
  };
  const updateNewLeagueName = (value: string) => {
    setNewLeagueName(value);
    setNewLeagueSlug(value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  };
  const cloneTemplate = async () => {
    if (!selectedTemplateId) { setMessage("Select a template."); return; }
    if (!newLeagueName.trim() || !newLeagueSlug.trim()) { setMessage("New league name and slug are required."); return; }
    const season = Number(newSeason);
    if (!Number.isInteger(season) || season < 2000 || season > 2200) { setMessage("Enter a valid four-digit season year."); return; }
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("create_league_from_template", { p_template_id: selectedTemplateId, p_slug: newLeagueSlug.trim().toLowerCase(), p_name: newLeagueName.trim(), p_season_year: season, p_copy_owner_invitations: copyOwners });
    if (error) { const detail = userActionError(error, "League creation"); setMessage(detail); Alert.alert("League not created", detail); }
    else { setMessage(`Created ${newLeagueName.trim()} as a clean draft. No ownership or history was copied.`); setNewLeagueName(""); setNewLeagueSlug(""); await onLeaguesChanged(); Alert.alert("Draft league created", "Open Home to see the new league."); }
    setBusy(false);
  };
  if (!canEdit) return <View style={s.adminCard}><Text style={s.adminNoticeText}>Only a league administrator can save or import league templates.</Text></View>;
  return <View>
    <View style={s.adminCard}><Text style={s.adminGroupTitle}>Save this league as a template</Text><Text style={s.adminNoticeText}>Copies configuration only. Ownership, bids, fixtures, lineups, points, rankings and usage history are excluded.</Text><TextInput style={s.ownerAdminInput} value={templateName} onChangeText={setTemplateName} placeholder="Template name" placeholderTextColor="#8B9893" /><TextInput style={s.ownerAdminInput} value={templateDescription} onChangeText={setTemplateDescription} placeholder="Description (optional)" placeholderTextColor="#8B9893" /><TouchableOpacity disabled={busy} style={[s.primary, busy && s.disabled]} onPress={() => runAction(saveTemplate)}><Text style={s.primaryText}>Save configuration template</Text></TouchableOpacity></View>
    <View style={s.adminCard}><Text style={s.adminGroupTitle}>Create a new league from template</Text>{templates.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.templateChoices}>{templates.map(template => <TouchableOpacity key={template.id} style={[s.templateChoice, selectedTemplateId === template.id && s.templateChoiceActive]} onPress={() => setSelectedTemplateId(template.id)}><Text style={s.templateChoiceName}>{template.name}</Text><Text style={s.meta}>v{template.version}{template.source_league_id === leagueId ? " · this league" : ""}</Text></TouchableOpacity>)}</ScrollView> : <Text style={s.adminNoticeText}>Save a template first.</Text>}<TextInput style={s.ownerAdminInput} value={newLeagueName} onChangeText={updateNewLeagueName} placeholder="New league name" placeholderTextColor="#8B9893" /><TextInput style={s.ownerAdminInput} value={newLeagueSlug} onChangeText={value => setNewLeagueSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} autoCapitalize="none" placeholder="new-league-slug" placeholderTextColor="#8B9893" /><TextInput style={s.ownerAdminInput} value={newSeason} onChangeText={setNewSeason} keyboardType="number-pad" placeholder="Season year" placeholderTextColor="#8B9893" /><TouchableOpacity style={s.adminNotice} onPress={() => setCopyOwners(value => !value)}><Text style={s.adminNoticeTitle}>{copyOwners ? "✓" : "○"} Copy owner emails as new invitations</Text><Text style={s.adminNoticeText}>Owners must opt in again. Squads and bidding never carry over.</Text></TouchableOpacity><TouchableOpacity disabled={busy || !templates.length} style={[s.primary, (busy || !templates.length) && s.disabled]} onPress={() => runAction(cloneTemplate)}>{busy ? <ActivityIndicator color="#10251F" /> : <Text style={s.primaryText}>Create clean draft league</Text>}</TouchableOpacity></View>
    {message ? <View style={[s.adminMessage, (message.startsWith("Saved") || message.startsWith("Created")) && s.adminMessageSuccess]}><Text style={s.adminMessageText}>{message}</Text></View> : null}
  </View>;
}

function AdminNumberField({ label, value, onChange, detail }: { label: string; value: string; onChange: (value: string) => void; detail?: string }) {
  const canEdit = React.useContext(AdminEditContext);
  return <View style={s.adminField}><View style={{ flex: 1 }}><Text style={s.adminFieldLabel}>{label}</Text>{detail ? <Text style={s.adminFieldDetail}>{detail}</Text> : null}</View><TextInput editable={canEdit} style={[s.adminInput, !canEdit && s.adminInputReadOnly]} value={value} onChangeText={onChange} keyboardType="numbers-and-punctuation" selectTextOnFocus /></View>;
}

function FormatToggle({ label, detail, value, disabled, onPress }: { label: string; detail: string; value: boolean; disabled: boolean; onPress: () => void }) {
  return <TouchableOpacity disabled={disabled} style={[s.adminField, disabled && { opacity: 0.55 }]} onPress={onPress}><View style={{ flex: 1 }}><Text style={s.adminFieldLabel}>{label}</Text><Text style={s.adminFieldDetail}>{detail}</Text></View><View style={[s.formatToggle, value && s.formatToggleActive]}><Text style={[s.formatToggleText, value && s.formatToggleTextActive]}>{value ? "ON" : "OFF"}</Text></View></TouchableOpacity>;
}

type SpecialSelectionPlayer = { id: string; name: string; role: string; team: string };
type SpecialSelectionPhase = { id: string; name: string; sort_order: number; is_final_phase: boolean; deadline: string | null };

function PhaseSpecialPlayerSelection({ leagueId, rules }: { leagueId: string; rules: SpecialPlayerRuleForm }) {
  const selectionType = rules.unique_mode_enabled ? "unique" : rules.marquee_mode_enabled ? "marquee" : null;
  const required = Number(rules.unique_mode_enabled ? rules.unique_players_per_owner : rules.marquee_players_per_owner);
  const [players, setPlayers] = useState<SpecialSelectionPlayer[]>([]);
  const [phases, setPhases] = useState<SpecialSelectionPhase[]>([]);
  const [phaseId, setPhaseId] = useState("");
  const [savedByPhase, setSavedByPhase] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!selectionType) { setBusy(false); return; }
    setBusy(true); setMessage("");
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) { setMessage("Sign in again to select phase players."); setBusy(false); return; }
    const { data: member, error: memberError } = await supabase.from("league_members").select("id").eq("league_id", leagueId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (memberError || !member) { setMessage(memberError?.message ?? "Active owner membership is required."); setBusy(false); return; }
    const [playerResult, phaseResult, selectionResult] = await Promise.all([
      supabase.from("league_players").select("player_id,player:players(id,full_name,role,team:cricket_teams(code))").eq("league_id", leagueId).eq("owner_member_id", member.id).eq("active", true),
      supabase.from("league_phases").select("id,name,sort_order,is_final_phase").eq("league_id", leagueId).eq("active", true).order("sort_order"),
      supabase.from("phase_special_players").select("phase_id,player_id").eq("league_id", leagueId).eq("member_id", member.id).eq("selection_type", selectionType),
    ]);
    if (playerResult.error || phaseResult.error || selectionResult.error) { setMessage(playerResult.error?.message ?? phaseResult.error?.message ?? selectionResult.error?.message ?? "Could not load phase selections."); setBusy(false); return; }
    const owned = (playerResult.data ?? []).map((row: any) => ({ id: row.player_id, name: row.player?.full_name ?? "Unknown player", role: row.player?.role ?? "—", team: row.player?.team?.code ?? "—" })).sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
    const phaseRows = await Promise.all(((phaseResult.data ?? []) as any[]).map(async phase => { const { data } = await supabase.rpc("phase_special_selection_deadline", { p_phase_id: phase.id }); return { ...phase, deadline: data as string | null }; }));
    const saved = ((selectionResult.data ?? []) as any[]).reduce((result, row) => ({ ...result, [row.phase_id]: [...(result[row.phase_id] ?? []), row.player_id] }), {} as Record<string, string[]>);
    const now = Date.now();
    const editable = phaseRows.find(phase => !phase.is_final_phase && phase.deadline && new Date(phase.deadline).getTime() > now) ?? phaseRows[0];
    setPlayers(owned); setPhases(phaseRows); setSavedByPhase(saved); setPhaseId(editable?.id ?? ""); setSelected(saved[editable?.id] ?? []); setBusy(false);
  };
  useEffect(() => { load(); }, [leagueId, selectionType]);
  useEffect(() => { setSelected(savedByPhase[phaseId] ?? []); }, [phaseId]);
  if (!selectionType) return null;
  if (busy) return <View style={s.adminCard}><ActivityIndicator color="#174D3D" /><Text style={s.adminLoadingText}>Loading your owned squad…</Text></View>;
  const phase = phases.find(item => item.id === phaseId);
  const editable = !!phase && !phase.is_final_phase && !!phase.deadline && new Date(phase.deadline).getTime() > Date.now();
  const toggle = (playerId: string) => setSelected(current => current.includes(playerId) ? current.filter(id => id !== playerId) : current.length < required ? [...current, playerId] : current);
  const save = async () => {
    if (!phase || selected.length !== required) { setMessage(`Select exactly ${required} ${selectionType === "unique" ? "Unique" : "Marquee"} Players.`); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("set_phase_special_players", { p_phase_id: phase.id, p_selection_type: selectionType, p_player_ids: selected });
    if (error) setMessage(userActionError(error, "Special-player selection")); else { setSavedByPhase(current => ({ ...current, [phase.id]: selected })); setMessage(`Saved ${required} ${selectionType === "unique" ? "Unique" : "Marquee"} Players for ${phase.name}.`); }
    setBusy(false);
  };
  return <View style={s.adminCard}><Text style={s.adminGroupTitle}>Your phase {selectionType === "unique" ? "Unique" : "Marquee"} Players</Text><Text style={s.adminNoticeText}>Choose exactly {required} active players owned by you. Final/playoff selections carry forward automatically.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.templateChoices}>{phases.map(item => { const isEditable = !item.is_final_phase && !!item.deadline && new Date(item.deadline).getTime() > Date.now(); return <TouchableOpacity key={item.id} style={[s.templateChoice, phaseId === item.id && s.templateChoiceActive]} onPress={() => setPhaseId(item.id)}><Text style={s.templateChoiceName}>{item.name}</Text><Text style={s.meta}>{item.is_final_phase ? "Carry forward" : isEditable ? "Open" : "Closed"}</Text></TouchableOpacity>; })}</ScrollView>
    {phase?.deadline ? <Text style={s.adminFieldDetail}>{editable ? "CHANGES CLOSE" : "SELECTION CLOSED"} · {new Date(phase.deadline).toLocaleString()}</Text> : null}
    {players.length ? players.map(player => <TouchableOpacity key={player.id} disabled={!editable} style={[s.ownerAdminRow, selected.includes(player.id) && s.leagueCardSelected, !editable && { opacity: 0.65 }]} onPress={() => toggle(player.id)}><IplTeamBadge code={player.team} /><View style={{ flex: 1, marginLeft: 9 }}><Text style={s.pointsPlayerName} numberOfLines={1}>{player.name}</Text><Text style={s.meta}>{player.role}</Text></View><Text style={s.adminNoticeTitle}>{selected.includes(player.id) ? "✓ Selected" : "Select"}</Text></TouchableOpacity>) : <Text style={s.adminNoticeText}>No active owned players are available. This mode requires completed ownership assignments.</Text>}
    {editable && players.length ? <TouchableOpacity disabled={busy || selected.length !== required} style={[s.primary, (busy || selected.length !== required) && s.disabled]} onPress={save}><Text style={s.primaryText}>Save {selected.length}/{required} for {phase?.name}</Text></TouchableOpacity> : null}
    {message ? <View style={[s.adminMessage, message.startsWith("Saved") && s.adminMessageSuccess]}><Text style={s.adminMessageText}>{message}</Text></View> : null}
  </View>;
}

function OwnerTabContent({ leagueId, currentOwner, roster }: { leagueId: string; currentOwner: string; roster: Player[] }) {
  const [rules, setRules] = useState<SpecialPlayerRuleForm | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let mounted = true;
    setRules(null); setMessage("");
    supabase.from("special_player_rule_sets").select("*").eq("league_id", leagueId).eq("active", true).maybeSingle().then(({ data, error }) => {
      if (!mounted) return;
      if (error) { setMessage(userActionError(error, "Special-player selections")); return; }
      if (!data) return;
      const special = data as any;
      setRules({
        unique_mode_enabled: special.unique_mode_enabled, unique_players_per_owner: String(special.unique_players_per_owner),
        other_player_fee_percent: String(special.other_player_fee_percent), other_player_minimum_fee: String(special.other_player_minimum_fee),
        unique_restrict_captain: special.unique_restrict_captain, unique_restrict_vice_captain: special.unique_restrict_vice_captain,
        unique_restrict_impact: special.unique_restrict_impact, unique_restrict_3x: special.unique_restrict_3x,
        marquee_mode_enabled: special.marquee_mode_enabled, marquee_players_per_owner: String(special.marquee_players_per_owner),
        regular_royalty_percent: String(special.regular_royalty_percent), regular_minimum_royalty: String(special.regular_minimum_royalty ?? 5),
        marquee_royalty_percent: String(special.marquee_royalty_percent), marquee_minimum_royalty: String(special.marquee_minimum_royalty ?? 15),
        royalty_zero_floor: special.royalty_zero_floor, royalty_rounding: special.royalty_rounding,
        automatic_unique_enabled: special.automatic_unique_enabled, automatic_unique_usage_threshold: String(special.automatic_unique_usage_threshold),
        phase_change_deadline_hours: String(special.phase_change_deadline_hours), mid_phase_replacement_allowed: special.mid_phase_replacement_allowed,
      });
    });
    return () => { mounted = false; };
  }, [leagueId]);
  const specialSelection = rules?.unique_mode_enabled
    ? { type: "unique" as const, required: Number(rules.unique_players_per_owner) }
    : rules?.marquee_mode_enabled
      ? { type: "marquee" as const, required: Number(rules.marquee_players_per_owner) }
      : null;
  return <>
    {message ? <View style={s.warningCard}><Text style={s.warningText}>⚠ {message}</Text></View> : null}
    <ProductionSquads leagueId={leagueId} currentOwner={currentOwner} roster={roster} specialSelection={specialSelection} />
  </>;
}

function LeagueAdminScreen({ leagueId, leagueName, canEdit, onLeaguesChanged }: { leagueId: string; leagueName: string; canEdit: boolean; onLeaguesChanged: () => Promise<void> }) {
  const [section, setSection] = useState<AdminSection>("format");
  const [leagueFormat, setLeagueFormat] = useState<LeagueFormatForm>({ acquisition_mode: "auction", bidding_enabled: true, other_owner_deductions_enabled: true, marquee_enabled: false, unique_players_enabled: false, unique_scope: "league", royalty_enabled: false });
  const [specialRules, setSpecialRules] = useState<SpecialPlayerRuleForm>(defaultSpecialPlayerRules);
  const [specialRulesVersion, setSpecialRulesVersion] = useState(1);
  const [specialEffectiveMatch, setSpecialEffectiveMatch] = useState("1");
  const [playing, setPlaying] = useState<PlayingRuleForm>(defaultPlayingRules);
  const [points, setPoints] = useState<PointRuleForm>(defaultPointRules);
  const [scoringDocument, setScoringDocument] = useState<any>(null);
  const [versions, setVersions] = useState({ playing: 1, points: 1 });
  const [playingEffectiveMatch, setPlayingEffectiveMatch] = useState("6");
  const [pointsEffectiveMatch, setPointsEffectiveMatch] = useState("6");
  const [phases, setPhases] = useState<PhaseForm[]>([]);
  const [transferPeriods, setTransferPeriods] = useState<TransferPeriodForm[]>([]);
  const [scoringFixtures, setScoringFixtures] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const runAction = useActionGuard();

  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase.from("lineup_rule_sets").select("*").eq("league_id", leagueId).eq("active", true).single(),
      supabase.from("scoring_rule_sets").select("*").eq("league_id", leagueId).eq("active", true).single(),
      supabase.from("league_phases").select("id,code,name,start_match_number,end_match_number,sort_order").eq("league_id", leagueId).eq("active", true).order("sort_order"),
      supabase.from("league_transfer_periods").select("id,code,name,start_match_number,end_match_number,transfer_limit,first_match_free,sort_order").eq("league_id", leagueId).eq("active", true).order("sort_order"),
      supabase.from("league_format_configs").select("acquisition_mode,bidding_enabled,other_owner_deductions_enabled,marquee_enabled,unique_players_enabled,unique_scope,royalty_enabled").eq("league_id", leagueId).single(),
      supabase.from("special_player_rule_sets").select("*").eq("league_id", leagueId).eq("active", true).maybeSingle(),
    ]).then(([playingResult, scoringResult, phaseResult, transferPeriodResult, formatResult, specialResult]) => {
      if (!mounted) return;
      if (playingResult.error || scoringResult.error) {
        setMessage(playingResult.error?.message ?? scoringResult.error?.message ?? "Unable to load rules");
      } else {
        const rule = playingResult.data as any;
        setPlaying(Object.fromEntries(Object.keys(defaultPlayingRules).map(key => [key, String(rule[key])])) as PlayingRuleForm);
        const scoring = (scoringResult.data as any).rules;
        setScoringDocument(scoring);
        setPoints({ run: String(scoring.batting.run), four_bonus: String(scoring.batting.four_bonus), six_bonus: String(scoring.batting.six_bonus), duck: String(scoring.batting.duck_non_bowler), golden_duck: String(scoring.batting.golden_or_diamond_duck_non_bowler), bowler_wicket: String(scoring.bowling.dismissed_bowler_wicket), non_bowler_wicket: String(scoring.bowling.dismissed_non_bowler_wicket), maiden: String(scoring.bowling.maiden), dot_ball: String(scoring.bowling.dot_ball), catch: String(scoring.fielding.catch), stumping: String(scoring.fielding.stumping), run_out: String(scoring.fielding.run_out), player_of_match: String(scoring.bonus.player_of_match), winning_participant: String(scoring.bonus.winning_participant) });
        setVersions({ playing: rule.version, points: (scoringResult.data as any).version });
        setPlayingEffectiveMatch(String(rule.effective_from_match_number ?? 1));
        setPointsEffectiveMatch(String((scoringResult.data as any).effective_from_match_number ?? 1));
        setPhases(((phaseResult.data ?? []) as any[]).map(phase => ({ id: phase.id, code: phase.code, name: phase.name, start: String(phase.start_match_number), end: String(phase.end_match_number) })));
        setTransferPeriods(((transferPeriodResult.data ?? []) as any[]).map(period => ({ id: period.id, code: period.code, name: period.name, start: String(period.start_match_number), end: String(period.end_match_number), limit: String(period.transfer_limit), firstMatchFree: period.first_match_free })));
        const format = formatResult.data as any;
        if (format) setLeagueFormat({ acquisition_mode: format.acquisition_mode, bidding_enabled: format.bidding_enabled, other_owner_deductions_enabled: format.other_owner_deductions_enabled, marquee_enabled: format.marquee_enabled, unique_players_enabled: format.unique_players_enabled, unique_scope: format.unique_scope ?? "league", royalty_enabled: format.royalty_enabled });
        const special = specialResult.data as any;
        if (special) {
          setSpecialRules({
            unique_mode_enabled: special.unique_mode_enabled, unique_players_per_owner: String(special.unique_players_per_owner),
            other_player_fee_percent: String(special.other_player_fee_percent), other_player_minimum_fee: String(special.other_player_minimum_fee),
            unique_restrict_captain: special.unique_restrict_captain, unique_restrict_vice_captain: special.unique_restrict_vice_captain,
            unique_restrict_impact: special.unique_restrict_impact, unique_restrict_3x: special.unique_restrict_3x,
            marquee_mode_enabled: special.marquee_mode_enabled, marquee_players_per_owner: String(special.marquee_players_per_owner),
            regular_royalty_percent: String(special.regular_royalty_percent), regular_minimum_royalty: String(special.regular_minimum_royalty ?? 5), marquee_royalty_percent: String(special.marquee_royalty_percent), marquee_minimum_royalty: String(special.marquee_minimum_royalty ?? 15),
            royalty_zero_floor: special.royalty_zero_floor, royalty_rounding: special.royalty_rounding,
            automatic_unique_enabled: special.automatic_unique_enabled, automatic_unique_usage_threshold: String(special.automatic_unique_usage_threshold),
            phase_change_deadline_hours: String(special.phase_change_deadline_hours), mid_phase_replacement_allowed: special.mid_phase_replacement_allowed,
          });
          setSpecialRulesVersion(special.version);
          setSpecialEffectiveMatch(String(special.effective_from_match_number));
        }
      }
      if (phaseResult.error || transferPeriodResult.error || formatResult.error || specialResult.error) setMessage(phaseResult.error?.message ?? transferPeriodResult.error?.message ?? formatResult.error?.message ?? specialResult.error?.message ?? "Unable to load league settings");
      setBusy(false);
    });
    return () => { mounted = false; };
  }, [leagueId]);
  const loadScoringFixtures = () => supabase.from("fixtures").select("id,match_number,status,scoring_status,home:cricket_teams!fixtures_home_team_id_fkey(code),away:cricket_teams!fixtures_away_team_id_fkey(code)").eq("league_id", leagueId).in("status", ["live", "completed", "abandoned"]).order("match_number", { ascending: false }).then(({ data, error }) => {
    if (error) setMessage(userActionError(error, "Completed matches"));
    else setScoringFixtures(data ?? []);
  });
  useEffect(() => { if (section === "scoring") loadScoringFixtures(); }, [section]);

  const selectAcquisitionMode = (mode: "auction" | "all_open") => setLeagueFormat(current => mode === "all_open" ? { ...current, acquisition_mode: mode, bidding_enabled: false, other_owner_deductions_enabled: false } : { ...current, acquisition_mode: mode });
  const publishFormat = async () => {
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("publish_league_format", { p_league_id: leagueId, p_acquisition_mode: leagueFormat.acquisition_mode, p_bidding_enabled: leagueFormat.bidding_enabled, p_other_owner_deductions_enabled: leagueFormat.other_owner_deductions_enabled, p_marquee_enabled: leagueFormat.marquee_enabled, p_unique_players_enabled: leagueFormat.unique_players_enabled, p_unique_scope: leagueFormat.unique_players_enabled ? leagueFormat.unique_scope : null, p_royalty_enabled: leagueFormat.royalty_enabled });
    if (error) setMessage(userActionError(error, "League-format publication"));
    else { const result = data as any; setLeagueFormat(current => ({ ...current, acquisition_mode: result.acquisition_mode, bidding_enabled: result.bidding_enabled, other_owner_deductions_enabled: result.other_owner_deductions_enabled })); setMessage("Published league format configuration."); }
    setBusy(false);
  };

  const updatePlaying = (key: keyof PlayingRuleForm, value: string) => setPlaying(current => ({ ...current, [key]: value }));
  const updateSpecialNumber = (key: keyof SpecialPlayerRuleForm, value: string) => setSpecialRules(current => ({ ...current, [key]: value }));
  const publishSpecialRules = async () => {
    const numericValues = [specialEffectiveMatch, specialRules.unique_players_per_owner, specialRules.other_player_fee_percent, specialRules.other_player_minimum_fee, specialRules.marquee_players_per_owner, specialRules.regular_royalty_percent, specialRules.regular_minimum_royalty, specialRules.marquee_royalty_percent, specialRules.marquee_minimum_royalty, specialRules.automatic_unique_usage_threshold, specialRules.phase_change_deadline_hours];
    if (numericValues.some(value => value.trim() === "" || Number.isNaN(Number(value)))) { setMessage("Every special-player rule must contain a valid number."); return; }
    if (leagueFormat.acquisition_mode === "all_open" && (specialRules.unique_mode_enabled || specialRules.marquee_mode_enabled)) { setMessage("Unique-player-driven and Royalty-driven modes require an Auction / Owned league."); return; }
    if (Number(specialRules.marquee_royalty_percent) < Number(specialRules.regular_royalty_percent)) { setMessage("Marquee royalty cannot be lower than regular royalty."); return; }
    setBusy(true); setMessage("");
    const payload = Object.fromEntries(Object.entries(specialRules).map(([key, value]) => [key, typeof value === "string" && key !== "royalty_rounding" ? Number(value) : value]));
    const { data, error } = await supabase.rpc("publish_special_player_rules_v2", { p_league_id: leagueId, p_effective_from_match_number: Number(specialEffectiveMatch), p_rules: payload });
    if (error) setMessage(userActionError(error, "Special-player rule publication"));
    else { const result = data as any; setSpecialRulesVersion(result.version); setMessage(`Published special-player rules v${result.version} from Match ${result.effective_from_match_number}.`); }
    setBusy(false);
  };
  const updatePoints = (key: keyof PointRuleForm, value: string) => setPoints(current => ({ ...current, [key]: value }));
  const publish = async () => {
    const allValues = [...Object.values(playing), ...Object.values(points), playingEffectiveMatch, pointsEffectiveMatch];
    if (allValues.some(value => value.trim() === "" || Number.isNaN(Number(value)))) { setMessage("Every displayed rule must contain a valid number."); return; }
    if (Number(playing.min_batters) + Number(playing.min_bowlers) + Number(playing.min_wicketkeepers) + Number(playing.min_all_rounders) > Number(playing.lineup_size)) { setMessage("Minimum player roles cannot exceed the lineup size."); return; }
    setBusy(true); setMessage("");
    const nextScoring = { ...(scoringDocument ?? {}), batting: { ...(scoringDocument?.batting ?? {}), run: Number(points.run), four_bonus: Number(points.four_bonus), six_bonus: Number(points.six_bonus), duck_non_bowler: Number(points.duck), golden_or_diamond_duck_non_bowler: Number(points.golden_duck) }, bowling: { ...(scoringDocument?.bowling ?? {}), dismissed_bowler_wicket: Number(points.bowler_wicket), dismissed_non_bowler_wicket: Number(points.non_bowler_wicket), maiden: Number(points.maiden), dot_ball: Number(points.dot_ball) }, fielding: { ...(scoringDocument?.fielding ?? {}), catch: Number(points.catch), stumping: Number(points.stumping), run_out: Number(points.run_out) }, bonus: { ...(scoringDocument?.bonus ?? {}), player_of_match: Number(points.player_of_match), winning_participant: Number(points.winning_participant) } };
    const { data, error } = await supabase.rpc("publish_league_rules_effective", { p_league_id: leagueId, p_lineup_rules: Object.fromEntries(Object.entries(playing).map(([key, value]) => [key, Number(value)])), p_scoring_rules: nextScoring, p_lineup_effective_from_match: Number(playingEffectiveMatch), p_scoring_effective_from_match: Number(pointsEffectiveMatch) });
    if (error) setMessage(userActionError(error, "Rule publication"));
    else { const result = data as any; setVersions({ playing: result.lineup_version, points: result.scoring_version }); setScoringDocument(nextScoring); setMessage(`Published playing rules v${result.lineup_version} and points rules v${result.scoring_version}.`); }
    setBusy(false);
  };

  const updatePhase = (index: number, key: "name" | "start" | "end", value: string) => setPhases(current => current.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, [key]: value } : phase));
  const addPhase = () => setPhases(current => { const nextNumber = Math.max(0, ...current.map(phase => Number(phase.code.match(/\d+$/)?.[0] ?? 0))) + 1; return [...current, { code: `phase${nextNumber}`, name: `Phase ${nextNumber}`, start: "", end: "" }]; });
  const publishPhases = async () => {
    if (!phases.length) { setMessage("At least one league phase is required."); return; }
    if (phases.some(phase => !phase.name.trim() || !Number.isInteger(Number(phase.start)) || !Number.isInteger(Number(phase.end)) || Number(phase.start) < 1 || Number(phase.end) < Number(phase.start))) { setMessage("Every phase needs a name and a valid start and end match number."); return; }
    const sorted = phases.map(phase => ({ ...phase, startNumber: Number(phase.start), endNumber: Number(phase.end) })).sort((a, b) => a.startNumber - b.startNumber);
    if (sorted.some((phase, index) => index > 0 && phase.startNumber <= sorted[index - 1].endNumber)) { setMessage("Phase match ranges cannot overlap."); return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("publish_league_phases", { p_league_id: leagueId, p_phases: phases.map((phase, index) => ({ code: phase.code, name: phase.name.trim(), sort_order: index + 1, start_match_number: Number(phase.start), end_match_number: Number(phase.end) })) });
    if (error) setMessage(userActionError(error, "Phase publication"));
    else setMessage("Published league phase configuration.");
    setBusy(false);
  };
  const updateTransferPeriod = (index: number, key: "name" | "start" | "end" | "limit", value: string) => setTransferPeriods(current => current.map((period, periodIndex) => periodIndex === index ? { ...period, [key]: value } : period));
  const addTransferPeriod = () => setTransferPeriods(current => { const nextNumber = Math.max(0, ...current.map(period => Number(period.code.match(/\d+$/)?.[0] ?? 0))) + 1; return [...current, { code: `period${nextNumber}`, name: `Transfer Period ${nextNumber}`, start: "", end: "", limit: "", firstMatchFree: true }]; });
  const publishTransfers = async () => {
    if (!transferPeriods.length) { setMessage("At least one transfer period is required."); return; }
    if (transferPeriods.some(period => !period.name.trim() || !Number.isInteger(Number(period.start)) || !Number.isInteger(Number(period.end)) || !Number.isInteger(Number(period.limit)) || Number(period.start) < 1 || Number(period.end) < Number(period.start) || Number(period.limit) < 0)) { setMessage("Every transfer period needs a name, valid match range, and a whole-number limit."); return; }
    const sorted = transferPeriods.map(period => ({ ...period, startNumber: Number(period.start), endNumber: Number(period.end) })).sort((a, b) => a.startNumber - b.startNumber);
    if (sorted[0].startNumber !== 1) { setMessage("The first transfer period must start at Match 1."); return; }
    if (sorted.some((period, index) => index > 0 && period.startNumber <= sorted[index - 1].endNumber)) { setMessage("Transfer period match ranges cannot overlap."); return; }
    const gap = sorted.find((period, index) => index > 0 && period.startNumber !== sorted[index - 1].endNumber + 1);
    if (gap) { const previous = sorted[sorted.indexOf(gap) - 1]; setMessage(`Transfer periods cannot have a gap. Match ${previous.endNumber + 1} is not covered.`); return; }
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("publish_league_transfer_periods", { p_league_id: leagueId, p_periods: transferPeriods.map((period, index) => ({ code: period.code, name: period.name.trim(), start_match_number: Number(period.start), end_match_number: Number(period.end), transfer_limit: Number(period.limit), first_match_free: period.firstMatchFree, sort_order: index + 1 })) });
    if (error) setMessage(userActionError(error, "Transfer-period publication"));
    else setMessage(`Published ${(data as any)?.period_count ?? transferPeriods.length} configurable transfer periods.`);
    setBusy(false);
  };
  const publishScores = async (fixtureId: string) => {
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("publish_match_scores_safe", { p_fixture_id: fixtureId });
    if (error) setMessage(userActionError(error, "Score publication"));
    else { const result = data as any; setMessage(`Published Match scores for ${result.member_count} owners.`); await loadScoringFixtures(); }
    setBusy(false);
  };
  const settleAbandoned = async (fixtureId: string) => {
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("settle_abandoned_match", { p_fixture_id: fixtureId });
    if (error) setMessage(userActionError(error, "Abandoned-match settlement"));
    else { const result = data as any; setMessage(`Published zero points for ${result.member_count} owners and returned transfers and boosters.`); await loadScoringFixtures(); }
    setBusy(false);
  };
  const requestPublicationConfirmation = () => {
    const publication = section === "format"
      ? {
          title: "Publish league format?",
          detail: "This updates the league mode and enabled features. Confirm that ownership, bidding, and special-player settings are correct before continuing.",
          action: publishFormat,
        }
      : section === "special"
        ? {
            title: "Publish Unique & Royalty rules?",
            detail: `A new rule version will apply from Match ${specialEffectiveMatch}. Previously published match results remain unchanged.`,
            action: publishSpecialRules,
          }
        : section === "phases"
          ? {
              title: "Publish league phases?",
              detail: "This updates fixture phase assignments and phase-wise rankings. Review every match range before continuing.",
              action: publishPhases,
            }
          : section === "transfers"
            ? {
                title: "Publish transfer periods?",
                detail: "This applies the configured limits to future submissions and regroups recorded usage by these match ranges.",
                action: publishTransfers,
              }
            : {
                title: "Publish playing and points rules?",
                detail: `New versions will apply from Match ${playingEffectiveMatch} for playing rules and Match ${pointsEffectiveMatch} for points rules. Published results remain unchanged.`,
                action: publish,
              };
    Alert.alert(publication.title, publication.detail, [
      { text: "Cancel", style: "cancel" },
      { text: "Publish", onPress: () => runAction(publication.action) },
    ]);
  };

  if (busy && !scoringDocument) return <View style={s.adminLoading}><ActivityIndicator color="#174D3D" /><Text style={s.adminLoadingText}>Loading active rules…</Text></View>;
  return <AdminEditContext.Provider value={canEdit}><ScrollView contentContainerStyle={[s.content, s.pageSurface]} keyboardShouldPersistTaps="handled">
<Text style={s.greeting}>Rules</Text>
<Text style={s.subtitle}>{leagueName} · {canEdit ? "editable league configuration" : "read-only league configuration"}</Text>
<View style={s.adminNotice}>
<Text style={s.adminNoticeTitle}>{canEdit ? "League administrator" : "Read only"}</Text>
<Text style={s.adminNoticeText}>{canEdit ? "You can publish rule changes. Published match calculations keep their original rule version." : "Only a league administrator can publish changes. You can review every active rule and scoring status."}</Text>
</View>
<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.adminTabs}>
<TouchableOpacity style={[s.adminTab, section === "format" && s.adminTabActive]} onPress={() => setSection("format")}>
<Text style={[s.adminTabText, section === "format" && s.adminTabTextActive]}>League Format</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.adminTab, section === "special" && s.adminTabActive]} onPress={() => setSection("special")}>
<Text style={[s.adminTabText, section === "special" && s.adminTabTextActive]}>Unique & Royalty · v{specialRulesVersion}</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.adminTab, section === "playing" && s.adminTabActive]} onPress={() => setSection("playing")}>
<Text style={[s.adminTabText, section === "playing" && s.adminTabTextActive]}>Playing · v{versions.playing}</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.adminTab, section === "points" && s.adminTabActive]} onPress={() => setSection("points")}>
<Text style={[s.adminTabText, section === "points" && s.adminTabTextActive]}>Points · v{versions.points}</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.adminTab, section === "phases" && s.adminTabActive]} onPress={() => setSection("phases")}>
<Text style={[s.adminTabText, section === "phases" && s.adminTabTextActive]}>League Phases</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.adminTab, section === "transfers" && s.adminTabActive]} onPress={() => setSection("transfers")}>
<Text style={[s.adminTabText, section === "transfers" && s.adminTabTextActive]}>Transfers</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.adminTab, section === "owners" && s.adminTabActive]} onPress={() => setSection("owners")}>
<Text style={[s.adminTabText, section === "owners" && s.adminTabTextActive]}>Owners</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.adminTab, section === "templates" && s.adminTabActive]} onPress={() => setSection("templates")}>
<Text style={[s.adminTabText, section === "templates" && s.adminTabTextActive]}>Templates</Text>
</TouchableOpacity>
<TouchableOpacity style={[s.adminTab, section === "scoring" && s.adminTabActive]} onPress={() => setSection("scoring")}>
<Text style={[s.adminTabText, section === "scoring" && s.adminTabTextActive]}>Match Scoring</Text>
</TouchableOpacity>
</ScrollView>{section === "format" ? <View>
<View style={s.adminCard}><Text style={s.adminGroupTitle}>Player acquisition</Text><Text style={s.adminNoticeText}>Choose this before the league starts. The format is locked after setup.</Text><View style={s.ownerRoleRow}><TouchableOpacity disabled={!canEdit} style={[s.ownerRoleButton, leagueFormat.acquisition_mode === "auction" && s.ownerRoleButtonActive]} onPress={() => selectAcquisitionMode("auction")}><Text style={s.ownerRoleText}>Auction / Owned</Text></TouchableOpacity><TouchableOpacity disabled={!canEdit} style={[s.ownerRoleButton, leagueFormat.acquisition_mode === "all_open" && s.ownerRoleButtonActive]} onPress={() => selectAcquisitionMode("all_open")}><Text style={s.ownerRoleText}>All Open Players</Text></TouchableOpacity></View></View>
<View style={s.adminCard}><Text style={s.adminGroupTitle}>Ownership features</Text><FormatToggle label="Bidding enabled" detail="Used only for auction/owned leagues" value={leagueFormat.bidding_enabled} disabled={!canEdit || leagueFormat.acquisition_mode === "all_open"} onPress={() => setLeagueFormat(current => ({ ...current, bidding_enabled: !current.bidding_enabled }))} /><FormatToggle label="Other-owner deductions" detail="Apply borrowing deductions and transfer rules" value={leagueFormat.other_owner_deductions_enabled} disabled={!canEdit || leagueFormat.acquisition_mode === "all_open"} onPress={() => setLeagueFormat(current => ({ ...current, other_owner_deductions_enabled: !current.other_owner_deductions_enabled }))} /></View>
<View style={s.adminCard}><Text style={s.adminGroupTitle}>Optional competition features</Text><FormatToggle label="Marquee players" detail="Enable marquee classification for royalty rules" value={leagueFormat.marquee_enabled} disabled={!canEdit} onPress={() => setLeagueFormat(current => ({ ...current, marquee_enabled: !current.marquee_enabled }))} /><FormatToggle label="Unique players" detail="Restrict unique-player usage by match, phase or league" value={leagueFormat.unique_players_enabled} disabled={!canEdit} onPress={() => setLeagueFormat(current => ({ ...current, unique_players_enabled: !current.unique_players_enabled }))} />{leagueFormat.unique_players_enabled ? <View><Text style={s.adminFieldDetail}>UNIQUE SCOPE</Text><View style={s.ownerRoleRow}>{(["match", "phase", "league"] as const).map(scope => <TouchableOpacity key={scope} disabled={!canEdit} style={[s.ownerRoleButton, leagueFormat.unique_scope === scope && s.ownerRoleButtonActive]} onPress={() => setLeagueFormat(current => ({ ...current, unique_scope: scope }))}><Text style={s.ownerRoleText}>{scope.charAt(0).toUpperCase() + scope.slice(1)}</Text></TouchableOpacity>)}</View></View> : null}<FormatToggle label="Royalty points" detail="Enable configured marquee and unique royalty scoring" value={leagueFormat.royalty_enabled} disabled={!canEdit} onPress={() => setLeagueFormat(current => ({ ...current, royalty_enabled: !current.royalty_enabled }))} /></View>
</View> : section === "special" ? <View>
<View style={s.adminPhaseHelp}><Text style={s.adminNoticeTitle}>Unique, Marquee and Royalty</Text><Text style={s.adminNoticeText}>Versioned rules apply only from the selected unlocked match. Locked and published matches retain their original version.</Text></View>
<View style={s.adminCard}>
<Text style={s.adminGroupTitle}>Rule schedule</Text>
<AdminNumberField label="Effective from match" detail="Must be an unlocked scheduled match" value={specialEffectiveMatch} onChange={setSpecialEffectiveMatch} />
</View>
<View style={s.adminCard}>
<Text style={s.adminGroupTitle}>Unique-player-driven league</Text>
<Text style={s.adminNoticeText}>Each owner declares owned Unique Players for the phase. Their owner may use power roles; borrowing owners cannot. Borrowing another owner's player also incurs the configured usage fee.</Text>
<FormatToggle label="Use Unique-player-driven rules" detail={leagueFormat.acquisition_mode === "all_open" ? "Unavailable: this league has no player ownership" : "Turns Royalty-driven rules off"} value={specialRules.unique_mode_enabled} disabled={!canEdit || leagueFormat.acquisition_mode === "all_open"} onPress={() => setSpecialRules(current => ({ ...current, unique_mode_enabled: !current.unique_mode_enabled, marquee_mode_enabled: false }))} />
{specialRules.unique_mode_enabled ? <View>
<AdminNumberField label="Unique Players per owner" value={specialRules.unique_players_per_owner} onChange={value => updateSpecialNumber("unique_players_per_owner", value)} />
<AdminNumberField label="Other-player usage fee" detail="percentage of final contribution" value={specialRules.other_player_fee_percent} onChange={value => updateSpecialNumber("other_player_fee_percent", value)} />
<AdminNumberField label="Minimum usage fee" detail="points; applied even when contribution is zero" value={specialRules.other_player_minimum_fee} onChange={value => updateSpecialNumber("other_player_minimum_fee", value)} />
<FormatToggle label="Restrict Captain" detail="Borrowing owners cannot make a Unique Player Captain" value={specialRules.unique_restrict_captain} disabled={!canEdit} onPress={() => setSpecialRules(current => ({ ...current, unique_restrict_captain: !current.unique_restrict_captain }))} />
<FormatToggle label="Restrict Vice-Captain" detail="Borrowing owners cannot make a Unique Player Vice-Captain" value={specialRules.unique_restrict_vice_captain} disabled={!canEdit} onPress={() => setSpecialRules(current => ({ ...current, unique_restrict_vice_captain: !current.unique_restrict_vice_captain }))} />
<FormatToggle label="Restrict BAI / BOI" detail="Borrowing owners cannot use a Unique Player as an Impact Player" value={specialRules.unique_restrict_impact} disabled={!canEdit} onPress={() => setSpecialRules(current => ({ ...current, unique_restrict_impact: !current.unique_restrict_impact }))} />
<FormatToggle label="Restrict 3X" detail="Borrowing owners cannot give a Unique Player Triple Impact" value={specialRules.unique_restrict_3x} disabled={!canEdit} onPress={() => setSpecialRules(current => ({ ...current, unique_restrict_3x: !current.unique_restrict_3x }))} />
</View> : <Text style={s.adminFieldDetail}>OFF · No Unique declaration, power restriction or special borrowing fee.</Text>}
</View>
<View style={s.adminCard}>
<Text style={s.adminGroupTitle}>Royalty-driven league</Text>
<Text style={s.adminNoticeText}>Each owner declares owned Marquee Players. Borrowers retain all their points, while the owning owner earns additional rounded royalty. Players become automatically Unique after the configured league-wide usage threshold.</Text>
<FormatToggle label="Use Royalty-driven rules" detail={leagueFormat.acquisition_mode === "all_open" ? "Unavailable: this league has no player ownership" : "Turns Unique-player-driven rules off; Automatic Unique defaults to ON"} value={specialRules.marquee_mode_enabled} disabled={!canEdit || leagueFormat.acquisition_mode === "all_open"} onPress={() => setSpecialRules(current => { const enabling = !current.marquee_mode_enabled; return { ...current, marquee_mode_enabled: enabling, unique_mode_enabled: false, automatic_unique_enabled: enabling ? true : current.automatic_unique_enabled }; })} />
{specialRules.marquee_mode_enabled ? <View>
<AdminNumberField label="Marquee Players per owner" value={specialRules.marquee_players_per_owner} onChange={value => updateSpecialNumber("marquee_players_per_owner", value)} />
<AdminNumberField label="Regular-player royalty" detail="percentage" value={specialRules.regular_royalty_percent} onChange={value => updateSpecialNumber("regular_royalty_percent", value)} />
<AdminNumberField label="Minimum regular-player royalty" detail="points, including zero or negative contribution" value={specialRules.regular_minimum_royalty} onChange={value => updateSpecialNumber("regular_minimum_royalty", value)} />
<AdminNumberField label="Marquee-player royalty" detail="percentage" value={specialRules.marquee_royalty_percent} onChange={value => updateSpecialNumber("marquee_royalty_percent", value)} />
<AdminNumberField label="Minimum Marquee-player royalty" detail="points, including zero or negative contribution" value={specialRules.marquee_minimum_royalty} onChange={value => updateSpecialNumber("marquee_minimum_royalty", value)} />
<View style={s.adminNotice}><Text style={s.adminNoticeText}>Royalty is never negative. For a zero or negative contribution, the configured minimum still applies: regular-player minimum or Marquee-player minimum.</Text></View>
<View style={s.adminField}><View style={{ flex: 1 }}><Text style={s.adminFieldLabel}>Royalty rounding</Text><Text style={s.adminFieldDetail}>Applied separately for every borrowing owner</Text></View></View>
<View style={s.ownerRoleRow}>{([['immediate_whole_point', 'Immediate'], ['final_total_whole_point', 'Final total'], ['none', 'Decimals']] as const).map(([value, label]) => <TouchableOpacity key={value} disabled={!canEdit} style={[s.ownerRoleButton, specialRules.royalty_rounding === value && s.ownerRoleButtonActive]} onPress={() => setSpecialRules(current => ({ ...current, royalty_rounding: value }))}><Text style={s.ownerRoleText}>{label}</Text></TouchableOpacity>)}</View>
<FormatToggle label="Automatic Unique status" detail="Based on locked-XI appearances across the league" value={specialRules.automatic_unique_enabled} disabled={!canEdit} onPress={() => setSpecialRules(current => ({ ...current, automatic_unique_enabled: !current.automatic_unique_enabled }))} />
<AdminNumberField label="Automatic Unique threshold" detail="Becomes Unique after exceeding this usage count" value={specialRules.automatic_unique_usage_threshold} onChange={value => updateSpecialNumber("automatic_unique_usage_threshold", value)} />
</View> : <Text style={s.adminFieldDetail}>OFF · No Marquee declaration, royalty credit or automatic Unique conversion.</Text>}
</View>
<View style={s.adminCard}>
<Text style={s.adminGroupTitle}>Unique / Marquee selection timing</Text>
<Text style={s.adminNoticeText}>Controls when owners must finalize their special players for each phase. Final/playoff selections always carry forward and cannot be changed.</Text>
<AdminNumberField label="Selection closes before phase" detail="Hours before that phase's first match. Example: 24 closes owner changes one day before the phase begins." value={specialRules.phase_change_deadline_hours} onChange={value => updateSpecialNumber("phase_change_deadline_hours", value)} />
<FormatToggle label="Mid-phase injury replacement" detail="Confirmed default is OFF; playoff changes remain blocked" value={specialRules.mid_phase_replacement_allowed} disabled={!canEdit} onPress={() => setSpecialRules(current => ({ ...current, mid_phase_replacement_allowed: !current.mid_phase_replacement_allowed }))} />
</View>
</View> : section === "playing" ? <View style={s.adminCard}>
<Text style={s.adminGroupTitle}>Rule schedule</Text>
<AdminNumberField label="Effective from match" detail="Applies from this match onward" value={playingEffectiveMatch} onChange={setPlayingEffectiveMatch} />
<Text style={s.adminGroupTitle}>Team selection</Text>
<AdminNumberField label="Playing XI size" value={playing.lineup_size} onChange={value => updatePlaying("lineup_size", value)} />
<AdminNumberField label="Lineup budget" detail="₹ million" value={playing.lineup_budget} onChange={value => updatePlaying("lineup_budget", value)} />
<AdminNumberField label="Minimum batters" value={playing.min_batters} onChange={value => updatePlaying("min_batters", value)} />
<AdminNumberField label="Minimum bowlers" value={playing.min_bowlers} onChange={value => updatePlaying("min_bowlers", value)} />
<AdminNumberField label="Minimum wicketkeepers" value={playing.min_wicketkeepers} onChange={value => updatePlaying("min_wicketkeepers", value)} />
<AdminNumberField label="Minimum all-rounders" value={playing.min_all_rounders} onChange={value => updatePlaying("min_all_rounders", value)} />
<AdminNumberField label="Maximum from one IPL team" value={playing.max_from_one_team} onChange={value => updatePlaying("max_from_one_team", value)} />
<Text style={s.adminGroupTitle}>Multipliers and borrowing</Text>
<AdminNumberField label="Captain multiplier" value={playing.captain_multiplier} onChange={value => updatePlaying("captain_multiplier", value)} />
<AdminNumberField label="Vice-Captain multiplier" value={playing.vice_captain_multiplier} onChange={value => updatePlaying("vice_captain_multiplier", value)} />
<AdminNumberField label="BAI / BOI multiplier" value={playing.impact_multiplier} onChange={value => updatePlaying("impact_multiplier", value)} />
<AdminNumberField label="Other-owner penalty" detail="percentage" value={playing.other_owner_penalty_percent} onChange={value => updatePlaying("other_owner_penalty_percent", value)} />
<AdminNumberField label="Minimum other-owner penalty" detail="points" value={playing.other_owner_minimum_penalty} onChange={value => updatePlaying("other_owner_minimum_penalty", value)} />
</View> : section === "points" ? <View style={s.adminCard}>
<Text style={s.adminGroupTitle}>Rule schedule</Text>
<AdminNumberField label="Effective from match" detail="Applies to scoring from this match onward" value={pointsEffectiveMatch} onChange={setPointsEffectiveMatch} />
<Text style={s.adminGroupTitle}>Batting</Text>
<AdminNumberField label="Every run" value={points.run} onChange={value => updatePoints("run", value)} />
<AdminNumberField label="Four bonus" value={points.four_bonus} onChange={value => updatePoints("four_bonus", value)} />
<AdminNumberField label="Six bonus" value={points.six_bonus} onChange={value => updatePoints("six_bonus", value)} />
<AdminNumberField label="Duck · non-bowler" value={points.duck} onChange={value => updatePoints("duck", value)} />
<AdminNumberField label="Golden / diamond duck" value={points.golden_duck} onChange={value => updatePoints("golden_duck", value)} />
<Text style={s.adminGroupTitle}>Bowling</Text>
<AdminNumberField label="Dismissed bowler wicket" value={points.bowler_wicket} onChange={value => updatePoints("bowler_wicket", value)} />
<AdminNumberField label="Dismissed non-bowler wicket" value={points.non_bowler_wicket} onChange={value => updatePoints("non_bowler_wicket", value)} />
<AdminNumberField label="Maiden over" value={points.maiden} onChange={value => updatePoints("maiden", value)} />
<AdminNumberField label="Dot ball" value={points.dot_ball} onChange={value => updatePoints("dot_ball", value)} />
<Text style={s.adminGroupTitle}>Fielding and bonus</Text>
<AdminNumberField label="Catch" value={points.catch} onChange={value => updatePoints("catch", value)} />
<AdminNumberField label="Stumping" value={points.stumping} onChange={value => updatePoints("stumping", value)} />
<AdminNumberField label="Run out" value={points.run_out} onChange={value => updatePoints("run_out", value)} />
<AdminNumberField label="Player of the match" value={points.player_of_match} onChange={value => updatePoints("player_of_match", value)} />
<AdminNumberField label="Winning participant" value={points.winning_participant} onChange={value => updatePoints("winning_participant", value)} />
</View> : section === "phases" ? <View>
<View style={s.adminPhaseHelp}>
<Text style={s.adminNoticeTitle}>Ranking periods</Text>
<Text style={s.adminNoticeText}>Every fixture must belong to exactly one phase. Overall ranking includes all phases.</Text>
</View>{phases.map((phase, index) => <View key={phase.code} style={s.adminPhaseCard}>
<View style={s.adminPhaseHeader}>
<TextInput editable={canEdit} style={[s.adminPhaseNameInput, !canEdit && s.adminInputReadOnly]} value={phase.name} onChangeText={value => updatePhase(index, "name", value)} />
<TouchableOpacity disabled={!canEdit || phases.length === 1} style={[s.adminPhaseRemove, !canEdit && s.disabled]} onPress={() => setPhases(current => current.filter((_, phaseIndex) => phaseIndex !== index))}>
<Text style={s.adminPhaseRemoveText}>Remove</Text>
</TouchableOpacity>
</View>
<View style={s.adminPhaseRange}>
<View style={{ flex: 1 }}>
<Text style={s.adminFieldDetail}>START MATCH</Text>
<TextInput editable={canEdit} style={[s.adminPhaseNumberInput, !canEdit && s.adminInputReadOnly]} value={phase.start} onChangeText={value => updatePhase(index, "start", value)} keyboardType="number-pad" />
</View>
<Text style={s.adminPhaseTo}>to</Text>
<View style={{ flex: 1 }}>
<Text style={s.adminFieldDetail}>END MATCH</Text>
<TextInput editable={canEdit} style={[s.adminPhaseNumberInput, !canEdit && s.adminInputReadOnly]} value={phase.end} onChangeText={value => updatePhase(index, "end", value)} keyboardType="number-pad" />
</View>
</View>
</View>)}<TouchableOpacity disabled={!canEdit} style={[s.adminAddPhase, !canEdit && s.disabled]} onPress={addPhase}>
<Text style={s.adminAddPhaseText}>＋ Add another phase</Text>
</TouchableOpacity>
</View> : section === "transfers" ? <View>
<View style={s.adminPhaseHelp}><Text style={s.adminNoticeTitle}>Configurable transfer periods</Text><Text style={s.adminNoticeText}>Each period has its own balance. A free first match resets the carried team and does not charge transfers. Period ranges cannot overlap.</Text></View>
{transferPeriods.map((period, index) => <View key={period.code} style={s.adminPhaseCard}>
<View style={s.adminPhaseHeader}><TextInput editable={canEdit} style={[s.adminPhaseNameInput, !canEdit && s.adminInputReadOnly]} value={period.name} onChangeText={value => updateTransferPeriod(index, "name", value)} /><TouchableOpacity disabled={!canEdit || transferPeriods.length === 1} style={[s.adminPhaseRemove, !canEdit && s.disabled]} onPress={() => setTransferPeriods(current => current.filter((_, periodIndex) => periodIndex !== index))}><Text style={s.adminPhaseRemoveText}>Remove</Text></TouchableOpacity></View>
<View style={s.adminPhaseRange}><View style={{ flex: 1 }}><Text style={s.adminFieldDetail}>START MATCH</Text><TextInput editable={canEdit} style={[s.adminPhaseNumberInput, !canEdit && s.adminInputReadOnly]} value={period.start} onChangeText={value => updateTransferPeriod(index, "start", value)} keyboardType="number-pad" /></View><Text style={s.adminPhaseTo}>to</Text><View style={{ flex: 1 }}><Text style={s.adminFieldDetail}>END MATCH</Text><TextInput editable={canEdit} style={[s.adminPhaseNumberInput, !canEdit && s.adminInputReadOnly]} value={period.end} onChangeText={value => updateTransferPeriod(index, "end", value)} keyboardType="number-pad" /></View></View>
<AdminNumberField label="Transfer allowance" detail={`Shared across Matches ${period.firstMatchFree ? Number(period.start) + 1 : period.start}–${period.end}`} value={period.limit} onChange={value => updateTransferPeriod(index, "limit", value)} />
<TouchableOpacity disabled={!canEdit} style={[s.adminNotice, !canEdit && s.disabled]} onPress={() => setTransferPeriods(current => current.map((item, periodIndex) => periodIndex === index ? { ...item, firstMatchFree: !item.firstMatchFree } : item))}><Text style={s.adminNoticeTitle}>{period.firstMatchFree ? "✓" : "○"} First match is unlimited/free</Text><Text style={s.adminNoticeText}>{period.firstMatchFree ? `Match ${period.start || "—"} resets this period's balance.` : "The first match can consume this period's allowance."}</Text></TouchableOpacity>
</View>)}<TouchableOpacity disabled={!canEdit} style={[s.adminAddPhase, !canEdit && s.disabled]} onPress={addTransferPeriod}><Text style={s.adminAddPhaseText}>＋ Add transfer period</Text></TouchableOpacity>
</View> : section === "owners" ? <OwnerManagement leagueId={leagueId} canEdit={canEdit} onMembersChanged={onLeaguesChanged} /> : section === "templates" ? <LeagueTemplateManagement leagueId={leagueId} leagueName={leagueName} canEdit={canEdit} onLeaguesChanged={onLeaguesChanged} /> : <View><View style={s.adminPhaseHelp}><Text style={s.adminNoticeTitle}>Score review and publication</Text><Text style={s.adminNoticeText}>{canEdit ? "The score processor uploads calculated player points first. Only matches in REVIEW can be published to owners and rankings." : "Match scoring status is visible here. Only a league administrator can publish or settle scores."}</Text></View>{scoringFixtures.length ? scoringFixtures.map((fixture: any) => <View key={fixture.id} style={s.adminPhaseCard}><View style={s.adminPhaseHeader}><View style={{ flex: 1 }}><Text style={s.adminNoticeTitle}>Match {fixture.match_number}</Text><View style={s.adminFixtureTeams}><IplTeamBadge code={fixture.home?.code} /><Text style={s.fixtureVs}>vs</Text><IplTeamBadge code={fixture.away?.code} /></View><Text style={s.adminNoticeText}>{fixture.status.toUpperCase()} · {fixture.scoring_status.toUpperCase()}</Text></View>{canEdit && fixture.status === "abandoned" && fixture.scoring_status !== "published" ? <TouchableOpacity disabled={busy} style={s.resetButton} onPress={() => runAction(() => settleAbandoned(fixture.id))}><Text style={s.resetButtonText}>Settle zero</Text></TouchableOpacity> : canEdit && fixture.scoring_status === "review" ? <TouchableOpacity disabled={busy} style={s.resetButton} onPress={() => runAction(() => publishScores(fixture.id))}><Text style={s.resetButtonText}>Publish scores</Text></TouchableOpacity> : null}</View></View>) : <View style={s.adminCard}><Text style={s.adminNoticeText}>No live or completed fixtures are available.</Text></View>}</View>}{message ? <View style={[s.adminMessage, message.startsWith("Published") && s.adminMessageSuccess]}>
<Text style={s.adminMessageText}>{message}</Text>
</View> : null}{canEdit && section !== "scoring" && section !== "owners" && section !== "templates" ? <TouchableOpacity disabled={busy} style={[s.primary, busy && s.disabled]} onPress={requestPublicationConfirmation}>{busy ? <ActivityIndicator color="#10251F" /> : <Text style={s.primaryText}>{section === "format" ? "Publish league format" : section === "special" ? "Publish Unique & Royalty rules" : section === "phases" ? "Publish phase configuration" : section === "transfers" ? "Publish transfer periods" : "Review and publish both rule sets"}</Text>}</TouchableOpacity> : null}
<Text style={s.adminFootnote}>{section === "special" ? "Changes apply only from the selected unlocked match. Historical scoring remains pinned to its original version." : section === "phases" ? "Changing phases updates fixture assignments and phase-wise ranking." : section === "transfers" ? "Transfer periods apply immediately to future submissions; recorded usage is regrouped by the published match ranges." : "Milestone, strike-rate and economy tables remain preserved when these headline values are updated."}</Text>
</ScrollView></AdminEditContext.Provider>;
}

function Dashboard({ memberName, tab, bid, setBid, openTeam }: { memberName: string; tab: Tab; bid: number; setBid: (n: number) => void; openTeam: () => void }) {
  const memberRank = standings.findIndex(([name]) => name === memberName) + 1;
  return <>
    <Text style={s.greeting}>Good evening, {memberName}</Text><Text style={s.subtitle}>IPL 2026 · Private league</Text>
    <View style={s.hero}><Text style={s.heroLabel}>NEXT MATCH · M6</Text><Text style={s.heroTitle}>KKR <Text style={s.vs}>vs</Text> SRH</Text><Text style={s.heroMeta}>Apr 2 · 7:30 PM · Lineup open</Text><TouchableOpacity style={s.primary} onPress={openTeam}><Text style={s.primaryText}>Set playing XI</Text></TouchableOpacity></View>
    <View style={s.stats}><Stat label="RANK" value={memberRank > 0 ? `#${memberRank}` : "—"} detail="after Match 5" /><Stat label="BUDGET" value="₹0m" detail="auction balance" /><Stat label="TRANSFERS" value="0/105" detail="league stage" /></View>
    {tab === "Auction" ? <><Text style={s.sectionTitle}>Live auction</Text><View style={s.auction}><Text style={s.timer}>08</Text><View style={s.avatar}><Text style={s.avatarText}>AS</Text></View><Text style={s.auctionName}>Abhishek Sharma</Text><Text style={s.meta}>ALL-ROUNDER · SRH</Text><Text style={s.bidLabel}>CURRENT BID</Text><Text style={s.bid}>₹{bid.toFixed(1)}m</Text><Text style={s.meta}>Pandiyan is leading</Text><TouchableOpacity style={s.primary} onPress={() => setBid(bid + 0.5)}><Text style={s.primaryText}>Bid ₹{(bid + 0.5).toFixed(1)}m</Text></TouchableOpacity></View></> : tab === "Squads" ? <OwnerSquadPoints currentOwner={memberName} /> : <LeagueRanking />}
  </>;
}

const completedMatchIds = ["M1", "M2", "M3", "M4", "M5"];
type RankingPhase = "overall" | "phase1" | "phase2" | "phase3";
const rankingPhases: Array<{ code: RankingPhase; name: string; range: string; matches: string[] }> = [
  { code: "overall", name: "Overall", range: "Matches 1–74", matches: completedMatchIds },
  { code: "phase1", name: "Phase 1", range: "Matches 1–35", matches: completedMatchIds },
  { code: "phase2", name: "Phase 2", range: "Matches 36–70", matches: [] },
  { code: "phase3", name: "Phase 3", range: "Playoffs · 71–74", matches: [] },
];
function ownerPointsForMatches(owner: string, matchIds: string[]) {
  return matchIds.reduce((sum, matchId) => sum + ownerMatchPoints(owner, matchId), 0);
}
function LeagueRanking() {
  const [phase, setPhase] = useState<RankingPhase>("overall");
  const selectedPhase = rankingPhases.find(item => item.code === phase) ?? rankingPhases[0];
  const phaseStandings = leagueOwners.map(owner => [owner, ownerPointsForMatches(owner, selectedPhase.matches)] as [string, number]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return <View>
    <Text style={s.sectionTitle}>League Ranking</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rankingPhaseTabs}>{rankingPhases.map(item => <TouchableOpacity key={item.code} style={[s.rankingPhaseTab, phase === item.code && s.rankingPhaseTabActive]} onPress={() => setPhase(item.code)}><Text style={[s.rankingPhaseName, phase === item.code && s.rankingPhaseNameActive]}>{item.name}</Text><Text style={[s.rankingPhaseRange, phase === item.code && s.rankingPhaseRangeActive]}>{item.range}</Text></TouchableOpacity>)}</ScrollView>
    <View style={s.pointsReset}><Text style={s.pointsResetTitle}>{selectedPhase.name} ranking</Text><Text style={s.pointsResetText}>{selectedPhase.matches.length ? `${selectedPhase.matches.length} calculated matches included.` : "No calculated matches in this phase yet. Rankings will update when match scores are published."}</Text></View>
    <View style={s.card}>{phaseStandings.map(([name, points], index) => { const rank = phaseStandings.findIndex(([, value]) => value === points) + 1; return <View key={name} style={s.standing}><Text style={s.position}>{rank}</Text><View style={s.badge}><Text style={s.badgeText}>{name[0]}</Text></View><Text style={s.owner}>{name}</Text><Text style={s.points}>{Math.round(points)} pts</Text></View>; })}</View>
  </View>;
}

type PointTotals = { batting: number; bowling: number; fielding: number; bonus: number; total: number };
function playerPointTotals(playerName: string): PointTotals {
  return completedMatchIds.reduce((sum, matchId) => {
    const points = completedMatchPoints[matchId]?.[playerName];
    if (!points) return sum;
    return { batting: sum.batting + points.batting, bowling: sum.bowling + points.bowling, fielding: sum.fielding + points.fielding, bonus: sum.bonus + points.bonus, total: sum.total + points.total };
  }, { batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 });
}
function OwnerSquadPoints({ currentOwner }: { currentOwner: string }) {
  const [expandedOwner, setExpandedOwner] = useState(currentOwner);
  const [expandedPlayer, setExpandedPlayer] = useState("");
  const orderedOwners = [...testOwners].sort((ownerA, ownerB) => ownerA === currentOwner ? -1 : ownerB === currentOwner ? 1 : ownerA.localeCompare(ownerB));
  return <View>
    <Text style={s.sectionTitle}>Owner Squads</Text>
    <Text style={s.helper}>Based on Bid Summary · expand an owner, then a player, for match-by-match points.</Text>
    {orderedOwners.map(ownerName => {
      const ownerPlayers = players.filter(player => player.owner === ownerName).map(player => ({ player, points: playerPointTotals(player.name) })).sort((a, b) => b.points.total - a.points.total || a.player.team.localeCompare(b.player.team) || a.player.name.localeCompare(b.player.name));
      const totals = ownerPlayers.reduce((sum, item) => ({ batting: sum.batting + item.points.batting, bowling: sum.bowling + item.points.bowling, fielding: sum.fielding + item.points.fielding, bonus: sum.bonus + item.points.bonus, total: sum.total + item.points.total }), { batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 });
      const expanded = expandedOwner === ownerName;
      return <View key={ownerName} style={s.ownerSquadCard}>
        <TouchableOpacity style={s.ownerSquadHeader} onPress={() => { setExpandedOwner(expanded ? "" : ownerName); setExpandedPlayer(""); }}>
          <View style={s.badge}><Text style={s.badgeText}>{ownerName[0]}</Text></View><View style={{ flex: 1, marginLeft: 9 }}><Text style={s.ownerSquadName}>{ownerName}{ownerName === currentOwner ? " · You" : ""}</Text><Text style={s.ownerSquadMeta}>{ownerPlayers.length} auction players · through Match 5</Text></View><Text style={s.ownerSquadTotal}>{totals.total} pts</Text><Text style={s.pointsChevron}>{expanded ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {expanded && <View style={s.ownerSquadBody}>
          <View style={s.ownerPointColumns}><Text style={s.ownerPointPlayer}>PLAYER</Text><Text style={s.ownerPointCell}>BAT</Text><Text style={s.ownerPointCell}>BOWL</Text><Text style={s.ownerPointCell}>FLD</Text><Text style={s.ownerPointCell}>BON</Text><Text style={s.ownerPointTotal}>TOTAL</Text></View>
          {ownerPlayers.map(({ player, points }) => { const key = `${ownerName}:${player.name}`; const playerExpanded = expandedPlayer === key; return <View key={player.name}>
            <TouchableOpacity style={s.ownerPlayerRow} onPress={() => setExpandedPlayer(playerExpanded ? "" : key)}><Text style={s.playerBreakChevron}>{playerExpanded ? "▲" : "▼"}</Text><View style={s.ownerPointPlayer}><Text style={s.ownerPlayerName}>{player.name}</Text><View style={s.teamSubMeta}><IplTeamBadge code={player.team} /><Text style={s.ownerPlayerMeta}>{player.role} · ₹{player.price}m</Text></View></View><Text style={s.ownerPointCell}>{points.batting}</Text><Text style={s.ownerPointCell}>{points.bowling}</Text><Text style={s.ownerPointCell}>{points.fielding}</Text><Text style={s.ownerPointCell}>{points.bonus}</Text><Text style={s.ownerPointTotal}>{points.total}</Text></TouchableOpacity>
            {playerExpanded && <View style={s.ownerMatchBreakdown}>{completedMatchIds.map(matchId => { const matchPoints = completedMatchPoints[matchId]?.[player.name] ?? { batting: 0, bowling: 0, fielding: 0, bonus: 0, total: 0 }; return <View key={matchId} style={s.ownerMatchRow}><Text style={s.ownerMatchName}>{matchId}</Text><Text style={s.ownerMatchCell}>{matchPoints.batting}</Text><Text style={s.ownerMatchCell}>{matchPoints.bowling}</Text><Text style={s.ownerMatchCell}>{matchPoints.fielding}</Text><Text style={s.ownerMatchCell}>{matchPoints.bonus}</Text><Text style={s.ownerMatchTotal}>{matchPoints.total}</Text></View>; })}</View>}
          </View>; })}
          <View style={s.ownerTotalsRow}><Text style={s.ownerPointPlayer}>SQUAD TOTAL</Text><Text style={s.ownerPointCell}>{totals.batting}</Text><Text style={s.ownerPointCell}>{totals.bowling}</Text><Text style={s.ownerPointCell}>{totals.fielding}</Text><Text style={s.ownerPointCell}>{totals.bonus}</Text><Text style={s.ownerPointTotal}>{totals.total}</Text></View>
        </View>}
      </View>;
    })}
  </View>;
}

function MatchesScreen() {
  const [expandedMatch, setExpandedMatch] = useState("M1");
  const [expandedPlayer, setExpandedPlayer] = useState("");
  const [scoringVersions, setScoringVersions] = useState<Array<{ version: number; effective_from_match_number: number; rules: ScoringRulesDocument }>>([]);
  const [rulesMessage, setRulesMessage] = useState("");
  useEffect(() => {
    supabase.from("scoring_rule_sets").select("version,effective_from_match_number,rules").eq("league_id", IPL_2026_DATABASE_ID).order("effective_from_match_number").then(({ data, error }) => {
      if (error) setRulesMessage(userActionError(error, "Points rules refresh"));
      else setScoringVersions((data ?? []) as Array<{ version: number; effective_from_match_number: number; rules: ScoringRulesDocument }>);
    });
  }, []);
  return <ScrollView contentContainerStyle={s.content}><Text style={s.greeting}>Matches</Text><Text style={s.subtitle}>All 70 IPL fixtures · tap a match to expand or collapse</Text>{rulesMessage ? <View style={s.warningCard}><Text style={s.warningText}>⚠ {rulesMessage}</Text></View> : null}{iplFixtures.map(match => {
    const expanded = expandedMatch === match.id;
    const calculated = match.status === "Calculated";
    const scoringVersion = [...scoringVersions].filter(item => item.effective_from_match_number <= match.number).sort((a, b) => b.effective_from_match_number - a.effective_from_match_number || b.version - a.version)[0];
    const scoringRules = scoringVersion?.rules ?? defaultScoringRules;
    const calculatedPoints = Object.fromEntries(Object.entries(completedMatchStats[match.id] ?? {}).map(([name, stats]) => [name, calculatePlayerPoints(stats, scoringRules)]));
    const rankedPlayers = Object.entries(calculatedPoints).sort(([nameA, pointsA], [nameB, pointsB]) => {
      const teamA = players.find(player => player.name === nameA)?.team ?? "";
      const teamB = players.find(player => player.name === nameB)?.team ?? "";
      return teamA.localeCompare(teamB) || pointsB.total - pointsA.total;
    });
    return <View key={match.id} style={s.pointsMatchCard}>
      <TouchableOpacity style={s.pointsMatchHeader} onPress={() => { setExpandedMatch(expanded ? "" : match.id); setExpandedPlayer(""); }}>
        <View style={{ flex: 1 }}><Text style={s.pointsMatchTitle}>Match {match.number} · {match.teams}</Text><Text style={s.pointsMatchMeta}>{match.date} · {match.status}{scoringVersion ? ` · Points Rules v${scoringVersion.version}` : ""}</Text></View>
        <Text style={[s.pointsStatus, calculated ? s.pointsCalculated : s.pointsPending]}>{calculated ? "CALCULATED" : "UPCOMING"}</Text><Text style={s.pointsChevron}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {expanded && (calculated ? <View style={s.pointsMatchBody}>
        <View style={s.pointsColumns}><Text style={s.pointsColumnPlayer}>PLAYER</Text><Text style={s.pointsColumn}>BAT</Text><Text style={s.pointsColumn}>BOWL</Text><Text style={s.pointsColumn}>FLD</Text><Text style={s.pointsColumn}>BON</Text><Text style={s.pointsColumnTotal}>TOTAL</Text></View>
        {rankedPlayers.map(([name, points], index) => { const player = players.find(item => item.name === name); const team = player?.team ?? "—"; const ownership = player?.owner === "Available" ? "OpenPlayer" : player?.owner ? `Owned by ${player.owner}` : "Owner unavailable"; const previousName = index ? rankedPlayers[index - 1][0] : ""; const previousTeam = previousName ? players.find(item => item.name === previousName)?.team : ""; const playerKey = `${match.id}-${name}`; const playerExpanded = expandedPlayer === playerKey; const stats = completedMatchStats[match.id]?.[name]; const details = stats ? calculatePointDetails(stats, scoringRules) : null; return <View key={name}>{team !== previousTeam && <View style={s.pointsTeamHeader}><Text style={s.pointsTeamHeaderText}>{team}</Text><Text style={s.pointsTeamHeaderMeta}>Highest points first</Text></View>}<TouchableOpacity style={s.pointsPlayerRow} onPress={() => setExpandedPlayer(playerExpanded ? "" : playerKey)}><Text style={s.playerBreakChevron}>{playerExpanded ? "▲" : "▼"}</Text><View style={s.pointsPlayerIdentity}><Text style={s.pointsPlayerName}>{name}</Text><Text style={s.pointsPlayerTeam}>{team} · {ownership}</Text></View><Text style={s.pointsCell}>{points.batting}</Text><Text style={s.pointsCell}>{points.bowling}</Text><Text style={s.pointsCell}>{points.fielding}</Text><Text style={s.pointsCell}>{points.bonus}</Text><Text style={s.pointsCellTotal}>{points.total}</Text></TouchableOpacity>{playerExpanded && details && <View style={s.fullBreakdown}><PointDetailSection title="BATTING" rows={details.batting} total={points.batting} /><PointDetailSection title="BOWLING" rows={details.bowling} total={points.bowling} /><PointDetailSection title="FIELDING" rows={details.fielding} total={points.fielding} /><PointDetailSection title="BONUS" rows={details.bonus} total={points.bonus} /></View>}</View>; })}
      </View> : <View style={s.pointsEmpty}><Text style={s.pointsEmptyTitle}>Team selection available before lock</Text><Text style={s.pointsEmptyText}>Points will appear after this match is marked complete and its Cricinfo scorecard is processed.</Text></View>)}
    </View>;
  })}</ScrollView>;
}
function PointDetailSection({ title, rows, total }: { title: string; rows: Array<[string, number]>; total: number }) {
  const visible = rows.filter(([, value]) => value !== 0);
  return <View style={s.detailSection}><View style={s.detailHeading}><Text style={s.detailTitle}>{title}</Text><Text style={s.detailTotal}>{total}</Text></View>{visible.length ? visible.map(([label, value]) => <View key={label} style={s.detailRow}><Text style={s.detailLabel}>{label}</Text><Text style={s.detailValue}>{value > 0 ? `+${value}` : value}</Text></View>) : <Text style={s.detailEmpty}>No points</Text>}</View>;
}

function TeamSelection({ requestedFixtureId, leagueId, memberId, ownershipEnabled, ownerName, roster, fixtures, ruleVersions, rulesLoadMessage, selected, setSelected, captain, setCaptain, vice, setVice, submitted, setSubmitted, impactPlayer, setImpactPlayer, impactType, setImpactType, boosterCode, setBoosterCode, boosterPlayer, setBoosterPlayer }: { requestedFixtureId: string; leagueId: string; memberId: string; ownershipEnabled: boolean; ownerName: string; roster: Player[]; fixtures: UpcomingMatch[]; ruleVersions: SelectionRules[]; rulesLoadMessage: string; selected: string[]; setSelected: (players: string[]) => void; captain: string; setCaptain: (name: string) => void; vice: string; setVice: (name: string) => void; submitted: boolean; setSubmitted: (value: boolean) => void; impactPlayer: string; setImpactPlayer: (name: string) => void; impactType: ImpactType; setImpactType: (type: ImpactType) => void; boosterCode: BoosterCode; setBoosterCode: (code: BoosterCode) => void; boosterPlayer: string; setBoosterPlayer: (name: string) => void }) {
  const runAction = useActionGuard();
  const teamScrollRef = useRef<ScrollView>(null);
  const fixtureStripRef = useRef<ScrollView>(null);
  const teamPositions = useRef<Record<string, number>>({});
  const playerPositions = useRef<Record<string, number>>({});
  const [activeMatchId, setActiveMatchId] = useState("");
  const [showIssues, setShowIssues] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [roleFilter, setRoleFilter] = useState<PlayerRoleFilter>("ALL");
  const [ownershipFilter, setOwnershipFilter] = useState<PlayerOwnershipFilter>("ALL");
  const [playerSort, setPlayerSort] = useState<PlayerSort>("NAME");
  const [expandedTeams, setExpandedTeams] = useState<string[]>([]);
  const [focusedPlayer, setFocusedPlayer] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [lineupLoadBusy, setLineupLoadBusy] = useState(false);
  const [hasSavedCurrentLineup, setHasSavedCurrentLineup] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);
  const [firstMissingPriorMatch, setFirstMissingPriorMatch] = useState<number | null>(null);
  const [carriedForwardNames, setCarriedForwardNames] = useState<Set<string>>(new Set());
  const [boosterUses, setBoosterUses] = useState<Array<{ code: Exclude<BoosterCode, "">; matchNumber: number }>>([]);
  const [leaguePhases, setLeaguePhases] = useState<LeaguePhase[]>([]);
  const [boosterRuleSettings, setBoosterRuleSettings] = useState<BoosterRuleSetting[]>([]);
  const [transferPeriods, setTransferPeriods] = useState<TransferPeriod[]>([]);
  const [transferUsage, setTransferUsage] = useState<Record<string, number>>({});
  const [hasPriorPeriodLineup, setHasPriorPeriodLineup] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [scheduledFixtureCount, setScheduledFixtureCount] = useState<number | null>(null);
  const [specialLabels, setSpecialLabels] = useState<Record<string, string[]>>({});
  const [leaguePlayerPoints, setLeaguePlayerPoints] = useState<Record<string, number>>({});
  const submittedSnapshots = useRef<Record<string, { players: string[]; captain: string; vice: string; impactPlayer: string; impactType: ImpactType }>>({});
  useEffect(() => {
    if (!requestedFixtureId) return;
    const requestedIndex = fixtures.findIndex(match => match.databaseId === requestedFixtureId);
    if (requestedIndex < 0) return;
    setActiveMatchId(fixtures[requestedIndex].id);
    const scrollTimer = setTimeout(() => {
      fixtureStripRef.current?.scrollTo({ x: Math.max(0, requestedIndex * 151 - 20), animated: true });
    }, 80);
    return () => clearTimeout(scrollTimer);
  }, [requestedFixtureId, fixtures]);
  useEffect(() => {
    let mounted = true;
    supabase.from("fixtures").select("id", { count: "exact", head: true }).eq("league_id", leagueId).eq("status", "scheduled").then(({ count }) => {
      if (mounted) setScheduledFixtureCount(count ?? 0);
    });
    return () => { mounted = false; };
  }, [leagueId]);
  useEffect(() => {
    let mounted = true;
    setLeaguePlayerPoints({});
    supabase.from("player_match_points")
      .select("fixture_id,total_points,calculation_version,published_at,player:players(full_name),fixture:fixtures!inner(league_id)")
      .eq("fixture.league_id", leagueId)
      .not("published_at", "is", null)
      .then(({ data }) => {
        if (!mounted) return;
        const latestByMatchAndPlayer = new Map<string, any>();
        for (const row of (data ?? []) as any[]) {
          const name = row.player?.full_name;
          if (!name) continue;
          const key = `${row.fixture_id}:${name}`;
          const current = latestByMatchAndPlayer.get(key);
          if (!current || Number(row.calculation_version) > Number(current.calculation_version)) latestByMatchAndPlayer.set(key, row);
        }
        const totals: Record<string, number> = {};
        for (const row of latestByMatchAndPlayer.values()) {
          const name = row.player.full_name;
          totals[name] = (totals[name] ?? 0) + Number(row.total_points ?? 0);
        }
        setLeaguePlayerPoints(totals);
      });
    return () => { mounted = false; };
  }, [leagueId]);
  const fixture = fixtures.find(match => match.id === activeMatchId) ?? fixtures[0] ?? { id: "M0", home: "TBD", away: "TBD", day: "—", time: "—" };
  useEffect(() => {
    let mounted = true;
    setSpecialLabels({});
    if (!fixture.databaseId) return () => { mounted = false; };
    supabase.rpc("special_player_labels_for_fixture", { p_fixture_id: fixture.databaseId }).then(({ data }) => {
      if (!mounted) return;
      setSpecialLabels(((data ?? []) as Array<{ full_name: string; label: string }>).reduce((result, row) => ({ ...result, [row.full_name]: [...(result[row.full_name] ?? []), row.label] }), {} as Record<string, string[]>));
    });
    return () => { mounted = false; };
  }, [fixture.databaseId]);
  useEffect(() => {
    const restricted = (name: string) => {
      const labels = specialLabels[name] ?? [];
      const player = roster.find(item => item.name === name);
      return (labels.includes("UNIQUE") || labels.includes("AUTO UNIQUE")) && player?.owner !== ownerName;
    };
    if (captain && restricted(captain)) setCaptain("");
    if (vice && restricted(vice)) setVice("");
    if (impactPlayer && restricted(impactPlayer)) { setImpactPlayer(""); setImpactType(""); }
    if (boosterCode === "3X" && boosterPlayer && restricted(boosterPlayer)) setBoosterPlayer("");
  }, [specialLabels, captain, vice, impactPlayer, boosterCode, boosterPlayer, roster, ownerName]);
  const immediateNextFixture = fixtures[0];
  const nextLockMilliseconds = immediateNextFixture?.lineupLockAt ? Math.max(0, new Date(immediateNextFixture.lineupLockAt).getTime() - countdownNow) : 0;
  const nextLockSeconds = Math.floor(nextLockMilliseconds / 1000);
  const nextLockDays = Math.floor(nextLockSeconds / 86_400);
  const nextLockHours = Math.floor((nextLockSeconds % 86_400) / 3_600);
  const nextLockMinutes = Math.floor((nextLockSeconds % 3_600) / 60);
  const nextLockRemainder = nextLockSeconds % 60;
  const nextLockCountdown = `${nextLockDays ? `${nextLockDays}d ` : ""}${String(nextLockHours).padStart(2, "0")}:${String(nextLockMinutes).padStart(2, "0")}:${String(nextLockRemainder).padStart(2, "0")}`;
  const nextLockIsFarAway = nextLockMilliseconds > 7 * 86_400_000;
  const nextLockDisplay = nextLockIsFarAway && immediateNextFixture?.lineupLockAt
    ? new Date(immediateNextFixture.lineupLockAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : nextLockCountdown;
  const activeMatchNumber = Number(activeMatchId.replace("M", ""));
  const fixtureLocked = !!fixture.lineupLockAt && Date.now() >= new Date(fixture.lineupLockAt).getTime();
  const rules = [...ruleVersions].filter(rule => rule.effective_from_match_number <= activeMatchNumber).sort((a, b) => b.effective_from_match_number - a.effective_from_match_number || b.version - a.version)[0] ?? defaultSelectionRules;
  const matchTeams = [fixture.home, fixture.away];
  const otherTeams = allTeams.filter(team => !matchTeams.includes(team));
  const chosen = roster.filter(p => selected.includes(p.name));
  const total = chosen.reduce((n, p) => n + p.price, 0);
  const count = (role: Role) => chosen.filter(p => p.role === role).length;
  const teams = Array.from(new Set(chosen.map(p => p.team)));
  const maxTeam = Math.max(0, ...teams.map(team => chosen.filter(p => p.team === team).length));
  const activeTransferPeriod = transferPeriods.find(period => activeMatchNumber >= period.start_match_number && activeMatchNumber <= period.end_match_number);
  const initialLineupFree = !!activeTransferPeriod?.first_match_free && !hasPriorPeriodLineup;
  const freeTransferMatch = initialLineupFree && !firstMissingPriorMatch && !lineupLoadBusy;
  const transfers = freeTransferMatch ? 0 : chosen.filter(p => (ownershipEnabled ? p.owner !== ownerName : true) && !carriedForwardNames.has(p.name)).length;
  const transferLimit = activeTransferPeriod?.transfer_limit ?? 0;
  const alreadyUsedTransfers = activeTransferPeriod ? transferUsage[activeTransferPeriod.id] ?? 0 : 0;
  const displayedTransfers = freeTransferMatch ? "Free" : boosterCode === "SUP-TR" ? "Unlimited" : `${alreadyUsedTransfers + transfers} used / ${transferLimit}`;
  const used3X = boosterUses.find(use => use.code === "3X");
  const tripleImpactAvailable = !used3X;
  const currentPhase = leaguePhases.find(phase => activeMatchNumber >= phase.start_match_number && activeMatchNumber <= phase.end_match_number);
  const doubleUpRule = boosterRuleSettings.find(rule => rule.code === "2UP");
  const doubleUpPhaseLimit = currentPhase ? Number(doubleUpRule?.phase_usage_limits?.[currentPhase.code] ?? 0) : 0;
  const doubleUpUsesInPhase = boosterUses.filter(use => use.code === "2UP" && leaguePhases.find(phase => use.matchNumber >= phase.start_match_number && use.matchNumber <= phase.end_match_number)?.code === currentPhase?.code);
  const doubleUpAvailable = !!currentPhase && doubleUpPhaseLimit > doubleUpUsesInPhase.length && boosterUses.filter(use => use.code === "2UP").length < Number(doubleUpRule?.total_usage_limit ?? 0);
  const superTransferUsed = boosterUses.find(use => use.code === "SUP-TR");
  const superTransferAvailable = !initialLineupFree && !firstMissingPriorMatch && !superTransferUsed;
  const myPlayers = chosen.filter(p => p.owner === ownerName).length;
  const openPlayers = chosen.filter(p => p.owner === "Available").length;
  const otherOwnerPlayers = chosen.filter(p => p.owner !== ownerName && p.owner !== "Available").length;
  const currentMatchPlayers = chosen.filter(p => matchTeams.includes(p.team)).length;
  const impactSelectedPlayer = chosen.find(p => p.name === impactPlayer);
  const impactWarnings = [impactType === "BOI" && impactSelectedPlayer && ["BA", "WK"].includes(impactSelectedPlayer.role) && `BOI warning: ${impactSelectedPlayer.name} is a ${impactSelectedPlayer.role === "BA" ? "batter" : "wicketkeeper"}. Only bowling points will count.`, impactType === "BAI" && impactSelectedPlayer?.role === "BO" && `BAI warning: ${impactSelectedPlayer.name} is a bowler. Only batting points will count.`].filter(Boolean) as string[];
  const selectionScopeWarnings = ownershipEnabled ? chosen.filter(player => player.owner !== ownerName && !matchTeams.includes(player.team) && !carriedForwardNames.has(player.name)).map(player => `${player.name} is not your player and is not playing in ${fixture.home} vs ${fixture.away}.`) : [];
  const optionalMarkerWarnings = [!captain && "Captain not selected", !vice && "Vice-Captain not selected", !impactPlayer && "BAI/BOI not selected"].filter(Boolean) as string[];
  const submissionWarnings = [...selectionScopeWarnings, ...impactWarnings, ...optionalMarkerWarnings];
  const errors = [fixtureLocked && "Lineup is locked", firstMissingPriorMatch && `Submit Match ${firstMissingPriorMatch} before submitting Match ${activeMatchNumber}`, !activeTransferPeriod && `No transfer period is configured for Match ${activeMatchNumber}`, selected.length !== rules.lineup_size && `Select exactly ${rules.lineup_size} players (${selected.length}/${rules.lineup_size})`, count("BA") < rules.min_batters && `At least ${rules.min_batters} batters required`, count("BO") < rules.min_bowlers && `At least ${rules.min_bowlers} bowlers required`, count("WK") < rules.min_wicketkeepers && `At least ${rules.min_wicketkeepers} wicketkeeper${rules.min_wicketkeepers === 1 ? "" : "s"} required`, count("AL") < rules.min_all_rounders && `At least ${rules.min_all_rounders} all-rounder${rules.min_all_rounders === 1 ? "" : "s"} required`, maxTeam > rules.max_from_one_team && `Maximum ${rules.max_from_one_team} from one IPL team`, total > rules.lineup_budget && `₹${(total - rules.lineup_budget).toFixed(1)}m over budget`, initialLineupFree && boosterCode === "SUP-TR" && "Super Transfer is unavailable because this lineup already has free transfers", activeTransferPeriod && boosterCode !== "SUP-TR" && alreadyUsedTransfers + transfers > transferLimit && `${activeTransferPeriod.name} transfer limit of ${transferLimit} exceeded`, captain && vice && captain === vice && "Captain and vice-captain must differ", impactPlayer && !impactType && "Choose BAI or BOI for the Impact player", impactPlayer && (impactPlayer === captain || impactPlayer === vice) && "Impact player cannot be captain or vice-captain", boosterCode === "3X" && !boosterPlayer && "Select the player who receives 3X", boosterCode === "3X" && boosterPlayer && !selected.includes(boosterPlayer) && "The 3X player must be in your XI"].filter(Boolean) as string[];
  const toggle = (name: string) => {
    const player = roster.find(item => item.name === name);
    const freshExternalPlayer = player && (ownershipEnabled ? player.owner !== ownerName : true) && !carriedForwardNames.has(name);
    if (activeTransferPeriod && !selected.includes(name) && !initialLineupFree && boosterCode !== "SUP-TR" && freshExternalPlayer && alreadyUsedTransfers + transfers >= transferLimit) {
      setSubmitMessage(`No ${activeTransferPeriod?.name ?? "period"} transfers remain. Retain a carried-forward player or use SUP-TR.`);
      return;
    }
    setSubmitted(false);
    if (selected.includes(name)) { setSelected(selected.filter(x => x !== name)); if (captain === name) setCaptain(""); if (vice === name) setVice(""); if (impactPlayer === name) { setImpactPlayer(""); setImpactType(""); } if (boosterPlayer === name) setBoosterPlayer(""); }
    else setSelected([...selected, name]);
  };
  const resetXI = () => { const snapshot = submittedSnapshots.current[activeMatchId]; if (!snapshot) return; setSelected([...snapshot.players]); setCaptain(snapshot.captain); setVice(snapshot.vice); setImpactPlayer(snapshot.impactPlayer); setImpactType(snapshot.impactType); setBoosterCode(""); setBoosterPlayer(""); setSubmitted(hasSavedCurrentLineup); setShowIssues(false); };
  const clearXI = () => { setSelected([]); setCaptain(""); setVice(""); setImpactPlayer(""); setImpactType(""); setBoosterCode(""); setBoosterPlayer(""); setSubmitted(false); setShowIssues(false); };
  const submitXI = async () => {
    setSubmitBusy(true); setSubmitMessage("");
    if (firstMissingPriorMatch) { setSubmitMessage(`Submit Match ${firstMissingPriorMatch} before submitting Match ${activeMatchNumber}`); setSubmitBusy(false); return; }
    const matchNumber = Number(activeMatchId.replace("M", ""));
    const fixtureResult = await supabase.from("fixtures").select("id").eq("league_id", leagueId).eq("match_number", matchNumber).single();
    if (fixtureResult.error) { setSubmitMessage(userActionError(fixtureResult.error, "Match lookup")); setSubmitBusy(false); return; }
    const playerResult = await supabase.from("league_players").select("player_id,player:players!inner(full_name)").eq("league_id", leagueId).eq("active", true).in("player.full_name", selected);
    if (playerResult.error) { setSubmitMessage(userActionError(playerResult.error, "Squad validation")); setSubmitBusy(false); return; }
    const playerIdByName = new Map((playerResult.data ?? []).map((leaguePlayer: any) => [leaguePlayer.player.full_name, leaguePlayer.player_id] as [string, string]));
    const playerIds = selected.map(name => playerIdByName.get(name)).filter((id): id is string => !!id);
    if (playerIds.length !== selected.length) { setSubmitMessage("Some selected players could not be matched to the active league squad."); setSubmitBusy(false); return; }
    const { data: savedLineupId, error } = await supabase.rpc("submit_lineup_with_transfer_enforcement", { p_fixture_id: fixtureResult.data.id, p_player_ids: playerIds, p_captain_player_id: captain ? playerIdByName.get(captain) ?? null : null, p_vice_captain_player_id: vice ? playerIdByName.get(vice) ?? null : null, p_impact_player_id: impactPlayer ? playerIdByName.get(impactPlayer) ?? null : null, p_impact_type: impactType || null, p_booster_code: boosterCode || null, p_booster_player_id: boosterPlayer ? playerIdByName.get(boosterPlayer) ?? null : null });
    if (error) { const detail = userActionError(error, "Team submission"); setSubmitMessage(detail); Alert.alert("Team not submitted", detail); }
    else if (!savedLineupId) { const message = "The lineup could not be confirmed. Please submit again."; setSubmitMessage(message); Alert.alert("Team not submitted", message); }
    else {
      const verification = await supabase.from("lineup_players").select("player_id", { count: "exact" }).eq("lineup_id", savedLineupId);
      if (verification.error) { const message = "Your lineup was submitted, but confirmation could not be loaded. Refresh the match before submitting again."; if (__DEV__) console.warn("Lineup verification failed:", verification.error.message); setSubmitMessage(message); Alert.alert("Confirmation unavailable", message); }
      else if ((verification.count ?? verification.data?.length ?? 0) !== selected.length) { const message = `Team verification found ${verification.count ?? verification.data?.length ?? 0}/${selected.length} saved players. Please submit again.`; setSubmitMessage(message); Alert.alert("Verification failed", message); }
      else { submittedSnapshots.current[activeMatchId] = { players: [...selected], captain, vice, impactPlayer, impactType }; setHasSavedCurrentLineup(true); setSubmitted(true); setSubmitMessage("Your lineup has been saved."); setShowSubmitConfirmation(true); }
    }
    setSubmitBusy(false);
  };
  const chooseBooster = (code: BoosterCode) => { if ((code === "3X" && !tripleImpactAvailable) || (code === "2UP" && !doubleUpAvailable) || (code === "SUP-TR" && !superTransferAvailable)) return; const next = boosterCode === code ? "" : code; setBoosterCode(next); if (next !== "3X") setBoosterPlayer(""); setSubmitted(false); };
  useEffect(() => {
    if (initialLineupFree && boosterCode === "SUP-TR") {
      setBoosterCode("");
      setBoosterPlayer("");
      setSubmitted(false);
    }
  }, [initialLineupFree, boosterCode, setBoosterCode, setBoosterPlayer, setSubmitted]);
  useEffect(() => {
    if (!fixtures.length || fixtures.some(match => match.id === activeMatchId)) return;
    const requestedMatch = requestedFixtureId
      ? fixtures.find(match => match.databaseId === requestedFixtureId)
      : undefined;
    setActiveMatchId(requestedMatch?.id ?? fixtures[0].id);
  }, [fixtures, activeMatchId, requestedFixtureId]);
  useEffect(() => {
    const timer = setInterval(() => setCountdownNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!fixture.databaseId) return;
    let cancelled = false;
    const loadLineup = async () => {
      setLineupLoadBusy(true); setFirstMissingPriorMatch(null); setHasPriorPeriodLineup(false); setHasSavedCurrentLineup(false); setSubmitMessage("");
      const [periodResult, transferResult, phaseResult, boosterRuleResult, boosterUsageResult, earlierFixturesResult, currentResult] = await Promise.all([
        supabase.from("league_transfer_periods").select("id,code,name,start_match_number,end_match_number,transfer_limit,first_match_free").eq("league_id", leagueId).eq("active", true).order("sort_order"),
        supabase.from("transfer_events").select("transfer_period_id,transfer_count").eq("league_id", leagueId).eq("member_id", memberId).eq("reason", "lineup_change"),
        supabase.from("league_phases").select("code,name,start_match_number,end_match_number").eq("league_id", leagueId).eq("active", true).order("sort_order"),
        supabase.from("booster_rules").select("code,total_usage_limit,phase_usage_limits").eq("league_id", leagueId).eq("active", true),
        supabase.from("lineup_boosters").select("booster:booster_rules(code),fixture:fixtures(match_number)").eq("member_id", memberId),
        supabase.from("fixtures").select("id,match_number,status,lineup_lock_at,scheduled_start").eq("league_id", leagueId).lt("match_number", activeMatchNumber).order("match_number"),
        supabase.from("lineup_submissions").select("id,status,captain_player_id,vice_captain_player_id,impact_player_id,impact_type").eq("fixture_id", fixture.databaseId).eq("member_id", memberId).maybeSingle(),
      ]);
      if (!cancelled && periodResult.data) setTransferPeriods(periodResult.data as TransferPeriod[]);
      if (!cancelled && transferResult.data) setTransferUsage(transferResult.data.reduce((usage: Record<string, number>, event: any) => event.transfer_period_id ? { ...usage, [event.transfer_period_id]: (usage[event.transfer_period_id] ?? 0) + event.transfer_count } : usage, {}));
      if (!cancelled && phaseResult.data) setLeaguePhases(phaseResult.data as LeaguePhase[]);
      if (!cancelled && boosterRuleResult.data) setBoosterRuleSettings(boosterRuleResult.data as BoosterRuleSetting[]);
      if (!boosterUsageResult.error && !cancelled) setBoosterUses((boosterUsageResult.data ?? []).map((row: any) => ({ code: row.booster?.code, matchNumber: row.fixture?.match_number })).filter(use => use.code && use.matchNumber));
      if (earlierFixturesResult.error) { if (!cancelled) { setSubmitMessage(userActionError(earlierFixturesResult.error, "Previous matches refresh")); setLineupLoadBusy(false); } return; }
      const earlierFixtureIds = (earlierFixturesResult.data ?? []).map(row => row.id);
      const earlierLineupsResult = earlierFixtureIds.length
        ? await supabase.from("lineup_submissions").select("id,status,captain_player_id,vice_captain_player_id,impact_player_id,impact_type,fixture_id").eq("member_id", memberId).in("fixture_id", earlierFixtureIds).in("status", ["submitted", "locked"])
        : { data: [], error: null };
      if (earlierLineupsResult.error) { if (!cancelled) { setSubmitMessage(userActionError(earlierLineupsResult.error, "Previous lineups refresh")); setLineupLoadBusy(false); } return; }
      const submittedFixtureIds = new Set((earlierLineupsResult.data ?? []).map(row => row.fixture_id));
      const missingPriorMatch = (earlierFixturesResult.data ?? []).find(row => row.status === "scheduled" && new Date(row.lineup_lock_at ?? row.scheduled_start).getTime() > Date.now() && !submittedFixtureIds.has(row.id))?.match_number ?? null;
      const currentPeriod = (periodResult.data ?? []).find(period => activeMatchNumber >= period.start_match_number && activeMatchNumber <= period.end_match_number);
      const priorPeriodLineup = !!currentPeriod && (earlierFixturesResult.data ?? []).some(row => row.match_number >= currentPeriod.start_match_number && row.match_number <= currentPeriod.end_match_number && submittedFixtureIds.has(row.id));
      if (!cancelled) { setFirstMissingPriorMatch(missingPriorMatch); setHasPriorPeriodLineup(priorPeriodLineup); }
      if (currentResult.error) { if (!cancelled) { setSubmitMessage(userActionError(currentResult.error, "Saved lineup refresh")); setLineupLoadBusy(false); } return; }
      let source = currentResult.data;
      let isCurrentSubmission = source?.status === "submitted" || source?.status === "locked";
      if (!source) {
        const priorIds = [...earlierFixtureIds].reverse();
        source = priorIds.map(id => (earlierLineupsResult.data ?? []).find(lineup => lineup.fixture_id === id)).find(Boolean) ?? null;
      }
      if (!source) { if (!cancelled) { setSelected([]); setCaptain(""); setVice(""); setImpactPlayer(""); setImpactType(""); setBoosterCode(""); setBoosterPlayer(""); setHasSavedCurrentLineup(false); setSubmitted(false); setCarriedForwardNames(new Set()); setLineupLoadBusy(false); } return; }
      const [lineupPlayersResult, currentBoosterResult] = await Promise.all([
        supabase.from("lineup_players").select("slot,player_id").eq("lineup_id", source.id).order("slot"),
        isCurrentSubmission ? supabase.from("lineup_boosters").select("target_player_id,booster:booster_rules(code)").eq("lineup_id", source.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      const boosterTargetId = (currentBoosterResult.data as any)?.target_player_id ?? null;
      const markerIds = [source.captain_player_id, source.vice_captain_player_id, source.impact_player_id, boosterTargetId].filter((id): id is string => !!id);
      const lineupPlayerIds = (lineupPlayersResult.data ?? []).map(row => row.player_id);
      const relevantPlayerIds = Array.from(new Set([...lineupPlayerIds, ...markerIds]));
      const playerNamesResult = relevantPlayerIds.length ? await supabase.from("players").select("id,full_name").in("id", relevantPlayerIds) : { data: [], error: null };
      if (lineupPlayersResult.error || playerNamesResult.error) { if (!cancelled) { setSubmitMessage(lineupPlayersResult.error?.message ?? playerNamesResult.error?.message ?? "Could not load lineup"); setLineupLoadBusy(false); } return; }
      const nameById = new Map((playerNamesResult.data ?? []).map(player => [player.id, player.full_name]));
      const names = lineupPlayerIds.map(id => nameById.get(id)).filter((name): name is string => !!name);
      if (isCurrentSubmission && names.length === 0) { if (!cancelled) { setSubmitMessage("Saved XI was found, but its players could not be loaded. Please refresh and try again."); setLineupLoadBusy(false); } return; }
      const markerName = (id: string | null) => id ? nameById.get(id) ?? "" : "";
      const snapshot = { players: names, captain: markerName(source.captain_player_id), vice: markerName(source.vice_captain_player_id), impactPlayer: markerName(source.impact_player_id), impactType: (source.impact_type ?? "") as ImpactType };
      if (!cancelled) {
        submittedSnapshots.current[activeMatchId] = snapshot;
        setSelected(names); setCaptain(snapshot.captain); setVice(snapshot.vice); setImpactPlayer(snapshot.impactPlayer); setImpactType(snapshot.impactType);
        setBoosterCode(isCurrentSubmission ? ((currentBoosterResult.data as any)?.booster?.code ?? "") : ""); setBoosterPlayer(isCurrentSubmission ? markerName(boosterTargetId) : ""); setHasSavedCurrentLineup(isCurrentSubmission); setSubmitted(isCurrentSubmission); setCarriedForwardNames(new Set(names)); setLineupLoadBusy(false);
      }
    };
    loadLineup();
    return () => { cancelled = true; };
  }, [fixture.databaseId, activeMatchId, activeMatchNumber, leagueId, memberId]);
  if (!fixtures.length) return <ScrollView contentContainerStyle={s.content}><View style={s.pendingLeague}><Text style={s.pendingLeagueEyebrow}>{scheduledFixtureCount ? "LINEUPS CLOSED" : "FIXTURES REQUIRED"}</Text><Text style={s.pendingLeagueTitle}>{scheduledFixtureCount ? "No unlocked upcoming matches" : "No fixtures imported"}</Text><Text style={s.pendingLeagueText}>{scheduledFixtureCount ? "Scheduled fixtures exist, but their lineup lock times have passed. Owners cannot submit or change teams after lock." : "This league does not have scheduled fixtures yet. A league administrator must import or configure its fixtures before owners can select a team."}</Text></View></ScrollView>;
  const selectFixture = (match: UpcomingMatch) => { setActiveMatchId(match.id); setExpandedTeams([match.home, match.away]); setBoosterCode(""); setBoosterPlayer(""); setHasSavedCurrentLineup(false); setSubmitted(false); setShowIssues(false); setShowWarnings(false); };
  const focusPlayerInTeamList = (name: string, team: string) => {
    setFocusedPlayer(name);
    setExpandedTeams(current => current.includes(team) ? current : [...current, team]);
    setTimeout(() => {
      const y = (teamPositions.current[team] ?? 0) + (playerPositions.current[`${team}:${name}`] ?? 0);
      teamScrollRef.current?.scrollTo({ y: Math.max(0, y - 18), animated: true });
    }, 180);
  };
  const toggleTeam = (team: string) => setExpandedTeams(expandedTeams.includes(team) ? expandedTeams.filter(item => item !== team) : [...expandedTeams, team]);
  const playerMatchesFilters = (player: Player) => {
    const roleMatches = roleFilter === "ALL" || player.role === roleFilter;
    const ownershipMatches = ownershipFilter === "ALL"
      || (ownershipFilter === "MINE" && player.owner === ownerName)
      || (ownershipFilter === "OPEN" && player.owner === "Available")
      || (ownershipFilter === "OTHER" && player.owner !== ownerName && player.owner !== "Available");
    return roleMatches && ownershipMatches;
  };
  const sortPlayers = (teamPlayers: Player[]) => [...teamPlayers].sort((left, right) => {
    if (playerSort === "COST") return Number(right.price) - Number(left.price) || left.name.localeCompare(right.name);
    if (playerSort === "POINTS") return (leaguePlayerPoints[right.name] ?? 0) - (leaguePlayerPoints[left.name] ?? 0) || left.name.localeCompare(right.name);
    return left.name.localeCompare(right.name);
  });
  const renderTeam = (team: string) => {
    const allTeamPlayers = roster.filter(player => player.team === team);
    const teamPlayers = sortPlayers(allTeamPlayers.filter(playerMatchesFilters));
    if (!teamPlayers.length) return null;
    const expanded = expandedTeams.includes(team);
    const brand = teamBadge(team);
    const selectedFromTeam = selected.filter(name => allTeamPlayers.some(player => player.name === name)).length;
    return <View key={team} style={s.teamGroup} onLayout={event => { teamPositions.current[team] = event.nativeEvent.layout.y; }}>
      <TouchableOpacity style={[s.teamHeader, s.teamHeaderModern, expanded && s.teamHeaderExpanded, { backgroundColor: brand.backgroundColor, borderColor: brand.borderColor }]} onPress={() => toggleTeam(team)}><Text style={[s.teamHeaderName, { color: brand.color }]}>{team}</Text><Text style={[s.teamHeaderCount, { color: brand.color }]}>{selectedFromTeam ? `${selectedFromTeam} selected · ` : ""}{teamPlayers.length}{teamPlayers.length !== allTeamPlayers.length ? ` of ${allTeamPlayers.length}` : ""} players</Text><Text style={[s.teamChevron, { color: brand.color }]}>{expanded ? "▲" : "▼"}</Text></TouchableOpacity>
      {expanded && teamPlayers.map(p => { const active = selected.includes(p.name); const ownership = p.owner === ownerName ? "Mine" : p.owner === "Available" ? "OpenPlayer" : `Owned by ${p.owner}`; const labels = specialLabels[p.name] ?? []; const powerRestricted = (labels.includes("UNIQUE") || labels.includes("AUTO UNIQUE")) && p.owner !== ownerName; return <View key={p.name} onLayout={event => { playerPositions.current[`${team}:${p.name}`] = event.nativeEvent.layout.y; }} style={[s.playerRow, s.playerRowModern, active && s.playerActive, focusedPlayer === p.name && s.playerFocused]}>
<TouchableOpacity style={s.playerMain} onPress={() => { setFocusedPlayer(p.name); toggle(p.name); }}>
<View style={[s.checkbox, active && s.checkboxActive]}>
<Text style={s.check}>{active ? "✓" : ""}</Text>
</View>
<View style={{ flex: 1, marginLeft: 10 }}>
<View style={s.specialNameRow}><Text style={s.playerName}>{p.name}</Text>{(specialLabels[p.name] ?? []).map((label: string) => <SpecialPlayerBadge key={label} label={label} />)}</View>
<View style={s.teamSubMeta}><IplTeamBadge code={p.team} /><Text style={s.meta}>{p.role}</Text><OwnerBadge owner={p.owner === "Available" ? "OpenPlayer" : p.owner} label={ownership} compact /></View>
</View>
<View style={s.playerMetrics}><Text style={s.price}>₹{p.price}m</Text><Text style={s.leaguePointValue}>{Math.round(leaguePlayerPoints[p.name] ?? 0)} pts</Text></View>
</TouchableOpacity>{active && <View style={s.markers}>
<Marker text="C" active={captain === p.name} disabled={powerRestricted} onPress={() => { const clearing = captain === p.name; setCaptain(clearing ? "" : p.name); if (!clearing && vice === p.name) setVice(""); if (!clearing && impactPlayer === p.name) { setImpactPlayer(""); setImpactType(""); } setSubmitted(false); }} />
<Marker text="VC" active={vice === p.name} disabled={powerRestricted} onPress={() => { const clearing = vice === p.name; setVice(clearing ? "" : p.name); if (!clearing && captain === p.name) setCaptain(""); if (!clearing && impactPlayer === p.name) { setImpactPlayer(""); setImpactType(""); } setSubmitted(false); }} />
<Marker text="BAI" active={impactPlayer === p.name && impactType === "BAI"} disabled={powerRestricted} onPress={() => { const clearing = impactPlayer === p.name && impactType === "BAI"; setImpactPlayer(clearing ? "" : p.name); setImpactType(clearing ? "" : "BAI"); if (!clearing && captain === p.name) setCaptain(""); if (!clearing && vice === p.name) setVice(""); setSubmitted(false); }} />
<Marker text="BOI" active={impactPlayer === p.name && impactType === "BOI"} disabled={powerRestricted} onPress={() => { const clearing = impactPlayer === p.name && impactType === "BOI"; setImpactPlayer(clearing ? "" : p.name); setImpactType(clearing ? "" : "BOI"); if (!clearing && captain === p.name) setCaptain(""); if (!clearing && vice === p.name) setVice(""); setSubmitted(false); }} />{boosterCode === "3X" && <Marker text="3X" active={boosterPlayer === p.name} disabled={powerRestricted} onPress={() => { setBoosterPlayer(boosterPlayer === p.name ? "" : p.name); setSubmitted(false); }} />}</View>}</View>; })}
    </View>;
  };
  return <View style={s.teamScreen}><ScrollView ref={teamScrollRef} contentContainerStyle={s.teamContent} scrollEventThrottle={16} onScroll={event => setShowScrollTop(event.nativeEvent.contentOffset.y > 520)}>
    <Text style={s.greeting}>Plan next 7 matches</Text><Text style={s.subtitle}>Select a fixture, prepare its XI, and submit before its own lock.</Text>
    {immediateNextFixture ? <View style={s.lockCountdown}><View><Text style={s.lockCountdownLabel}>{nextLockIsFarAway ? "NEXT LINEUP LOCKS ON" : "NEXT LINEUP LOCKS IN"}</Text><Text style={s.lockCountdownMatch}>Match {immediateNextFixture.id.replace("M", "")} · {immediateNextFixture.home} vs {immediateNextFixture.away}</Text></View><Text style={[s.lockCountdownTime, nextLockIsFarAway && s.lockCountdownDate]}>{nextLockDisplay}</Text></View> : null}
    <View style={s.activeFixtureBanner}><View style={s.activeFixtureBadge}><Text style={s.activeFixtureBadgeText}>ACTIVE XI</Text></View><View style={s.activeFixtureDetails}><Text style={s.activeFixtureTitle}>Editing Match {activeMatchNumber}</Text><View style={s.activeFixtureTeams}><IplTeamBadge code={fixture.home} /><Text style={s.activeFixtureVs}>VS</Text><IplTeamBadge code={fixture.away} /></View></View><Text style={s.activeFixtureHint}>{hasSavedCurrentLineup ? "EDIT XI" : "NEW XI"}</Text></View>
    <ScrollView ref={fixtureStripRef} horizontal showsHorizontalScrollIndicator={false} style={s.fixtureStrip} contentContainerStyle={s.fixtureStripContent}>{fixtures.map(match => { const active = match.id === activeMatchId; return <TouchableOpacity key={match.id} style={[s.fixtureCard, active && s.fixtureCardActive]} onPress={() => selectFixture(match)}><Text style={[s.fixtureNumber, active && s.fixtureTextActive]}>MATCH {match.id.replace("M", "")}</Text><View style={s.fixtureTeamRow}><IplTeamBadge code={match.home} /><Text style={[s.fixtureVs, active && s.fixtureTextActive]}>vs</Text><IplTeamBadge code={match.away} /></View><Text style={[s.fixtureTime, active && s.fixtureTextActive]}>{match.day} · {match.time}</Text><Text style={[s.fixtureStatus, active && submitted ? s.statusSubmitted : null]}>{active && submitted ? "Submitted" : "XI carried · booster empty"}</Text></TouchableOpacity>; })}</ScrollView>
    <View style={s.boosterSection}><View style={s.boosterSectionHeading}><Text style={s.boosterSectionTitle}>Match booster</Text><Text style={s.boosterSectionHint}>Optional · choose one</Text></View><View style={s.boosterGrid}>
      <BoosterCard code="3X" name="Triple Impact" detail={tripleImpactAvailable ? "1 remaining · all phases" : `Used in Match ${used3X?.matchNumber} · unavailable`} active={boosterCode === "3X"} disabled={!tripleImpactAvailable} onPress={() => chooseBooster("3X")} />
      <BoosterCard code="2UP" name="Double Up" detail={doubleUpAvailable ? `${currentPhase?.name}: ${doubleUpPhaseLimit - doubleUpUsesInPhase.length} remaining` : doubleUpPhaseLimit <= 0 ? `Unavailable in ${currentPhase?.name ?? "this phase"}` : `${currentPhase?.name}: usage reached`} active={boosterCode === "2UP"} disabled={!doubleUpAvailable} onPress={() => chooseBooster("2UP")} />
      {!initialLineupFree ? <BoosterCard code="SUP-TR" name="Super Transfer" detail={superTransferAvailable ? "1 remaining · all phases" : `Used in Match ${superTransferUsed?.matchNumber} · unavailable`} active={boosterCode === "SUP-TR"} disabled={!superTransferAvailable} onPress={() => chooseBooster("SUP-TR")} /> : null}
    </View></View>
    {boosterCode === "3X" && <View style={s.boosterHelp}><Text style={s.boosterHelpTitle}>{boosterPlayer ? `${boosterPlayer} receives 3X` : "Choose the 3X player below"}</Text><Text style={s.boosterHelpText}>Stacks multiplicatively: C+3X = 6×, VC+3X = 4.5×, and BAI/BOI+3X = 6× for that discipline.</Text></View>}
    {boosterCode === "2UP" && <View style={s.boosterHelp}><Text style={s.boosterHelpTitle}>Your final match total will be doubled</Text><Text style={s.boosterHelpText}>Availability follows the configured usage limit for {currentPhase?.name ?? "this league phase"}.</Text></View>}
    {boosterCode === "SUP-TR" && <View style={s.boosterHelp}><Text style={s.boosterHelpTitle}>Unlimited transfers enabled for this match</Text><Text style={s.boosterHelpText}>This submitted XI becomes the carried-forward team for following matches.</Text></View>}
    <View style={s.selectionTitleRow}><View style={{ flex: 1 }}><Text style={s.greeting}>{submitted ? "Your submitted XI" : "Select your XI"}</Text><View style={s.titleTeamRow}><IplTeamBadge code={fixture.home} /><Text style={s.fixtureVs}>vs</Text><IplTeamBadge code={fixture.away} /><Text style={s.titleLock}>Locks {fixture.day} at {fixture.time}</Text></View></View><View style={s.selectionActions}><TouchableOpacity style={s.resetButton} onPress={resetXI}><Text style={s.resetButtonText}>Reset XI</Text></TouchableOpacity><TouchableOpacity style={s.clearButton} onPress={clearXI}><Text style={s.clearButtonText}>Clear XI</Text></TouchableOpacity></View></View>
    <View style={s.activeRulesBanner}><View style={s.activeRulesHeading}><View style={s.activeRulesIcon}><Text style={s.activeRulesIconText}>✓</Text></View><View style={{ flex: 1 }}><Text style={s.activeRulesTitle}>Playing Rules v{rules.version}</Text><Text style={s.activeRulesText}>Minimum {rules.min_bowlers} bowlers · {rules.lineup_size} players · ₹{rules.lineup_budget}m budget</Text></View></View><View style={s.activeRulesChips}><View style={s.activeRulesChip}><Text style={s.activeRulesChipText}>C · VC · BAI · BOI optional</Text></View><View style={s.activeRulesChip}><Text style={s.activeRulesChipText}>C/VC cannot combine with BAI/BOI</Text></View></View></View>
    {firstMissingPriorMatch ? <View style={s.priorMatchBanner}><View style={s.priorMatchIcon}><Text style={s.priorMatchIconText}>!</Text></View><View style={{ flex: 1 }}><Text style={s.priorMatchTitle}>SUBMIT MATCH {firstMissingPriorMatch} FIRST</Text><Text style={s.priorMatchText}>Match {firstMissingPriorMatch} is still open. Submit that XI before preparing Match {activeMatchNumber}.</Text></View></View> : freeTransferMatch ? <View style={s.freeTransferBanner}><View style={s.freeTransferIcon}><Text style={s.freeTransferIconText}>FREE</Text></View><View style={{ flex: 1 }}><Text style={s.freeTransferTitle}>FREE TRANSFER MATCH</Text><Text style={s.freeTransferText}>Your first submitted XI in {activeTransferPeriod?.name ?? "this period"}. All changes are free and your {transferLimit}-transfer balance remains unchanged.</Text></View></View> : null}
    {lineupLoadBusy ? <View style={s.carryForward}><ActivityIndicator color="#174D3D" /><Text style={s.carryForwardText}>Loading saved or carried-forward XI…</Text></View> : null}
    {rulesLoadMessage ? <View style={s.warningCard}><Text style={s.warningText}>⚠ {rulesLoadMessage}</Text></View> : null}
    {submitted && <View style={s.carryForward}><Text style={s.carryForwardText}>✓ This XI will carry forward to the next match automatically.</Text></View>}
    {!submitted && selected.length === rules.lineup_size && <View style={s.carryForward}><Text style={s.carryForwardText}>↳ Your latest submitted XI was carried forward. You can alter it before submitting this match.</Text></View>}
    <Text style={s.selectedTitle}>Selected Players ({chosen.length}/{rules.lineup_size})</Text>
    {chosen.length ? <View style={s.selectedList}>{chosen.map((player, index) => { const marker = captain === player.name ? "C" : vice === player.name ? "VC" : impactPlayer === player.name ? impactType : ""; const triple = boosterCode === "3X" && boosterPlayer === player.name; return <View key={player.name} style={[s.selectedListRow, marker === "C" && s.rowCaptain, marker === "VC" && s.rowVice, marker === "BAI" && s.rowBai, marker === "BOI" && s.rowBoi]}><Text style={s.selectedNumber}>{index + 1}</Text><TouchableOpacity style={{ flex: 1 }} onPress={() => focusPlayerInTeamList(player.name, player.team)}><View style={s.specialNameRow}><Text style={s.selectedChipName}>{player.name}</Text>{(specialLabels[player.name] ?? []).map((label: string) => <SpecialPlayerBadge key={label} label={label} />)}</View><View style={s.teamSubMeta}><IplTeamBadge code={player.team} /><Text style={s.selectedChipMeta}>{player.role}</Text><Text style={s.selectedCost}>₹{Number(player.price).toFixed(1)}m</Text><Text style={s.selectedEditHint}>Tap to edit C/VC/BAI/BOI</Text></View></TouchableOpacity>{marker ? <MarkerBadge marker={marker} /> : null}{triple ? <MarkerBadge marker="3X" /> : null}<TouchableOpacity style={s.removeSelected} onPress={() => toggle(player.name)}><Text style={s.removeSelectedText}>×</Text></TouchableOpacity></View>; })}</View> : <View style={s.emptySelected}><Text style={s.emptySelectedText}>No players selected. Choose players from the team sections below.</Text></View>}
    <View style={[s.selectionSummary, s.selectionSummaryModern]}><Summary label="PLAYERS" value={`${selected.length}/${rules.lineup_size}`} bad={selected.length !== rules.lineup_size} /><Summary label="COST" value={`₹${total.toFixed(1)}m`} bad={total > rules.lineup_budget} /><Summary label="PERIOD TRANSFERS" value={displayedTransfers} bad={false} /></View>
    {ownershipEnabled ? <View style={s.ownershipSummary}><OwnershipSummary label="MY PLAYERS" value={myPlayers} tone="mine" /><OwnershipSummary label="OPENPLAYERS" value={openPlayers} tone="open" /><OwnershipSummary label="OTHER OWNERS" value={otherOwnerPlayers} tone="other" /><OwnershipSummary label={`${fixture.home} + ${fixture.away}`} value={currentMatchPlayers} tone="match" /></View> : <View style={s.openLeagueMatchSummary}><View style={[s.ownershipDot, s.dotMatch]} /><Text style={s.openLeagueMatchLabel}>{fixture.home} + {fixture.away} players in your XI</Text><Text style={s.openLeagueMatchValue}>{currentMatchPlayers}</Text></View>}
    <View style={s.roles}>{(["WK", "BA", "AL", "BO"] as Role[]).map(r => <Text key={r} style={s.roleChip}>{r} {count(r)}</Text>)}</View>
    {submissionWarnings.length ? <View style={s.combinedWarning}><TouchableOpacity style={s.combinedWarningHeader} onPress={() => setShowWarnings(value => !value)}><View style={s.combinedWarningIcon}><Text style={s.combinedWarningIconText}>!</Text></View><View style={{ flex: 1 }}><Text style={s.combinedWarningTitle}>{submissionWarnings.length} selection notice{submissionWarnings.length > 1 ? "s" : ""}</Text><Text style={s.combinedWarningSummary}>{submissionWarnings[0]}</Text></View><Text style={s.combinedWarningChevron}>{showWarnings ? "▲" : "▼"}</Text></TouchableOpacity>{showWarnings ? <View style={s.combinedWarningBody}>{submissionWarnings.map(warning => <Text key={warning} style={s.combinedWarningText}>• {warning}</Text>)}</View> : null}</View> : null}
    <View style={s.playerFiltersCard}>
      <View style={s.playerFiltersHeading}><View><Text style={s.playerFiltersTitle}>Filter & sort players</Text><Text style={s.playerFiltersHint}>Find the right players without changing your XI</Text></View>{roleFilter !== "ALL" || ownershipFilter !== "ALL" ? <TouchableOpacity onPress={() => { setRoleFilter("ALL"); setOwnershipFilter("ALL"); }}><Text style={s.clearFiltersText}>Clear filters</Text></TouchableOpacity> : null}</View>
      <Text style={s.playerFilterLabel}>ROLE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.playerFilterRow}>
        {([['ALL', 'All roles'], ['BA', 'Batters'], ['WK', 'Wicketkeepers'], ['AL', 'All-rounders'], ['BO', 'Bowlers']] as Array<[PlayerRoleFilter, string]>).map(([value, label]) => <TouchableOpacity key={value} style={[s.playerFilterChip, roleFilter === value && s.playerFilterChipActive]} onPress={() => setRoleFilter(value)}><Text style={[s.playerFilterChipText, roleFilter === value && s.playerFilterChipTextActive]}>{label}</Text></TouchableOpacity>)}
      </ScrollView>
      {ownershipEnabled ? <><Text style={s.playerFilterLabel}>OWNERSHIP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.playerFilterRow}>
          {([['ALL', 'All players'], ['MINE', 'My Players'], ['OTHER', 'Other Owners'], ['OPEN', 'OpenPlayer']] as Array<[PlayerOwnershipFilter, string]>).map(([value, label]) => <TouchableOpacity key={value} style={[s.playerFilterChip, ownershipFilter === value && s.playerFilterChipActive]} onPress={() => setOwnershipFilter(value)}><Text style={[s.playerFilterChipText, ownershipFilter === value && s.playerFilterChipTextActive]}>{label}</Text></TouchableOpacity>)}
        </ScrollView></> : null}
      <Text style={s.playerFilterLabel}>SORT BY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.playerFilterRow}>
        {([['NAME', 'Name A–Z'], ['COST', 'Cost · High first'], ['POINTS', 'Points · High first']] as Array<[PlayerSort, string]>).map(([value, label]) => <TouchableOpacity key={value} style={[s.playerFilterChip, playerSort === value && s.playerFilterChipActive]} onPress={() => setPlayerSort(value)}><Text style={[s.playerFilterChipText, playerSort === value && s.playerFilterChipTextActive]}>{label}</Text></TouchableOpacity>)}
      </ScrollView>
    </View>
    <Text style={s.sectionTitle}>Playing teams</Text><View style={s.playingTeamHelp}><IplTeamBadge code={fixture.home} /><Text style={s.fixtureVs}>and</Text><IplTeamBadge code={fixture.away} /><Text style={s.helperInline}>players are shown first.</Text></View>
    {matchTeams.map(renderTeam)}
    <Text style={s.otherTeamsTitle}>Other teams in Squad</Text><Text style={s.helper}>Tap to add or remove. Other-owner players use a transfer.</Text>
    {otherTeams.map(renderTeam)}
    <View style={[s.validation, errors.length ? s.invalid : s.valid]}><Text style={s.validationTitle}>{errors.length ? `${errors.length} issue${errors.length > 1 ? "s" : ""} to fix` : "Team is valid"}</Text>{errors.map(e => <Text key={e} style={s.validationText}>• {e}</Text>)}{!errors.length && <Text style={s.validationText}>Roles, cost, transfers and optional marker combinations are valid.</Text>}</View>
    {submitMessage ? <View style={[s.adminMessage, submitMessage === "Your lineup has been saved." && s.adminMessageSuccess]}><Text style={s.adminMessageText}>{submitMessage}</Text></View> : null}
  </ScrollView>{showScrollTop && !showIssues && !submitMessage ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Scroll to top" style={s.scrollTopButton} onPress={() => teamScrollRef.current?.scrollTo({ y: 0, animated: true })}><Text style={s.scrollTopArrow}>↑</Text><Text style={s.scrollTopText}>Top</Text></TouchableOpacity> : null}{showIssues && errors.length > 0 && <View style={s.issuePopup}>
<Text style={s.issuePopupTitle}>Issues to fix</Text>{errors.map(error => <Text key={error} style={s.issuePopupText}>• {error}</Text>)}</View>}{submitMessage ? <View style={[s.submitResult, submitMessage === "Your lineup has been saved." ? s.submitResultSuccess : s.submitResultError]}><Text style={s.submitResultText}>{submitMessage}</Text></View> : null}<View style={s.stickyAction}>
<TouchableOpacity style={{ flex: 1 }} onPress={() => setShowIssues(!showIssues)}>
<Text style={s.stickyMatch}>MATCH {activeMatchNumber} · {fixture.home} VS {fixture.away}</Text>
<Text style={s.stickyTitle}>{errors.length ? `${errors.length} issue${errors.length > 1 ? "s" : ""} remaining · Tap to ${showIssues ? "hide" : "view"}` : "Ready to submit"}</Text>
<Text style={s.stickyMeta}>{selected.length}/{rules.lineup_size} · ₹{total.toFixed(1)}m · {transfers} this match</Text>
</TouchableOpacity>
<TouchableOpacity disabled={submitBusy} style={[s.stickyButton, (!!errors.length || submitBusy) && s.disabled]} onPress={() => errors.length ? setShowIssues(true) : runAction(submitXI)}>
{submitBusy ? <ActivityIndicator color="white" /> : <Text style={s.submitText}>{errors.length ? "View issues" : submitted ? "Submitted ✓" : hasSavedCurrentLineup ? "Resubmit XI" : "Submit XI"}</Text>}
</TouchableOpacity>
</View><Modal visible={showSubmitConfirmation} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowSubmitConfirmation(false)}>
<View style={s.submitModalOverlay}><View style={s.submitModalCard}>
<View style={s.submitModalCheck}><Text style={s.submitModalCheckText}>✓</Text></View>
<Text style={s.submitModalEyebrow}>LINEUP CONFIRMED</Text>
<Text style={s.submitModalTitle}>Match {activeMatchNumber} submitted</Text>
<View style={s.submitModalTeams}><IplTeamBadge code={fixture.home} /><Text style={s.submitModalVs}>VS</Text><IplTeamBadge code={fixture.away} /></View>
<View style={s.submitModalSummary}><View style={s.submitModalStat}><Text style={s.submitModalStatValue}>{selected.length}</Text><Text style={s.submitModalStatLabel}>PLAYERS</Text></View><View style={s.submitModalDivider} /><View style={s.submitModalStat}><Text style={s.submitModalStatValue}>{transfers}</Text><Text style={s.submitModalStatLabel}>THIS MATCH</Text></View><View style={s.submitModalDivider} /><View style={s.submitModalStat}><Text style={s.submitModalStatValue}>{boosterCode || "—"}</Text><Text style={s.submitModalStatLabel}>BOOSTER</Text></View></View>
{submissionWarnings.length ? <View style={s.submitModalWarning}><View style={s.submitModalWarningHeading}><View style={s.submitModalWarningIcon}><Text style={s.submitModalWarningIconText}>!</Text></View><Text style={s.submitModalWarningTitle}>Submitted with {submissionWarnings.length} notice{submissionWarnings.length > 1 ? "s" : ""}</Text></View>{submissionWarnings.map(warning => <Text key={warning} style={s.submitModalWarningText}>• {warning}</Text>)}</View> : null}
<Text style={s.submitModalNote}>Your XI is confirmed. You can make changes and resubmit until the lineup locks.</Text>
<TouchableOpacity style={s.submitModalButton} onPress={() => setShowSubmitConfirmation(false)}><Text style={s.submitModalButtonText}>Done</Text></TouchableOpacity>
</View></View>
</Modal></View>;
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <View style={s.stat}><Text style={s.statLabel}>{label}</Text><Text style={s.statValue}>{value}</Text><Text style={s.meta}>{detail}</Text></View>; }
const testOwners = [...leagueOwners].sort((a, b) => a.localeCompare(b));
const lockedTestMatches = [
  { id: "M1", teams: "RCB vs SRH", date: "Mar 28 · 7:30 PM" },
  { id: "M2", teams: "MI vs KKR", date: "Mar 29 · 7:30 PM" },
  { id: "M3", teams: "RR vs CSK", date: "Mar 30 · 7:30 PM" },
  { id: "M4", teams: "PBKS vs GT", date: "Mar 31 · 7:30 PM" },
  { id: "M5", teams: "DC vs LSG", date: "Apr 1 · 7:30 PM" },
];
function seededScore(value: string) { let score = 7; for (let i = 0; i < value.length; i += 1) score = (score * 31 + value.charCodeAt(i)) % 100003; return score; }
function createTestXI(owner: string, matchId: string) {
  const ranked = [...players].filter(player => player.price > 0).sort((a, b) => seededScore(`${matchId}-${owner}-${a.name}`) - seededScore(`${matchId}-${owner}-${b.name}`));
  const picked: typeof players = [];
  const addRole = (role: Role, required: number) => { for (const player of ranked.filter(item => item.role === role)) { if (picked.length >= 11 || picked.filter(item => item.role === role).length >= required) break; if (!picked.includes(player) && picked.reduce((sum, item) => sum + item.price, 0) + player.price <= 100) picked.push(player); } };
  addRole("WK", 1); addRole("BA", 2); addRole("AL", 1); addRole("BO", 2);
  for (const player of ranked) { if (picked.length >= 11) break; const teamCount = picked.filter(item => item.team === player.team).length; if (!picked.includes(player) && teamCount < 7 && picked.reduce((sum, item) => sum + item.price, 0) + player.price <= 100) picked.push(player); }
  return picked;
}
function matchFantasyPoints(matchId: string, playerName: string, marker: "" | "C" | "VC" | "BAI" | "BOI") {
  const points = completedMatchPoints[matchId]?.[playerName];
  if (!points) return 0;
  if (marker === "C") return points.total * 2;
  if (marker === "VC") return points.total * 1.5;
  if (marker === "BAI") return points.batting * 2;
  if (marker === "BOI") return points.bowling * 2;
  return points.total;
}
type TestBooster = { code: "3X"; playerName: string } | { code: "2UP" } | null;
function testBoosterFor(owner: string, matchId: string, lineup: typeof players): TestBooster {
  if (matchId === "M2" && owner === "Pandiyan") return { code: "3X", playerName: lineup[0]?.name ?? "" };
  if (matchId === "M3" && owner === "Sashi") return { code: "2UP" };
  if (matchId === "M4" && owner === "Jeba") return { code: "3X", playerName: lineup[1]?.name ?? "" };
  if (matchId === "M5" && owner === "Saravana") return { code: "2UP" };
  return null;
}
function boostedPlayerPoints(matchId: string, playerName: string, marker: "" | "C" | "VC" | "BAI" | "BOI", triple: boolean) {
  if (!triple) return matchFantasyPoints(matchId, playerName, marker);
  const points = completedMatchPoints[matchId]?.[playerName];
  if (!points) return 0;
  if (marker === "C") return points.total * 6;
  if (marker === "VC") return points.total * 4.5;
  if (marker === "BAI") return points.batting * 6;
  if (marker === "BOI") return points.bowling * 6;
  return points.total * 3;
}
function ownerMatchPoints(owner: string, matchId: string) {
  const impactMarker: ImpactType = seededScore(`${matchId}-${owner}-impact`) % 2 === 0 ? "BAI" : "BOI";
  const lineup = createTestXI(owner, matchId);
  const booster = testBoosterFor(owner, matchId, lineup);
  const total = lineup.reduce((sum, player, index) => {
    const marker = index === 0 ? "C" : index === 1 ? "VC" : index === 2 ? impactMarker : "";
    return sum + boostedPlayerPoints(matchId, player.name, marker, booster?.code === "3X" && booster.playerName === player.name);
  }, 0);
  return booster?.code === "2UP" ? total * 2 : total;
}
const standings = leagueOwners.map(owner => [owner, lockedTestMatches.reduce((sum, match) => sum + ownerMatchPoints(owner, match.id), 0)] as [string, number]).sort((a, b) => b[1] - a[1]).map(([owner, points]) => [owner, String(Math.round(points))]);
function LockedHistoryTestData() {
  const [expandedMatch, setExpandedMatch] = useState("M1");
  const [expandedOwner, setExpandedOwner] = useState("M1-Pandiyan");
  return <>
    <Text style={s.greeting}>Team history</Text><Text style={s.subtitle}>Select a locked match, then expand an owner to view their submitted XI.</Text>
    {lockedTestMatches.map((match, index) => { const matchExpanded = expandedMatch === match.id; const matchBoosters = testOwners.map(owner => ({ owner, booster: testBoosterFor(owner, match.id, createTestXI(owner, match.id)) })).filter(item => item.booster); return <View key={match.id} style={[s.historyMatchCard, matchBoosters.length > 0 && s.historyMatchBoosted]}>
      <TouchableOpacity style={s.historyMatchHeader} onPress={() => { setExpandedMatch(matchExpanded ? "" : match.id); setExpandedOwner(matchExpanded ? "" : `${match.id}-Pandiyan`); }}><View style={{ flex: 1 }}><Text style={s.historyListTitle}>Match {index + 1} · {match.teams}</Text><Text style={s.historyListMeta}>{match.date} · Calculated</Text>{matchBoosters.length > 0 && <Text style={s.historyMatchBoosterOwners}>{matchBoosters.map(item => `${item.owner}: ${item.booster?.code}`).join(" · ")}</Text>}</View>{matchBoosters.length > 0 && <View style={s.historyMatchBoosterBadge}><Text style={s.historyMatchBoosterBadgeText}>⚡ BOOSTER USED</Text></View>}<Text style={s.historyStatus}>LOCKED</Text><Text style={s.pointsChevron}>{matchExpanded ? "▲" : "▼"}</Text></TouchableOpacity>
      {matchExpanded && <View style={s.historyOwners}>{testOwners.map(owner => ({ owner, points: ownerMatchPoints(owner, match.id) })).sort((a, b) => b.points - a.points || a.owner.localeCompare(b.owner)).map(({ owner, points: matchPoints }, ownerIndex, rankedOwners) => { const dayRank = rankedOwners.findIndex(item => item.points === matchPoints) + 1; const ownerKey = `${match.id}-${owner}`; const ownerExpanded = expandedOwner === ownerKey; const lineup = createTestXI(owner, match.id); const total = lineup.reduce((sum, player) => sum + player.price, 0); const impactMarker: ImpactType = seededScore(`${match.id}-${owner}-impact`) % 2 === 0 ? "BAI" : "BOI"; const booster = testBoosterFor(owner, match.id, lineup); return <View key={owner} style={s.historyOwnerCard}>
        <TouchableOpacity style={s.historyOwnerHeader} onPress={() => setExpandedOwner(ownerExpanded ? "" : ownerKey)}><View style={[s.dayRank, dayRank === 1 && s.dayRankFirst]}><Text style={[s.dayRankText, dayRank === 1 && s.dayRankTextFirst]}>#{dayRank}</Text></View><View style={s.badge}><Text style={s.badgeText}>{owner[0]}</Text></View><View style={{ flex: 1, marginLeft: 9 }}><View style={s.historyOwnerNameRow}><Text style={s.historyOwnerName}>{owner}</Text>{booster && <View style={s.historyBooster}><Text style={s.historyBoosterText}>{booster.code}</Text></View>}</View><Text style={s.historyOwnerMeta}>Match-day rank · 11 players · ₹{total.toFixed(1)}m{booster?.code === "2UP" ? " · total doubled" : booster?.code === "3X" ? ` · ${booster.playerName} tripled` : ""}</Text></View><Text style={s.historyOwnerPoints}>{Math.round(matchPoints)} pts</Text><Text style={s.pointsChevron}>{ownerExpanded ? "▲" : "▼"}</Text></TouchableOpacity>
        {ownerExpanded && <View style={s.historyLineup}>{lineup.map((player, playerIndex) => { const marker = playerIndex === 0 ? "C" : playerIndex === 1 ? "VC" : playerIndex === 2 ? impactMarker : ""; const triple = booster?.code === "3X" && booster.playerName === player.name; const playerPoints = boostedPlayerPoints(match.id, player.name, marker, triple); return <View key={player.name} style={[s.historyPlayer, marker === "C" && s.rowCaptain, marker === "VC" && s.rowVice, marker === "BAI" && s.rowBai, marker === "BOI" && s.rowBoi, triple && s.rowTriple]}><View style={{ flex: 1 }}><Text style={s.historyPlayerName}>{playerIndex + 1}. {player.name}</Text><Text style={s.historyPlayerMeta}>{player.team} · {player.role} · {player.owner === owner ? "Mine" : player.owner === "Available" ? "OpenPlayer" : `Owned by ${player.owner}`}</Text></View><Text style={s.playerPoints}>{Math.round(playerPoints)} pts</Text>{marker ? <MarkerBadge marker={marker} /> : null}{triple ? <MarkerBadge marker="3X" /> : null}</View>; })}{booster?.code === "2UP" && <View style={s.doubleUpSummary}><Text style={s.doubleUpText}>2UP applied after all player, C, VC and Impact points</Text><Text style={s.doubleUpValue}>Final total ×2</Text></View>}</View>}
      </View>; })}</View>}
    </View>; })}<Text style={s.testDataNote}>Test data only. Match 2 Pandiyan and Match 4 Jeba use 3X. Match 3 Sashi and Match 5 Saravana use 2UP.</Text>
  </>;
}
function HistoryScreen({ selected, captain, vice, submitted }: { selected: string[]; captain: string; vice: string; submitted: boolean }) {
  const chosen = players.filter(player => selected.includes(player.name));
  const total = chosen.reduce((sum, player) => sum + player.price, 0);
  return <><Text style={s.greeting}>Team history</Text><Text style={s.subtitle}>Submitted and locked match lineups</Text>{submitted ? <View style={s.historyCard}><View style={s.historyHeader}><View><Text style={s.historyMatch}>RCB vs SRH</Text><Text style={s.historyDate}>Match 1 · Mar 28 · 7:30 PM</Text></View><Text style={s.historyStatus}>SUBMITTED</Text></View><View style={s.historyStats}><Text style={s.historyStat}>11 players</Text><Text style={s.historyStat}>₹{total.toFixed(1)}m</Text></View>{chosen.map(player => <View key={player.name} style={s.historyPlayer}><Text style={s.historyPlayerName}>{player.name}</Text><Text style={s.historyPlayerMeta}>{player.team} · {player.role}{captain === player.name ? " · C" : vice === player.name ? " · VC" : ""}</Text></View>)}</View> : <View style={s.emptyHistory}><Text style={s.emptyHistoryTitle}>No submitted teams yet</Text><Text style={s.emptyHistoryText}>Submitted or locked match teams will appear here and remain view-only.</Text></View>}</>;
}
function Summary({ label, value, bad }: { label: string; value: string; bad: boolean }) { return <View style={s.summary}><Text style={s.summaryLabel}>{label}</Text><Text style={[s.summaryValue, bad && { color: "#FFB4A8" }]}>{value}</Text></View>; }
function OwnershipSummary({ label, value, tone }: { label: string; value: number; tone: "mine" | "open" | "other" | "match" }) { return <View style={s.ownershipItem}><View style={[s.ownershipDot, tone === "mine" ? s.dotMine : tone === "open" ? s.dotOpen : tone === "other" ? s.dotOther : s.dotMatch]} /><View><Text style={s.ownershipLabel}>{label}</Text><Text style={s.ownershipValue}>{value}</Text></View></View>; }
function BoosterCard({ code, name, detail, active, disabled = false, onPress }: { code: Exclude<BoosterCode, "">; name: string; detail: string; active: boolean; disabled?: boolean; onPress: () => void }) { return <TouchableOpacity disabled={disabled} style={[s.boosterCard, disabled && s.boosterCardDisabled, active && s.boosterCardActive]} onPress={onPress}><Text style={[s.boosterCode, disabled && s.boosterTextDisabled, active && s.boosterCodeActive]}>{code}</Text><Text style={[s.boosterName, disabled && s.boosterTextDisabled, active && s.boosterNameActive]}>{name}</Text><Text style={[s.boosterDetail, active && s.boosterDetailActive]}>{detail}</Text></TouchableOpacity>; }
function Marker({ text, active, disabled = false, onPress }: { text: string; active: boolean; disabled?: boolean; onPress: () => void }) { return <TouchableOpacity disabled={disabled} style={[s.marker, disabled && s.markerDisabled, active && (text === "C" ? s.badgeCaptain : text === "VC" ? s.badgeVice : text === "BAI" ? s.badgeBai : text === "BOI" ? s.badgeBoi : s.badgeTriple)]} onPress={onPress}><Text style={[s.markerText, disabled && s.markerTextDisabled, active && s.activeMarkerText]}>{text}</Text></TouchableOpacity>; }
function MarkerBadge({ marker }: { marker: string }) { return <View style={[s.markerBadge, marker === "C" ? s.badgeCaptain : marker === "VC" ? s.badgeVice : marker === "BAI" ? s.badgeBai : marker === "BOI" ? s.badgeBoi : s.badgeTriple]}><Text style={s.markerBadgeText}>{marker}</Text></View>; }

const s = StyleSheet.create({
  authSafe: { flex: 1, backgroundColor: UI.primaryDeep, alignItems: "center", justifyContent: "center", padding: 22 },
  authKeyboard: { flex: 1, width: "100%" },
  authScroll: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  authCard: { width: "100%", maxWidth: 430, backgroundColor: UI.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", shadowColor: "#000000", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.24, shadowRadius: 28, elevation: 10 },
  authLogo: { width: 54, height: 54, borderRadius: 17, backgroundColor: UI.accent, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  authLogoText: { color: "#071D17", fontSize: 18, fontWeight: "900" },
  authTitle: { color: "#10251F", fontSize: 25, fontWeight: "900" },
  authSubtitle: { color: "#718079", fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 19 },
  authInput: { backgroundColor: "white", borderWidth: 1, borderColor: "#D7DFDA", borderRadius: 12, color: "#10251F", fontSize: 15, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 11 },
  authButton: { backgroundColor: "#DDFB72", borderRadius: 13, padding: 14, alignItems: "center", marginTop: 5 },
  authButtonText: { color: "#10251F", fontWeight: "900" },
  authLink: { color: "#416158", textAlign: "center", fontSize: 12, fontWeight: "800", marginTop: 17 },
  authMessage: { color: "#8A3E32", fontSize: 11, lineHeight: 16, marginBottom: 8 },
  authSuccess: { color: "#35643B" },
  authLoadingText: { color: "#B7CDC6", fontSize: 12, marginTop: 12 },
  signedInAs: { color: "#9BC1B6", fontSize: 9, marginTop: 2 },
  signOutButton: { borderWidth: 1, borderColor: "#40675C", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginLeft: 8 },
  signOutText: { color: "#B7CDC6", fontSize: 8, fontWeight: "800" },
  homeBackground: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  homeBackgroundImage: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  homeBackgroundShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2, 18, 15, 0.34)" },
  homeContent: { backgroundColor: "transparent", minHeight: 780 },
  homeGreeting: { color: "#FFFFFF", fontSize: 27, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.65)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
  homeSubtitle: { color: "#D8E8E1", fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 18, textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  leagueCard: { backgroundColor: "white", borderRadius: 17, borderWidth: 1, borderColor: "#DEE5E1", padding: 14, marginBottom: 10 },
  homeLeagueCard: { backgroundColor: "rgba(255,255,255,0.94)", borderColor: "rgba(255,255,255,0.72)", shadowColor: "#001A12", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 9, elevation: 5 },
  leagueCardMain: { flexDirection: "row", alignItems: "center" },
  leagueCardSelected: { borderColor: "#88A938", backgroundColor: "#FBFDEF" },
  leagueEmblemShadow: { width: 62, height: 68, marginRight: 13, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 5, elevation: 6 },
  leagueEmblem: { width: 62, height: 64, borderRadius: 18, borderWidth: 2, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  leagueEmblemStripe: { position: "absolute", width: 95, height: 24, top: 7, left: -17, transform: [{ rotate: "-18deg" }], opacity: 0.95 },
  leagueEmblemGlow: { position: "absolute", width: 34, height: 34, borderRadius: 17, top: -19, right: -9, opacity: 0.18 },
  leagueBall: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: "#F7F3E8", top: 5, right: 6, transform: [{ rotate: "-20deg" }] },
  leagueBallSeam: { position: "absolute", width: 1, height: 12, backgroundColor: "#C43C3C", left: 6.5, top: 1 },
  leagueBallStitch: { position: "absolute", width: 4, height: 1, backgroundColor: "#C43C3C", left: 5 },
  leagueBallStitchOne: { top: 4 },
  leagueBallStitchTwo: { top: 8 },
  leagueEmblemCode: { fontSize: 17, lineHeight: 20, fontWeight: "900", letterSpacing: 0.8, marginTop: 5, textShadowColor: "rgba(0,0,0,0.35)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  leagueEmblemYearRibbon: { position: "absolute", bottom: 5, minWidth: 31, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, alignItems: "center" },
  leagueEmblemYear: { fontSize: 10, lineHeight: 12, fontWeight: "900", letterSpacing: 1.2 },
  leagueName: { color: "#173028", fontSize: 16, fontWeight: "900" },
  leagueMeta: { color: "#7D8B85", fontSize: 9, marginTop: 3 },
  leagueFormatNote: { color: "#4F665D", fontSize: 9, lineHeight: 13, marginTop: 5, paddingRight: 4 },
  leagueStatus: { alignSelf: "flex-start", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: "900", marginTop: 8 },
  leagueStatusActive: { color: "#285F39", backgroundColor: "#E2F1DF" },
  leagueStatusPending: { color: "#735F22", backgroundColor: "#F5EFD5" },
  leagueArrow: { color: "#809089", fontSize: 27, marginLeft: 7 },
  invitationActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#EDF0ED" },
  invitationDecline: { borderWidth: 1, borderColor: "#C4CEC9", borderRadius: 10, paddingHorizontal: 15, paddingVertical: 10 },
  invitationDeclineText: { color: "#53665E", fontSize: 11, fontWeight: "800" },
  invitationAccept: { minWidth: 128, alignItems: "center", backgroundColor: "#DDFB72", borderRadius: 10, paddingHorizontal: 15, paddingVertical: 10 },
  invitationAcceptText: { color: "#10251F", fontSize: 11, fontWeight: "900" },
  pendingLeague: { backgroundColor: "white", borderRadius: 20, padding: 24, alignItems: "center" },
  pendingLeagueEyebrow: { color: "#829089", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  pendingLeagueTitle: { color: "#173028", fontSize: 25, fontWeight: "900", marginTop: 8 },
  pendingLeagueMeta: { color: "#718079", fontSize: 11, marginTop: 5 },
  pendingLeagueText: { color: "#66766F", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 18 },
  teamHeaderExpanded: { borderWidth: 2 },
  teamChevron: { color: "#527067", fontSize: 9, fontWeight: "900", marginLeft: 8 },
  rowCaptain: { backgroundColor: "#FFF6CF" },
  rowVice: { backgroundColor: "#EAF0FF" },
  rowBai: { backgroundColor: "#FCE8F2" },
  rowBoi: { backgroundColor: "#E4F5F3" },
  rowTriple: { borderLeftWidth: 4, borderLeftColor: "#6A3FB5" },
  markerDisabled: { opacity: 0.3, backgroundColor: "#E8ECEA" },
  markerTextDisabled: { color: "#8E9994" },
  markerBadge: { minWidth: 32, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, alignItems: "center", marginRight: 7 },
  badgeCaptain: { backgroundColor: "#D8A900" },
  badgeVice: { backgroundColor: "#5578C9" },
  badgeBai: { backgroundColor: "#BE5C8B" },
  badgeBoi: { backgroundColor: "#238778" },
  badgeTriple: { backgroundColor: "#6A3FB5" },
  markerBadgeText: { color: "white", fontSize: 9, fontWeight: "900" },
  activeMarkerText: { color: "white" },
  teamScreen: { flex: 1, backgroundColor: "#F4F5EF" },
  teamContent: { padding: 20, paddingBottom: Platform.OS === "android" ? 155 : 125 },
  scrollTopButton: { position: "absolute", right: 16, bottom: Platform.OS === "android" ? 120 : 88, minWidth: 66, height: 40, borderRadius: 20, backgroundColor: "#173F35", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, zIndex: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  scrollTopArrow: { color: UI.accent, fontSize: 18, lineHeight: 20, fontWeight: "900" },
  scrollTopText: { color: "white", fontSize: 11, fontWeight: "900" },
  stickyAction: { position: "absolute", left: 0, right: 0, bottom: Platform.OS === "android" ? 32 : 0, minHeight: 74, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#DDE4DF", paddingHorizontal: 16, paddingVertical: 11, flexDirection: "row", alignItems: "center" },
  submitWarning: { position: "absolute", left: 0, right: 0, bottom: Platform.OS === "android" ? 106 : 74, minHeight: 47, backgroundColor: "#FFF4D8", borderTopWidth: 1, borderTopColor: "#E6C86A", paddingHorizontal: 16, paddingVertical: 9, flexDirection: "row", alignItems: "center", zIndex: 3 },
  submitResult: { position: "absolute", left: 12, right: 12, bottom: Platform.OS === "android" ? 114 : 82, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, zIndex: 5, borderWidth: 1 },
  submitResultWithWarnings: { bottom: 211 },
  submitResultSuccess: { backgroundColor: "#E7F6EC", borderColor: "#83BE94" },
  submitResultError: { backgroundColor: "#FFF1ED", borderColor: "#D99B8E" },
  submitResultText: { color: "#123D31", fontSize: 13, fontWeight: "800", textAlign: "center" },
  submitModalOverlay: { flex: 1, backgroundColor: "rgba(0, 24, 19, 0.72)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  submitModalCard: { width: "100%", maxWidth: 420, backgroundColor: "#F8F8F2", borderRadius: 28, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22, alignItems: "center", borderWidth: 1, borderColor: "#DDE6DF" },
  submitModalCheck: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#D8FF63", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  submitModalCheckText: { color: "#062C23", fontSize: 34, fontWeight: "900" },
  submitModalEyebrow: { color: "#687B74", fontSize: 11, fontWeight: "900", letterSpacing: 1.8 },
  submitModalTitle: { color: "#082F26", fontSize: 25, fontWeight: "900", marginTop: 7, textAlign: "center" },
  submitModalTeams: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 13, marginTop: 18 },
  submitModalVs: { color: "#71817B", fontSize: 12, fontWeight: "900" },
  submitModalSummary: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#EDF3EF", borderRadius: 18, paddingVertical: 15, marginTop: 20 },
  submitModalStat: { flex: 1, alignItems: "center" },
  submitModalStatValue: { color: "#0C483A", fontSize: 19, fontWeight: "900" },
  submitModalStatLabel: { color: "#7A8983", fontSize: 9, fontWeight: "800", marginTop: 3, letterSpacing: 0.7 },
  submitModalDivider: { width: 1, height: 32, backgroundColor: "#CFDAD4" },
  submitModalWarning: { width: "100%", backgroundColor: "#FFF3CD", borderWidth: 1.5, borderColor: "#E5A900", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, marginTop: 15 },
  submitModalWarningHeading: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  submitModalWarningIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: "#D99700", alignItems: "center", justifyContent: "center", marginRight: 8 },
  submitModalWarningIconText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  submitModalWarningTitle: { color: "#4E3500", fontSize: 12, fontWeight: "900", flex: 1 },
  submitModalWarningText: { color: "#624600", fontSize: 10, lineHeight: 15, fontWeight: "700", marginTop: 2 },
  submitModalNote: { color: "#64756F", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 18 },
  submitModalButton: { width: "100%", backgroundColor: "#0A4A3B", borderRadius: 15, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  submitModalButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  submitWarningIcon: { color: "#765D16", fontSize: 15, marginRight: 8 },
  submitWarningText: { flex: 1, color: "#765D16", fontSize: 9, lineHeight: 13, fontWeight: "800" },
  stickyTitle: { color: "#173028", fontSize: 13, fontWeight: "900" },
  stickyMatch: { color: "#4456A6", fontSize: 8, fontWeight: "900", letterSpacing: 0.5, marginBottom: 2 },
  stickyMeta: { color: "#7D8B85", fontSize: 10, marginTop: 3 },
  stickyButton: { marginLeft: "auto", backgroundColor: "#174D3D", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13 },
  fixtureStrip: { marginHorizontal: -20, marginBottom: 18 },
  lockCountdown: { backgroundColor: "#102D25", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lockCountdownLabel: { color: "#D8FF63", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  lockCountdownMatch: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", marginTop: 4 },
  lockCountdownTime: { color: "#D8FF63", fontSize: 19, fontWeight: "900", fontVariant: ["tabular-nums"] },
  lockCountdownDate: { fontSize: 12, maxWidth: 145, textAlign: "right" },
  activeFixtureBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF4EC", borderWidth: 1, borderColor: "#F0B28B", borderRadius: 15, paddingHorizontal: 13, paddingVertical: 10, marginBottom: 12 },
  activeFixtureBadge: { backgroundColor: "#EF6A2C", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginRight: 10 },
  activeFixtureBadgeText: { color: "#FFFFFF", fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  activeFixtureDetails: { flex: 1 },
  activeFixtureTitle: { color: "#173028", fontSize: 14, fontWeight: "900" },
  activeFixtureTeams: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  activeFixtureVs: { color: "#7B8983", fontSize: 8, fontWeight: "900" },
  activeFixtureHint: { color: "#9A4A27", fontSize: 8, fontWeight: "900", letterSpacing: 0.4, marginLeft: 8 },
  fixtureStripContent: { paddingHorizontal: 20, gap: 9 },
  fixtureCard: { width: 142, backgroundColor: "white", borderWidth: 1, borderColor: "#DCE4DF", borderRadius: 14, padding: 12 },
  fixtureCardActive: { backgroundColor: "#174D3D", borderColor: "#174D3D" },
  fixtureNumber: { color: "#8A9691", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  fixtureTeams: { color: "#173028", fontSize: 15, fontWeight: "900", marginTop: 7 },
  fixtureTime: { color: "#7D8B85", fontSize: 9, marginTop: 4 },
  fixtureTextActive: { color: "white" },
  fixtureTeamRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  fixtureVs: { color: "#718079", fontSize: 8, fontWeight: "900" },
  titleTeamRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 7, marginBottom: 16 },
  titleLock: { color: "#718079", fontSize: 9, marginLeft: 2 },
  teamSubMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  specialNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  playingTeamHelp: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  playerFiltersCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5E0", borderRadius: 17, padding: 13, marginTop: 14, shadowColor: "#18352D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  playerFiltersHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  playerFiltersTitle: { color: "#17352C", fontSize: 14, fontWeight: "900" },
  playerFiltersHint: { color: "#7B8984", fontSize: 9, marginTop: 2 },
  clearFiltersText: { color: "#C55734", fontSize: 10, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 5 },
  playerFilterLabel: { color: "#899690", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginBottom: 6 },
  playerFilterRow: { gap: 7, paddingBottom: 9 },
  playerFilterChip: { minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: "#D5DEDA", backgroundColor: "#F4F7F5", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  playerFilterChipActive: { backgroundColor: "#173F35", borderColor: "#173F35" },
  playerFilterChipText: { color: "#536860", fontSize: 10, fontWeight: "800" },
  playerFilterChipTextActive: { color: "#D8FF63", fontWeight: "900" },
  helperInline: { color: "#7D8984", fontSize: 11 },
  adminFixtureTeams: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  fixtureStatus: { color: "#7B6B24", backgroundColor: "#F6F0D7", alignSelf: "flex-start", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: "800", marginTop: 9 },
  statusSubmitted: { color: "#275B32", backgroundColor: "#DFF0DD" },
  lockedBanner: { backgroundColor: "#F5EAE7", borderRadius: 11, padding: 11, marginBottom: 11 },
  lockedBannerText: { color: "#6E3A30", fontSize: 11, fontWeight: "900" },
  ownerStrip: { marginHorizontal: -20, marginBottom: 12 },
  ownerChip: { backgroundColor: "white", borderWidth: 1, borderColor: "#D8E1DC", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, marginLeft: 8 },
  ownerChipActive: { backgroundColor: "#174D3D", borderColor: "#174D3D" },
  ownerChipText: { color: "#556A62", fontSize: 11, fontWeight: "800" },
  ownerChipTextActive: { color: "white" },
  testDataNote: { color: "#87938E", fontSize: 9, textAlign: "center", marginTop: 10 },
  matchHistoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 11 },
  matchHistoryCard: { width: "31%", backgroundColor: "white", borderWidth: 1, borderColor: "#D8E1DC", borderRadius: 12, padding: 10 },
  matchHistoryCardActive: { backgroundColor: "#174D3D", borderColor: "#174D3D" },
  matchHistoryNumber: { color: "#84918C", fontSize: 7, fontWeight: "900" },
  matchHistoryTeams: { color: "#173028", fontSize: 12, fontWeight: "900", marginTop: 5 },
  matchHistoryDate: { color: "#7D8B85", fontSize: 7, marginTop: 3 },
  historyMatchCard: { backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#DFE6E1", marginBottom: 9, overflow: "hidden" },
  historyMatchBoosted: { borderColor: "#8C67C8", borderWidth: 2, backgroundColor: "#FCF9FF" },
  historyMatchHeader: { flexDirection: "row", alignItems: "center", padding: 13 },
  historyListTitle: { color: "#173028", fontSize: 13, fontWeight: "900" },
  historyListMeta: { color: "#7D8B85", fontSize: 9, marginTop: 3 },
  historyMatchBoosterOwners: { color: "#68409E", fontSize: 8, fontWeight: "900", marginTop: 5 },
  historyMatchBoosterBadge: { backgroundColor: "#EEE3FF", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, marginLeft: 6 },
  historyMatchBoosterBadgeText: { color: "#603694", fontSize: 7, fontWeight: "900" },
  historyOwners: { backgroundColor: "#F1F4F1", borderTopWidth: 1, borderTopColor: "#E2E8E4", padding: 8 },
  historyOwnerCard: { backgroundColor: "white", borderRadius: 11, marginBottom: 7, overflow: "hidden" },
  historyOwnerHeader: { flexDirection: "row", alignItems: "center", padding: 10 },
  dayRank: { minWidth: 31, height: 31, borderRadius: 10, backgroundColor: "#EEF1EF", alignItems: "center", justifyContent: "center", marginRight: 7 },
  dayRankFirst: { backgroundColor: "#DDFB72" },
  dayRankText: { color: "#64766F", fontSize: 9, fontWeight: "900" },
  dayRankTextFirst: { color: "#174D3D" },
  historyOwnerName: { color: "#20372F", fontFamily: OWNER_FONT, fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  historyOwnerNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyBooster: { backgroundColor: "#6A3FB5", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  historyBoosterText: { color: "white", fontSize: 7, fontWeight: "900" },
  historyOwnerMeta: { color: "#829089", fontSize: 8, marginTop: 2 },
  historyOwnerPoints: { color: "#174D3D", fontSize: 12, fontWeight: "900", marginRight: 5 },
  historyLineup: { borderTopWidth: 1, borderTopColor: "#E7EBE8", paddingHorizontal: 9 },
  doubleUpSummary: { flexDirection: "row", alignItems: "center", backgroundColor: "#EDF6D2", borderRadius: 9, padding: 10, marginVertical: 7 },
  doubleUpText: { flex: 1, color: "#5C714B", fontSize: 8, fontWeight: "800" },
  doubleUpValue: { color: "#31511F", fontSize: 10, fontWeight: "900" },
  historyCard: { backgroundColor: "white", borderRadius: 17, padding: 15 },
  historyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  historyMatch: { color: "#173028", fontSize: 18, fontWeight: "900" },
  historyDate: { color: "#7D8B85", fontSize: 10, marginTop: 3 },
  historyStatus: { marginLeft: "auto", color: "#2F6237", backgroundColor: "#E3F1E0", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: "900" },
  historyStats: { flexDirection: "row", gap: 8, marginBottom: 8 },
  historyStat: { color: "#416158", backgroundColor: "#EAF0ED", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, fontSize: 10, fontWeight: "800" },
  historyPlayer: { borderTopWidth: 1, borderTopColor: "#EDF0EE", paddingVertical: 9, flexDirection: "row", alignItems: "center" },
  historyPlayerName: { color: "#20372F", fontSize: 12, fontWeight: "800" },
  historyPlayerMeta: { color: "#819089", fontSize: 9, marginTop: 2 },
  historyPoints: { color: "#174D3D", fontSize: 16, fontWeight: "900", marginBottom: 4 },
  playerPoints: { color: "#174D3D", fontSize: 11, fontWeight: "900", marginHorizontal: 8 },
  emptyHistory: { backgroundColor: "white", borderRadius: 17, padding: 28, alignItems: "center" },
  emptyHistoryTitle: { color: "#20372F", fontSize: 16, fontWeight: "900" },
  emptyHistoryText: { color: "#819089", fontSize: 11, textAlign: "center", marginTop: 6 },
  issuePopup: { position: "absolute", left: 12, right: 12, bottom: Platform.OS === "android" ? 110 : 78, backgroundColor: "#FFF5F1", borderWidth: 1, borderColor: "#EDC9BE", borderRadius: 14, padding: 14, zIndex: 5 },
  issuePopupWithWarnings: { bottom: 207 },
  issuePopupTitle: { color: "#6E2D21", fontSize: 13, fontWeight: "900", marginBottom: 5 },
  issuePopupText: { color: "#78483F", fontSize: 11, marginTop: 4 },
  carryForward: { backgroundColor: "#EAF6E5", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  carryForwardText: { color: "#35643B", fontSize: 11, fontWeight: "800" },
  activeRulesBanner: { backgroundColor: "#F2F7F5", borderWidth: 1, borderColor: "#D7E8E1", borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  activeRulesHeading: { flexDirection: "row", alignItems: "center" },
  activeRulesIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#174D3D", alignItems: "center", justifyContent: "center", marginRight: 9 },
  activeRulesIconText: { color: "#DDFB72", fontSize: 15, fontWeight: "900" },
  activeRulesTitle: { color: "#173B31", fontSize: 11, fontWeight: "900" },
  activeRulesText: { color: "#61736D", fontSize: 9, marginTop: 2 },
  activeRulesChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  activeRulesChip: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDE6E2", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  activeRulesChipText: { color: "#425D54", fontSize: 8, fontWeight: "800" },
  freeTransferBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#DDF7E2", borderWidth: 1, borderColor: "#62A970", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10 },
  freeTransferIcon: { minWidth: 42, height: 31, paddingHorizontal: 7, borderRadius: 16, backgroundColor: "#277348", alignItems: "center", justifyContent: "center", marginRight: 10 },
  freeTransferIconText: { color: "white", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  freeTransferTitle: { color: "#1D603A", fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  freeTransferText: { color: "#407154", fontSize: 9, lineHeight: 13, marginTop: 3 },
  priorMatchBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF0E8", borderWidth: 1, borderColor: "#D98763", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10 },
  priorMatchIcon: { width: 31, height: 31, borderRadius: 16, backgroundColor: "#A64D31", alignItems: "center", justifyContent: "center", marginRight: 10 },
  priorMatchIconText: { color: "white", fontSize: 16, fontWeight: "900" },
  priorMatchTitle: { color: "#873D28", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  priorMatchText: { color: "#865A4B", fontSize: 9, lineHeight: 13, marginTop: 3 },
  ownershipSummary: { flexDirection: "row", gap: 0, marginTop: 8, marginBottom: 2, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E8EE", borderRadius: 13, padding: 4 },
  openLeagueMatchSummary: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E8EE", borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, marginTop: 8, marginBottom: 2 },
  openLeagueMatchLabel: { flex: 1, color: "#52675F", fontSize: 10, fontWeight: "800", marginLeft: 2 },
  openLeagueMatchValue: { color: "#173F35", fontSize: 18, fontWeight: "900" },
  ownershipItem: { flex: 1, minHeight: 42, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 6, flexDirection: "row", alignItems: "center" },
  ownershipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  dotMine: { backgroundColor: "#2B775F" },
  dotOpen: { backgroundColor: "#C79D25" },
  dotOther: { backgroundColor: "#A35C72" },
  dotMatch: { backgroundColor: "#426FC0" },
  impactHelp: { backgroundColor: "#EEF1FA", borderRadius: 11, padding: 11, marginTop: 10 },
  impactHelpTitle: { color: "#354C7A", fontSize: 11, fontWeight: "900" },
  impactHelpText: { color: "#65728C", fontSize: 9, lineHeight: 13, marginTop: 3 },
  boosterGrid: { flexDirection: "row", gap: 7, marginTop: 6 },
  boosterSection: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4E8EE", borderRadius: 16, padding: 10, marginTop: 10, marginBottom: 10, shadowColor: "#111827", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 7, elevation: 2 },
  boosterSectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  boosterSectionTitle: { color: "#17243D", fontSize: 13, fontWeight: "900" },
  boosterSectionHint: { color: "#7B8493", fontSize: 8, fontWeight: "700" },
  boosterCard: { flex: 1, minHeight: 68, borderWidth: 1, borderColor: "#D8E0DC", backgroundColor: "white", borderRadius: 11, paddingHorizontal: 9, paddingVertical: 7, justifyContent: "center" },
  boosterCardDisabled: { backgroundColor: "#ECEFED", borderColor: "#D7DDD9", opacity: 0.72 },
  boosterTextDisabled: { color: "#89958F" },
  boosterCardActive: { borderColor: "#174D3D", backgroundColor: "#174D3D" },
  boosterCode: { color: "#174D3D", fontSize: 12, fontWeight: "900" },
  boosterCodeActive: { color: "#DDFB72" },
  boosterName: { color: "#334D44", fontSize: 8, fontWeight: "900", marginTop: 2 },
  boosterNameActive: { color: "white" },
  boosterDetail: { color: "#84918C", fontSize: 7, lineHeight: 9, marginTop: 2 },
  boosterDetailActive: { color: "#BBD0C9" },
  boosterHelp: { backgroundColor: "#EDF6D2", borderRadius: 11, padding: 11, marginTop: 8 },
  boosterHelpTitle: { color: "#31511F", fontSize: 10, fontWeight: "900" },
  boosterHelpText: { color: "#5C714B", fontSize: 8, lineHeight: 12, marginTop: 3 },
  warningCard: { backgroundColor: "#FFF4D8", borderWidth: 1, borderColor: "#E6C86A", borderRadius: 10, padding: 10, marginTop: 7 },
  warningText: { color: "#765D16", fontSize: 10, fontWeight: "800" },
  combinedWarning: { backgroundColor: "#FFF3CD", borderWidth: 2, borderColor: "#E5A900", borderRadius: 15, marginTop: 12, overflow: "hidden", shadowColor: "#8A5B00", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 3 },
  combinedWarningHeader: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11 },
  combinedWarningIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#D99700", alignItems: "center", justifyContent: "center", marginRight: 12 },
  combinedWarningIconText: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  combinedWarningTitle: { color: "#4E3500", fontSize: 14, fontWeight: "900" },
  combinedWarningSummary: { color: "#624600", fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 3 },
  combinedWarningChevron: { color: "#624600", fontSize: 13, marginLeft: 10 },
  combinedWarningBody: { borderTopWidth: 1, borderTopColor: "#DDBF63", paddingHorizontal: 15, paddingVertical: 11 },
  combinedWarningText: { color: "#523A00", fontSize: 12, fontWeight: "700", lineHeight: 18 },
  selectionTitleRow: { flexDirection: "row", alignItems: "flex-start" },
  selectionActions: { marginLeft: 8, gap: 6 },
  resetButton: { minHeight: 42, borderWidth: 1, borderColor: "#D4D9E1", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  resetButtonText: { color: "#6A423A", fontSize: 10, fontWeight: "900" },
  clearButton: { borderWidth: 1, borderColor: "#D6AEA5", backgroundColor: "#FFF3F0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  clearButtonText: { color: "#8B4337", fontSize: 10, fontWeight: "900" },
  selectedTitle: { color: "#173028", fontSize: 14, fontWeight: "900", marginTop: 16, marginBottom: 7 },
  selectedStrip: { marginHorizontal: -20 },
  selectedStripContent: { paddingHorizontal: 20, gap: 8 },
  selectedList: { backgroundColor: "white", borderRadius: 12, paddingHorizontal: 10 },
  selectedListRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#EDF0EE" },
  selectedNumber: { width: 25, color: "#829089", fontSize: 10, fontWeight: "900" },
  selectedChip: { minWidth: 150, backgroundColor: "#EAF2EE", borderRadius: 11, paddingLeft: 10, paddingVertical: 9, paddingRight: 6, flexDirection: "row", alignItems: "center" },
  selectedChipName: { color: "#1E3B31", fontSize: 10, fontWeight: "900" },
  selectedChipMeta: { color: "#74857E", fontSize: 8, marginTop: 2 },
  selectedCost: {
    color: "#173B31",
    fontSize: 8,
    fontWeight: "900",
    backgroundColor: "#F4EFD5",
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 5,
  },
  selectedEditHint: {
    color: "#74857E",
    fontSize: 8,
    marginLeft: 6,
    flexShrink: 1,
  },
  removeSelected: { width: 25, height: 25, borderRadius: 8, backgroundColor: "white", alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  removeSelectedText: { color: "#7D4E45", fontSize: 18, lineHeight: 19, fontWeight: "700" },
  emptySelected: { backgroundColor: "#EDF1EF", borderRadius: 10, padding: 11 },
  emptySelectedText: { color: "#77857F", fontSize: 10 },
  ownershipLabel: { color: "#87938E", fontSize: 7, fontWeight: "900" },
  ownershipValue: { color: "#173028", fontSize: 15, fontWeight: "900", marginTop: 2 },
  pointsReset: { backgroundColor: "#E8F2ED", borderRadius: 14, padding: 13, marginTop: 12 },
  pointsResetTitle: { color: "#174D3D", fontSize: 12, fontWeight: "900" },
  pointsResetText: { color: "#587068", fontSize: 10, lineHeight: 15, marginTop: 3 },
  adminLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  adminLoadingText: { color: "#60736B", fontSize: 11, fontWeight: "800" },
  adminNotice: { backgroundColor: "#EAF2EE", borderRadius: 13, padding: 12, marginTop: 12 },
  adminNoticeTitle: { color: "#174D3D", fontSize: 11, fontWeight: "900" },
  adminNoticeText: { color: "#61756D", fontSize: 9, lineHeight: 14, marginTop: 3 },
  adminTabs: { flexDirection: "row", gap: 4, backgroundColor: "#E2E8E4", borderRadius: 12, padding: 4, marginTop: 12 },
  adminTab: { minWidth: 105, alignItems: "center", borderRadius: 9, paddingVertical: 10, paddingHorizontal: 8 },
  adminTabActive: { backgroundColor: "#174D3D" },
  adminTabText: { color: "#60736B", fontSize: 9, fontWeight: "900" },
  adminTabTextActive: { color: "#DDFB72" },
  adminCard: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E4E8EE", paddingHorizontal: 15, paddingTop: 5, paddingBottom: 9, marginTop: 12, shadowColor: "#111827", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 9, elevation: 2 },
  ownerAdminInput: { height: 46, backgroundColor: "#F4F7F5", borderWidth: 1, borderColor: "#DCE5E0", borderRadius: 10, paddingHorizontal: 12, color: "#173028", marginBottom: 9 },
  ownerInviteMessage: { backgroundColor: "#FFF0EC", borderRadius: 10, padding: 11, marginTop: 9 },
  ownerRoleRow: { flexDirection: "row", gap: 8, marginBottom: 2 },
  ownerRoleButton: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: "#C9D3CE", borderRadius: 10, paddingVertical: 10 },
  ownerRoleButtonActive: { backgroundColor: "#EAF6C7", borderColor: "#9BB73E" },
  ownerRoleText: { color: "#263B34", fontSize: 11, fontWeight: "800" },
  ownerAdminRow: { minHeight: 68, flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 13, padding: 11, marginBottom: 8 },
  ownerDisplayName: { color: "#173028", fontSize: 13, fontWeight: "900", fontFamily: OWNER_FONT },
  ownerActivate: { backgroundColor: "#DDFB72", borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9 },
  ownerActivateText: { color: "#10251F", fontSize: 10, fontWeight: "900" },
  ownerSuspend: { borderWidth: 1, borderColor: "#D5A59B", borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9 },
  ownerSuspendText: { color: "#8B3D31", fontSize: 10, fontWeight: "900" },
  ownerAdminActions: { alignItems: "stretch", gap: 6, marginLeft: 7 },
  ownerEditName: { borderWidth: 1, borderColor: "#9FAEDB", backgroundColor: "#F2F5FF", borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, alignItems: "center" },
  ownerEditNameText: { color: "#43558C", fontSize: 9, fontWeight: "900" },
  ownerRenamePanel: { flex: 1, paddingVertical: 2 },
  ownerRenameInput: { minHeight: 42, borderWidth: 1, borderColor: "#8998C7", backgroundColor: "#FFFFFF", color: "#18223B", borderRadius: 10, paddingHorizontal: 11, fontSize: 12, fontWeight: "800" },
  ownerRenameActions: { flexDirection: "row", justifyContent: "flex-end", gap: 7, marginTop: 7 },
  ownerRenameCancel: { borderWidth: 1, borderColor: "#C9D0D9", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  ownerRenameCancelText: { color: "#66717F", fontSize: 9, fontWeight: "900" },
  ownerRenameSave: { minWidth: 82, backgroundColor: "#43558C", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  ownerRenameSaveText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  templateChoices: { gap: 8, paddingVertical: 10 },
  templateChoice: { minWidth: 135, borderWidth: 1, borderColor: "#D3DDD8", backgroundColor: "#F5F8F6", borderRadius: 11, padding: 11 },
  templateChoiceActive: { borderColor: "#88A938", backgroundColor: "#F0F8D8" },
  templateChoiceName: { color: "#173028", fontSize: 11, fontWeight: "900" },
  adminGroupTitle: { color: "#174D3D", fontSize: 11, fontWeight: "900", paddingTop: 14, paddingBottom: 5 },
  adminField: { minHeight: 55, borderTopWidth: 1, borderTopColor: "#E8ECE9", flexDirection: "row", alignItems: "center", gap: 10 },
  adminFieldLabel: { color: "#2C433A", fontSize: 10, fontWeight: "800" },
  adminFieldDetail: { color: "#89958F", fontSize: 8, marginTop: 2 },
  formatToggle: { minWidth: 47, borderRadius: 9, backgroundColor: "#E5EAE7", paddingHorizontal: 10, paddingVertical: 8, alignItems: "center" },
  formatToggleActive: { backgroundColor: "#174D3D" },
  formatToggleText: { color: "#718079", fontSize: 8, fontWeight: "900" },
  formatToggleTextActive: { color: "#DDFB72" },
  adminInput: { width: 78, height: 38, borderWidth: 1, borderColor: "#CFD9D4", backgroundColor: "#F8FAF9", borderRadius: 9, paddingHorizontal: 9, color: "#173028", fontSize: 12, fontWeight: "900", textAlign: "right" },
  adminInputReadOnly: { backgroundColor: "#EEF1EF", color: "#66766F" },
  adminMessage: { backgroundColor: "#FFF1ED", borderRadius: 10, padding: 10, marginTop: 10 },
  adminMessageSuccess: { backgroundColor: "#E5F3E1" },
  adminMessageText: { color: "#5D473F", fontSize: 9, fontWeight: "800", lineHeight: 13 },
  adminFootnote: { color: "#7B8983", fontSize: 8, lineHeight: 12, textAlign: "center", marginTop: 8 },
  adminPhaseHelp: { backgroundColor: "#EAF2EE", borderRadius: 12, padding: 12, marginTop: 10 },
  adminPhaseCard: { backgroundColor: "white", borderRadius: 13, padding: 12, marginTop: 9, borderWidth: 1, borderColor: "#DEE6E1" },
  adminPhaseHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  adminPhaseNameInput: { flex: 1, height: 40, borderWidth: 1, borderColor: "#CFD9D4", borderRadius: 9, paddingHorizontal: 10, color: "#173028", fontSize: 11, fontWeight: "900" },
  adminPhaseRemove: { paddingHorizontal: 8, paddingVertical: 8 },
  adminPhaseRemoveText: { color: "#935448", fontSize: 8, fontWeight: "900" },
  adminPhaseRange: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 10 },
  adminPhaseNumberInput: { height: 40, borderWidth: 1, borderColor: "#CFD9D4", backgroundColor: "#F8FAF9", borderRadius: 9, paddingHorizontal: 10, marginTop: 4, color: "#173028", fontSize: 12, fontWeight: "900", textAlign: "center" },
  adminPhaseTo: { color: "#7B8983", fontSize: 9, fontWeight: "800", paddingBottom: 14 },
  adminAddPhase: { borderWidth: 1, borderStyle: "dashed", borderColor: "#8FA49B", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 9 },
  adminAddPhaseText: { color: "#174D3D", fontSize: 10, fontWeight: "900" },
  rankingPhaseTabs: { gap: 8, paddingRight: 20, marginTop: 4 },
  rankingPhaseTab: { minWidth: 112, borderWidth: 1, borderColor: "#D7E0DB", backgroundColor: "white", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  rankingPhaseTabActive: { borderColor: "#174D3D", backgroundColor: "#174D3D" },
  rankingPhaseName: { color: "#334D44", fontSize: 11, fontWeight: "900" },
  rankingPhaseNameActive: { color: "#DDFB72" },
  rankingPhaseRange: { color: "#829089", fontSize: 8, marginTop: 3 },
  rankingPhaseRangeActive: { color: "#BBD0C9" },
  leagueSectionTabs: { flexDirection: "row", backgroundColor: "#E4EAE6", borderRadius: 12, padding: 4, marginTop: 14, marginBottom: 4 },
  leagueSectionTab: { flex: 1, alignItems: "center", borderRadius: 9, paddingVertical: 10 },
  leagueSectionTabActive: { backgroundColor: "#174D3D" },
  leagueSectionTabText: { color: "#65766F", fontSize: 11, fontWeight: "900" },
  leagueSectionTabTextActive: { color: "#DDFB72" },
  ownerSquadCard: { backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#DFE6E1", marginBottom: 9, overflow: "hidden" },
  ownerSquadHeader: { flexDirection: "row", alignItems: "center", padding: 12 },
  ownerSquadName: { color: "#20372F", fontFamily: OWNER_FONT, fontSize: 14, fontWeight: "700", letterSpacing: 0.2 },
  ownerSquadMeta: { color: "#829089", fontSize: 8, marginTop: 2 },
  ownerSquadTotal: { color: "#174D3D", fontSize: 12, fontWeight: "900" },
  ownerSquadBody: { borderTopWidth: 1, borderTopColor: "#E5EAE7", paddingHorizontal: 8, paddingBottom: 7 },
  ownerPointColumns: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  ownerPointPlayer: { flex: 1, color: "#7C8A84", fontSize: 7, fontWeight: "900" },
  ownerPointCell: { width: 32, color: "#61736C", fontSize: 8, textAlign: "right" },
  ownerPointTotal: { width: 39, color: "#174D3D", fontSize: 9, fontWeight: "900", textAlign: "right" },
  ownerPlayerRow: { flexDirection: "row", alignItems: "center", minHeight: 42, borderTopWidth: 1, borderTopColor: "#EDF0EE" },
  ownerPlayerName: { color: "#263E35", fontSize: 10, fontWeight: "900" },
  ownerPlayerMeta: { color: "#84928C", fontSize: 7, marginTop: 2 },
  ownerMatchBreakdown: { backgroundColor: "#F2F5F3", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 },
  ownerMatchRow: { flexDirection: "row", alignItems: "center", minHeight: 25 },
  ownerMatchName: { flex: 1, color: "#5D7068", fontSize: 8, fontWeight: "900" },
  ownerMatchCell: { width: 32, color: "#6F7F79", fontSize: 8, textAlign: "right" },
  ownerMatchTotal: { width: 39, color: "#174D3D", fontSize: 8, fontWeight: "900", textAlign: "right" },
  ownerTotalsRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#E7F0EB", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 9, marginTop: 6 },
  pointsMatchCard: { backgroundColor: "white", borderRadius: 14, marginBottom: 9, overflow: "hidden", borderWidth: 1, borderColor: "#E1E7E3" },
  pointsMatchHeader: { flexDirection: "row", alignItems: "center", padding: 13 },
  pointsMatchTitle: { color: "#173028", fontSize: 13, fontWeight: "900" },
  pointsMatchMeta: { color: "#7D8B85", fontSize: 9, marginTop: 3 },
  pointsStatus: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: "900" },
  pointsCalculated: { color: "#285F39", backgroundColor: "#E2F1DF" },
  pointsPending: { color: "#735F22", backgroundColor: "#F5EFD5" },
  pointsChevron: { color: "#667A72", fontSize: 9, fontWeight: "900", marginLeft: 10 },
  pointsMatchBody: { borderTopWidth: 1, borderTopColor: "#E8ECE9", paddingHorizontal: 10, paddingBottom: 8 },
  pointsColumns: { flexDirection: "row", paddingVertical: 8, alignItems: "center" },
  pointsColumnPlayer: { flex: 1, color: "#87938E", fontSize: 7, fontWeight: "900" },
  pointsColumn: { width: 34, textAlign: "right", color: "#87938E", fontSize: 7, fontWeight: "900" },
  pointsColumnTotal: { width: 42, textAlign: "right", color: "#174D3D", fontSize: 7, fontWeight: "900" },
  pointsPlayerRow: { flexDirection: "row", alignItems: "center", minHeight: 31, borderTopWidth: 1, borderTopColor: "#F0F2F0" },
  playerBreakChevron: { width: 14, color: "#6F817A", fontSize: 7, fontWeight: "900" },
  pointsPlayerIdentity: { flex: 1, paddingVertical: 5 },
  pointsPlayerName: { color: "#243C34", fontSize: 9, fontWeight: "800" },
  pointsPlayerTeam: { color: "#7B8B84", fontSize: 7, fontWeight: "900", marginTop: 2 },
  pointsTeamHeader: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8F0EC", marginHorizontal: -10, paddingHorizontal: 10, paddingVertical: 6 },
  pointsTeamHeaderText: { flex: 1, color: "#174D3D", fontSize: 10, fontWeight: "900" },
  pointsTeamHeaderMeta: { color: "#71827B", fontSize: 7, fontWeight: "800" },
  pointsCell: { width: 34, textAlign: "right", color: "#687871", fontSize: 9 },
  pointsCellTotal: { width: 42, textAlign: "right", color: "#174D3D", fontSize: 10, fontWeight: "900" },
  pointsEmpty: { borderTopWidth: 1, borderTopColor: "#E8ECE9", padding: 16, alignItems: "center" },
  pointsEmptyTitle: { color: "#53675F", fontSize: 11, fontWeight: "900" },
  pointsEmptyText: { color: "#8A9691", fontSize: 9, marginTop: 4 },
  fullBreakdown: { backgroundColor: "#F6F8F5", borderTopWidth: 1, borderTopColor: "#E4E9E5", padding: 9, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  detailSection: { width: "48%", backgroundColor: "white", borderRadius: 9, padding: 8 },
  detailHeading: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EDF0ED", paddingBottom: 5, marginBottom: 3 },
  detailTitle: { flex: 1, color: "#718079", fontSize: 7, fontWeight: "900" },
  detailTotal: { color: "#174D3D", fontSize: 11, fontWeight: "900" },
  detailRow: { flexDirection: "row", paddingVertical: 3 },
  detailLabel: { flex: 1, color: "#63756E", fontSize: 8 },
  detailValue: { color: "#213A31", fontSize: 8, fontWeight: "900" },
  detailEmpty: { color: "#9AA49F", fontSize: 8, paddingVertical: 3 },
  appShell: { flex: 1, width: "100%", maxWidth: 1180, alignSelf: "center", backgroundColor: UI.primaryDeep, shadowColor: "#00150F", shadowOffset: { width: 0, height: 0 }, shadowOpacity: Platform.OS === "web" ? 0.2 : 0, shadowRadius: 24 },
  headerIdentity: { flex: 1, marginLeft: 11, paddingRight: 8, minWidth: 0 },
  headerMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 },
  headerPageChip: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  headerPageChipText: { fontSize: 9, fontWeight: "900" },
  headerActions: { alignItems: "flex-end", gap: 6, marginLeft: 5 },
  navigationMenuButton: { minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 },
  navigationMenuButtonIcon: { color: "white", fontSize: 17, fontWeight: "900" },
  navigationMenuButtonText: { color: "white", fontSize: 11, fontWeight: "900" },
  navigationMenuOverlay: { flex: 1, backgroundColor: "rgba(3,18,15,0.58)", alignItems: "flex-end", paddingTop: Platform.OS === "android" ? 70 : 86, paddingRight: 14 },
  navigationMenuCard: { width: 286, maxHeight: "88%", backgroundColor: "#FBFCF8", borderRadius: 22, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 10, borderWidth: 1, borderColor: "#D8E1DC", shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 18 },
  navigationMenuHeader: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 4, paddingBottom: 8 },
  navigationMenuEyebrow: { color: "#75847E", fontSize: 8, fontWeight: "900", letterSpacing: 1.4, marginTop: 2 },
  navigationMenuLeague: { color: "#102A23", fontSize: 15, lineHeight: 19, fontWeight: "900", marginTop: 3, paddingRight: 6 },
  navigationMenuClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center", marginLeft: 5 },
  navigationMenuCloseText: { color: "#52675F", fontSize: 23, lineHeight: 25, fontWeight: "600" },
  navigationMenuScroll: { paddingBottom: 2 },
  navigationMenuItem: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 9, marginBottom: 3, flexDirection: "row", alignItems: "center", gap: 9 },
  navigationMenuItemText: { flex: 1, color: "#304A42", fontSize: 12, fontWeight: "800" },
  navigationMenuCheck: { width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  navigationMenuCheckText: { color: "white", fontSize: 12, lineHeight: 14, fontWeight: "900" },
  navigationMenuArrow: { color: "#83918C", fontSize: 24, lineHeight: 24 },
  navigationMenuDivider: { height: 1, backgroundColor: "#E1E7E3", marginVertical: 8 },
  navigationMenuHome: { minHeight: 44, borderRadius: 12, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  navigationMenuHomeIcon: { color: "#175B49", fontSize: 21, fontWeight: "900" },
  navigationMenuHomeText: { color: "#1D4137", fontSize: 13, fontWeight: "900" },
  navigationMenuSignOut: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#E3C6C0", backgroundColor: "#FFF5F2", marginTop: 7, alignItems: "center", justifyContent: "center" },
  navigationMenuSignOutText: { color: "#8A4035", fontSize: 12, fontWeight: "900" },
  homeIcon: { width: 25, height: 25, alignItems: "center", justifyContent: "flex-end" },
  homeIconRoof: { position: "absolute", top: 1, width: 18, height: 18, backgroundColor: UI.primaryDeep, transform: [{ rotate: "45deg" }], borderRadius: 2 },
  homeIconBody: { width: 20, height: 16, backgroundColor: UI.primaryDeep, alignItems: "center", justifyContent: "flex-end" },
  homeIconDoor: { width: 6, height: 9, backgroundColor: UI.accent, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  livePill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(216,255,99,0.09)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: UI.accent, marginRight: 5 },
  headerModern: { minHeight: 80, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 13, backgroundColor: "#111827", borderBottomWidth: 0, position: "relative", overflow: "hidden" },
  headerAccent: { position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: "#6D44C5", opacity: 0.95 },
  logoModern: { width: 44, height: 44, borderRadius: 14, backgroundColor: UI.accent, shadowColor: "#000000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.27, shadowRadius: 7, elevation: 5 },
  eyebrowModern: { color: "#A7B0C0", fontSize: 8, letterSpacing: 1.4 },
  brandModern: { color: "#FFFFFF", fontSize: 18, lineHeight: 21, marginTop: 1 },
  signedInAsModern: { flexShrink: 1, color: "#C0C8D5", fontSize: 10 },
  signOutButtonModern: { borderColor: "rgba(255,255,255,0.20)", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  signOutTextModern: { color: "#E7EAF0", fontSize: 9 },
  tabBarModern: { left: 10, right: 10, bottom: Platform.OS === "android" ? 32 : 8, height: 76, paddingTop: 7, paddingHorizontal: 5, backgroundColor: "#FAFBFC", borderWidth: 1, borderColor: "#E2E6EC", borderRadius: 24, shadowColor: "#111827", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 16 },
  tabModern: { marginHorizontal: 1, paddingTop: 1, borderRadius: 17 },
  tabTextModern: { marginTop: 3, letterSpacing: 0.1, fontSize: 9 },
  tabActive: { backgroundColor: "#FFFFFF", borderRadius: 17, shadowColor: "#111827", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 7, elevation: 3 },
  tabIndicator: { position: "absolute", bottom: 0, width: 32, height: 4, borderRadius: 2, backgroundColor: UI.primary },
  navIconShell: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", position: "relative" },
  navIconShellActive: { transform: [{ translateY: -3 }, { scale: 1.05 }], shadowColor: "#111827", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },
  navIconGlyph: { fontSize: 20, lineHeight: 23, fontWeight: "900", textAlign: "center" },
  navIconGlyphSmall: { fontSize: 12, letterSpacing: -0.5 },
  navIconCalendarTop: { position: "absolute", top: 8, left: 9, right: 9, height: 2, borderRadius: 1, opacity: 0.9 },
  leagueCardModern: { overflow: "hidden", borderRadius: 22, paddingLeft: 18, paddingVertical: 17, shadowColor: "#001A12", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 7 },
  leagueCardAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 6 },
  pageSurface: { backgroundColor: "#F5F6F8", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18 },
  selectionSummaryModern: { backgroundColor: "#18223B", borderRadius: 18, borderWidth: 1, borderColor: "#2D3853", shadowColor: "#111827", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 4 },
  teamHeaderModern: { minHeight: 50, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 11, shadowColor: "#111827", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  playerRowModern: { borderRadius: 16, borderColor: "#E4E8EE", shadowColor: "#111827", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2 },
  safe: { flex: 1, backgroundColor: "#071D17" }, header: { flexDirection: "row", alignItems: "center", padding: 16 }, logo: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#DDFB72", alignItems: "center", justifyContent: "center" }, logoHomeActive: { borderWidth: 2, borderColor: "white" }, logoText: { fontSize: 26, lineHeight: 28, fontWeight: "900", color: "#071D17", marginTop: -2 }, eyebrow: { color: "#80A399", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 }, brand: { color: "white", fontSize: 18, fontWeight: "900" }, live: { color: "#DDFB72", fontSize: 10, fontWeight: "900" }, content: { backgroundColor: "#F4F5EF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 110, minHeight: 750 }, greeting: { color: "#10251F", fontSize: 25, fontWeight: "900" }, subtitle: { color: "#718079", fontSize: 13, marginTop: 4, marginBottom: 18 }, hero: { backgroundColor: "#123C31", borderRadius: 22, padding: 20 }, heroLabel: { color: "#9BC1B6", fontSize: 10, fontWeight: "800" }, heroTitle: { color: "white", fontSize: 31, fontWeight: "900", marginTop: 10 }, vs: { color: "#DDFB72", fontSize: 18 }, heroMeta: { color: "#B7CDC6", fontSize: 12, marginTop: 6 }, primary: { backgroundColor: "#DDFB72", borderRadius: 13, padding: 14, alignItems: "center", marginTop: 16 }, primaryText: { color: "#10251F", fontWeight: "900" }, stats: { flexDirection: "row", gap: 8, marginTop: 12 }, stat: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12 }, statLabel: { color: "#87938E", fontSize: 8, fontWeight: "900" }, statValue: { color: "#10251F", fontSize: 17, fontWeight: "900", marginTop: 5 }, sectionTitle: { color: "#10251F", fontSize: 18, fontWeight: "900", marginTop: 22, marginBottom: 10 }, card: { backgroundColor: "white", borderRadius: 18, paddingHorizontal: 14 }, standing: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EDF0EA" }, position: { width: 23, color: "#819089", fontWeight: "800" }, badge: { width: 31, height: 31, borderRadius: 10, backgroundColor: "#E8F4EF", alignItems: "center", justifyContent: "center" }, badgeText: { color: "#174D3D", fontWeight: "900" }, owner: { flex: 1, marginLeft: 9, fontWeight: "800", color: "#1B3029" }, points: { color: "#51665F", fontSize: 11 }, auction: { backgroundColor: "white", borderRadius: 20, alignItems: "center", padding: 20 }, timer: { alignSelf: "flex-end", color: "#496209", fontWeight: "900" }, avatar: { width: 66, height: 66, borderRadius: 22, backgroundColor: "#174D3D", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#DDFB72", fontSize: 22, fontWeight: "900" }, auctionName: { fontSize: 20, fontWeight: "900", marginTop: 10 }, bidLabel: { color: "#87938E", fontSize: 9, fontWeight: "900", marginTop: 16 }, bid: { fontSize: 30, fontWeight: "900" }, meta: { color: "#7D8B85", fontSize: 9, marginTop: 3 }, selectionSummary: { flexDirection: "row", backgroundColor: "#123C31", borderRadius: 17, paddingVertical: 14 }, summary: { flex: 1, alignItems: "center" }, summaryLabel: { color: "#9BC1B6", fontSize: 8, fontWeight: "900" }, summaryValue: { color: "#DDFB72", fontSize: 16, fontWeight: "900", marginTop: 4 }, roles: { flexDirection: "row", gap: 7, marginTop: 9 }, roleChip: { backgroundColor: "#E4ECE7", color: "#35554B", borderRadius: 9, padding: 7, fontSize: 10, fontWeight: "800" }, helper: { color: "#7D8984", fontSize: 11, marginBottom: 10 }, otherTeamsTitle: { color: "#10251F", fontSize: 18, fontWeight: "900", marginTop: 22, marginBottom: 4 }, teamGroup: { marginBottom: 12 }, teamHeader: { flexDirection: "row", alignItems: "center", backgroundColor: "#E3ECE7", borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 7 }, teamHeaderName: { flex: 1, color: "#174D3D", fontSize: 13, fontWeight: "900" }, teamHeaderCount: { color: "#71827B", fontSize: 10, fontWeight: "700" }, playerRow: { backgroundColor: "white", borderRadius: 13, marginBottom: 8, borderWidth: 1, borderColor: "transparent" }, playerActive: { borderColor: "#9AB64B", backgroundColor: "#FBFDEF" }, playerFocused: { borderColor: "#6A3FB5", borderWidth: 2, backgroundColor: "#F8F1FF" }, playerMain: { flexDirection: "row", alignItems: "center", padding: 11 }, checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: "#B8C3BD", alignItems: "center", justifyContent: "center" }, checkboxActive: { backgroundColor: "#174D3D" }, check: { color: "white", fontWeight: "900" }, playerName: { color: "#173028", fontSize: 13, fontWeight: "800" }, price: { color: "#173028", fontSize: 12, fontWeight: "900" }, markers: { flexDirection: "row", gap: 7, paddingLeft: 44, paddingBottom: 9 }, marker: { borderWidth: 1, borderColor: "#B9C5BF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }, markerActive: { backgroundColor: "#DDFB72", borderColor: "#9BB73E" }, markerText: { color: "#253A32", fontSize: 10, fontWeight: "900" }, validation: { borderRadius: 14, padding: 14, marginTop: 12 }, invalid: { backgroundColor: "#FFF0EC" }, valid: { backgroundColor: "#EAF6E5" }, validationTitle: { fontWeight: "900", color: "#263B34" }, validationText: { color: "#5E6D67", fontSize: 11, marginTop: 3 }, submit: { backgroundColor: "#174D3D", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 11 }, disabled: { backgroundColor: "#AAB5B0" }, submitText: { color: "white", fontWeight: "900" }, success: { color: "#2F6B37", textAlign: "center", fontWeight: "800", marginTop: 10 }, tabBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 82, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#E5E9E4", flexDirection: "row", paddingTop: 9 }, tab: { flex: 1, alignItems: "center" }, cricketBallIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#BFC8C4", marginBottom: 5, position: "relative" }, cricketBallIconActive: { backgroundColor: "#C53A45" }, cricketBallIconSeam: { position: "absolute", width: 1.5, height: 17, backgroundColor: "#FFFFFF", left: 9.25, top: 1.5, transform: [{ rotate: "24deg" }], opacity: 0.8 }, cricketBallIconSeamActive: { backgroundColor: "#FFE8D9", opacity: 1 }, cricketBallIconStitch: { position: "absolute", width: 5, height: 1, backgroundColor: "#FFFFFF", left: 7.5, transform: [{ rotate: "24deg" }], opacity: 0.8 }, cricketBallIconStitchTop: { top: 6 }, cricketBallIconStitchBottom: { top: 12 }, cricketBallIconStitchActive: { backgroundColor: "#FFE8D9", opacity: 1 }, cricketBatIcon: { width: 20, height: 20, marginBottom: 5, position: "relative", transform: [{ rotate: "-38deg" }] }, cricketBatHandle: { position: "absolute", width: 4, height: 8, borderRadius: 2, backgroundColor: "#8D9A95", top: 0, left: 8 }, cricketBatHandleActive: { backgroundColor: "#174D3D" }, cricketBatBlade: { position: "absolute", width: 9, height: 14, borderRadius: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: "#C7CECA", top: 6, left: 5.5 }, cricketBatBladeActive: { backgroundColor: "#D5A558" }, tabText: { color: "#8A9691", fontSize: 10, fontWeight: "700" }, tabTextActive: { color: "#174D3D", fontWeight: "900" }
  ,playerMetrics: { minWidth: 58, alignItems: "flex-end", marginLeft: 8 },
  leaguePointValue: { color: "#6A3FB5", fontSize: 9, fontWeight: "900", marginTop: 3 },
});
