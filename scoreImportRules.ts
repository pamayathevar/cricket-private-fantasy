import type {
  PlayerMatchStats,
  PointBreakdown,
  ScoringRulesDocument,
} from "./scoringRules";

export type ScoreImportRole = "BA" | "WK" | "AL" | "BO";

export type ScoreImportIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type ScoreImportSource = {
  provider: string;
  externalMatchId: string;
  sourceUrl: string;
  retrievedAt: string;
};

export type ScoreImportWicket = {
  victimPlayerId: string;
  victimRole: ScoreImportRole;
};

export type ScoreImportPlayer = {
  playerId: string;
  providerPlayerId?: string | null;
  name: string;
  team: string;
  role: ScoreImportRole;
  playingXI: boolean;
  batting?: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    dismissal: "none" | "duck" | "golden-duck" | "diamond-duck" | "retired-out" | "retired-hurt";
  };
  bowling?: {
    balls: number;
    runsConceded: number;
    maidens: number;
    dots: number;
    wickets: ScoreImportWicket[];
  };
  fielding?: {
    catches: number;
    stumpings: number;
    directRunOuts: number;
    sharedRunOuts: number;
  };
};

export type NormalizedScoreImport = {
  schemaVersion: 1;
  leagueId: string;
  fixtureId: string;
  matchNumber: number;
  ruleSetId: string;
  source: ScoreImportSource;
  expectedPlayerIds: string[];
  match: {
    homeTeam: string;
    awayTeam: string;
    winnerTeam: string;
    playerOfMatchId: string | null;
    maxBallsPerBowler: number;
    resultSummary: string;
  };
  players: ScoreImportPlayer[];
  scorecard?: unknown;
};

type CalculatorServices = {
  rules: ScoringRulesDocument;
  calculatePoints: (stats: PlayerMatchStats, rules: ScoringRulesDocument) => PointBreakdown;
  calculateDetails: (stats: PlayerMatchStats, rules: ScoringRulesDocument) => unknown;
};

export type ScoreImportStagingRow = {
  player_id: string;
  raw_stats: Record<string, unknown>;
  breakdown: Record<string, unknown>;
  batting_points: number;
  bowling_points: number;
  fielding_points: number;
  bonus_points: number;
};

export type CompiledScoreImport = {
  issues: ScoreImportIssue[];
  stagingPayload: ScoreImportStagingRow[];
  reconciliation: {
    playerCount: number;
    expectedPlayerCount: number;
    battingPoints: number;
    bowlingPoints: number;
    fieldingPoints: number;
    bonusPoints: number;
    totalPoints: number;
  };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set<ScoreImportRole>(["BA", "WK", "AL", "BO"]);

const asFiniteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const asNonNegativeInteger = (value: unknown) => asFiniteNumber(value) && Number.isInteger(value) && Number(value) >= 0;

const addIssue = (
  issues: ScoreImportIssue[],
  severity: ScoreImportIssue["severity"],
  code: string,
  path: string,
  message: string,
) => issues.push({ severity, code, path, message });

const validateUuid = (issues: ScoreImportIssue[], value: unknown, path: string) => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    addIssue(issues, "error", "invalid_uuid", path, "Expected a valid UUID.");
  }
};

const validateCount = (issues: ScoreImportIssue[], value: unknown, path: string) => {
  if (!asNonNegativeInteger(value)) {
    addIssue(issues, "error", "invalid_count", path, "Expected a non-negative integer.");
  }
};

const isSecureSourceUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export const validateScoreImport = (document: NormalizedScoreImport): ScoreImportIssue[] => {
  const issues: ScoreImportIssue[] = [];

  if (!document || typeof document !== "object") {
    return [{ severity: "error", code: "invalid_document", path: "$", message: "Score import must be an object." }];
  }

  if (document.schemaVersion !== 1) {
    addIssue(issues, "error", "unsupported_schema", "schemaVersion", "Only score import schema version 1 is supported.");
  }

  validateUuid(issues, document.leagueId, "leagueId");
  validateUuid(issues, document.fixtureId, "fixtureId");
  validateUuid(issues, document.ruleSetId, "ruleSetId");

  if (!asNonNegativeInteger(document.matchNumber) || document.matchNumber < 1) {
    addIssue(issues, "error", "invalid_match_number", "matchNumber", "Match number must be a positive integer.");
  }

  const source = document.source;
  if (!source?.provider?.trim()) addIssue(issues, "error", "missing_provider", "source.provider", "Source provider is required.");
  if (!source?.externalMatchId?.trim()) addIssue(issues, "error", "missing_external_match_id", "source.externalMatchId", "Provider match ID is required.");
  if (!source?.sourceUrl?.trim()) {
    addIssue(issues, "error", "missing_source_url", "source.sourceUrl", "Source URL is required for auditability.");
  } else if (!isSecureSourceUrl(source.sourceUrl)) {
    addIssue(issues, "error", "invalid_source_url", "source.sourceUrl", "Source URL must be a valid HTTPS URL.");
  }
  if (!source?.retrievedAt || Number.isNaN(Date.parse(source.retrievedAt))) {
    addIssue(issues, "error", "invalid_retrieved_at", "source.retrievedAt", "retrievedAt must be an ISO-compatible date/time.");
  }

  const homeTeam = document.match?.homeTeam?.trim();
  const awayTeam = document.match?.awayTeam?.trim();
  const winnerTeam = document.match?.winnerTeam?.trim();
  const maxBallsPerBowler = document.match?.maxBallsPerBowler ?? 0;
  if (!homeTeam || !awayTeam || homeTeam === awayTeam) {
    addIssue(issues, "error", "invalid_teams", "match", "Home and away teams must be present and different.");
  }
  if (!winnerTeam || (winnerTeam !== homeTeam && winnerTeam !== awayTeam)) {
    addIssue(issues, "error", "invalid_winner", "match.winnerTeam", "A completed scored match must have one of its teams as winner. Use the no-result settlement workflow for abandoned matches.");
  }
  if (!asNonNegativeInteger(document.match?.maxBallsPerBowler) || document.match.maxBallsPerBowler < 1) {
    addIssue(issues, "error", "invalid_max_balls", "match.maxBallsPerBowler", "Maximum balls per bowler must be a positive integer.");
  }
  if (!document.match?.resultSummary?.trim()) {
    addIssue(issues, "error", "missing_result_summary", "match.resultSummary", "A result summary is required.");
  }

  if (!Array.isArray(document.expectedPlayerIds) || document.expectedPlayerIds.length === 0) {
    addIssue(issues, "error", "missing_expected_players", "expectedPlayerIds", "Expected player IDs are required to prove selected-lineup completeness.");
  }
  const expectedIds = new Set<string>();
  (document.expectedPlayerIds ?? []).forEach((playerId, index) => {
    validateUuid(issues, playerId, `expectedPlayerIds[${index}]`);
    if (expectedIds.has(playerId)) {
      addIssue(issues, "error", "duplicate_expected_player", `expectedPlayerIds[${index}]`, "Expected player IDs must be unique.");
    }
    expectedIds.add(playerId);
  });

  if (!Array.isArray(document.players) || document.players.length === 0) {
    addIssue(issues, "error", "missing_players", "players", "At least one mapped player is required.");
    return issues;
  }

  const playerIds = new Set<string>();
  const dismissedPlayerIds = new Set<string>();
  const bowlerWickets: Array<{
    bowlerPlayerId: string;
    bowlerTeam: string;
    victimPlayerId: string;
    victimRole: ScoreImportRole;
    path: string;
  }> = [];
  let playingXiCount = 0;

  document.players.forEach((player, index) => {
    const path = `players[${index}]`;
    if (!player || typeof player !== "object") {
      addIssue(issues, "error", "invalid_player", path, "Each player entry must be an object.");
      return;
    }
    validateUuid(issues, player.playerId, `${path}.playerId`);
    if (playerIds.has(player.playerId)) {
      addIssue(issues, "error", "duplicate_player", `${path}.playerId`, "Each league player may appear only once in an import.");
    }
    playerIds.add(player.playerId);

    if (!player.name?.trim()) addIssue(issues, "error", "missing_player_name", `${path}.name`, "Mapped player name is required.");
    if (player.team !== homeTeam && player.team !== awayTeam) {
      addIssue(issues, "error", "player_team_mismatch", `${path}.team`, "Player team must be one of the fixture teams.");
    }
    if (!ROLES.has(player.role)) addIssue(issues, "error", "invalid_role", `${path}.role`, "Role must be BA, WK, AL, or BO.");
    if (typeof player.playingXI !== "boolean") addIssue(issues, "error", "invalid_playing_xi", `${path}.playingXI`, "playingXI must be true or false.");
    if (player.playingXI) playingXiCount += 1;

    const batting = player.batting;
    if (batting) {
      validateCount(issues, batting.runs, `${path}.batting.runs`);
      validateCount(issues, batting.balls, `${path}.batting.balls`);
      validateCount(issues, batting.fours, `${path}.batting.fours`);
      validateCount(issues, batting.sixes, `${path}.batting.sixes`);
      if (asNonNegativeInteger(batting.runs) && asNonNegativeInteger(batting.fours) && asNonNegativeInteger(batting.sixes)
        && batting.fours * 4 + batting.sixes * 6 > batting.runs) {
        addIssue(issues, "error", "impossible_boundaries", `${path}.batting`, "Boundary runs cannot exceed total runs.");
      }
      if (!new Set(["none", "duck", "golden-duck", "diamond-duck", "retired-out", "retired-hurt"]).has(batting.dismissal)) {
        addIssue(issues, "error", "invalid_dismissal", `${path}.batting.dismissal`, "Dismissal category is invalid.");
      }
      if (!player.playingXI && (batting.runs > 0 || batting.balls > 0)) {
        addIssue(issues, "error", "non_xi_batting", `${path}.batting`, "A player outside the playing XI cannot have batting figures.");
      }
    }

    const bowling = player.bowling;
    if (bowling) {
      validateCount(issues, bowling.balls, `${path}.bowling.balls`);
      validateCount(issues, bowling.runsConceded, `${path}.bowling.runsConceded`);
      validateCount(issues, bowling.maidens, `${path}.bowling.maidens`);
      validateCount(issues, bowling.dots, `${path}.bowling.dots`);
      if (asNonNegativeInteger(bowling.dots) && asNonNegativeInteger(bowling.balls) && bowling.dots > bowling.balls) {
        addIssue(issues, "error", "impossible_dot_balls", `${path}.bowling.dots`, "Dot balls cannot exceed balls bowled.");
      }
      if (asNonNegativeInteger(bowling.maidens) && asNonNegativeInteger(bowling.balls) && bowling.maidens * 6 > bowling.balls) {
        addIssue(issues, "error", "impossible_maidens", `${path}.bowling.maidens`, "Maiden overs cannot exceed completed overs.");
      }
      if (asNonNegativeInteger(bowling.balls) && bowling.balls > maxBallsPerBowler) {
        addIssue(issues, "error", "bowling_limit_exceeded", `${path}.bowling.balls`, "Balls bowled exceed the configured innings limit for one bowler.");
      }
      if (!player.playingXI && (bowling.balls > 0 || (Array.isArray(bowling.wickets) && bowling.wickets.length > 0))) {
        addIssue(issues, "error", "non_xi_bowling", `${path}.bowling`, "A player outside the playing XI cannot have bowling figures.");
      }
      if (!Array.isArray(bowling.wickets)) {
        addIssue(issues, "error", "invalid_wickets", `${path}.bowling.wickets`, "Bowler wickets must be an array of dismissed players.");
      } else {
        bowling.wickets.forEach((wicket, wicketIndex) => {
          const wicketPath = `${path}.bowling.wickets[${wicketIndex}]`;
          validateUuid(issues, wicket.victimPlayerId, `${wicketPath}.victimPlayerId`);
          if (!ROLES.has(wicket.victimRole)) addIssue(issues, "error", "invalid_victim_role", `${wicketPath}.victimRole`, "Victim role must be BA, WK, AL, or BO.");
          if (dismissedPlayerIds.has(wicket.victimPlayerId)) {
            addIssue(issues, "error", "duplicate_bowler_wicket", wicketPath, "A batter cannot be credited as a bowler wicket more than once.");
          }
          dismissedPlayerIds.add(wicket.victimPlayerId);
          bowlerWickets.push({
            bowlerPlayerId: player.playerId,
            bowlerTeam: player.team,
            victimPlayerId: wicket.victimPlayerId,
            victimRole: wicket.victimRole,
            path: wicketPath,
          });
        });
      }
    }

    const fielding = player.fielding;
    if (fielding) {
      validateCount(issues, fielding.catches, `${path}.fielding.catches`);
      validateCount(issues, fielding.stumpings, `${path}.fielding.stumpings`);
      validateCount(issues, fielding.directRunOuts, `${path}.fielding.directRunOuts`);
      validateCount(issues, fielding.sharedRunOuts, `${path}.fielding.sharedRunOuts`);
      if (!player.playingXI && [fielding.catches, fielding.stumpings, fielding.directRunOuts, fielding.sharedRunOuts].some((value) => value > 0)) {
        addIssue(issues, "error", "non_xi_fielding", `${path}.fielding`, "A player outside the playing XI cannot have fielding figures.");
      }
    }
  });

  expectedIds.forEach((playerId) => {
    if (!playerIds.has(playerId)) {
      addIssue(issues, "error", "missing_expected_player", "players", `Expected player ${playerId} is missing. Publishing would leave a selected player unresolved.`);
    }
  });

  dismissedPlayerIds.forEach((playerId) => {
    if (!playerIds.has(playerId)) {
      addIssue(issues, "error", "unresolved_wicket_victim", "players", `Bowler wicket victim ${playerId} is not present in the mapped player list.`);
    }
  });

  const playersById = new Map(document.players.map((player) => [player.playerId, player]));
  bowlerWickets.forEach((wicket) => {
    const victim = playersById.get(wicket.victimPlayerId);
    if (!victim) return;
    if (victim.playerId === wicket.bowlerPlayerId || victim.team === wicket.bowlerTeam) {
      addIssue(issues, "error", "invalid_wicket_opposition", wicket.path, "A bowler wicket must dismiss a player from the opposition team.");
    }
    if (victim.role !== wicket.victimRole) {
      addIssue(issues, "error", "wicket_victim_role_mismatch", `${wicket.path}.victimRole`, `Declared victim role ${wicket.victimRole} does not match mapped role ${victim.role}.`);
    }
    if (!victim.playingXI) {
      addIssue(issues, "error", "non_xi_wicket_victim", wicket.path, "A bowler wicket cannot dismiss a player outside the playing XI.");
    }
  });

  if (document.match.playerOfMatchId) {
    validateUuid(issues, document.match.playerOfMatchId, "match.playerOfMatchId");
    const playerOfMatch = document.players.find((player) => player.playerId === document.match.playerOfMatchId);
    if (!playerOfMatch?.playingXI) {
      addIssue(issues, "error", "unresolved_player_of_match", "match.playerOfMatchId", "Player of the match must resolve to a mapped playing-XI player.");
    }
  }

  if (playingXiCount !== 22) {
    addIssue(issues, "warning", "unexpected_playing_xi_count", "players", `Expected 22 playing-XI players for a standard match; found ${playingXiCount}. Review substitutes and mappings.`);
  }

  return issues;
};

