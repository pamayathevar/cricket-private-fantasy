import React, { useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Role, squadPlayers as players } from "./squadData";
import { completedMatchPoints, completedMatchStats } from "./completedMatchPoints";
import { calculatePointDetails } from "./scoringRules";
import { iplFixtures } from "./iplFixtures";
import { ipl2026Members } from "./leagueMembers";

type Tab = "Home" | "Auction" | "Team" | "Matches" | "League" | "History";
type ImpactType = "BAI" | "BOI" | "";
type LeagueId = "ipl-2026" | "world-cup-2026" | "ipl-2027";

const tabs: Tab[] = ["Home", "Team", "Matches", "League", "History"];
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
const leagueOwners = ipl2026Members.filter(member => member.status === "active" && member.role !== "viewer").map(member => member.name);
const availableLeagues: Array<{ id: LeagueId; name: string; format: string; season: string; status: "Active" | "Setup pending" }> = [
  { id: "ipl-2026", name: "IPL 2026", format: "T20 · 10 IPL teams", season: "Mar–May 2026", status: "Active" },
  { id: "world-cup-2026", name: "World Cup 2026", format: "International tournament", season: "2026 season", status: "Setup pending" },
  { id: "ipl-2027", name: "IPL 2027", format: "T20 · New season", season: "2027 season", status: "Setup pending" },
];

export default function App() {
  const carriedForwardM5 = createTestXI("Pandiyan", "M5");
  const [tab, setTab] = useState<Tab>("Home");
  const [activeLeagueId, setActiveLeagueId] = useState<LeagueId | "">("");
  const [bid, setBid] = useState(13);
  const [selected, setSelected] = useState<string[]>(() => carriedForwardM5.map(player => player.name));
  const [captain, setCaptain] = useState(() => carriedForwardM5[0]?.name ?? "");
  const [vice, setVice] = useState(() => carriedForwardM5[1]?.name ?? "");
  const [lineupSubmitted, setLineupSubmitted] = useState(false);
  const [impactPlayer, setImpactPlayer] = useState("");
  const [impactType, setImpactType] = useState<ImpactType>("");
  const activeLeague = availableLeagues.find(league => league.id === activeLeagueId);
  const selectLeague = (leagueId: LeagueId) => { setActiveLeagueId(leagueId); setTab("League"); };
  const leagueContent = tab === "Home" || !activeLeague ? <LeaguePicker activeLeagueId={activeLeagueId} onSelect={selectLeague} /> : activeLeague.id !== "ipl-2026" ? <LeagueSetupPending league={activeLeague} /> : tab === "Team" ? <TeamSelection selected={selected} setSelected={setSelected} captain={captain} setCaptain={setCaptain} vice={vice} setVice={setVice} submitted={lineupSubmitted} setSubmitted={setLineupSubmitted} impactPlayer={impactPlayer} setImpactPlayer={setImpactPlayer} impactType={impactType} setImpactType={setImpactType} /> : tab === "Matches" ? <MatchesScreen /> : tab === "History" ? <ScrollView contentContainerStyle={s.content}><LockedHistoryTestData /></ScrollView> : <ScrollView contentContainerStyle={s.content}><Dashboard tab={tab} bid={bid} setBid={setBid} openTeam={() => setTab("Team")} /></ScrollView>;
  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="light-content" />
    <View style={s.header}><View style={s.logo}><Text style={s.logoText}>CP</Text></View><View style={{ flex: 1, marginLeft: 11 }}><Text style={s.eyebrow}>{activeLeague ? "SELECTED LEAGUE" : "PRIVATE FANTASY"}</Text><Text style={s.brand}>{activeLeague?.name ?? "Cricket Fantasy"}</Text></View>{activeLeague?.status === "Active" && <Text style={s.live}>● LIVE</Text>}</View>
    {leagueContent}
    <View style={s.tabBar}>{tabs.map(item => <TouchableOpacity key={item} style={s.tab} onPress={() => setTab(item === "Home" || activeLeague ? item : "Home")}><View style={[s.tabIcon, tab === item && s.tabIconActive]} /><Text style={[s.tabText, tab === item && s.tabTextActive]}>{item}</Text></TouchableOpacity>)}</View>
  </SafeAreaView>;
}

function LeaguePicker({ activeLeagueId, onSelect }: { activeLeagueId: LeagueId | ""; onSelect: (id: LeagueId) => void }) {
  return <ScrollView contentContainerStyle={s.content}><Text style={s.greeting}>Your leagues</Text><Text style={s.subtitle}>Choose a competition to open its teams, fixtures, points and standings.</Text>{availableLeagues.map(league => <TouchableOpacity key={league.id} style={[s.leagueCard, activeLeagueId === league.id && s.leagueCardSelected]} onPress={() => onSelect(league.id)}><View style={s.leagueMark}><Text style={s.leagueMarkText}>{league.name.split(" ").map(word => word[0]).join("")}</Text></View><View style={{ flex: 1 }}><Text style={s.leagueName}>{league.name}</Text><Text style={s.leagueMeta}>{league.format} · {league.season}</Text><Text style={[s.leagueStatus, league.status === "Active" ? s.leagueStatusActive : s.leagueStatusPending]}>{league.status}</Text></View><Text style={s.leagueArrow}>›</Text></TouchableOpacity>)}</ScrollView>;
}
function LeagueSetupPending({ league }: { league: { name: string; format: string; season: string } }) {
  return <ScrollView contentContainerStyle={s.content}><View style={s.pendingLeague}><Text style={s.pendingLeagueEyebrow}>SELECTED LEAGUE</Text><Text style={s.pendingLeagueTitle}>{league.name}</Text><Text style={s.pendingLeagueMeta}>{league.format} · {league.season}</Text><Text style={s.pendingLeagueText}>This league workspace is ready to configure. Add its owners, squads, fixtures and scoring rules before team selection begins.</Text></View></ScrollView>;
}

