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
  firstMissingOpenPriorMatch,
  fixtureOwnerAction,
  fixtureOwnerActionLabel,
  hasSubmittedInTransferPeriod,
  isFreeTransferSubmission,
  isLineupLocked,
  isPowerRoleRestricted,
  isSuperTransferAvailable,
  lineupSubmitActionLabel,
  selectSingleMatchBooster,
} = loadTypeScriptModule("lineupWorkflowRules.ts");

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
  ["the first actual submission in a transfer period is free", () => {
    const period = { start_match_number: 1, end_match_number: 35, first_match_free: true };
    assert.equal(isFreeTransferSubmission({ period, hasPriorPeriodLineup: false, firstMissingPriorMatch: null, loading: false }), true);
    assert.equal(isFreeTransferSubmission({ period, hasPriorPeriodLineup: true, firstMissingPriorMatch: null, loading: false }), false);
    assert.equal(isFreeTransferSubmission({ period, hasPriorPeriodLineup: false, firstMissingPriorMatch: 1, loading: false }), false);
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
