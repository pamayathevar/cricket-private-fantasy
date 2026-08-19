export type ScoreIngestionFixtureIdentity = {
  leagueId: string;
  fixtureId: string;
  matchNumber: number;
  homeTeam?: string;
  awayTeam?: string;
};

export type ScoreIngestionArtifactSummary = {
  provider: string;
  externalMatchId: string;
  sourceUrl: string;
  sourceFingerprint: string;
  ruleSetId: string;
  playerCount: number;
  expectedPlayerCount: number;
  warningCount: number;
  totalPoints: number;
};

export type ScoreIngestionPlayerPreview = {
  playerId: string;
  name: string;
  team: string;
  role: string;
  playingXI: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  dots: number;
  maidens: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  directRunOuts: number;
  sharedRunOuts: number;
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  bonusPoints: number;
  totalPoints: number;
  playerOfMatch: boolean;
  winningXI: boolean;
  battingInnings: 1 | 2;
  bowlingInnings: 1 | 2;
  battingOrder: number;
  bowlingOrder: number;
  dismissalText: string;
  wicketDetails: string[];
};

export type ScoreIngestionArtifactPreview = {
  resultSummary: string;
  firstInningsTeam: string;
  secondInningsTeam: string;
  firstInningsScore: string;
  secondInningsScore: string;
  winnerTeam: string;
  playerOfMatchName: string;
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  bonusPoints: number;
  totalPoints: number;
  players: ScoreIngestionPlayerPreview[];
};

export type ParsedScoreIngestionArtifact = {
  artifact: Record<string, unknown>;
  summary: ScoreIngestionArtifactSummary;
  preview: ScoreIngestionArtifactPreview;
};

export type SavedCricinfoScorecard = {
  sourceUrl: string;
  firstInningsTeam: string;
  winnerTeam: string;
  resultSummary: string;
  playerOfMatchName: string;
  maxBallsPerBowler: number;
  aliases: string;
  firstInningsBatting: string;
  firstInningsBowling: string;
  secondInningsBatting: string;
  secondInningsBowling: string;
  fielderValidation?: {
    provider: "cricbuzz";
    sourceUrl: string;
    corrections: Array<{
      innings: 1 | 2;
      batterName: string;
      originalDismissal: string;
      validatedDismissal: string;
    }>;
  };
};

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SCORECARD_TEAM_SLUGS: Record<string, string[]> = {
  CSK: ["csk", "chennai-super-kings"],
  DC: ["dc", "delhi-capitals"],
  GT: ["gt", "gujarat-titans"],
  KKR: ["kkr", "kolkata-knight-riders"],
  LSG: ["lsg", "lucknow-super-giants"],
  MI: ["mi", "mumbai-indians"],
  PBKS: ["pbks", "punjab-kings"],
  RCB: ["rcb", "royal-challengers-bengaluru", "royal-challengers-bangalore"],
  RR: ["rr", "rajasthan-royals"],
  SRH: ["srh", "sunrisers-hyderabad"],
};

const SCORECARD_IDENTITY_HOSTS = /(^|\.)(?:cricinfo\.com|espncricinfo\.com|cricbuzz\.com)$/i;