const emptyBatting = () => ({ runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: "none" as const });
const emptyBowling = () => ({ balls: 0, runsConceded: 0, maidens: 0, dots: 0, wickets: [] as ScoreImportWicket[] });
const emptyFielding = () => ({ catches: 0, stumpings: 0, directRunOuts: 0, sharedRunOuts: 0 });

const toPlayerMatchStats = (document: NormalizedScoreImport, player: ScoreImportPlayer): PlayerMatchStats => {
  const batting = player.batting ?? emptyBatting();
  const bowling = player.bowling ?? emptyBowling();
  const fielding = player.fielding ?? emptyFielding();
  return {
    runs: batting.runs,
    balls: batting.balls,
    fours: batting.fours,
    sixes: batting.sixes,
    dismissal: batting.dismissal,
    bowlerWickets: bowling.wickets.filter((wicket) => wicket.victimRole === "BO").length,
    nonBowlerWickets: bowling.wickets.filter((wicket) => wicket.victimRole !== "BO").length,
    ballsBowled: bowling.balls,
    runsConceded: bowling.runsConceded,
    maidens: bowling.maidens,
    dots: bowling.dots,
    maxBalls: document.match.maxBallsPerBowler,
    playerIsBowler: player.role === "BO",
    catches: fielding.catches,
    stumpings: fielding.stumpings,
    runOuts: fielding.directRunOuts,
    sharedRunOuts: fielding.sharedRunOuts,
    winningXI: player.playingXI && player.team === document.match.winnerTeam,
    playerOfMatch: player.playerId === document.match.playerOfMatchId,
  };
};

