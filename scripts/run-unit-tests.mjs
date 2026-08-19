import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function loadTypeScriptModule(relativePath) {
  const filename = path.resolve(relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, `Unable to transpile ${relativePath}`);

  const module = { exports: {} };
  new Function("exports", "module", result.outputText)(module.exports, module);
  return module.exports;
}

const {
  applyFantasyMarkers,
  calculatePointDetails,
  calculatePlayerPoints,
  defaultScoringRules,
} = loadTypeScriptModule("scoringRules.ts");

assert.equal(defaultScoringRules.fielding.shared_run_out, 10);

const {
  boosterForFixture,
  canViewSubmittedLineup,
  countLineupChanges,
  firstMissingOpenPriorMatch,
  fixtureOwnerAction,
  fixtureOwnerActionLabel,
  fixtureStripStatusLabel,
  hasSubmittedInTransferPeriod,
  isFreeTransferSubmission,
  isLineupLocked,
  isNoResultFixture,
  isPowerRoleRestricted,
  isSuperTransferAvailable,
  lineupSubmitActionLabel,
  selectSingleMatchBooster,
} = loadTypeScriptModule("lineupWorkflowRules.ts");

const {
  formatOversFromBalls,
  latestPublishedPlayerPoints,
  scorecardDismissalLabel,
} = loadTypeScriptModule("scorecardRules.ts");

const {
  previousNavigation,
  recordNavigation,
} = loadTypeScriptModule("navigationHistory.ts");

const {
  isMatchReminderDue,
  matchReminderTarget,
} = loadTypeScriptModule("matchReminderRules.ts");

const {
  compileScoreImport,
} = loadTypeScriptModule("scoreImportRules.ts");

const {
  extractSavedCricinfoScorecard,
  parseScoreIngestionArtifact,
} = loadTypeScriptModule("scoreIngestionArtifact.ts");

const {
  scorecardFromIngestionPreview,
} = loadTypeScriptModule("scorecardFromIngestionPreview.ts");

const {
  browserCaptureStatus,
  scoreSourceRequiresBrowserCapture,
} = loadTypeScriptModule("scoreSourceWorkflow.ts");

const {
  applyCricbuzzFielderValidation,
  isCricbuzzDismissalCapture,
  isScorecardBrowserCapture,
} = loadTypeScriptModule("scorecardBrowserExtension.ts");

const {
  buildCricinfoPasteImport,
  fieldersFromDismissal,
  isDirectBowlerWicket,
  oversToBalls,
  parseCricinfoBattingTable,
  parseCricinfoBowlingTable,
  parseCricinfoInningsTotal,
  parsePlayerNameAliases,
  resolveScorecardPlayer,
} = loadTypeScriptModule("cricinfoScorecardPaste.ts");

const blankStats = {
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  playerIsBowler: false,
  dismissal: "none",
  bowlerWickets: 0,
  nonBowlerWickets: 0,
  directWickets: 0,
  ballsBowled: 0,
  maxBalls: 24,
  runsConceded: 0,
  maidens: 0,
  dots: 0,
  catches: 0,
  stumpings: 0,
  runOuts: 0,
  sharedRunOuts: 0,
  playerOfMatch: false,
  winningXI: false,
};

const reviewArtifact = () => ({
  schemaVersion: 1,
  status: "ready-for-admin-review",
  generatedAt: "2026-08-17T10:00:00Z",
  sourceFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  leagueId: "11111111-1111-4111-8111-111111111111",
  fixtureId: "22222222-2222-4222-8222-222222222222",
  matchNumber: 11,
  ruleSetId: "33333333-3333-4333-8333-333333333333",
  source: {
    provider: "licensed-test-feed",
    externalMatchId: "match-11",
    sourceUrl: "https://provider.example/match-11",
    retrievedAt: "2026-08-17T09:55:00Z",
  },
  issues: [{ severity: "warning", code: "manual_name_mapping", message: "Mapping was reviewed." }],
  reconciliation: {
    playerCount: 2,
    expectedPlayerCount: 2,
    battingPoints: 12,
    bowlingPoints: 20,
    fieldingPoints: 4,
    bonusPoints: 5,
    totalPoints: 41,
  },
  stagingPayload: [
    {
      player_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      raw_stats: {
        player_name: "Batter One",
        team: "SRH",
        role: "BA",
        playing_xi: true,
        result_summary: "SRH won by 12 runs",
        scorecard: {
          firstInningsTeam: "SRH",
          raw: {
            firstInningsBatting: "BATTING\t\tR\tB\t4s\t6s\tSR\nBatter One\tc Bowler Two b Bowler Two\t12\t8\t2\t0\t150.00\nTOTAL\t20 Ov\t12/1",
            firstInningsBowling: "BOWLING\tO\tM\tR\tW\t0s\nBowler Two\t4.0\t0\t30\t1\t10",
            secondInningsBatting: "BATTING\t\tR\tB\t4s\t6s\tSR\nBowler Two\tnot out\t0\t0\t0\t0\t0.00\nTOTAL\t1 Ov\t0/0",
            secondInningsBowling: "BOWLING\tO\tM\tR\tW\t0s\nBatter One\t1.0\t0\t0\t0\t6",
          },
        },
        normalized_stats: { runs: 12, balls: 8, fours: 2, sixes: 0, ballsBowled: 0, runsConceded: 0, bowlerWickets: 0, nonBowlerWickets: 0, dots: 0, maidens: 0, catches: 1, stumpings: 0, runOuts: 0, sharedRunOuts: 0, playerOfMatch: true, winningXI: true },
      },
      batting_points: 12,
      bowling_points: 0,
      fielding_points: 4,
      bonus_points: 5,
      breakdown: { batting: { run_points: 12 } },
    },
    {
      player_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      raw_stats: {
        player_name: "Bowler Two",
        team: "RR",
        role: "BO",
        playing_xi: true,
        result_summary: "SRH won by 12 runs",
        normalized_stats: { runs: 0, balls: 0, fours: 0, sixes: 0, ballsBowled: 24, runsConceded: 30, bowlerWickets: 1, nonBowlerWickets: 0, dots: 10, maidens: 0, catches: 0, stumpings: 0, runOuts: 0, sharedRunOuts: 0, playerOfMatch: false, winningXI: false },
      },
      batting_points: 0,
      bowling_points: 20,
      fielding_points: 0,
      bonus_points: 0,
      breakdown: { bowling: { wicket_points: 20 } },
    },
  ],
});