function Dashboard({ tab, bid, setBid, openTeam }: { tab: Tab; bid: number; setBid: (n: number) => void; openTeam: () => void }) {
  const pandiyanRank = standings.findIndex(([name]) => name === "Pandiyan") + 1;
  return <>
    <Text style={s.greeting}>Good evening, Pandiyan</Text><Text style={s.subtitle}>IPL 2026 · Private league</Text>
    <View style={s.hero}><Text style={s.heroLabel}>NEXT MATCH · M6</Text><Text style={s.heroTitle}>KKR <Text style={s.vs}>vs</Text> SRH</Text><Text style={s.heroMeta}>Apr 2 · 7:30 PM · Lineup open</Text><TouchableOpacity style={s.primary} onPress={openTeam}><Text style={s.primaryText}>Set playing XI</Text></TouchableOpacity></View>
    <View style={s.stats}><Stat label="RANK" value={`#${pandiyanRank}`} detail="after Match 5" /><Stat label="BUDGET" value="₹0m" detail="auction balance" /><Stat label="TRANSFERS" value="0/105" detail="league stage" /></View>
    <View style={s.pointsReset}><Text style={s.pointsResetTitle}>Matches 1–5 calculated</Text><Text style={s.pointsResetText}>League standings use five final Cricinfo scorecards and the league's T20 scoring rules.</Text></View>
    <Text style={s.sectionTitle}>{tab === "Auction" ? "Live auction" : "League standings"}</Text>
    {tab === "Auction" ? <View style={s.auction}><Text style={s.timer}>08</Text><View style={s.avatar}><Text style={s.avatarText}>AS</Text></View><Text style={s.auctionName}>Abhishek Sharma</Text><Text style={s.meta}>ALL-ROUNDER · SRH</Text><Text style={s.bidLabel}>CURRENT BID</Text><Text style={s.bid}>₹{bid.toFixed(1)}m</Text><Text style={s.meta}>Pandiyan is leading</Text><TouchableOpacity style={s.primary} onPress={() => setBid(bid + 0.5)}><Text style={s.primaryText}>Bid ₹{(bid + 0.5).toFixed(1)}m</Text></TouchableOpacity></View> : <View style={s.card}>{standings.map(([name, pts], i) => <View key={name} style={s.standing}><Text style={s.position}>{i + 1}</Text><View style={s.badge}><Text style={s.badgeText}>{name[0]}</Text></View><Text style={s.owner}>{name}</Text><Text style={s.points}>{pts} pts</Text></View>)}</View>}
  </>;
}

function MatchesScreen() {
  const [expandedMatch, setExpandedMatch] = useState("M1");
  const [expandedPlayer, setExpandedPlayer] = useState("");
  return <ScrollView contentContainerStyle={s.content}><Text style={s.greeting}>Matches</Text><Text style={s.subtitle}>All 70 IPL fixtures · tap a match to expand or collapse</Text>{iplFixtures.map(match => {
    const expanded = expandedMatch === match.id;
    const calculated = match.status === "Calculated";
    const rankedPlayers = Object.entries(completedMatchPoints[match.id] ?? {}).sort(([nameA, pointsA], [nameB, pointsB]) => {
      const teamA = players.find(player => player.name === nameA)?.team ?? "";
      const teamB = players.find(player => player.name === nameB)?.team ?? "";
      return teamA.localeCompare(teamB) || pointsB.total - pointsA.total;
    });
    return <View key={match.id} style={s.pointsMatchCard}>
      <TouchableOpacity style={s.pointsMatchHeader} onPress={() => { setExpandedMatch(expanded ? "" : match.id); setExpandedPlayer(""); }}>
        <View style={{ flex: 1 }}><Text style={s.pointsMatchTitle}>Match {match.number} · {match.teams}</Text><Text style={s.pointsMatchMeta}>{match.date} · {match.status}</Text></View>
        <Text style={[s.pointsStatus, calculated ? s.pointsCalculated : s.pointsPending]}>{calculated ? "CALCULATED" : "UPCOMING"}</Text><Text style={s.pointsChevron}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {expanded && (calculated ? <View style={s.pointsMatchBody}>
        <View style={s.pointsColumns}><Text style={s.pointsColumnPlayer}>PLAYER</Text><Text style={s.pointsColumn}>BAT</Text><Text style={s.pointsColumn}>BOWL</Text><Text style={s.pointsColumn}>FLD</Text><Text style={s.pointsColumn}>BON</Text><Text style={s.pointsColumnTotal}>TOTAL</Text></View>
        {rankedPlayers.map(([name, points], index) => { const team = players.find(player => player.name === name)?.team ?? "—"; const previousName = index ? rankedPlayers[index - 1][0] : ""; const previousTeam = previousName ? players.find(player => player.name === previousName)?.team : ""; const playerKey = `${match.id}-${name}`; const playerExpanded = expandedPlayer === playerKey; const stats = completedMatchStats[match.id]?.[name]; const details = stats ? calculatePointDetails(stats) : null; return <View key={name}>{team !== previousTeam && <View style={s.pointsTeamHeader}><Text style={s.pointsTeamHeaderText}>{team}</Text><Text style={s.pointsTeamHeaderMeta}>Highest points first</Text></View>}<TouchableOpacity style={s.pointsPlayerRow} onPress={() => setExpandedPlayer(playerExpanded ? "" : playerKey)}><Text style={s.playerBreakChevron}>{playerExpanded ? "▲" : "▼"}</Text><View style={s.pointsPlayerIdentity}><Text style={s.pointsPlayerName}>{name}</Text><Text style={s.pointsPlayerTeam}>{team}</Text></View><Text style={s.pointsCell}>{points.batting}</Text><Text style={s.pointsCell}>{points.bowling}</Text><Text style={s.pointsCell}>{points.fielding}</Text><Text style={s.pointsCell}>{points.bonus}</Text><Text style={s.pointsCellTotal}>{points.total}</Text></TouchableOpacity>{playerExpanded && details && <View style={s.fullBreakdown}><PointDetailSection title="BATTING" rows={details.batting} total={points.batting} /><PointDetailSection title="BOWLING" rows={details.bowling} total={points.bowling} /><PointDetailSection title="FIELDING" rows={details.fielding} total={points.fielding} /><PointDetailSection title="BONUS" rows={details.bonus} total={points.bonus} /></View>}</View>; })}
      </View> : <View style={s.pointsEmpty}><Text style={s.pointsEmptyTitle}>Team selection available before lock</Text><Text style={s.pointsEmptyText}>Points will appear after this match is marked complete and its Cricinfo scorecard is processed.</Text></View>)}
    </View>;
  })}</ScrollView>;
}
function PointDetailSection({ title, rows, total }: { title: string; rows: Array<[string, number]>; total: number }) {
  const visible = rows.filter(([, value]) => value !== 0);
  return <View style={s.detailSection}><View style={s.detailHeading}><Text style={s.detailTitle}>{title}</Text><Text style={s.detailTotal}>{total}</Text></View>{visible.length ? visible.map(([label, value]) => <View key={label} style={s.detailRow}><Text style={s.detailLabel}>{label}</Text><Text style={s.detailValue}>{value > 0 ? `+${value}` : value}</Text></View>) : <Text style={s.detailEmpty}>No points</Text>}</View>;
}

