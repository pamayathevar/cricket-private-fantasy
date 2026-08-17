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

const blankStats = {
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  playerIsBowler: false,
  dismissal: "none",
  bowlerWickets: 0,
  nonBowlerWickets: 0,
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

const tests = [
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
    assert.equal(points.fielding, 38);
    assert.equal(points.bonus, 17);
    assert.equal(points.total, 88);
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