const scorecardPathHasTeam = (path: string, team: string) => {
  const normalized = team.trim().toLocaleUpperCase();
  const aliases = SCORECARD_TEAM_SLUGS[normalized] ?? [normalized.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")];
  return aliases.some(alias => new RegExp(`(?:^|[-_/])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[-_/]|$)`, "i").test(path));
};

export const assertScoreSourceMatchesFixture = (
  sourceUrl: string,
  externalMatchId: string,
  expected: ScoreIngestionFixtureIdentity,
) => {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("Source URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:") throw new Error("Source URL must be a valid HTTPS URL.");
  if (!SCORECARD_IDENTITY_HOSTS.test(url.hostname)) return;

  const mismatch = (): never => {
    const teams = expected.homeTeam && expected.awayTeam ? ` (${expected.homeTeam} vs ${expected.awayTeam})` : "";
    throw new Error(`Scorecard URL does not match Match ${expected.matchNumber}${teams}. Select the correct fixture scorecard before staging.`);
  };
  const path = decodeURIComponent(url.pathname).toLocaleLowerCase();
  const sourceMatch = path.match(/(?:^|[-_/])(\d+)(?:st|nd|rd|th)-match(?:[-_/]|$)/i);
  if (!sourceMatch || Number(sourceMatch[1]) !== expected.matchNumber) mismatch();
  if (!path.includes(externalMatchId.trim().toLocaleLowerCase())) mismatch();
  if (expected.homeTeam && !scorecardPathHasTeam(path, expected.homeTeam)) mismatch();
  if (expected.awayTeam && !scorecardPathHasTeam(path, expected.awayTeam)) mismatch();
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const number = (value: unknown, label: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
};

const integer = (value: unknown, label: string) => {
  const parsed = number(value, label);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative whole number.`);
  return parsed;
};

const text = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
};

const optionalText = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const optionalNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const optionalBoolean = (value: unknown) => value === true;

type CapturedScorecardRow = { name: string; detail: string; order: number };

const scorecardNameKey = (value: string) => value
  .normalize("NFKD")
  .replace(/[†*‡]/g, "")
  .replace(/\((?:c|capt|wk|wicketkeeper)\)/gi, "")
  .replace(/[^a-zA-Z0-9]+/g, " ")
  .trim()
  .toLocaleLowerCase();

const capturedTableLines = (value: unknown) => typeof value === "string"
  ? value.replace(/\r/g, "").split("\n").map(line => {
      const cells = line.split("\t").map(cell => cell.trim());
      return cells.length > 1 ? cells : line.trim().split(/\s{2,}/).map(cell => cell.trim());
    }).filter(cells => cells.some(Boolean))
  : [];

const capturedBattingRows = (value: unknown): CapturedScorecardRow[] => {
  const lines = capturedTableLines(value);
  const headerIndex = lines.findIndex(cells => cells.some(cell => /^(batting|batter)$/i.test(cell)) && cells.some(cell => /^r(?:uns)?$/i.test(cell)));
  if (headerIndex < 0) return [];
  const headers = lines[headerIndex].map(cell => cell.toLocaleUpperCase().replace(/[^A-Z0-9]/g, ""));
  const nameIndex = Math.max(0, headers.findIndex(cell => cell === "BATTING" || cell === "BATTER"));
  const runsIndex = headers.findIndex(cell => cell === "R" || cell === "RUNS");
  const rows: CapturedScorecardRow[] = [];
  for (const cells of lines.slice(headerIndex + 1)) {
    const name = String(cells[nameIndex] ?? "").replace(/[†*‡]/g, "").replace(/\((?:c|capt|wk|wicketkeeper)\)/gi, "").trim();
    if (!name) continue;
    if (/^did not bat/i.test(name)) {
      const names = cells.join(" ").replace(/^did not bat:?/i, "").split(/,|•/).map(item => item.trim()).filter(Boolean);
      names.forEach(item => rows.push({ name: item, detail: "did not bat", order: rows.length }));
      continue;
    }
    if (/^(extras|total|fall of wickets|bowling|bowler|powerplay)/i.test(name)) break;
    if (runsIndex < 0 || !/^\d[\d,]*$/.test(String(cells[runsIndex] ?? "").trim())) continue;
    rows.push({ name, detail: cells.slice(nameIndex + 1, runsIndex).filter(Boolean).join(" ").trim() || "not out", order: rows.length });
  }
  return rows;
};

const capturedBowlingRows = (value: unknown): CapturedScorecardRow[] => {
  const lines = capturedTableLines(value);
  const headerIndex = lines.findIndex(cells => cells.some(cell => /^(bowling|bowler)$/i.test(cell)) && cells.some(cell => /^o(?:vers)?$/i.test(cell)));
  if (headerIndex < 0) return [];
  const headers = lines[headerIndex].map(cell => cell.toLocaleUpperCase().replace(/[^A-Z0-9]/g, ""));
  const nameIndex = Math.max(0, headers.findIndex(cell => cell === "BOWLING" || cell === "BOWLER"));
  const oversIndex = headers.findIndex(cell => cell === "O" || cell === "OVERS");
  return lines.slice(headerIndex + 1).flatMap((cells, index) => {
    const name = String(cells[nameIndex] ?? "").replace(/[†*‡]/g, "").replace(/\((?:c|capt|wk|wicketkeeper)\)/gi, "").trim();
    if (!name || oversIndex < 0 || !/^\d+(?:\.[0-5])?$/.test(String(cells[oversIndex] ?? "").trim())) return [];
    return [{ name, detail: "", order: index }];
  });
};

const capturedInningsScore = (value: unknown) => {
  const totalLine = capturedTableLines(value).find(cells => cells.some(cell => /^total\b/i.test(String(cell))));
  if (!totalLine) return "Score unavailable";
  const totalText = totalLine.join(" ");
  const wicketsScore = totalText.match(/\b(\d{1,3})\s*(?:\/|-|for\s+)(\d{1,2})\b/i);
  if (wicketsScore) return `${wicketsScore[1]}/${wicketsScore[2]}`;
  const allOutScore = totalText.match(/\b(\d{1,3})\s*(?:all\s*out|ao)\b/i);
  if (allOutScore) return `${allOutScore[1]}/10`;
  const values = totalLine.flatMap(cell => String(cell).match(/\b\d{1,3}\b/g) ?? []);
  return values.length ? values[values.length - 1] : "Score unavailable";
};

const capturedRowForPlayer = (rows: CapturedScorecardRow[], playerName: string) => {
  const key = scorecardNameKey(playerName);
  const exact = rows.find(row => scorecardNameKey(row.name) === key);
  if (exact) return exact;
  const surname = key.split(" ").filter(Boolean).at(-1);
  const surnameMatches = surname ? rows.filter(row => scorecardNameKey(row.name).split(" ").filter(Boolean).at(-1) === surname) : [];
  return surnameMatches.length === 1 ? surnameMatches[0] : undefined;
};

export const extractSavedCricinfoScorecard = (value: unknown): SavedCricinfoScorecard => {
  const artifact = record(value);
  if (!artifact) throw new Error("The saved review artifact is unavailable.");
  const source = record(artifact.source);
  if (optionalText(source?.provider) !== "espncricinfo-copy-paste") {
    throw new Error("Only saved Cricinfo copy-and-paste reviews can be regenerated in the admin screen.");
  }

  const rows = Array.isArray(artifact.stagingPayload)
    ? artifact.stagingPayload.map(record).filter((row): row is Record<string, unknown> => row !== null)
    : [];
  const rawRows = rows.map(row => record(row.raw_stats)).filter((row): row is Record<string, unknown> => row !== null);
  const rowScorecard = rawRows.map(row => record(row.scorecard)).find(Boolean) ?? null;
  const scorecard = record(artifact.scorecard) ?? rowScorecard;
  const raw = record(scorecard?.raw);
  if (!scorecard || !raw) throw new Error("This saved review does not contain reusable scorecard tables.");

  const winningRows = rawRows.filter(row => optionalBoolean(record(row.normalized_stats)?.winningXI));
  const winnerTeams = [...new Set(winningRows.map(row => optionalText(row.team).toLocaleUpperCase()).filter(Boolean))];
  if (winnerTeams.length !== 1) throw new Error("The saved match winner could not be recovered safely.");
  const playerOfMatchRow = rawRows.find(row => optionalBoolean(record(row.normalized_stats)?.playerOfMatch));
  const resultSummary = rawRows.map(row => optionalText(row.result_summary)).find(Boolean) ?? "";
  const savedMaxBalls = rawRows.map(row => optionalNumber(record(row.normalized_stats)?.maxBalls)).find(value => value > 0) ?? 24;

  const requiredTable = (key: string, label: string) => {
    const table = optionalText(raw[key]);
    if (!table) throw new Error(`The saved review is missing ${label}.`);
    return table;
  };
  const validationRecord = record(scorecard.fielderValidation);
  const validationCorrections = Array.isArray(validationRecord?.corrections)
    ? validationRecord.corrections.flatMap(value => {
        const correction = record(value);
        const innings = correction?.innings;
        const batterName = optionalText(correction?.batterName);
        const originalDismissal = optionalText(correction?.originalDismissal);
        const validatedDismissal = optionalText(correction?.validatedDismissal);
        if ((innings !== 1 && innings !== 2) || !batterName || !originalDismissal || !validatedDismissal) return [];
        return [{ innings: innings as 1 | 2, batterName, originalDismissal, validatedDismissal }];
      })
    : [];
  const fielderValidation = validationRecord?.provider === "cricbuzz" && optionalText(validationRecord.sourceUrl) && validationCorrections.length
    ? { provider: "cricbuzz" as const, sourceUrl: optionalText(validationRecord.sourceUrl), corrections: validationCorrections }
    : undefined;

  return {
    sourceUrl: text(source?.sourceUrl, "Saved score source URL"),
    firstInningsTeam: text(scorecard.firstInningsTeam, "Saved first-innings team").toLocaleUpperCase(),
    winnerTeam: winnerTeams[0],
    resultSummary: text(resultSummary, "Saved result summary"),
    playerOfMatchName: optionalText(playerOfMatchRow?.player_name),
    maxBallsPerBowler: savedMaxBalls,
    aliases: optionalText(scorecard.aliases),
    firstInningsBatting: requiredTable("firstInningsBatting", "the first-innings batting table"),
    firstInningsBowling: requiredTable("firstInningsBowling", "the first-innings bowling table"),
    secondInningsBatting: requiredTable("secondInningsBatting", "the second-innings batting table"),
    secondInningsBowling: requiredTable("secondInningsBowling", "the second-innings bowling table"),
    fielderValidation,
  };
};

export const parseScoreIngestionArtifact = (
  jsonText: string,
  expected: ScoreIngestionFixtureIdentity,
): ParsedScoreIngestionArtifact => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Review artifact is not valid JSON.");
  }

  const artifact = record(parsed);
  if (!artifact) throw new Error("Review artifact must be a JSON object.");
  if (artifact.schemaVersion !== 1 || artifact.status !== "ready-for-admin-review") {
    throw new Error("Only schema v1 artifacts marked ready-for-admin-review can be staged.");
  }
  if (artifact.leagueId !== expected.leagueId || artifact.fixtureId !== expected.fixtureId || artifact.matchNumber !== expected.matchNumber) {
    throw new Error(`Review artifact does not belong to Match ${expected.matchNumber} in this league.`);
  }

  const sourceFingerprint = text(artifact.sourceFingerprint, "Source fingerprint");
  if (!SHA256_PATTERN.test(sourceFingerprint)) throw new Error("Source fingerprint must be a SHA-256 value.");
  const ruleSetId = text(artifact.ruleSetId, "Rule-set ID");
  if (!UUID_PATTERN.test(ruleSetId)) throw new Error("Rule-set ID must be a UUID.");

  const source = record(artifact.source);
  if (!source) throw new Error("Artifact source is required.");
  const provider = text(source.provider, "Source provider");
  const externalMatchId = text(source.externalMatchId, "External match ID");
  const sourceUrl = text(source.sourceUrl, "Source URL");
  try {
    if (new URL(sourceUrl).protocol !== "https:") throw new Error();
  } catch {
    throw new Error("Source URL must be a valid HTTPS URL.");
  }
  assertScoreSourceMatchesFixture(sourceUrl, externalMatchId, expected);

  if (!Array.isArray(artifact.issues)) throw new Error("Artifact issues must be an array.");
  const issues = artifact.issues.map((issue, index) => {
    const item = record(issue);
    if (!item) throw new Error(`Issue ${index + 1} must be an object.`);
    return item;
  });
  if (issues.some(issue => issue.severity === "error")) {
    throw new Error("Artifact contains validation errors and cannot be staged.");
  }
  const warningCount = issues.filter(issue => issue.severity === "warning").length;

  const reconciliation = record(artifact.reconciliation);
  if (!reconciliation) throw new Error("Artifact reconciliation is required.");
  const playerCount = integer(reconciliation.playerCount, "Player count");
  const expectedPlayerCount = integer(reconciliation.expectedPlayerCount, "Expected player count");
  const battingPoints = number(reconciliation.battingPoints, "Batting points");
  const bowlingPoints = number(reconciliation.bowlingPoints, "Bowling points");
  const fieldingPoints = number(reconciliation.fieldingPoints, "Fielding points");
  const bonusPoints = number(reconciliation.bonusPoints, "Bonus points");
  const totalPoints = number(reconciliation.totalPoints, "Total points");

  if (!Array.isArray(artifact.stagingPayload) || artifact.stagingPayload.length === 0) {
    throw new Error("Artifact staging payload must contain player rows.");
  }
  if (playerCount !== artifact.stagingPayload.length || expectedPlayerCount < 1 || expectedPlayerCount > playerCount) {
    throw new Error("Artifact player reconciliation does not match its staging payload.");
  }

  const seenPlayers = new Set<string>();
  let resultSummary = "Official result not provided";
  const players: ScoreIngestionPlayerPreview[] = [];
  const rowScorecard = artifact.stagingPayload
    .map(value => record(value))
    .map(item => record(item?.raw_stats))
    .map(rawStats => record(rawStats?.scorecard))
    .find(Boolean) ?? null;
  const scorecard = record(artifact.scorecard) ?? rowScorecard;
  const capturedRaw = record(scorecard?.raw);
  const firstInningsTeam = optionalText(scorecard?.firstInningsTeam).toLocaleUpperCase();
  const firstBattingRows = capturedBattingRows(capturedRaw?.firstInningsBatting);
  const firstBowlingRows = capturedBowlingRows(capturedRaw?.firstInningsBowling);
  const secondBattingRows = capturedBattingRows(capturedRaw?.secondInningsBatting);
  const secondBowlingRows = capturedBowlingRows(capturedRaw?.secondInningsBowling);
  const firstInningsScore = optionalText(scorecard?.firstInningsScore) || capturedInningsScore(capturedRaw?.firstInningsBatting);
  const secondInningsScore = optionalText(scorecard?.secondInningsScore) || capturedInningsScore(capturedRaw?.secondInningsBatting);
  const calculated = artifact.stagingPayload.reduce((totals, value, index) => {
    const item = record(value);
    if (!item) throw new Error(`Player row ${index + 1} must be an object.`);
    const playerId = text(item.player_id, `Player row ${index + 1} ID`);
    if (!UUID_PATTERN.test(playerId)) throw new Error(`Player row ${index + 1} ID must be a UUID.`);
    if (seenPlayers.has(playerId)) throw new Error("Artifact contains duplicate player score rows.");
    seenPlayers.add(playerId);
    const rawStats = record(item.raw_stats);
    if (!rawStats || !record(item.breakdown)) {
      throw new Error(`Player row ${index + 1} requires raw stats and a point breakdown.`);
    }
    const normalizedStats = record(rawStats.normalized_stats) ?? {};
    const rowBatting = number(item.batting_points, `Player row ${index + 1} batting points`);
    const rowBowling = number(item.bowling_points, `Player row ${index + 1} bowling points`);
    const rowFielding = number(item.fielding_points, `Player row ${index + 1} fielding points`);
    const rowBonus = number(item.bonus_points, `Player row ${index + 1} bonus points`);
    totals.batting += rowBatting;
    totals.bowling += rowBowling;
    totals.fielding += rowFielding;
    totals.bonus += rowBonus;
    const rowResult = optionalText(rawStats.result_summary);
    if (rowResult) resultSummary = rowResult;
    const playerName = optionalText(rawStats.player_name, `Player ${index + 1}`);
    const playerTeam = optionalText(rawStats.team, "—");
    const battingInnings: 1 | 2 = rawStats.batting_innings === 1 || rawStats.batting_innings === 2
      ? rawStats.batting_innings
      : playerTeam.toLocaleUpperCase() === firstInningsTeam ? 1 : 2;
    const bowlingInnings: 1 | 2 = rawStats.bowling_innings === 1 || rawStats.bowling_innings === 2
      ? rawStats.bowling_innings
      : battingInnings === 1 ? 2 : 1;
    const battingRow = capturedRowForPlayer(battingInnings === 1 ? firstBattingRows : secondBattingRows, playerName);
    const bowlingRow = capturedRowForPlayer(battingInnings === 1 ? secondBowlingRows : firstBowlingRows, playerName);
    players.push({
      playerId,
      name: playerName,
      team: playerTeam,
      role: optionalText(rawStats.role, "—"),
      playingXI: optionalBoolean(rawStats.playing_xi),
      runs: optionalNumber(normalizedStats.runs),
      balls: optionalNumber(normalizedStats.balls),
      fours: optionalNumber(normalizedStats.fours),
      sixes: optionalNumber(normalizedStats.sixes),
      ballsBowled: optionalNumber(normalizedStats.ballsBowled),
      runsConceded: optionalNumber(normalizedStats.runsConceded),
      wickets: optionalNumber(normalizedStats.bowlerWickets) + optionalNumber(normalizedStats.nonBowlerWickets),
      dots: optionalNumber(normalizedStats.dots),
      maidens: optionalNumber(normalizedStats.maidens),
      catches: optionalNumber(normalizedStats.catches),
      stumpings: optionalNumber(normalizedStats.stumpings),
      runOuts: optionalNumber(normalizedStats.runOuts) + optionalNumber(normalizedStats.sharedRunOuts),
      directRunOuts: optionalNumber(normalizedStats.runOuts),
      sharedRunOuts: optionalNumber(normalizedStats.sharedRunOuts),
      battingPoints: rowBatting,
      bowlingPoints: rowBowling,
      fieldingPoints: rowFielding,
      bonusPoints: rowBonus,
      totalPoints: rowBatting + rowBowling + rowFielding + rowBonus,
      playerOfMatch: optionalBoolean(normalizedStats.playerOfMatch),
      winningXI: optionalBoolean(normalizedStats.winningXI),
      battingInnings,
      bowlingInnings,
      battingOrder: typeof rawStats.batting_order === "number" ? rawStats.batting_order : battingRow?.order ?? Number.MAX_SAFE_INTEGER,
      bowlingOrder: typeof rawStats.bowling_order === "number" ? rawStats.bowling_order : bowlingRow?.order ?? Number.MAX_SAFE_INTEGER,
      dismissalText: optionalText(rawStats.dismissal_text) || battingRow?.detail || "",
      wicketDetails: [],
    });
    return totals;
  }, { batting: 0, bowling: 0, fielding: 0, bonus: 0 });
  const calculatedTotal = calculated.batting + calculated.bowling + calculated.fielding + calculated.bonus;
  if (
    calculated.batting !== battingPoints
    || calculated.bowling !== bowlingPoints
    || calculated.fielding !== fieldingPoints
    || calculated.bonus !== bonusPoints
    || calculatedTotal !== totalPoints
  ) {
    throw new Error("Artifact category totals do not reconcile with its player rows.");
  }

  const attachDismissals = (battingRows: CapturedScorecardRow[], battingTeam: string, bowlingTeam: string) => {
    battingRows.forEach(row => {
      const bowlerMatch = row.detail.match(/\bb\s+(.+)$/i);
      if (!bowlerMatch) return;
      const bowlerKey = scorecardNameKey(bowlerMatch[1]);
      const bowlerSurname = bowlerKey.split(" ").filter(Boolean).at(-1);
      const candidates = players.filter(player => player.team === bowlingTeam && (
        scorecardNameKey(player.name) === bowlerKey
        || (bowlerSurname && scorecardNameKey(player.name).split(" ").filter(Boolean).at(-1) === bowlerSurname)
      ));
      if (candidates.length !== 1) return;
      const batter = players.find(player => player.team === battingTeam && capturedRowForPlayer([row], player.name));
      candidates[0].wicketDetails.push(`${batter?.name ?? row.name} · ${row.detail}`);
    });
  };
  if (firstInningsTeam) {
    const secondTeam = players.find(player => player.team !== firstInningsTeam)?.team ?? "";
    attachDismissals(firstBattingRows, firstInningsTeam, secondTeam);
    attachDismissals(secondBattingRows, secondTeam, firstInningsTeam);
  }

  const resolvedFirstTeam = firstInningsTeam || players.find(player => player.battingInnings === 1)?.team || players[0]?.team || "TEAM 1";
  const resolvedSecondTeam = players.find(player => player.team !== resolvedFirstTeam)?.team || "TEAM 2";
  const winnerTeam = players.find(player => player.winningXI)?.team || "No result";
  const playerOfMatchName = players.find(player => player.playerOfMatch)?.name || "Not provided";
  const scoreWithFallback = (score: string, battingTeam: string) => {
    if (score !== "Score unavailable") return score;
    const battingPlayers = players.filter(player => player.team === battingTeam);
    const dismissalRows = battingPlayers.filter(player => player.dismissalText && !/^(?:not out|did not bat|retired hurt)$/i.test(player.dismissalText));
    const bowlingPlayers = players.filter(player => player.team !== battingTeam);
    const bowlingWickets = bowlingPlayers.reduce((sum, player) => sum + player.wickets, 0);
    const directRunOuts = bowlingPlayers.reduce((sum, player) => sum + player.directRunOuts, 0);
    const sharedRunOutCredits = bowlingPlayers.reduce((sum, player) => sum + player.sharedRunOuts, 0);
    const wickets = Math.min(10, dismissalRows.length || bowlingWickets + directRunOuts + Math.ceil(sharedRunOutCredits / 2));
    const runs = battingPlayers.reduce((sum, player) => sum + player.runs, 0);
    return `${runs}/${wickets}`;
  };

  return {
    artifact,
    summary: {
      provider,
      externalMatchId,
      sourceUrl,
      sourceFingerprint: sourceFingerprint.toLowerCase(),
      ruleSetId,
      playerCount,
      expectedPlayerCount,
      warningCount,
      totalPoints,
    },
    preview: {
      resultSummary,
      firstInningsTeam: resolvedFirstTeam,
      secondInningsTeam: resolvedSecondTeam,
      firstInningsScore: scoreWithFallback(firstInningsScore, resolvedFirstTeam),
      secondInningsScore: scoreWithFallback(secondInningsScore, resolvedSecondTeam),
      winnerTeam,
      playerOfMatchName,
      battingPoints,
      bowlingPoints,
      fieldingPoints,
      bonusPoints,
      totalPoints,
      players,
    },
  };
};