export const compileScoreImport = (
  document: NormalizedScoreImport,
  services: CalculatorServices,
): CompiledScoreImport => {
  const issues = validateScoreImport(document);
  if (issues.some((issue) => issue.severity === "error")) {
    return {
      issues,
      stagingPayload: [],
      reconciliation: {
        playerCount: 0,
        expectedPlayerCount: document?.expectedPlayerIds?.length ?? 0,
        battingPoints: 0,
        bowlingPoints: 0,
        fieldingPoints: 0,
        bonusPoints: 0,
        totalPoints: 0,
      },
    };
  }

  const orderedPlayers = [...document.players].sort((left, right) => left.playerId.localeCompare(right.playerId));
  const stagingPayload = orderedPlayers.map((player, index) => {
    const stats = toPlayerMatchStats(document, player);
    const points = services.calculatePoints(stats, services.rules);
    const details = services.calculateDetails(stats, services.rules);
    const rawStats: Record<string, unknown> = {
      schema_version: document.schemaVersion,
      rule_set_id: document.ruleSetId,
      source: document.source,
      match_number: document.matchNumber,
      result_summary: document.match.resultSummary,
      player_name: player.name,
      provider_player_id: player.providerPlayerId ?? null,
      team: player.team,
      role: player.role,
      playing_xi: player.playingXI,
      normalized_stats: stats,
    };
    if (index === 0 && document.scorecard !== undefined) rawStats.scorecard = document.scorecard;

    return {
      player_id: player.playerId,
      raw_stats: rawStats,
      breakdown: {
        batting: points.batting,
        bowling: points.bowling,
        fielding: points.fielding,
        bonus: points.bonus,
        total: points.total,
        details,
      },
      batting_points: points.batting,
      bowling_points: points.bowling,
      fielding_points: points.fielding,
      bonus_points: points.bonus,
    };
  });

  const reconciliation = stagingPayload.reduce(
    (summary, row) => {
      summary.battingPoints += row.batting_points;
      summary.bowlingPoints += row.bowling_points;
      summary.fieldingPoints += row.fielding_points;
      summary.bonusPoints += row.bonus_points;
      summary.totalPoints += row.batting_points + row.bowling_points + row.fielding_points + row.bonus_points;
      return summary;
    },
    {
      playerCount: stagingPayload.length,
      expectedPlayerCount: document.expectedPlayerIds.length,
      battingPoints: 0,
      bowlingPoints: 0,
      fieldingPoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
    },
  );

  return { issues, stagingPayload, reconciliation };
};