function TeamSelection({ selected, setSelected, captain, setCaptain, vice, setVice, submitted, setSubmitted, impactPlayer, setImpactPlayer, impactType, setImpactType }: { selected: string[]; setSelected: (players: string[]) => void; captain: string; setCaptain: (name: string) => void; vice: string; setVice: (name: string) => void; submitted: boolean; setSubmitted: (value: boolean) => void; impactPlayer: string; setImpactPlayer: (name: string) => void; impactType: ImpactType; setImpactType: (type: ImpactType) => void }) {
  const [activeMatchId, setActiveMatchId] = useState("M6");
  const [showIssues, setShowIssues] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<string[]>(["PBKS", "GT"]);
  const fixture = upcomingMatches.find(match => match.id === activeMatchId) ?? upcomingMatches[0];
  const matchTeams = [fixture.home, fixture.away];
  const otherTeams = allTeams.filter(team => !matchTeams.includes(team));
  const chosen = players.filter(p => selected.includes(p.name));
  const total = chosen.reduce((n, p) => n + p.price, 0);
  const count = (role: Role) => chosen.filter(p => p.role === role).length;
  const teams = Array.from(new Set(chosen.map(p => p.team)));
  const maxTeam = Math.max(0, ...teams.map(team => chosen.filter(p => p.team === team).length));
  const transfers = chosen.filter(p => p.owner !== "Pandiyan").length;
  const myPlayers = chosen.filter(p => p.owner === "Pandiyan").length;
  const openPlayers = chosen.filter(p => p.owner === "Available").length;
  const otherOwnerPlayers = chosen.filter(p => p.owner !== "Pandiyan" && p.owner !== "Available").length;
  const currentMatchPlayers = chosen.filter(p => matchTeams.includes(p.team)).length;
  const impactSelectedPlayer = chosen.find(p => p.name === impactPlayer);
  const impactWarnings = [impactType === "BOI" && impactSelectedPlayer && ["BA", "WK"].includes(impactSelectedPlayer.role) && `BOI warning: ${impactSelectedPlayer.name} is a ${impactSelectedPlayer.role === "BA" ? "batter" : "wicketkeeper"}. Only bowling points will count.`, impactType === "BAI" && impactSelectedPlayer?.role === "BO" && `BAI warning: ${impactSelectedPlayer.name} is a bowler. Only batting points will count.`].filter(Boolean) as string[];
  const errors = [selected.length !== 11 && `Select exactly 11 players (${selected.length}/11)`, count("BA") < 2 && "At least 2 batters required", count("BO") < 2 && "At least 2 bowlers required", count("WK") < 1 && "At least 1 wicketkeeper required", count("AL") < 1 && "At least 1 all-rounder required", maxTeam > 7 && "Maximum 7 from one IPL team", total > 100 && `₹${(total - 100).toFixed(1)}m over budget`, !captain && "Captain required", !vice && "Vice-captain required", captain === vice && "Captain and vice-captain must differ", impactPlayer && !impactType && "Choose BAI or BOI for the Impact player", impactPlayer && (impactPlayer === captain || impactPlayer === vice) && "Impact player cannot be captain or vice-captain"].filter(Boolean) as string[];
  const toggle = (name: string) => { setSubmitted(false); if (selected.includes(name)) { setSelected(selected.filter(x => x !== name)); if (captain === name) setCaptain(""); if (vice === name) setVice(""); if (impactPlayer === name) { setImpactPlayer(""); setImpactType(""); } } else setSelected([...selected, name]); };
  const resetXI = () => { setSelected([]); setCaptain(""); setVice(""); setImpactPlayer(""); setImpactType(""); setSubmitted(false); setShowIssues(false); };
  const toggleTeam = (team: string) => setExpandedTeams(expandedTeams.includes(team) ? expandedTeams.filter(item => item !== team) : [...expandedTeams, team]);
  const renderTeam = (team: string) => {
    const teamPlayers = players.filter(player => player.team === team);
    if (!teamPlayers.length) return null;
    const expanded = expandedTeams.includes(team);
    const selectedFromTeam = selected.filter(name => teamPlayers.some(player => player.name === name)).length;
    return <View key={team} style={s.teamGroup}>
      <TouchableOpacity style={[s.teamHeader, expanded && s.teamHeaderExpanded]} onPress={() => toggleTeam(team)}><Text style={s.teamHeaderName}>{team}</Text><Text style={s.teamHeaderCount}>{selectedFromTeam ? `${selectedFromTeam} selected · ` : ""}{teamPlayers.length} players</Text><Text style={s.teamChevron}>{expanded ? "▲" : "▼"}</Text></TouchableOpacity>
      {expanded && teamPlayers.map(p => { const active = selected.includes(p.name); const ownership = p.owner === "Pandiyan" ? "Mine" : p.owner === "Available" ? "OpenPlayer" : `Owned by ${p.owner}`; return <View key={p.name} style={[s.playerRow, active && s.playerActive]}><TouchableOpacity style={s.playerMain} onPress={() => toggle(p.name)}><View style={[s.checkbox, active && s.checkboxActive]}><Text style={s.check}>{active ? "✓" : ""}</Text></View><View style={{ flex: 1, marginLeft: 10 }}><Text style={s.playerName}>{p.name}</Text><Text style={s.meta}>{p.role} · {ownership}</Text></View><Text style={s.price}>₹{p.price}m</Text></TouchableOpacity>{active && <View style={s.markers}><Marker text="C" active={captain === p.name} onPress={() => { setCaptain(p.name); setSubmitted(false); }} /><Marker text="VC" active={vice === p.name} onPress={() => { setVice(p.name); setSubmitted(false); }} /><Marker text="BAI" active={impactPlayer === p.name && impactType === "BAI"} onPress={() => { setImpactPlayer(p.name); setImpactType("BAI"); setSubmitted(false); }} /><Marker text="BOI" active={impactPlayer === p.name && impactType === "BOI"} onPress={() => { setImpactPlayer(p.name); setImpactType("BOI"); setSubmitted(false); }} /></View>}</View>; })}
    </View>;
  };
  return <View style={s.teamScreen}><ScrollView contentContainerStyle={s.teamContent}>
    <Text style={s.greeting}>Plan next 7 matches</Text><Text style={s.subtitle}>Select a fixture, prepare its XI, and submit before its own lock.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.fixtureStrip} contentContainerStyle={s.fixtureStripContent}>{upcomingMatches.map((match, index) => { const active = match.id === activeMatchId; return <TouchableOpacity key={match.id} style={[s.fixtureCard, active && s.fixtureCardActive]} onPress={() => { setActiveMatchId(match.id); setExpandedTeams([match.home, match.away]); }}><Text style={[s.fixtureNumber, active && s.fixtureTextActive]}>MATCH {match.id.replace("M", "")}</Text><Text style={[s.fixtureTeams, active && s.fixtureTextActive]}>{match.home} vs {match.away}</Text><Text style={[s.fixtureTime, active && s.fixtureTextActive]}>{match.day} · {match.time}</Text><Text style={[s.fixtureStatus, submitted && index === 0 ? s.statusSubmitted : null]}>{submitted && index === 0 ? "Submitted" : "Carried forward"}</Text></TouchableOpacity>; })}</ScrollView>
    <View style={s.selectionTitleRow}><View style={{ flex: 1 }}><Text style={s.greeting}>{submitted && activeMatchId === "M6" ? "Your submitted XI" : "Select your XI"}</Text><Text style={s.subtitle}>{fixture.home} vs {fixture.away} · Locks {fixture.day} at {fixture.time}</Text></View><TouchableOpacity style={s.resetButton} onPress={resetXI}><Text style={s.resetButtonText}>Reset XI</Text></TouchableOpacity></View>
    {submitted && <View style={s.carryForward}><Text style={s.carryForwardText}>✓ This XI will carry forward to the next match automatically.</Text></View>}
    {!submitted && activeMatchId === "M6" && selected.length === 11 && <View style={s.carryForward}><Text style={s.carryForwardText}>↳ Match 5 XI carried forward. You can alter and submit it for Match 6.</Text></View>}
    <View style={s.selectionSummary}><Summary label="PLAYERS" value={`${selected.length}/11`} bad={selected.length !== 11} /><Summary label="COST" value={`₹${total.toFixed(1)}m`} bad={total > 100} /><Summary label="TRANSFERS" value={`${transfers}/105`} bad={false} /></View>
    <View style={s.ownershipSummary}><OwnershipSummary label="MY PLAYERS" value={myPlayers} tone="mine" /><OwnershipSummary label="OPENPLAYERS" value={openPlayers} tone="open" /><OwnershipSummary label="OTHER OWNERS" value={otherOwnerPlayers} tone="other" /><OwnershipSummary label={`${fixture.home} + ${fixture.away}`} value={currentMatchPlayers} tone="match" /></View>
    <View style={s.roles}>{(["WK", "BA", "AL", "BO"] as Role[]).map(r => <Text key={r} style={s.roleChip}>{r} {count(r)}</Text>)}</View>
    <View style={s.impactHelp}><Text style={s.impactHelpTitle}>Impact: {impactPlayer ? `${impactPlayer} · ${impactType || "choose BAI/BOI"}` : "Optional"}</Text><Text style={s.impactHelpText}>BAI doubles batting points only. BOI doubles bowling points only. Fielding and other bonuses are excluded.</Text></View>
    {impactWarnings.map(warning => <View key={warning} style={s.warningCard}><Text style={s.warningText}>⚠ {warning}</Text></View>)}
    <Text style={s.selectedTitle}>Selected Players ({chosen.length}/11)</Text>
    {chosen.length ? <View style={s.selectedList}>{chosen.map((player, index) => { const marker = captain === player.name ? "C" : vice === player.name ? "VC" : impactPlayer === player.name ? impactType : ""; return <View key={player.name} style={[s.selectedListRow, marker === "C" && s.rowCaptain, marker === "VC" && s.rowVice, marker === "BAI" && s.rowBai, marker === "BOI" && s.rowBoi]}><Text style={s.selectedNumber}>{index + 1}</Text><View style={{ flex: 1 }}><Text style={s.selectedChipName}>{player.name}</Text><Text style={s.selectedChipMeta}>{player.team} · {player.role}</Text></View>{marker ? <MarkerBadge marker={marker} /> : null}<TouchableOpacity style={s.removeSelected} onPress={() => toggle(player.name)}><Text style={s.removeSelectedText}>×</Text></TouchableOpacity></View>; })}</View> : <View style={s.emptySelected}><Text style={s.emptySelectedText}>No players selected. Choose players from the team sections below.</Text></View>}
    <Text style={s.sectionTitle}>Playing teams</Text><Text style={s.helper}>{fixture.home} and {fixture.away} players are shown first for this fixture.</Text>
    {matchTeams.map(renderTeam)}
    <Text style={s.otherTeamsTitle}>Other teams in Squad</Text><Text style={s.helper}>Tap to add or remove. Other-owner players use a transfer.</Text>
    {otherTeams.map(renderTeam)}
    <View style={[s.validation, errors.length ? s.invalid : s.valid]}><Text style={s.validationTitle}>{errors.length ? `${errors.length} issue${errors.length > 1 ? "s" : ""} to fix` : "Team is valid"}</Text>{errors.map(e => <Text key={e} style={s.validationText}>• {e}</Text>)}{!errors.length && <Text style={s.validationText}>Roles, cost, transfers, captain and vice-captain are valid.</Text>}</View>
  </ScrollView>{showIssues && errors.length > 0 && <View style={s.issuePopup}><Text style={s.issuePopupTitle}>Issues to fix</Text>{errors.map(error => <Text key={error} style={s.issuePopupText}>• {error}</Text>)}</View>}<View style={s.stickyAction}><TouchableOpacity style={{ flex: 1 }} onPress={() => setShowIssues(!showIssues)}><Text style={s.stickyTitle}>{errors.length ? `${errors.length} issue${errors.length > 1 ? "s" : ""} remaining · Tap to ${showIssues ? "hide" : "view"}` : "Ready to submit"}</Text><Text style={s.stickyMeta}>{selected.length}/11 · ₹{total.toFixed(1)}m · {transfers} transfers</Text></TouchableOpacity><TouchableOpacity disabled={!!errors.length} style={[s.stickyButton, !!errors.length && s.disabled]} onPress={() => setSubmitted(true)}><Text style={s.submitText}>{submitted ? "Submitted ✓" : "Submit XI"}</Text></TouchableOpacity></View></View>;
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
function ownerMatchPoints(owner: string, matchId: string) {
  const impactMarker: ImpactType = seededScore(`${matchId}-${owner}-impact`) % 2 === 0 ? "BAI" : "BOI";
  return createTestXI(owner, matchId).reduce((sum, player, index) => sum + matchFantasyPoints(matchId, player.name, index === 0 ? "C" : index === 1 ? "VC" : index === 2 ? impactMarker : ""), 0);
}
const standings = leagueOwners.map(owner => [owner, lockedTestMatches.reduce((sum, match) => sum + ownerMatchPoints(owner, match.id), 0)] as [string, number]).sort((a, b) => b[1] - a[1]).map(([owner, points]) => [owner, Number.isInteger(points) ? String(points) : points.toFixed(1)]);
function LockedHistoryTestData() {
  const [expandedMatch, setExpandedMatch] = useState("M1");
  const [expandedOwner, setExpandedOwner] = useState("M1-Pandiyan");
  return <>
    <Text style={s.greeting}>Team history</Text><Text style={s.subtitle}>Select a locked match, then expand an owner to view their submitted XI.</Text>
    {lockedTestMatches.map((match, index) => { const matchExpanded = expandedMatch === match.id; return <View key={match.id} style={s.historyMatchCard}>
      <TouchableOpacity style={s.historyMatchHeader} onPress={() => { setExpandedMatch(matchExpanded ? "" : match.id); setExpandedOwner(matchExpanded ? "" : `${match.id}-Pandiyan`); }}><View style={{ flex: 1 }}><Text style={s.historyListTitle}>Match {index + 1} · {match.teams}</Text><Text style={s.historyListMeta}>{match.date} · Calculated</Text></View><Text style={s.historyStatus}>LOCKED</Text><Text style={s.pointsChevron}>{matchExpanded ? "▲" : "▼"}</Text></TouchableOpacity>
      {matchExpanded && <View style={s.historyOwners}>{testOwners.map(owner => ({ owner, points: ownerMatchPoints(owner, match.id) })).sort((a, b) => b.points - a.points || a.owner.localeCompare(b.owner)).map(({ owner, points: matchPoints }, ownerIndex, rankedOwners) => { const dayRank = rankedOwners.findIndex(item => item.points === matchPoints) + 1; const ownerKey = `${match.id}-${owner}`; const ownerExpanded = expandedOwner === ownerKey; const lineup = createTestXI(owner, match.id); const total = lineup.reduce((sum, player) => sum + player.price, 0); const impactMarker: ImpactType = seededScore(`${match.id}-${owner}-impact`) % 2 === 0 ? "BAI" : "BOI"; return <View key={owner} style={s.historyOwnerCard}>
        <TouchableOpacity style={s.historyOwnerHeader} onPress={() => setExpandedOwner(ownerExpanded ? "" : ownerKey)}><View style={[s.dayRank, dayRank === 1 && s.dayRankFirst]}><Text style={[s.dayRankText, dayRank === 1 && s.dayRankTextFirst]}>#{dayRank}</Text></View><View style={s.badge}><Text style={s.badgeText}>{owner[0]}</Text></View><View style={{ flex: 1, marginLeft: 9 }}><Text style={s.historyOwnerName}>{owner}</Text><Text style={s.historyOwnerMeta}>Match-day rank · 11 players · ₹{total.toFixed(1)}m</Text></View><Text style={s.historyOwnerPoints}>{matchPoints} pts</Text><Text style={s.pointsChevron}>{ownerExpanded ? "▲" : "▼"}</Text></TouchableOpacity>
        {ownerExpanded && <View style={s.historyLineup}>{lineup.map((player, playerIndex) => { const marker = playerIndex === 0 ? "C" : playerIndex === 1 ? "VC" : playerIndex === 2 ? impactMarker : ""; const playerPoints = matchFantasyPoints(match.id, player.name, marker); return <View key={player.name} style={[s.historyPlayer, marker === "C" && s.rowCaptain, marker === "VC" && s.rowVice, marker === "BAI" && s.rowBai, marker === "BOI" && s.rowBoi]}><View style={{ flex: 1 }}><Text style={s.historyPlayerName}>{playerIndex + 1}. {player.name}</Text><Text style={s.historyPlayerMeta}>{player.team} · {player.role} · {player.owner === owner ? "Mine" : player.owner === "Available" ? "OpenPlayer" : `Owned by ${player.owner}`}</Text></View><Text style={s.playerPoints}>{playerPoints} pts</Text>{marker ? <MarkerBadge marker={marker} /> : null}</View>; })}</View>}
      </View>; })}</View>}
    </View>; })}<Text style={s.testDataNote}>Test data only. C, VC and Impact players are highlighted.</Text>
  </>;
}
function HistoryScreen({ selected, captain, vice, submitted }: { selected: string[]; captain: string; vice: string; submitted: boolean }) {
  const chosen = players.filter(player => selected.includes(player.name));
  const total = chosen.reduce((sum, player) => sum + player.price, 0);
  return <><Text style={s.greeting}>Team history</Text><Text style={s.subtitle}>Submitted and locked match lineups</Text>{submitted ? <View style={s.historyCard}><View style={s.historyHeader}><View><Text style={s.historyMatch}>RCB vs SRH</Text><Text style={s.historyDate}>Match 1 · Mar 28 · 7:30 PM</Text></View><Text style={s.historyStatus}>SUBMITTED</Text></View><View style={s.historyStats}><Text style={s.historyStat}>11 players</Text><Text style={s.historyStat}>₹{total.toFixed(1)}m</Text></View>{chosen.map(player => <View key={player.name} style={s.historyPlayer}><Text style={s.historyPlayerName}>{player.name}</Text><Text style={s.historyPlayerMeta}>{player.team} · {player.role}{captain === player.name ? " · C" : vice === player.name ? " · VC" : ""}</Text></View>)}</View> : <View style={s.emptyHistory}><Text style={s.emptyHistoryTitle}>No submitted teams yet</Text><Text style={s.emptyHistoryText}>Submitted or locked match teams will appear here and remain view-only.</Text></View>}</>;
}
function Summary({ label, value, bad }: { label: string; value: string; bad: boolean }) { return <View style={s.summary}><Text style={s.summaryLabel}>{label}</Text><Text style={[s.summaryValue, bad && { color: "#FFB4A8" }]}>{value}</Text></View>; }
function OwnershipSummary({ label, value, tone }: { label: string; value: number; tone: "mine" | "open" | "other" | "match" }) { return <View style={s.ownershipItem}><View style={[s.ownershipDot, tone === "mine" ? s.dotMine : tone === "open" ? s.dotOpen : tone === "other" ? s.dotOther : s.dotMatch]} /><View><Text style={s.ownershipLabel}>{label}</Text><Text style={s.ownershipValue}>{value}</Text></View></View>; }
function Marker({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) { return <TouchableOpacity style={[s.marker, active && (text === "C" ? s.badgeCaptain : text === "VC" ? s.badgeVice : text === "BAI" ? s.badgeBai : s.badgeBoi)]} onPress={onPress}><Text style={[s.markerText, active && s.activeMarkerText]}>{text}</Text></TouchableOpacity>; }
function MarkerBadge({ marker }: { marker: string }) { return <View style={[s.markerBadge, marker === "C" ? s.badgeCaptain : marker === "VC" ? s.badgeVice : marker === "BAI" ? s.badgeBai : s.badgeBoi]}><Text style={s.markerBadgeText}>{marker}</Text></View>; }

const s = StyleSheet.create({
  leagueCard: { backgroundColor: "white", borderRadius: 17, borderWidth: 1, borderColor: "#DEE5E1", padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center" },
  leagueCardSelected: { borderColor: "#88A938", backgroundColor: "#FBFDEF" },
  leagueMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: "#174D3D", alignItems: "center", justifyContent: "center", marginRight: 12 },
  leagueMarkText: { color: "#DDFB72", fontSize: 14, fontWeight: "900" },
  leagueName: { color: "#173028", fontSize: 16, fontWeight: "900" },
  leagueMeta: { color: "#7D8B85", fontSize: 9, marginTop: 3 },
  leagueStatus: { alignSelf: "flex-start", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: "900", marginTop: 8 },
  leagueStatusActive: { color: "#285F39", backgroundColor: "#E2F1DF" },
  leagueStatusPending: { color: "#735F22", backgroundColor: "#F5EFD5" },
  leagueArrow: { color: "#809089", fontSize: 27, marginLeft: 7 },
  pendingLeague: { backgroundColor: "white", borderRadius: 20, padding: 24, alignItems: "center" },
  pendingLeagueEyebrow: { color: "#829089", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  pendingLeagueTitle: { color: "#173028", fontSize: 25, fontWeight: "900", marginTop: 8 },
  pendingLeagueMeta: { color: "#718079", fontSize: 11, marginTop: 5 },
  pendingLeagueText: { color: "#66766F", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 18 },
  teamHeaderExpanded: { backgroundColor: "#D7E7DF" },
  teamChevron: { color: "#527067", fontSize: 9, fontWeight: "900", marginLeft: 8 },
  rowCaptain: { backgroundColor: "#FFF6CF" },
  rowVice: { backgroundColor: "#EAF0FF" },
  rowBai: { backgroundColor: "#FCE8F2" },
  rowBoi: { backgroundColor: "#E4F5F3" },
  markerBadge: { minWidth: 32, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, alignItems: "center", marginRight: 7 },
  badgeCaptain: { backgroundColor: "#D8A900" },
  badgeVice: { backgroundColor: "#5578C9" },
  badgeBai: { backgroundColor: "#BE5C8B" },
  badgeBoi: { backgroundColor: "#238778" },
  markerBadgeText: { color: "white", fontSize: 9, fontWeight: "900" },
  activeMarkerText: { color: "white" },
  teamScreen: { flex: 1, backgroundColor: "#F4F5EF" },
  teamContent: { padding: 20, paddingBottom: 175 },
  stickyAction: { position: "absolute", left: 0, right: 0, bottom: 82, minHeight: 74, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#DDE4DF", paddingHorizontal: 16, paddingVertical: 11, flexDirection: "row", alignItems: "center" },
  stickyTitle: { color: "#173028", fontSize: 13, fontWeight: "900" },
  stickyMeta: { color: "#7D8B85", fontSize: 10, marginTop: 3 },
  stickyButton: { marginLeft: "auto", backgroundColor: "#174D3D", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13 },
  fixtureStrip: { marginHorizontal: -20, marginBottom: 18 },
  fixtureStripContent: { paddingHorizontal: 20, gap: 9 },
  fixtureCard: { width: 142, backgroundColor: "white", borderWidth: 1, borderColor: "#DCE4DF", borderRadius: 14, padding: 12 },
  fixtureCardActive: { backgroundColor: "#174D3D", borderColor: "#174D3D" },
  fixtureNumber: { color: "#8A9691", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  fixtureTeams: { color: "#173028", fontSize: 15, fontWeight: "900", marginTop: 7 },
  fixtureTime: { color: "#7D8B85", fontSize: 9, marginTop: 4 },
  fixtureTextActive: { color: "white" },
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
  historyMatchHeader: { flexDirection: "row", alignItems: "center", padding: 13 },
  historyListTitle: { color: "#173028", fontSize: 13, fontWeight: "900" },
  historyListMeta: { color: "#7D8B85", fontSize: 9, marginTop: 3 },
  historyOwners: { backgroundColor: "#F1F4F1", borderTopWidth: 1, borderTopColor: "#E2E8E4", padding: 8 },
  historyOwnerCard: { backgroundColor: "white", borderRadius: 11, marginBottom: 7, overflow: "hidden" },
  historyOwnerHeader: { flexDirection: "row", alignItems: "center", padding: 10 },
  dayRank: { minWidth: 31, height: 31, borderRadius: 10, backgroundColor: "#EEF1EF", alignItems: "center", justifyContent: "center", marginRight: 7 },
  dayRankFirst: { backgroundColor: "#DDFB72" },
  dayRankText: { color: "#64766F", fontSize: 9, fontWeight: "900" },
  dayRankTextFirst: { color: "#174D3D" },
  historyOwnerName: { color: "#20372F", fontSize: 11, fontWeight: "900" },
  historyOwnerMeta: { color: "#829089", fontSize: 8, marginTop: 2 },
  historyOwnerPoints: { color: "#174D3D", fontSize: 12, fontWeight: "900", marginRight: 5 },
  historyLineup: { borderTopWidth: 1, borderTopColor: "#E7EBE8", paddingHorizontal: 9 },
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
  issuePopup: { position: "absolute", left: 12, right: 12, bottom: 160, backgroundColor: "#FFF5F1", borderWidth: 1, borderColor: "#EDC9BE", borderRadius: 14, padding: 14, zIndex: 5 },
  issuePopupTitle: { color: "#6E2D21", fontSize: 13, fontWeight: "900", marginBottom: 5 },
  issuePopupText: { color: "#78483F", fontSize: 11, marginTop: 4 },
  carryForward: { backgroundColor: "#EAF6E5", borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  carryForwardText: { color: "#35643B", fontSize: 11, fontWeight: "800" },
  ownershipSummary: { flexDirection: "row", gap: 7, marginTop: 8, marginBottom: 2 },
  ownershipItem: { flex: 1, backgroundColor: "white", borderRadius: 11, paddingHorizontal: 9, paddingVertical: 9, flexDirection: "row", alignItems: "center" },
  ownershipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  dotMine: { backgroundColor: "#2B775F" },
  dotOpen: { backgroundColor: "#C79D25" },
  dotOther: { backgroundColor: "#A35C72" },
  dotMatch: { backgroundColor: "#426FC0" },
  impactHelp: { backgroundColor: "#EEF1FA", borderRadius: 11, padding: 11, marginTop: 10 },
  impactHelpTitle: { color: "#354C7A", fontSize: 11, fontWeight: "900" },
  impactHelpText: { color: "#65728C", fontSize: 9, lineHeight: 13, marginTop: 3 },
  warningCard: { backgroundColor: "#FFF4D8", borderWidth: 1, borderColor: "#E6C86A", borderRadius: 10, padding: 10, marginTop: 7 },
  warningText: { color: "#765D16", fontSize: 10, fontWeight: "800" },
  selectionTitleRow: { flexDirection: "row", alignItems: "flex-start" },
  resetButton: { borderWidth: 1, borderColor: "#B9C5BF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginLeft: 8 },
  resetButtonText: { color: "#6A423A", fontSize: 10, fontWeight: "900" },
  selectedTitle: { color: "#173028", fontSize: 14, fontWeight: "900", marginTop: 16, marginBottom: 7 },
  selectedStrip: { marginHorizontal: -20 },
  selectedStripContent: { paddingHorizontal: 20, gap: 8 },
  selectedList: { backgroundColor: "white", borderRadius: 12, paddingHorizontal: 10 },
  selectedListRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#EDF0EE" },
  selectedNumber: { width: 25, color: "#829089", fontSize: 10, fontWeight: "900" },
  selectedChip: { minWidth: 150, backgroundColor: "#EAF2EE", borderRadius: 11, paddingLeft: 10, paddingVertical: 9, paddingRight: 6, flexDirection: "row", alignItems: "center" },
  selectedChipName: { color: "#1E3B31", fontSize: 10, fontWeight: "900" },
  selectedChipMeta: { color: "#74857E", fontSize: 8, marginTop: 2 },
  removeSelected: { width: 25, height: 25, borderRadius: 8, backgroundColor: "white", alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  removeSelectedText: { color: "#7D4E45", fontSize: 18, lineHeight: 19, fontWeight: "700" },
  emptySelected: { backgroundColor: "#EDF1EF", borderRadius: 10, padding: 11 },
  emptySelectedText: { color: "#77857F", fontSize: 10 },
  ownershipLabel: { color: "#87938E", fontSize: 7, fontWeight: "900" },
  ownershipValue: { color: "#173028", fontSize: 15, fontWeight: "900", marginTop: 2 },
  pointsReset: { backgroundColor: "#E8F2ED", borderRadius: 14, padding: 13, marginTop: 12 },
  pointsResetTitle: { color: "#174D3D", fontSize: 12, fontWeight: "900" },
  pointsResetText: { color: "#587068", fontSize: 10, lineHeight: 15, marginTop: 3 },
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
  safe: { flex: 1, backgroundColor: "#071D17" }, header: { flexDirection: "row", alignItems: "center", padding: 16 }, logo: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#DDFB72", alignItems: "center", justifyContent: "center" }, logoText: { fontWeight: "900", color: "#071D17" }, eyebrow: { color: "#80A399", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 }, brand: { color: "white", fontSize: 18, fontWeight: "900" }, live: { color: "#DDFB72", fontSize: 10, fontWeight: "900" }, content: { backgroundColor: "#F4F5EF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 110, minHeight: 750 }, greeting: { color: "#10251F", fontSize: 25, fontWeight: "900" }, subtitle: { color: "#718079", fontSize: 13, marginTop: 4, marginBottom: 18 }, hero: { backgroundColor: "#123C31", borderRadius: 22, padding: 20 }, heroLabel: { color: "#9BC1B6", fontSize: 10, fontWeight: "800" }, heroTitle: { color: "white", fontSize: 31, fontWeight: "900", marginTop: 10 }, vs: { color: "#DDFB72", fontSize: 18 }, heroMeta: { color: "#B7CDC6", fontSize: 12, marginTop: 6 }, primary: { backgroundColor: "#DDFB72", borderRadius: 13, padding: 14, alignItems: "center", marginTop: 16 }, primaryText: { color: "#10251F", fontWeight: "900" }, stats: { flexDirection: "row", gap: 8, marginTop: 12 }, stat: { flex: 1, backgroundColor: "white", borderRadius: 14, padding: 12 }, statLabel: { color: "#87938E", fontSize: 8, fontWeight: "900" }, statValue: { color: "#10251F", fontSize: 17, fontWeight: "900", marginTop: 5 }, sectionTitle: { color: "#10251F", fontSize: 18, fontWeight: "900", marginTop: 22, marginBottom: 10 }, card: { backgroundColor: "white", borderRadius: 18, paddingHorizontal: 14 }, standing: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EDF0EA" }, position: { width: 23, color: "#819089", fontWeight: "800" }, badge: { width: 31, height: 31, borderRadius: 10, backgroundColor: "#E8F4EF", alignItems: "center", justifyContent: "center" }, badgeText: { color: "#174D3D", fontWeight: "900" }, owner: { flex: 1, marginLeft: 9, fontWeight: "800", color: "#1B3029" }, points: { color: "#51665F", fontSize: 11 }, auction: { backgroundColor: "white", borderRadius: 20, alignItems: "center", padding: 20 }, timer: { alignSelf: "flex-end", color: "#496209", fontWeight: "900" }, avatar: { width: 66, height: 66, borderRadius: 22, backgroundColor: "#174D3D", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#DDFB72", fontSize: 22, fontWeight: "900" }, auctionName: { fontSize: 20, fontWeight: "900", marginTop: 10 }, bidLabel: { color: "#87938E", fontSize: 9, fontWeight: "900", marginTop: 16 }, bid: { fontSize: 30, fontWeight: "900" }, meta: { color: "#7D8B85", fontSize: 9, marginTop: 3 }, selectionSummary: { flexDirection: "row", backgroundColor: "#123C31", borderRadius: 17, paddingVertical: 14 }, summary: { flex: 1, alignItems: "center" }, summaryLabel: { color: "#9BC1B6", fontSize: 8, fontWeight: "900" }, summaryValue: { color: "#DDFB72", fontSize: 16, fontWeight: "900", marginTop: 4 }, roles: { flexDirection: "row", gap: 7, marginTop: 9 }, roleChip: { backgroundColor: "#E4ECE7", color: "#35554B", borderRadius: 9, padding: 7, fontSize: 10, fontWeight: "800" }, helper: { color: "#7D8984", fontSize: 11, marginBottom: 10 }, otherTeamsTitle: { color: "#10251F", fontSize: 18, fontWeight: "900", marginTop: 22, marginBottom: 4 }, teamGroup: { marginBottom: 12 }, teamHeader: { flexDirection: "row", alignItems: "center", backgroundColor: "#E3ECE7", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 7 }, teamHeaderName: { flex: 1, color: "#174D3D", fontSize: 13, fontWeight: "900" }, teamHeaderCount: { color: "#71827B", fontSize: 10, fontWeight: "700" }, playerRow: { backgroundColor: "white", borderRadius: 13, marginBottom: 8, borderWidth: 1, borderColor: "transparent" }, playerActive: { borderColor: "#9AB64B", backgroundColor: "#FBFDEF" }, playerMain: { flexDirection: "row", alignItems: "center", padding: 11 }, checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: "#B8C3BD", alignItems: "center", justifyContent: "center" }, checkboxActive: { backgroundColor: "#174D3D" }, check: { color: "white", fontWeight: "900" }, playerName: { color: "#173028", fontSize: 13, fontWeight: "800" }, price: { color: "#173028", fontSize: 12, fontWeight: "900" }, markers: { flexDirection: "row", gap: 7, paddingLeft: 44, paddingBottom: 9 }, marker: { borderWidth: 1, borderColor: "#B9C5BF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }, markerActive: { backgroundColor: "#DDFB72", borderColor: "#9BB73E" }, markerText: { color: "#253A32", fontSize: 10, fontWeight: "900" }, validation: { borderRadius: 14, padding: 14, marginTop: 12 }, invalid: { backgroundColor: "#FFF0EC" }, valid: { backgroundColor: "#EAF6E5" }, validationTitle: { fontWeight: "900", color: "#263B34" }, validationText: { color: "#5E6D67", fontSize: 11, marginTop: 3 }, submit: { backgroundColor: "#174D3D", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 11 }, disabled: { backgroundColor: "#AAB5B0" }, submitText: { color: "white", fontWeight: "900" }, success: { color: "#2F6B37", textAlign: "center", fontWeight: "800", marginTop: 10 }, tabBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 82, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#E5E9E4", flexDirection: "row", paddingTop: 11 }, tab: { flex: 1, alignItems: "center" }, tabIcon: { width: 18, height: 18, borderRadius: 6, backgroundColor: "#C6CFCA", marginBottom: 5 }, tabIconActive: { backgroundColor: "#174D3D" }, tabText: { color: "#8A9691", fontSize: 10, fontWeight: "700" }, tabTextActive: { color: "#174D3D", fontWeight: "900" }
});