const tests = [
  ["Results attaches each published royalty to the player who generated it", () => {
    const source = fs.readFileSync("SupabaseScreens.tsx", "utf8");
    assert.match(source, /row\.fixture_id === match\.id && row\.recipient_member_id === lineup\.member\?\.id/);
    assert.match(source, /ownerRoyaltyRows\.filter\(row => row\.player_id === player\.id\)/);
    assert.match(source, /ROY \+\{fmt\(playerRoyaltyTotal\)\}/);
    assert.match(source, /OWNER ROYALTY \(ROY\)/);
    assert.match(source, /Borrowed by \{row\.source\?\.display_name/);
    assert.doesNotMatch(source, /OWNER ROYALTY EARNED/);
  }],
  ["browser extension capture contract requires all four innings tables", () => {
    const capture = {
      schemaVersion: 1,
      captureMethod: "cricket-rivalries-browser-extension",
      sourceUrl: "https://www.espncricinfo.com/series/example/full-scorecard",
      capturedAt: "2026-08-18T00:00:00Z",
      match: { matchNumber: 2, homeTeam: "KKR", awayTeam: "MI" },
      tables: {
        firstInningsBatting: "BATTING\tR\tB",
        firstInningsBowling: "BOWLING\tO\tR\tW",
        secondInningsBatting: "BATTING\tR\tB",
        secondInningsBowling: "BOWLING\tO\tR\tW",
      },
    };
    assert.equal(isScorecardBrowserCapture(capture), true);
    assert.equal(isScorecardBrowserCapture({ ...capture, tables: { ...capture.tables, secondInningsBowling: null } }), false);
  }],
  ["browser extension permissions stay restricted to approved scorecard providers", () => {
    const manifest = JSON.parse(fs.readFileSync("browser-extension/manifest.json", "utf8"));
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.permissions, ["scripting"]);
    assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
    assert.equal(manifest.host_permissions.some(value => /supabase/i.test(value)), false);
    assert.equal(manifest.host_permissions.every(value => /(?:espncricinfo|cricinfo|cricbuzz)\.com/.test(value)), true);
    assert.equal(manifest.host_permissions.some(value => /cricbuzz\.com/.test(value)), true);
  }],
  ["Cricbuzz validation corrects only ambiguous fielder names", () => {
    const capture = {
      schemaVersion: 1,
      captureMethod: "cricket-rivalries-cricbuzz-fielder-validation",
      sourceUrl: "https://www.cricbuzz.com/live-cricket-scorecard/149629/mi-vs-kkr-2nd-match-indian-premier-league-2026",
      capturedAt: "2026-08-19T00:00:00Z",
      match: { matchNumber: 2, homeTeam: "MI", awayTeam: "KKR" },
      innings: [
        { innings: 1, teamCode: "KKR", batters: [{ batterName: "Finn Allen", dismissalText: "c Tilak Varma b Shardul Thakur", runs: 37 }] },
        { innings: 2, teamCode: "MI", batters: [{ batterName: "Suryakumar Yadav", dismissalText: "c Rinku Singh b Kartik Tyagi", runs: 16 }] },
      ],
    };
    assert.equal(isCricbuzzDismissalCapture(capture), true);
    const result = applyCricbuzzFielderValidation(
      ["BATTING\t\tR\tB\t4s\t6s\tSR", "Finn Allen\tc Varma b Thakur\t37\t17\t6\t2\t217.64"].join("\n"),
      ["BATTING\t\tR\tB\t4s\t6s\tSR", "Suryakumar Yadav\tc Singh b Kartik Tyagi\t16\t8\t3\t0\t200.00"].join("\n"),
      capture,
    );
    assert.match(result.firstInningsBatting, /c Tilak Varma b Thakur/);
    assert.match(result.secondInningsBatting, /c Rinku Singh b Kartik Tyagi/);
    assert.equal(result.corrections.length, 2);
    assert.equal(result.corrections[1].batterName, "Suryakumar Yadav");
  }],
  ["provider-page URLs use the guided browser capture workflow", () => {
    assert.equal(scoreSourceRequiresBrowserCapture("https://www.espncricinfo.com/series/example/full-scorecard"), true);
    assert.equal(scoreSourceRequiresBrowserCapture("https://www.cricinfo.com/series/example/full-scorecard"), true);
    assert.equal(scoreSourceRequiresBrowserCapture("https://api.authorized-provider.example/match/2.json"), false);
    assert.equal(scoreSourceRequiresBrowserCapture("not a URL"), false);
    assert.match(browserCaptureStatus("ESPNcricinfo"), /No terminal command is required/);
  }],
  ["match reminders target exactly 24 hours and 30 minutes before start", () => {
    const start = Date.parse("2026-08-16T14:00:00Z");
    assert.equal(matchReminderTarget(start, 1440), Date.parse("2026-08-15T14:00:00Z"));
    assert.equal(matchReminderTarget(start, 30), Date.parse("2026-08-16T13:30:00Z"));
  }],
  ["match reminders allow the scheduler grace window without sending early", () => {
    const scheduledStart = "2026-08-16T14:00:00Z";
    assert.equal(isMatchReminderDue({ scheduledStart, offsetMinutes: 30, now: Date.parse("2026-08-16T13:29:59Z"), status: "scheduled" }), false);
    assert.equal(isMatchReminderDue({ scheduledStart, offsetMinutes: 30, now: Date.parse("2026-08-16T13:30:00Z"), status: "scheduled" }), true);
    assert.equal(isMatchReminderDue({ scheduledStart, offsetMinutes: 30, now: Date.parse("2026-08-16T13:49:59Z"), status: "scheduled" }), true);
    assert.equal(isMatchReminderDue({ scheduledStart, offsetMinutes: 30, now: Date.parse("2026-08-16T13:50:00Z"), status: "scheduled" }), false);
  }],
  ["match reminders skip started cancelled and abandoned fixtures", () => {
    const scheduledStart = "2026-08-16T14:00:00Z";
    const now = Date.parse("2026-08-16T13:30:00Z");
    assert.equal(isMatchReminderDue({ scheduledStart, offsetMinutes: 30, now, status: "live" }), false);
    assert.equal(isMatchReminderDue({ scheduledStart, offsetMinutes: 30, now, status: "cancelled" }), false);
    assert.equal(isMatchReminderDue({ scheduledStart, offsetMinutes: 30, now, status: "abandoned" }), false);
  }],
  ["navigation records the current screen without duplicating the active destination", () => {
    assert.deepEqual(recordNavigation(["Home"], "Team", "Ranking"), ["Home", "Team"]);
    assert.deepEqual(recordNavigation(["Home"], "Team", "Team"), ["Home"]);
  }],
  ["navigation back skips unavailable screens and preserves the remaining history", () => {
    assert.deepEqual(
      previousNavigation(["Home", "Ranking", "Squads"], ["Home", "Team", "Ranking"]),
      { destination: "Ranking", history: ["Home"] },
    );
  }],
  ["navigation back reports the root when no previous screen exists", () => {
    assert.deepEqual(previousNavigation([], ["Home", "Team"]), { destination: null, history: [] });
  }],
  ["home header uses the generic identity after returning from a league", () => {
    const source = fs.readFileSync("App.tsx", "utf8");
    assert.match(source, /const headerLeague = tab === "Home" \? undefined : activeLeague;/);
    assert.match(source, /headerLeague \? headerLeague\.competition\.toUpperCase\(\) : "PRIVATE FANTASY"/);
    assert.match(source, /headerLeague\?\.name \?\? "Cricket Fantasy"/);
  }],
  ["scorecard overs preserve cricket's base-six ball notation", () => {
    assert.equal(formatOversFromBalls(0), "0.0");
    assert.equal(formatOversFromBalls(17), "2.5");
    assert.equal(formatOversFromBalls(24), "4.0");
  }],
  ["scorecards use only the latest published calculation for each player", () => {
    const rows = [
      { player_id: "p1", calculation_version: 1, published_at: "2026-08-01", total_points: 10 },
      { player_id: "p1", calculation_version: 2, published_at: "2026-08-02", total_points: 20 },
      { player_id: "p2", calculation_version: 1, published_at: null, total_points: 99 },
      { player_id: "p3", calculation_version: 1, published_at: "2026-08-01", total_points: 30 },
    ];
    const latest = latestPublishedPlayerPoints(rows);
    assert.equal(latest.length, 2);
    assert.equal(latest.find(row => row.player_id === "p1")?.total_points, 20);
    assert.equal(latest.find(row => row.player_id === "p3")?.total_points, 30);
  }],
  ["scorecards show only verified dismissal text and never infer it", () => {
    assert.equal(scorecardDismissalLabel({ dismissalText: " c Phil Salt b Jacob Duffy " }), "c Phil Salt b Jacob Duffy");
    assert.equal(scorecardDismissalLabel({ how_out: "run out (Virat Kohli)" }), "run out (Virat Kohli)");
    assert.equal(scorecardDismissalLabel({ not_out: true }), "not out");
    assert.equal(scorecardDismissalLabel({ dismissal: "" }), "");
  }],
  ["batting includes runs, boundary bonuses and the run milestone", () => {
    const points = calculatePlayerPoints({
      ...blankStats,
      runs: 50,
      balls: 40,
      fours: 4,
      sixes: 2,
    });
    // 50 runs + 4 fours + 4 for two sixes + 6 milestone + 4 strike rate.
    assert.equal(points.batting, 68);
  }],
  ["a bowler is not penalized for a batting duck", () => {
    const points = calculatePlayerPoints({
      ...blankStats,
      playerIsBowler: true,
      dismissal: "duck",
    });
    assert.equal(points.batting, 0);
  }],
  ["non-bowler duck penalties distinguish normal and golden ducks", () => {
    const duck = calculatePlayerPoints({ ...blankStats, dismissal: "duck" });
    const goldenDuck = calculatePlayerPoints({ ...blankStats, dismissal: "golden-duck" });
    const diamondDuck = calculatePlayerPoints({ ...blankStats, dismissal: "diamond-duck" });
    assert.equal(duck.batting, -2);
    assert.equal(goldenDuck.batting, -4);
    assert.equal(diamondDuck.batting, -4);
  }],
  ["retired out is treated like retired hurt", () => {
    const retiredOut = calculatePlayerPoints({ ...blankStats, dismissal: "retired-out" });
    const retiredHurt = calculatePlayerPoints({ ...blankStats, dismissal: "retired-hurt" });
    assert.equal(retiredOut.batting, retiredHurt.batting);
    assert.equal(retiredOut.batting, 0);
  }],
  ["wickets use the dismissed player's bowler/non-bowler type", () => {
    const points = calculatePlayerPoints({
      ...blankStats,
      playerIsBowler: true,
      bowlerWickets: 1,
      nonBowlerWickets: 1,
      // Keep economy scoring out of this test so it verifies wicket types only.
      ballsBowled: 0,
      runsConceded: 0,
    });
    assert.equal(points.bowling, 37);
  }],
  ["direct bowler wickets receive ten bonus points without fielder assistance", () => {
    const direct = calculatePlayerPoints({ ...blankStats, playerIsBowler: true, nonBowlerWickets: 1, directWickets: 1 });
    const assisted = calculatePlayerPoints({ ...blankStats, playerIsBowler: true, nonBowlerWickets: 1, directWickets: 0 });
    assert.equal(direct.bowling, assisted.bowling + 10);
    assert.equal(isDirectBowlerWicket("b Jacob Duffy"), true);
    assert.equal(isDirectBowlerWicket("lbw b Jacob Duffy"), true);
    assert.equal(isDirectBowlerWicket("hit wicket b Jacob Duffy"), true);
    assert.equal(isDirectBowlerWicket("c & b Jacob Duffy"), true);
    assert.equal(isDirectBowlerWicket("c Phil Salt b Jacob Duffy"), false);
    assert.equal(isDirectBowlerWicket("st Phil Salt b Jacob Duffy"), false);
  }],
  ["a wicketless bowler receives the configured half and full quota penalties", () => {
    const halfQuota = calculatePlayerPoints({
      ...blankStats,
      playerIsBowler: true,
      ballsBowled: 12,
      runsConceded: 14,
    });
    const fullQuota = calculatePlayerPoints({
      ...blankStats,
      playerIsBowler: true,
      ballsBowled: 24,
      runsConceded: 28,
    });
    // Economy is neutral at 7.0, isolating the no-wicket adjustment.
    assert.equal(halfQuota.bowling, -2);
    assert.equal(fullQuota.bowling, -4);
  }],
  ["maidens, dot balls, fielding and match bonuses are accumulated", () => {
    const points = calculatePlayerPoints({
      ...blankStats,
      bowlerWickets: 1,
      ballsBowled: 6,
      runsConceded: 7,
      maidens: 1,
      dots: 4,
      catches: 1,
      stumpings: 1,
      runOuts: 1,
      sharedRunOuts: 1,
      playerOfMatch: true,
      winningXI: true,
    });
    assert.equal(points.bowling, 33); // 15 wicket + 10 maiden + 8 dots.
    assert.equal(points.fielding, 40);
    assert.equal(points.bonus, 17);
    assert.equal(points.total, 90);
  }],
  ["point detail rows reconcile with every category and the total", () => {
    const stats = {
      ...blankStats,
      runs: 25,
      balls: 20,
      fours: 2,
      sixes: 1,
      nonBowlerWickets: 1,
      ballsBowled: 6,
      runsConceded: 7,
      dots: 2,
      catches: 1,
      winningXI: true,
    };
    const points = calculatePlayerPoints(stats);
    const details = calculatePointDetails(stats);
    const sum = (rows) => rows.reduce((total, [, value]) => total + value, 0);
    assert.equal(sum(details.batting), points.batting);
    assert.equal(sum(details.bowling), points.bowling);
    assert.equal(sum(details.fielding), points.fielding);
    assert.equal(sum(details.bonus), points.bonus);
    assert.equal(
      sum(details.batting) + sum(details.bowling) + sum(details.fielding) + sum(details.bonus),
      points.total,
    );
  }],
  ["captain and vice-captain multiply the full contribution", () => {
    const points = { batting: 40, bowling: 30, fielding: 10, bonus: 5, total: 85 };
    assert.equal(applyFantasyMarkers(points, "C"), 170);
    assert.equal(applyFantasyMarkers(points, "VC"), 127.5);
  }],
  ["BAI doubles batting only and excludes bowling, fielding and bonus", () => {
    const points = { batting: 40, bowling: 30, fielding: 10, bonus: 5, total: 85 };
    assert.equal(applyFantasyMarkers(points, "BAI"), 80);
  }],
  ["BOI doubles bowling only and excludes batting, fielding and bonus", () => {
    const points = { batting: 40, bowling: 30, fielding: 10, bonus: 5, total: 85 };
    assert.equal(applyFantasyMarkers(points, "BOI"), 60);
  }],
  ["marker multipliers remain configurable", () => {
    const points = { batting: 10, bowling: 20, fielding: 5, bonus: 5, total: 40 };
    assert.equal(applyFantasyMarkers(points, "C", 2.5), 100);
    assert.equal(applyFantasyMarkers(points, "VC", 2, 1.25), 50);
    assert.equal(applyFantasyMarkers(points, "BAI", 2, 1.5, 3), 30);
  }],
  ["default scoring rules retain the configured wicket values", () => {
    assert.equal(defaultScoringRules.bowling.dismissed_bowler_wicket, 15);
    assert.equal(defaultScoringRules.bowling.dismissed_non_bowler_wicket, 20);
    assert.equal(defaultScoringRules.bowling.direct_wicket_bonus, 10);
  }],
  ["lineups lock exactly at the configured lock time", () => {
    const lock = "2026-08-09T18:00:00.000Z";
    assert.equal(isLineupLocked(lock, Date.parse("2026-08-09T17:59:59.999Z")), false);
    assert.equal(isLineupLocked(lock, Date.parse(lock)), true);
    assert.equal(isLineupLocked(null, Date.parse(lock)), false);
  }],
  ["an earlier open scheduled match blocks a later submission", () => {
    const fixtures = [
      { id: "m1", match_number: 1, status: "scheduled", lineup_lock_at: "2026-08-09T18:00:00.000Z" },
      { id: "m2", match_number: 2, status: "scheduled", lineup_lock_at: "2026-08-10T18:00:00.000Z" },
    ];
    assert.equal(firstMissingOpenPriorMatch(fixtures, new Set(), Date.parse("2026-08-09T12:00:00.000Z")), 1);
    assert.equal(firstMissingOpenPriorMatch(fixtures, new Set(["m1"]), Date.parse("2026-08-09T12:00:00.000Z")), 2);
  }],
  ["missed locked matches are skipped by sequential submission", () => {
    const fixtures = [
      { id: "m1", match_number: 1, status: "scheduled", lineup_lock_at: "2026-08-08T18:00:00.000Z" },
      { id: "m2", match_number: 2, status: "live", lineup_lock_at: "2026-08-09T18:00:00.000Z" },
    ];
    assert.equal(firstMissingOpenPriorMatch(fixtures, new Set(), Date.parse("2026-08-09T12:00:00.000Z")), null);
  }],
  ["abandoned and cancelled fixtures are both No Result", () => {
    assert.equal(isNoResultFixture("abandoned"), true);
    assert.equal(isNoResultFixture("cancelled"), true);
    assert.equal(isNoResultFixture("completed"), false);
    assert.equal(isNoResultFixture(null), false);
  }],
  ["the first actual submission in a transfer period is free", () => {
    const period = { start_match_number: 1, end_match_number: 35, first_match_free: true };
    assert.equal(isFreeTransferSubmission({ period, hasPriorPeriodLineup: false, firstMissingPriorMatch: null, loading: false }), true);
    assert.equal(isFreeTransferSubmission({ period, hasPriorPeriodLineup: true, firstMissingPriorMatch: null, loading: false }), false);
    assert.equal(isFreeTransferSubmission({ period, hasPriorPeriodLineup: false, firstMissingPriorMatch: 1, loading: false }), false);
  }],
  ["lineup changes compare the current XI with the previous submitted XI", () => {
    const previous = new Set(["A", "B", "C", "D"]);
    assert.equal(countLineupChanges(["A", "B", "E", "F"], previous), 2);
    assert.equal(countLineupChanges(["A", "B", "C", "D"], previous), 0);
    const ownedPlayers = new Set(["E"]);
    assert.equal(countLineupChanges(["A", "B", "E", "F"], previous, player => !ownedPlayers.has(player)), 1);
  }],
  ["a locked XI after No Result is rebased against the last valid XI", () => {
    const match3 = new Set(["A", "B", "C", "D"]);
    const voidMatch4 = new Set(["A", "B", "E", "F"]);
    const lockedMatch5 = ["A", "B", "E", "G"];
    assert.equal(countLineupChanges(lockedMatch5, voidMatch4), 1);
    assert.equal(countLineupChanges(lockedMatch5, match3), 2);
    const ownedPlayers = new Set(["E"]);
    assert.equal(countLineupChanges(lockedMatch5, match3, player => !ownedPlayers.has(player)), 1);
  }],
  ["a submitted lineup is detected only inside the active transfer period", () => {
    const fixtures = [
      { id: "m35", match_number: 35, status: "completed" },
      { id: "m36", match_number: 36, status: "completed" },
    ];
    const period = { start_match_number: 36, end_match_number: 70, first_match_free: true };
    assert.equal(hasSubmittedInTransferPeriod(fixtures, new Set(["m35"]), period), false);
    assert.equal(hasSubmittedInTransferPeriod(fixtures, new Set(["m35", "m36"]), period), true);
  }],
  ["Super Transfer is hidden for a free lineup and available afterward", () => {
    const period = { start_match_number: 1, end_match_number: 35, first_match_free: true };
    assert.equal(isSuperTransferAvailable({ period, hasPriorPeriodLineup: false, firstMissingPriorMatch: null, alreadyUsed: false }), false);
    assert.equal(isSuperTransferAvailable({ period, hasPriorPeriodLineup: true, firstMissingPriorMatch: null, alreadyUsed: false }), true);
    assert.equal(isSuperTransferAvailable({ period, hasPriorPeriodLineup: true, firstMissingPriorMatch: null, alreadyUsed: true }), false);
  }],
  ["submission labels distinguish first submit, unchanged and resubmit states", () => {
    assert.equal(lineupSubmitActionLabel({ hasSavedLineup: false, unchanged: false }), "Submit XI");
    assert.equal(lineupSubmitActionLabel({ hasSavedLineup: true, unchanged: true }), "Submitted ✓");
    assert.equal(lineupSubmitActionLabel({ hasSavedLineup: true, unchanged: false }), "Resubmit XI");
  }],
  ["fixture submission badges do not depend on the active match", () => {
    const submittedFixtures = new Set(["match-3"]);
    const activeFixtureId = "match-4";
    assert.equal(fixtureStripStatusLabel({ hasSubmission: submittedFixtures.has("match-3") }), "Submitted");
    assert.equal(fixtureStripStatusLabel({ hasSubmission: submittedFixtures.has(activeFixtureId) }), "XI carried · booster empty");
  }],
  ["available fixtures offer Submit XI or Edit XI based on submission state", () => {
    const available = { availableForSelection: true, locked: false, completed: false, published: false };
    assert.equal(fixtureOwnerAction({ ...available, hasSubmission: false }), "submit");
    assert.equal(fixtureOwnerAction({ ...available, hasSubmission: true }), "edit");
    assert.equal(fixtureOwnerActionLabel({ action: "submit", published: false }), "Submit XI");
    assert.equal(fixtureOwnerActionLabel({ action: "edit", published: false }), "Edit XI");
  }],
  ["locked completed and published fixtures navigate to History", () => {
    const unavailable = { availableForSelection: false, hasSubmission: false };
    assert.equal(fixtureOwnerAction({ ...unavailable, locked: true, completed: false, published: false }), "history");
    assert.equal(fixtureOwnerAction({ ...unavailable, locked: false, completed: true, published: false }), "history");
    assert.equal(fixtureOwnerAction({ ...unavailable, locked: false, completed: false, published: true }), "history");
    assert.equal(fixtureOwnerActionLabel({ action: "history", published: false }), "View XI");
    assert.equal(fixtureOwnerActionLabel({ action: "history", published: true }), "View scores");
  }],
  ["scheduled fixtures outside the selectable seven stay closed", () => {
    const action = fixtureOwnerAction({ availableForSelection: false, locked: false, completed: false, published: false, hasSubmission: false });
    assert.equal(action, "later");
    assert.equal(fixtureOwnerActionLabel({ action, published: false }), "OPENS LATER");
  }],
  ["owners can always view their own submitted lineup", () => {
    assert.equal(canViewSubmittedLineup({ viewerMemberId: "owner", ownerMemberId: "owner", lineupLockAt: "2026-08-10T18:00:00Z", revealAfterLock: true, now: Date.parse("2026-08-09T18:00:00Z") }), true);
  }],
  ["other owners and admins cannot view a lineup before lock", () => {
    const input = { ownerMemberId: "owner", lineupLockAt: "2026-08-10T18:00:00Z", revealAfterLock: true, now: Date.parse("2026-08-09T18:00:00Z") };
    assert.equal(canViewSubmittedLineup({ ...input, viewerMemberId: "other-owner" }), false);
    assert.equal(canViewSubmittedLineup({ ...input, viewerMemberId: "league-admin" }), false);
  }],
  ["active members can view submitted lineups after lock when reveal is enabled", () => {
    assert.equal(canViewSubmittedLineup({ viewerMemberId: "other", ownerMemberId: "owner", lineupLockAt: "2026-08-09T18:00:00Z", revealAfterLock: true, now: Date.parse("2026-08-09T18:00:00Z") }), true);
    assert.equal(canViewSubmittedLineup({ viewerMemberId: "other", ownerMemberId: "owner", lineupLockAt: "2026-08-09T18:00:00Z", revealAfterLock: false, now: Date.parse("2026-08-10T18:00:00Z") }), false);
  }],
  ["selecting another booster replaces the current match booster", () => {
    assert.equal(selectSingleMatchBooster("3X", "2UP"), "2UP");
    assert.equal(selectSingleMatchBooster("2UP", "2UP"), "");
  }],
  ["boosters restore only for the same saved fixture and never carry forward", () => {
    assert.deepEqual(boosterForFixture({ isCurrentSubmission: true, savedCode: "3X", savedPlayer: "Virat Kohli" }), { code: "3X", player: "Virat Kohli" });
    assert.deepEqual(boosterForFixture({ isCurrentSubmission: false, savedCode: "3X", savedPlayer: "Virat Kohli" }), { code: "", player: "" });
  }],
  ["Unique and Auto Unique power restrictions apply only to borrowers", () => {
    assert.equal(isPowerRoleRestricted({ labels: ["UNIQUE"], playerOwner: "Pandiyan", currentOwner: "Pandiyan" }), false);
    assert.equal(isPowerRoleRestricted({ labels: ["UNIQUE"], playerOwner: "Pandiyan", currentOwner: "Jeba" }), true);
    assert.equal(isPowerRoleRestricted({ labels: ["AUTO UNIQUE"], playerOwner: "Pandiyan", currentOwner: "Jeba" }), true);
    assert.equal(isPowerRoleRestricted({ labels: ["MARQUEE"], playerOwner: "Pandiyan", currentOwner: "Jeba" }), false);
  }],
  ["score imports compile mapped facts into a reviewable staging payload", () => {
    const homeBatter = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const homeBowler = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const awayBatter = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const document = {
      schemaVersion: 1,
      leagueId: "11111111-1111-4111-8111-111111111111",
      fixtureId: "22222222-2222-4222-8222-222222222222",
      matchNumber: 11,
      ruleSetId: "33333333-3333-4333-8333-333333333333",
      source: {
        provider: "licensed-test-feed",
        externalMatchId: "match-11",
        sourceUrl: "https://provider.example/match-11",
        retrievedAt: "2026-08-14T20:00:00Z",
      },
      expectedPlayerIds: [homeBatter, homeBowler, awayBatter],
      match: {
        homeTeam: "HME",
        awayTeam: "AWY",
        winnerTeam: "HME",
        playerOfMatchId: homeBatter,
        maxBallsPerBowler: 24,
        resultSummary: "HME won by 12 runs",
      },
      players: [
        {
          playerId: homeBatter,
          name: "Home Batter",
          team: "HME",
          role: "BA",
          playingXI: true,
          batting: { runs: 25, balls: 10, fours: 1, sixes: 1, dismissal: "none" },
        },
        {
          playerId: homeBowler,
          name: "Home Bowler",
          team: "HME",
          role: "BO",
          playingXI: true,
          bowling: {
            balls: 24,
            runsConceded: 20,
            maidens: 1,
            dots: 12,
            wickets: [{ victimPlayerId: awayBatter, victimRole: "BA" }],
          },
        },
        {
          playerId: awayBatter,
          name: "Away Batter",
          team: "AWY",
          role: "BA",
          playingXI: true,
          batting: { runs: 10, balls: 12, fours: 1, sixes: 0, dismissal: "none" },
        },
      ],
    };
    const compiled = compileScoreImport(document, {
      rules: defaultScoringRules,
      calculatePoints: calculatePlayerPoints,
      calculateDetails: calculatePointDetails,
    });
    assert.equal(compiled.issues.filter(issue => issue.severity === "error").length, 0);
    assert.equal(compiled.stagingPayload.length, 3);
    assert.equal(compiled.reconciliation.playerCount, 3);
    assert.equal(compiled.reconciliation.expectedPlayerCount, 3);
    assert.ok(compiled.reconciliation.totalPoints > 0);
    const batterRow = compiled.stagingPayload.find(row => row.player_id === homeBatter);
    assert.equal(batterRow.bonus_points, defaultScoringRules.bonus.player_of_match + defaultScoringRules.bonus.winning_participant);
  }],
  ["score imports reject incomplete mappings and impossible score facts", () => {
    const playerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const missingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const compiled = compileScoreImport({
      schemaVersion: 1,
      leagueId: "11111111-1111-4111-8111-111111111111",
      fixtureId: "22222222-2222-4222-8222-222222222222",
      matchNumber: 11,
      ruleSetId: "33333333-3333-4333-8333-333333333333",
      source: {
        provider: "licensed-test-feed",
        externalMatchId: "match-11",
        sourceUrl: "http://provider.example/match-11",
        retrievedAt: "2026-08-14T20:00:00Z",
      },
      expectedPlayerIds: [playerId, missingId],
      match: {
        homeTeam: "HME",
        awayTeam: "AWY",
        winnerTeam: "HME",
        playerOfMatchId: null,
        maxBallsPerBowler: 24,
        resultSummary: "HME won",
      },
      players: [{
        playerId,
        name: "Invalid Batter",
        team: "HME",
        role: "BA",
        playingXI: true,
        batting: { runs: 4, balls: 1, fours: 2, sixes: 0, dismissal: "none" },
      }],
    }, {
      rules: defaultScoringRules,
      calculatePoints: calculatePlayerPoints,
      calculateDetails: calculatePointDetails,
    });
    const codes = compiled.issues.map(issue => issue.code);
    assert.ok(codes.includes("missing_expected_player"));
    assert.ok(codes.includes("impossible_boundaries"));
    assert.ok(codes.includes("invalid_source_url"));
    assert.equal(compiled.stagingPayload.length, 0);
  }],
  ["score imports reject non-XI fielding and inconsistent wicket mappings", () => {
    const bowlerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const victimId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const substituteId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const compiled = compileScoreImport({
      schemaVersion: 1,
      leagueId: "11111111-1111-4111-8111-111111111111",
      fixtureId: "22222222-2222-4222-8222-222222222222",
      matchNumber: 11,
      ruleSetId: "33333333-3333-4333-8333-333333333333",
      source: {
        provider: "licensed-test-feed",
        externalMatchId: "match-11",
        sourceUrl: "https://provider.example/match-11",
        retrievedAt: "2026-08-14T20:00:00Z",
      },
      expectedPlayerIds: [bowlerId, victimId, substituteId],
      match: {
        homeTeam: "HME",
        awayTeam: "AWY",
        winnerTeam: "HME",
        playerOfMatchId: null,
        maxBallsPerBowler: 24,
        resultSummary: "HME won",
      },
      players: [
        {
          playerId: bowlerId,
          name: "Home Bowler",
          team: "HME",
          role: "BO",
          playingXI: true,
          bowling: {
            balls: 6,
            runsConceded: 4,
            maidens: 0,
            dots: 3,
            wickets: [{ victimPlayerId: victimId, victimRole: "BO" }],
          },
        },
        {
          playerId: victimId,
          name: "Home Batter",
          team: "HME",
          role: "BA",
          playingXI: true,
        },
        {
          playerId: substituteId,
          name: "Away Substitute",
          team: "AWY",
          role: "WK",
          playingXI: false,
          fielding: { catches: 1, stumpings: 0, directRunOuts: 0, sharedRunOuts: 0 },
        },
      ],
    }, {
      rules: defaultScoringRules,
      calculatePoints: calculatePlayerPoints,
      calculateDetails: calculatePointDetails,
    });
    const codes = compiled.issues.map(issue => issue.code);
    assert.ok(codes.includes("non_xi_fielding"));
    assert.ok(codes.includes("invalid_wicket_opposition"));
    assert.ok(codes.includes("wicket_victim_role_mismatch"));
    assert.equal(compiled.stagingPayload.length, 0);
  }],
  ["score review artifacts validate fixture identity and reconciliation", () => {
    const parsed = parseScoreIngestionArtifact(JSON.stringify(reviewArtifact()), {
      leagueId: "11111111-1111-4111-8111-111111111111",
      fixtureId: "22222222-2222-4222-8222-222222222222",
      matchNumber: 11,
    });
    assert.equal(parsed.summary.provider, "licensed-test-feed");
    assert.equal(parsed.summary.externalMatchId, "match-11");
    assert.equal(parsed.summary.playerCount, 2);
    assert.equal(parsed.summary.expectedPlayerCount, 2);
    assert.equal(parsed.summary.warningCount, 1);
    assert.equal(parsed.summary.totalPoints, 41);
    assert.equal(parsed.preview.resultSummary, "SRH won by 12 runs");
    assert.equal(parsed.preview.players[0].name, "Batter One");
    assert.equal(parsed.preview.players[0].runs, 12);
    assert.equal(parsed.preview.firstInningsTeam, "SRH");
    assert.equal(parsed.preview.secondInningsTeam, "RR");
    assert.equal(parsed.preview.firstInningsScore, "12/1");
    assert.equal(parsed.preview.secondInningsScore, "0/0");
    assert.equal(parsed.preview.winnerTeam, "SRH");
    assert.equal(parsed.preview.playerOfMatchName, "Batter One");
    assert.equal(parsed.preview.players[0].dismissalText, "c Bowler Two b Bowler Two");
    assert.equal(parsed.preview.players[0].battingInnings, 1);
    assert.equal(parsed.preview.players[1].bowlingInnings, 1);
    assert.deepEqual(parsed.preview.players[1].wicketDetails, ["Batter One · c Bowler Two b Bowler Two"]);
    assert.equal(parsed.preview.players[1].name, "Bowler Two");
    assert.equal(parsed.preview.players[1].wickets, 1);
    assert.equal(parsed.preview.bowlingPoints, 20);

    const scorecard = scorecardFromIngestionPreview(parsed.preview, 11, parsed.summary.sourceUrl);
    assert.equal(scorecard.result, "SRH won by 12 runs");
    assert.equal(scorecard.winnerTeam, "SRH");
    assert.equal(scorecard.playerOfMatch, "Batter One");
    assert.equal(scorecard.innings.length, 2);
    assert.equal(scorecard.innings[0].team, "SRH");
    assert.equal(scorecard.innings[0].score, "12/1");
    assert.equal(scorecard.innings[0].batting[0].dismissalText, "c Bowler Two b Bowler Two");
    assert.equal(scorecard.innings[0].bowling[0].name, "Bowler Two");
    assert.equal(scorecard.innings[0].bowling[0].overs, "4.0");
    assert.equal(scorecard.innings[1].team, "RR");
    assert.equal(scorecard.innings[1].score, "0/0");

    const legacy = reviewArtifact();
    delete legacy.stagingPayload[0].raw_stats.scorecard;
    const legacyParsed = parseScoreIngestionArtifact(JSON.stringify(legacy), {
      leagueId: legacy.leagueId,
      fixtureId: legacy.fixtureId,
      matchNumber: legacy.matchNumber,
    });
    assert.equal(legacyParsed.preview.firstInningsScore, "12/1");
    assert.equal(legacyParsed.preview.secondInningsScore, "0/0");
  }],
  ["saved Cricinfo reviews can be regenerated without a local capture file", () => {
    const artifact = reviewArtifact();
    artifact.source.provider = "espncricinfo-copy-paste";
    const saved = extractSavedCricinfoScorecard(artifact);
    assert.equal(saved.sourceUrl, "https://provider.example/match-11");
    assert.equal(saved.firstInningsTeam, "SRH");
    assert.equal(saved.winnerTeam, "SRH");
    assert.equal(saved.resultSummary, "SRH won by 12 runs");
    assert.equal(saved.playerOfMatchName, "Batter One");
    assert.equal(saved.maxBallsPerBowler, 24);
    assert.match(saved.firstInningsBatting, /Batter One/);
    assert.match(saved.secondInningsBowling, /Batter One/);
  }],
  ["score review artifacts reject a different fixture", () => {
    assert.throws(() => parseScoreIngestionArtifact(JSON.stringify(reviewArtifact()), {
      leagueId: "11111111-1111-4111-8111-111111111111",
      fixtureId: "99999999-9999-4999-8999-999999999999",
      matchNumber: 12,
    }), /does not belong to Match 12/);
  }],
  ["score review artifacts reject duplicate players and mismatched totals", () => {
    const duplicate = reviewArtifact();
    duplicate.stagingPayload[1].player_id = duplicate.stagingPayload[0].player_id;
    assert.throws(() => parseScoreIngestionArtifact(JSON.stringify(duplicate), {
      leagueId: duplicate.leagueId,
      fixtureId: duplicate.fixtureId,
      matchNumber: duplicate.matchNumber,
    }), /duplicate player score rows/);

    const mismatched = reviewArtifact();
    mismatched.reconciliation.totalPoints = 42;
    assert.throws(() => parseScoreIngestionArtifact(JSON.stringify(mismatched), {
      leagueId: mismatched.leagueId,
      fixtureId: mismatched.fixtureId,
      matchNumber: mismatched.matchNumber,
    }), /category totals do not reconcile/);
  }],
  ["Cricinfo paste parser preserves cricket overs and copied batting facts", () => {
    assert.equal(oversToBalls("4.0"), 24);
    assert.equal(oversToBalls("3.5"), 23);
    assert.throws(() => oversToBalls("2.6"), /Invalid overs value/);

    const table = parseCricinfoBattingTable([
      "BATTING\t\tR\tB\t4s\t6s\tSR",
      "Travis Head\tc Salt b Duffy\t11\t9\t2\t0\t122.22",
      "Ishan Kishan\tnot out\t80\t38\t8\t5\t210.52",
      "Did not bat:\tHarshal Patel, Jaydev Unadkat",
      "TOTAL\t20 Ov\t190/5",
    ].join("\n"));
    assert.equal(table.rows.length, 2);
    assert.deepEqual(table.rows[0], {
      name: "Travis Head",
      dismissalText: "c Salt b Duffy",
      runs: 11,
      balls: 9,
      fours: 2,
      sixes: 0,
    });
    assert.deepEqual(table.didNotBat, ["Harshal Patel", "Jaydev Unadkat"]);
    assert.equal(parseCricinfoInningsTotal("BATTING\t\tR\tB\nTOTAL\t20 Ov (RR: 9.50)\t190/5"), "190/5");
    assert.equal(parseCricinfoInningsTotal("BATTING\t\tR\tB\nTOTAL\t18.4 Ov\t176 all out"), "176/10");
  }],
  ["Cricinfo paste parser accepts browser-flattened scorecard rows", () => {
    const batting = parseCricinfoBattingTable([
      "Kolkata Knight Riders (20 ovs maximum)",
      "Batting\tR\tB\tM\t4s\t6s\tSR",
      "Ajinkya Rahane (c)",
      "c Pandya b Thakur",
      "67\t40\t69\t3\t5\t167.50",
      "Finn Allen",
      "not out",
      "37\t17\t26\t6\t2\t217.64",
      "Total",
      "224/4",
      "Did not bat",
      "Sherfane Rutherford,",
      "Shardul Thakur",
    ].join("\n"));
    assert.deepEqual(batting.rows[0], {
      name: "Ajinkya Rahane",
      dismissalText: "c Pandya b Thakur",
      runs: 67,
      balls: 40,
      fours: 3,
      sixes: 5,
    });
    assert.equal(batting.rows[1].name, "Finn Allen");
    assert.deepEqual(batting.didNotBat, ["Sherfane Rutherford", "Shardul Thakur"]);

    const bowling = parseCricinfoBowlingTable([
      "Bowling\tO\tM\tR\tW\tECON\t0s\tWD\tNB",
      "Trent Boult",
      "4\t0\t38\t0\t9.50\t7\t3\t0",
      "Hardik Pandya",
      "3\t0\t39\t1\t13.00\t7\t2\t0",
    ].join("\n"));
    assert.equal(bowling[0].name, "Trent Boult");
    assert.equal(bowling[0].balls, 24);
    assert.equal(bowling[1].wickets, 1);
    assert.equal(bowling[1].dots, 7);
  }],
  ["Cricinfo paste parser requires dot-ball data for league scoring", () => {
    const rows = parseCricinfoBowlingTable([
      "BOWLING\tO\tM\tR\tW\t0s\t4s\t6s\tWD\tNB",
      "Jacob Duffy\t4.0\t0\t22\t3\t13\t2\t0\t1\t0",
    ].join("\n"));
    assert.equal(rows[0].balls, 24);
    assert.equal(rows[0].dots, 13);
    assert.throws(() => parseCricinfoBowlingTable([
      "BOWLING\tO\tM\tR\tW\tER",
      "Jacob Duffy\t4.0\t0\t22\t3\t5.50",
    ].join("\n")), /dot-ball column/);
  }],
  ["Cricinfo player aliases resolve provider name differences explicitly", () => {
    const players = [
      { playerId: "p1", name: "Mohammed Siraj", team: "GT", role: "BO" },
      { playerId: "p2", name: "Mohammad Shami", team: "GT", role: "BO" },
    ];
    const aliases = parsePlayerNameAliases("M Siraj = Mohammed Siraj");
    assert.equal(resolveScorecardPlayer("M Siraj", "GT", players, aliases).playerId, "p1");
    assert.throws(
      () => resolveScorecardPlayer("Unknown Player", "GT", players),
      /No league player matched/,
    );
  }],
  ["Cricinfo wicketkeeper shorthand resolves a unique wicketkeeper automatically", () => {
    const players = [
      { playerId: "wk", name: "Jitesh Sharma", team: "RCB", role: "WK" },
      { playerId: "bo", name: "Suyash Sharma", team: "RCB", role: "BO" },
    ];
    assert.deepEqual(fieldersFromDismissal("c †Sharma b Duffy").catches, ["†Sharma"]);
    assert.equal(resolveScorecardPlayer("†Sharma", "RCB", players).playerId, "wk");
    assert.equal(resolveScorecardPlayer("Sharma", "RCB", players).playerId, "bo");
  }],
  ["Cricinfo paste import reconciles two complete XIs before review", () => {
    const homeNames = ["Home One", "Home Two", "Home Three", "Home Four", "Home Five", "Home Six", "Home Seven", "Home Eight", "Home Nine", "Home Ten", "Home Eleven"];
    const awayNames = ["Away One", "Away Two", "Away Three", "Away Four", "Away Five", "Away Six", "Away Seven", "Away Eight", "Away Nine", "Away Ten", "Away Eleven"];
    const leaguePlayers = [
      ...homeNames.map((name, index) => ({ playerId: `h${index + 1}`, name, team: "HME", role: index > 7 ? "BO" : "BA" })),
      ...awayNames.map((name, index) => ({ playerId: `a${index + 1}`, name, team: "AWY", role: index > 7 ? "BO" : "BA" })),
    ];
    const batting = (names, bowler) => [
      "BATTING\t\tR\tB\t4s\t6s\tSR",
      `${names[0]}\tb ${bowler}\t0\t1\t0\t0\t0.00`,
      `${names[1]}\tnot out\t10\t8\t1\t0\t125.00`,
      `Did not bat:\t${names.slice(2).join(", ")}`,
      "TOTAL\t20 Ov\t10/1",
    ].join("\n");
    const bowling = bowler => [
      "BOWLING\tO\tM\tR\tW\t0s\t4s\t6s\tWD\tNB",
      `${bowler}\t1.0\t0\t10\t1\t3\t1\t0\t0\t0`,
    ].join("\n");
    const imported = buildCricinfoPasteImport({
      leagueId: "11111111-1111-4111-8111-111111111111",
      fixtureId: "22222222-2222-4222-8222-222222222222",
      matchNumber: 21,
      ruleSetId: "33333333-3333-4333-8333-333333333333",
      sourceUrl: "https://www.espncricinfo.com/series/example-123/match-987654/full-scorecard",
      homeTeam: "HME",
      awayTeam: "AWY",
      firstInningsTeam: "HME",
      winnerTeam: "AWY",
      playerOfMatchName: "Away Nine",
      resultSummary: "Away won",
      firstInningsBatting: batting(homeNames, "Away Nine"),
      firstInningsBowling: bowling("Away Nine"),
      secondInningsBatting: batting(awayNames, "Home Nine"),
      secondInningsBowling: bowling("Home Nine"),
      leaguePlayers,
    });
    assert.equal(imported.players.length, 22);
    assert.equal(imported.match.playerOfMatchId, "a9");
    assert.equal(imported.players.find(player => player.playerId === "a9")?.bowling?.wickets.length, 1);
    assert.equal(imported.players.find(player => player.playerId === "a9")?.bowling?.wickets[0]?.direct, true);
    assert.equal(imported.source.provider, "espncricinfo-copy-paste");
  }],
  ["Cricinfo paste import ignores verified substitute fielder points by default and can enable them", () => {
    const homeNames = ["Home One", "Home Two", "Home Three", "Home Four", "Home Five", "Home Six", "Home Seven", "Home Eight", "Home Nine", "Home Ten", "Home Eleven"];
    const awayNames = ["Away One", "Away Two", "Away Three", "Away Four", "Away Five", "Away Six", "Away Seven", "Away Eight", "Away Nine", "Away Ten", "Away Eleven"];
    const leaguePlayers = [
      ...homeNames.map((name, index) => ({ playerId: `h${index + 1}`, name, team: "HME", role: index > 7 ? "BO" : "BA" })),
      ...awayNames.map((name, index) => ({ playerId: `a${index + 1}`, name, team: "AWY", role: index > 7 ? "BO" : "BA" })),
      { playerId: "hi", name: "Home Impact", team: "HME", role: "BO" },
      { playerId: "ai", name: "Away Impact", team: "AWY", role: "BO" },
      { playerId: "hs", name: "Home Substitute", team: "HME", role: "BA" },
      { playerId: "as", name: "Away Substitute", team: "AWY", role: "BA" },
    ];
    const batting = (names, bowler, substitute) => [
      "BATTING\t\tR\tB\t4s\t6s\tSR",
      `${names[0]}\tc (sub) ${substitute} b ${bowler}\t0\t1\t0\t0\t0.00`,
      `${names[1]}\tnot out\t10\t8\t1\t0\t125.00`,
      `Did not bat:\t${names.slice(2).join(", ")}`,
      "TOTAL\t20 Ov\t10/1",
    ].join("\n");
    const impactBowling = name => [
      "BOWLING\tO\tM\tR\tW\t0s\t4s\t6s\tWD\tNB",
      `${name}\t1.0\t0\t10\t1\t3\t1\t0\t0\t0`,
    ].join("\n");
    const importInput = {
      leagueId: "11111111-1111-4111-8111-111111111111",
      fixtureId: "22222222-2222-4222-8222-222222222222",
      matchNumber: 21,
      ruleSetId: "33333333-3333-4333-8333-333333333333",
      sourceUrl: "https://www.espncricinfo.com/series/example-123/match-987654/full-scorecard",
      homeTeam: "HME",
      awayTeam: "AWY",
      firstInningsTeam: "HME",
      winnerTeam: "AWY",
      playerOfMatchName: "Away One",
      resultSummary: "Away won",
      firstInningsBatting: batting(homeNames, "Away Impact", "Away Substitute"),
      firstInningsBowling: impactBowling("Away Impact"),
      secondInningsBatting: batting(awayNames, "Home Impact", "Home Substitute"),
      secondInningsBowling: impactBowling("Home Impact"),
      leaguePlayers,
    };
    const ignored = buildCricinfoPasteImport(importInput);
    assert.equal(ignored.players.length, 24);
    assert.ok(ignored.players.some(player => player.playerId === "hi"));
    assert.ok(ignored.players.some(player => player.playerId === "ai"));
    assert.ok(!ignored.players.some(player => player.playerId === "hs"));
    assert.ok(!ignored.players.some(player => player.playerId === "as"));
    assert.match(ignored.players.find(player => player.playerId === "h1")?.batting?.dismissalText ?? "", /\(sub\) Away Substitute/);
    assert.equal(ignored.scorecard.substituteFielderPointsEnabled, false);
    assert.equal(ignored.scorecard.substituteFielders.length, 2);
    assert.ok(ignored.scorecard.substituteFielders.every(player => player.pointsAwarded === false));

    const credited = buildCricinfoPasteImport({ ...importInput, substituteFielderPointsEnabled: true });
    assert.equal(credited.players.length, 26);
    assert.equal(credited.players.find(player => player.playerId === "hs")?.fielding?.catches, 1);
    assert.equal(credited.players.find(player => player.playerId === "as")?.fielding?.catches, 1);
    assert.equal(credited.scorecard.substituteFielderPointsEnabled, true);
    assert.ok(credited.scorecard.substituteFielders.every(player => player.pointsAwarded === true));
  }],
  ["Cricinfo paste import scores a 13th batting or bowling participant with an admin-review warning", () => {
    const homeNames = ["Home One", "Home Two", "Home Three", "Home Four", "Home Five", "Home Six", "Home Seven", "Home Eight", "Home Nine", "Home Ten", "Home Eleven"];
    const awayNames = ["Away One", "Away Two", "Away Three", "Away Four", "Away Five", "Away Six", "Away Seven", "Away Eight", "Away Nine", "Away Ten", "Away Eleven"];
    const playerId = (prefix, index) => `${prefix}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const leaguePlayers = [
      ...homeNames.map((name, index) => ({ playerId: playerId(1, index + 1), name, team: "HME", role: index > 7 ? "BO" : "BA" })),
      ...awayNames.map((name, index) => ({ playerId: playerId(2, index + 1), name, team: "AWY", role: index > 7 ? "BO" : "BA" })),
      { playerId: playerId(3, 1), name: "Home Extra One", team: "HME", role: "BO" },
      { playerId: playerId(3, 2), name: "Home Extra Two", team: "HME", role: "BO" },
    ];
    const batting = names => [
      "BATTING\t\tR\tB\t4s\t6s\tSR",
      `${names[0]}\tnot out\t10\t8\t1\t0\t125.00`,
      `Did not bat:\t${names.slice(1).join(", ")}`,
      "TOTAL\t20 Ov\t10/0",
    ].join("\n");
    const bowling = names => [
      "BOWLING\tO\tM\tR\tW\t0s\t4s\t6s\tWD\tNB",
      ...names.map(name => `${name}\t1.0\t0\t5\t0\t3\t0\t0\t0\t0`),
    ].join("\n");
    const imported = buildCricinfoPasteImport({
      leagueId: "11111111-1111-4111-8111-111111111111",
      fixtureId: "22222222-2222-4222-8222-222222222222",
      matchNumber: 21,
      ruleSetId: "33333333-3333-4333-8333-333333333333",
      sourceUrl: "https://www.espncricinfo.com/series/example-123/match-987654/full-scorecard",
      homeTeam: "HME",
      awayTeam: "AWY",
      firstInningsTeam: "HME",
      winnerTeam: "AWY",
      playerOfMatchName: "Away One",
      resultSummary: "Away won",
      firstInningsBatting: batting(homeNames),
      firstInningsBowling: bowling(["Away Nine"]),
      secondInningsBatting: batting(awayNames),
      secondInningsBowling: bowling(["Home Extra One", "Home Extra Two"]),
      leaguePlayers,
    });
    assert.equal(imported.players.filter(player => player.team === "HME").length, 13);
    assert.equal(imported.players.find(player => player.name === "Home Extra One")?.bowling?.balls, 6);
    const compiled = compileScoreImport(imported, {
      rules: defaultScoringRules,
      calculatePoints: calculatePlayerPoints,
      calculateDetails: calculatePointDetails,
    });
    assert.equal(compiled.issues.filter(issue => issue.severity === "error").length, 0);
    const participantWarning = compiled.issues.find(issue => issue.code === "unexpected_playing_xi_count");
    assert.equal(participantWarning?.severity, "warning");
    assert.match(participantWarning?.message ?? "", /administrator-approved exception.*review notes/i);
    const substituteRow = compiled.stagingPayload.find(row => row.player_id === playerId(3, 1));
    assert.ok((substituteRow?.bowling_points ?? 0) > 0);
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

if (failures > 0) process.exitCode = 1;
else console.log(`\n${tests.length} unit tests passed.`);
