import type { NormalizedScoreImport, ScoreImportPlayer, ScoreImportRole } from "./scoreImportRules";

export type LeagueScorecardPlayer = {
  playerId: string;
  name: string;
  team: string;
  role: ScoreImportRole;
};

export type ParsedBattingRow = {
  name: string;
  dismissalText: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
};

export type ParsedBattingTable = {
  rows: ParsedBattingRow[];
  didNotBat: string[];
};

export type ParsedBowlingRow = {
  name: string;
  overs: string;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  dots: number;
};

export type PlayerNameAlias = {
  source: string;
  target: string;
};

export class ScorecardPasteError extends Error {
  details: string[];
  code: string;

  constructor(message: string, details: string[] = [], code = "scorecard-parse-failed") {
    super(message);
    this.name = "ScorecardPasteError";
    this.details = details;
    this.code = code;
  }
}

const integer = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
};

const splitLine = (line: string) => {
  const tabbed = line.split("\t").map(value => value.trim());
  if (tabbed.length > 1) return tabbed;
  return line.trim().split(/\s{2,}/).map(value => value.trim());
};

const tableLines = (text: string) => text
  .replace(/\r/g, "")
  .split("\n")
  .map(line => splitLine(line))
  .filter(cells => cells.some(Boolean));

const headerKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const headerIndex = (headers: string[], names: string[]) => {
  const expected = new Set(names.map(headerKey));
  return headers.findIndex(value => expected.has(headerKey(value)));
};

const numericCell = (value: string) => /^-?\d+(?:\.\d+)?$/.test(value.replace(/,/g, "").trim());

const numericLine = (cells: string[]) => cells.length > 0 && cells.every(cell => numericCell(cell));

const collectFlattenedNumbers = (lines: string[][], start: number, required: number) => {
  const values: string[] = [];
  let nextIndex = start;
  while (nextIndex < lines.length && numericLine(lines[nextIndex]) && values.length < required) {
    values.push(...lines[nextIndex]);
    nextIndex += 1;
  }
  return { values, nextIndex };
};

const isBattingHeader = (cells: string[]) => {
  const keys = cells.map(headerKey);
  return keys.some(key => key === "BATTING" || key === "BATTER")
    && keys.includes("R")
    && keys.includes("B");
};

const isBowlingHeader = (cells: string[]) => {
  const keys = cells.map(headerKey);
  return keys.some(key => key === "BOWLING" || key === "BOWLER")
    && keys.includes("O")
    && keys.includes("W");
};

const stopBattingRow = (name: string) => /^(extras|total|fall of wickets|bowling|bowler|powerplay)/i.test(name);
const stopBowlingRow = (name: string) => /^(fall of wickets|batting|batter|innings|total|powerplay)/i.test(name);

export const normalizeScorecardPlayerName = (value: string) => value
  .normalize("NFKD")
  .replace(/[†*‡]/g, "")
  .replace(/\((?:c|capt|wk|wicketkeeper)\)/gi, "")
  .replace(/^\s*(?:\(sub\)|sub)\s+/i, "")
  .replace(/[^a-zA-Z0-9]+/g, " ")
  .trim()
  .toLowerCase();

const displayScorecardPlayerName = (value: string) => value
  .replace(/[†*‡]/g, "")
  .replace(/\((?:c|capt|wk|wicketkeeper)\)/gi, "")
  .trim();

const referencedScorecardPlayerName = (value: string) => value
  .replace(/\((?:c|capt)\)/gi, "")
  .trim();

const namesFromList = (value: string) => value
  .replace(/^did not bat:?/i, "")
  .split(/,|\u2022/)
  .map(displayScorecardPlayerName)
  .filter(Boolean);

const didNotBatFromLines = (lines: string[][]) => {
  const start = lines.findIndex(cells => /^did not bat\b/i.test(cells.join(" ").trim()));
  if (start < 0) return [];
  const names = namesFromList(lines[start].join(" "));
  for (const cells of lines.slice(start + 1)) {
    const text = cells.join(" ").trim();
    if (!text) continue;
    if (/^(?:total|extras|fall of wickets|bowling|bowler|powerplay|innings)\b/i.test(text)) break;
    names.push(...namesFromList(text));
  }
  return [...new Set(names)];
};

export const parseCricinfoBattingTable = (text: string): ParsedBattingTable => {
  const lines = tableLines(text);
  const headerRow = lines.findIndex(isBattingHeader);
  if (headerRow < 0) {
    throw new ScorecardPasteError("Batting table header was not found.", ["Copy the table including its BATTING, R and B header row."]);
  }

  const copiedHeaders = lines[headerRow];
  const copiedNameIndex = Math.max(0, headerIndex(copiedHeaders, ["BATTING", "BATTER"]));
  const copiedRunsIndex = headerIndex(copiedHeaders, ["R", "RUNS"]);
  // Browser clipboard text collapses Cricinfo's blank dismissal heading even
  // though every batter row still has a separate dismissal cell/line.
  const headers = copiedRunsIndex === copiedNameIndex + 1
    ? [...copiedHeaders.slice(0, copiedNameIndex + 1), "", ...copiedHeaders.slice(copiedNameIndex + 1)]
    : copiedHeaders;
  const nameIndex = Math.max(0, headerIndex(headers, ["BATTING", "BATTER"]));
  const runsIndex = headerIndex(headers, ["R", "RUNS"]);
  const ballsIndex = headerIndex(headers, ["B", "BALLS"]);
  const foursIndex = headerIndex(headers, ["4S", "4", "FOURS"]);
  const sixesIndex = headerIndex(headers, ["6S", "6", "SIXES"]);
  if (runsIndex < 0 || ballsIndex < 0) {
    throw new ScorecardPasteError("Batting table is missing required columns.", ["Required headers: R and B."]);
  }

  const rows: ParsedBattingRow[] = [];
  const didNotBat = didNotBatFromLines(lines);
  for (let lineIndex = headerRow + 1; lineIndex < lines.length; lineIndex += 1) {
    let cells = lines[lineIndex];
    const rawName = cells[nameIndex] ?? "";
    if (!rawName) continue;
    if (/^did not bat/i.test(rawName)) continue;
    if (stopBattingRow(rawName)) break;

    if (cells.length === 1 && !numericLine(cells)) {
      const dismissalCells = lines[lineIndex + 1] ?? [];
      const dismissalText = dismissalCells.join(" ").trim();
      const requiredNumbers = Math.max(2, headers.length - 2);
      const flattened = collectFlattenedNumbers(lines, lineIndex + 2, requiredNumbers);
      if (dismissalText && !numericLine(dismissalCells) && flattened.values.length >= requiredNumbers) {
        cells = [rawName, dismissalText, ...flattened.values.slice(0, requiredNumbers)];
        lineIndex = flattened.nextIndex - 1;
      }
    }

    const name = displayScorecardPlayerName(rawName);
    const runs = integer(cells[runsIndex]);
    const balls = integer(cells[ballsIndex]);
    if (!name || !/^\d[\d,]*$/.test(String(cells[runsIndex] ?? "").trim())) continue;
    const dismissalCells = cells.slice(nameIndex + 1, runsIndex).filter(Boolean);
    rows.push({
      name,
      dismissalText: dismissalCells.join(" ").trim() || "not out",
      runs,
      balls,
      fours: foursIndex >= 0 ? integer(cells[foursIndex]) : 0,
      sixes: sixesIndex >= 0 ? integer(cells[sixesIndex]) : 0,
    });
  }

  if (rows.length === 0) {
    throw new ScorecardPasteError("No batter rows were recognized.", ["Paste the full rendered scorecard table, not commentary or a screenshot."]);
  }
  return { rows, didNotBat: [...new Set(didNotBat)] };
};

export const parseCricinfoInningsTotal = (text: string) => {
  const totalCells = tableLines(text).find(cells => cells.some(cell => /^total\b/i.test(cell)));
  const totalText = totalCells?.join(" ") ?? "";
  const wicketsScore = totalText.match(/\b(\d{1,3})\s*(?:\/|-|for\s+)(\d{1,2})\b/i);
  if (wicketsScore) return `${wicketsScore[1]}/${wicketsScore[2]}`;
  const allOutScore = totalText.match(/\b(\d{1,3})\s*(?:all\s*out|ao)\b/i);
  if (allOutScore) return `${allOutScore[1]}/10`;
  const values = totalCells?.flatMap(cell => cell.match(/\b\d{1,3}\b/g) ?? []) ?? [];
  return values.length ? values[values.length - 1] : "";
};

export const oversToBalls = (overs: string | number) => {
  const value = String(overs).trim();
  if (!/^\d+(?:\.[0-5])?$/.test(value)) {
    throw new ScorecardPasteError(`Invalid overs value: ${value || "blank"}.`);
  }
  const [whole, remainder = "0"] = value.split(".");
  return Number(whole) * 6 + Number(remainder);
};

export const parseCricinfoBowlingTable = (text: string): ParsedBowlingRow[] => {
  const lines = tableLines(text);
  const headerRow = lines.findIndex(isBowlingHeader);
  if (headerRow < 0) {
    throw new ScorecardPasteError("Bowling table header was not found.", ["Copy the table including its BOWLING, O, R and W header row."]);
  }
  const headers = lines[headerRow];
  const nameIndex = Math.max(0, headerIndex(headers, ["BOWLING", "BOWLER"]));
  const oversIndex = headerIndex(headers, ["O", "OVERS"]);
  const maidensIndex = headerIndex(headers, ["M", "MAIDENS"]);
  const runsIndex = headerIndex(headers, ["R", "RUNS"]);
  const wicketsIndex = headerIndex(headers, ["W", "WICKETS"]);
  const dotsIndex = headerIndex(headers, ["0S", "DOTS", "D"]);
  if (oversIndex < 0 || runsIndex < 0 || wicketsIndex < 0) {
    throw new ScorecardPasteError("Bowling table is missing required columns.", ["Required headers: O, R and W."]);
  }
  if (dotsIndex < 0) {
    throw new ScorecardPasteError("Bowling table is missing the dot-ball column.", ["Copy the 0s, Dots or D column because the league awards dot-ball points."]);
  }

  const rows: ParsedBowlingRow[] = [];
  for (let lineIndex = headerRow + 1; lineIndex < lines.length; lineIndex += 1) {
    let cells = lines[lineIndex];
    const rawName = cells[nameIndex] ?? "";
    if (!rawName) continue;
    if (stopBowlingRow(rawName)) break;

    if (cells.length === 1 && !numericLine(cells)) {
      const requiredNumbers = Math.max(4, headers.length - 1);
      const flattened = collectFlattenedNumbers(lines, lineIndex + 1, requiredNumbers);
      if (flattened.values.length >= requiredNumbers) {
        cells = [rawName, ...flattened.values.slice(0, requiredNumbers)];
        lineIndex = flattened.nextIndex - 1;
      }
    }

    const overs = String(cells[oversIndex] ?? "").trim();
    if (!/^\d+(?:\.[0-5])?$/.test(overs)) continue;
    rows.push({
      name: displayScorecardPlayerName(rawName),
      overs,
      balls: oversToBalls(overs),
      maidens: maidensIndex >= 0 ? integer(cells[maidensIndex]) : 0,
      runs: integer(cells[runsIndex]),
      wickets: integer(cells[wicketsIndex]),
      dots: integer(cells[dotsIndex]),
    });
  }
  if (rows.length === 0) {
    throw new ScorecardPasteError("No bowler rows were recognized.", ["Paste the full rendered scorecard table, not commentary or a screenshot."]);
  }
  return rows;
};

export const parsePlayerNameAliases = (text: string): PlayerNameAlias[] => text
  .replace(/\r/g, "")
  .split("\n")
  .map(line => line.trim())
  .filter(Boolean)
  .map((line, index) => {
    const separator = line.includes("=") ? "=" : line.includes("->") ? "->" : "";
    if (!separator) throw new ScorecardPasteError(`Alias line ${index + 1} is invalid.`, ["Use: Cricinfo name = league player name"]);
    const [source, ...targetParts] = line.split(separator).map(value => value.trim());
    const target = targetParts.join(separator).trim();
    if (!source || !target) throw new ScorecardPasteError(`Alias line ${index + 1} is incomplete.`);
    return { source, target };
  });

const nameScore = (source: string, target: string) => {
  const sourceKey = normalizeScorecardPlayerName(source);
  const targetKey = normalizeScorecardPlayerName(target);
  if (sourceKey === targetKey) return 100;
  const sourceTokens = sourceKey.split(" ").filter(Boolean);
  const targetTokens = targetKey.split(" ").filter(Boolean);
  if (!sourceTokens.length || !targetTokens.length) return 0;
  const sourceSurname = sourceTokens[sourceTokens.length - 1];
  const targetSurname = targetTokens[targetTokens.length - 1];
  if (sourceSurname === targetSurname && sourceTokens[0][0] === targetTokens[0][0]) return 94;
  if (sourceSurname === targetSurname) return 86;
  const overlap = sourceTokens.filter(token => targetTokens.includes(token)).length;
  return Math.round((overlap / Math.max(sourceTokens.length, targetTokens.length)) * 80);
};

const aliasTarget = (source: string, aliases: PlayerNameAlias[]) => {
  const normalized = normalizeScorecardPlayerName(source);
  return aliases.find(alias => normalizeScorecardPlayerName(alias.source) === normalized)?.target ?? "";
};

export const resolveScorecardPlayer = (
  sourceName: string,
  team: string,
  players: LeagueScorecardPlayer[],
  aliases: PlayerNameAlias[] = [],
) => {
  const teamPlayers = players.filter(player => player.team.toUpperCase() === team.toUpperCase());
  const explicitTarget = aliasTarget(sourceName, aliases);
  if (explicitTarget) {
    const explicit = teamPlayers.find(player => normalizeScorecardPlayerName(player.name) === normalizeScorecardPlayerName(explicitTarget));
    if (!explicit) throw new ScorecardPasteError(`Alias target was not found for ${sourceName}.`, [`${explicitTarget} is not an active ${team} league player.`]);
    return explicit;
  }
  const wicketkeeperHint = /†|\((?:wk|wicketkeeper)\)/i.test(sourceName);
  const eligiblePlayers = wicketkeeperHint
    ? teamPlayers.filter(player => player.role === "WK")
    : teamPlayers;
  const ranked = eligiblePlayers
    .map(player => ({ player, score: nameScore(sourceName, player.name) }))
    .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
  if (!ranked.length || ranked[0].score < 86) {
    throw new ScorecardPasteError(`No league player matched “${sourceName}” for ${team}.`, [`Add an alias: ${sourceName} = Exact league player name`]);
  }
  if (ranked[1] && ranked[1].score === ranked[0].score) {
    throw new ScorecardPasteError(`Player name “${sourceName}” is ambiguous for ${team}.`, ranked.slice(0, 3).map(item => `${item.player.name} (${item.score}% match)`));
  }
  return ranked[0].player;
};

const dismissalKind = (row: ParsedBattingRow): NonNullable<ScoreImportPlayer["batting"]>["dismissal"] => {
  const dismissal = row.dismissalText.toLowerCase();
  if (/retired\s+hurt/.test(dismissal)) return "retired-hurt";
  if (/retired\s+out/.test(dismissal)) return "retired-out";
  if (row.runs > 0 || /not\s+out/.test(dismissal)) return "none";
  if (/run\s*out|obstructing/.test(dismissal) && row.balls === 0) return "diamond-duck";
  if (row.balls <= 1) return "golden-duck";
  return "duck";
};

const bowlerFromDismissal = (dismissal: string) => {
  if (/run\s*out|retired|obstructing|timed\s*out/i.test(dismissal)) return "";
  const match = dismissal.match(/\bb\s+(.+)$/i);
  return match ? displayScorecardPlayerName(match[1]) : "";
};

export const fieldersFromDismissal = (dismissal: string) => {
  if (/^(?:c|caught)\s*&\s*b\s+/i.test(dismissal)) {
    const bowler = bowlerFromDismissal(dismissal);
    return { catches: bowler ? [bowler] : [], stumpings: [], directRunOuts: [], sharedRunOuts: [] };
  }
  const catchMatch = dismissal.match(/^(?:c|caught)\s+(.+?)\s+b\s+/i);
  if (catchMatch) return { catches: [referencedScorecardPlayerName(catchMatch[1])], stumpings: [], directRunOuts: [], sharedRunOuts: [] };
  const stumpingMatch = dismissal.match(/^(?:st|stumped)\s+(.+?)\s+b\s+/i);
  if (stumpingMatch) return { catches: [], stumpings: [referencedScorecardPlayerName(stumpingMatch[1])], directRunOuts: [], sharedRunOuts: [] };
  const runOutMatch = dismissal.match(/run\s*out\s*\(([^)]+)\)/i);
  if (runOutMatch) {
    const names = runOutMatch[1].split(/\//).map(referencedScorecardPlayerName).filter(Boolean);
    return names.length > 1
      ? { catches: [], stumpings: [], directRunOuts: [], sharedRunOuts: names }
      : { catches: [], stumpings: [], directRunOuts: names, sharedRunOuts: [] };
  }
  return { catches: [], stumpings: [], directRunOuts: [], sharedRunOuts: [] };
};

export const isDirectBowlerWicket = (dismissal: string) => {
  const bowler = bowlerFromDismissal(dismissal);
  if (!bowler) return false;
  const fielders = fieldersFromDismissal(dismissal);
  return fielders.catches.length === 0 && fielders.stumpings.length === 0;
};

export type CricinfoPasteImportInput = {
  leagueId: string;
  fixtureId: string;
  matchNumber: number;
  ruleSetId: string;
  sourceUrl: string;
  homeTeam: string;
  awayTeam: string;
  firstInningsTeam: string;
  winnerTeam: string;
  playerOfMatchName: string;
  resultSummary: string;
  maxBallsPerBowler?: number;
  substituteFielderPointsEnabled?: boolean;
  firstInningsBatting: string;
  firstInningsBowling: string;
  secondInningsBatting: string;
  secondInningsBowling: string;
  aliases?: string;
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
  leaguePlayers: LeagueScorecardPlayer[];
};

const sourceMatchId = (sourceUrl: string, matchNumber: number) => {
  const numericSegments = sourceUrl.match(/\d{5,}/g);
  return numericSegments?.[numericSegments.length - 1] ?? `match-${matchNumber}`;
};

export const buildCricinfoPasteImport = (input: CricinfoPasteImportInput): NormalizedScoreImport => {
  const aliases = parsePlayerNameAliases(input.aliases ?? "");
  const firstTeam = input.firstInningsTeam.toUpperCase();
  const secondTeam = firstTeam === input.homeTeam.toUpperCase() ? input.awayTeam.toUpperCase() : input.homeTeam.toUpperCase();
  if (![input.homeTeam.toUpperCase(), input.awayTeam.toUpperCase()].includes(firstTeam)) {
    throw new ScorecardPasteError("First-innings team must be one of the fixture teams.");
  }
  const innings = [
    { battingTeam: firstTeam, bowlingTeam: secondTeam, batting: parseCricinfoBattingTable(input.firstInningsBatting), bowling: parseCricinfoBowlingTable(input.firstInningsBowling) },
    { battingTeam: secondTeam, bowlingTeam: firstTeam, batting: parseCricinfoBattingTable(input.secondInningsBatting), bowling: parseCricinfoBowlingTable(input.secondInningsBowling) },
  ];

  const sourceNames = new Map<string, LeagueScorecardPlayer>();
  const resolve = (name: string, team: string) => {
    const key = `${team}:${normalizeScorecardPlayerName(name)}`;
    const existing = sourceNames.get(key);
    if (existing) return existing;
    const player = resolveScorecardPlayer(name, team, input.leaguePlayers, aliases);
    sourceNames.set(key, player);
    return player;
  };
  const resolveFielder = (name: string, team: string, batterName: string) => {
    try {
      return resolve(name, team);
    } catch (error) {
      if (error instanceof ScorecardPasteError) {
        throw new ScorecardPasteError(
          error.message,
          [...error.details, `Use the matching Cricbuzz scorecard to validate the fielder for ${batterName}.`],
          "fielder-name-unresolved",
        );
      }
      throw error;
    }
  };

  innings.forEach(item => {
    item.batting.rows.forEach(row => resolve(row.name, item.battingTeam));
    item.batting.didNotBat.forEach(name => resolve(name, item.battingTeam));
    item.bowling.forEach(row => resolve(row.name, item.bowlingTeam));
  });

  const playersById = new Map<string, ScoreImportPlayer>();
  const substituteFielderIds = new Set<string>();
  const substituteFielders = new Map<string, LeagueScorecardPlayer>();
  const ensurePlayer = (leaguePlayer: LeagueScorecardPlayer) => {
    const existing = playersById.get(leaguePlayer.playerId);
    if (existing) return existing;
    const created: ScoreImportPlayer = {
      playerId: leaguePlayer.playerId,
      name: leaguePlayer.name,
      team: leaguePlayer.team.toUpperCase(),
      role: leaguePlayer.role,
      playingXI: true,
      batting: { runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: "none" },
      bowling: { balls: 0, runsConceded: 0, maidens: 0, dots: 0, wickets: [] },
      fielding: { catches: 0, stumpings: 0, directRunOuts: 0, sharedRunOuts: 0 },
    };
    playersById.set(leaguePlayer.playerId, created);
    return created;
  };
  sourceNames.forEach(player => ensurePlayer(player));

  innings.forEach((item, inningsIndex) => {
    item.batting.rows.forEach((row, battingOrder) => {
      const player = ensurePlayer(resolve(row.name, item.battingTeam));
      player.batting = { runs: row.runs, balls: row.balls, fours: row.fours, sixes: row.sixes, dismissal: dismissalKind(row), dismissalText: row.dismissalText, innings: inningsIndex === 0 ? 1 : 2, order: battingOrder };
      const bowlerName = bowlerFromDismissal(row.dismissalText);
      if (bowlerName) {
        const bowler = ensurePlayer(resolve(bowlerName, item.bowlingTeam));
        bowler.bowling?.wickets.push({ victimPlayerId: player.playerId, victimRole: player.role, direct: isDirectBowlerWicket(row.dismissalText) });
      }
      const fielders = fieldersFromDismissal(row.dismissalText);
      const creditFielder = (name: string, category: "catches" | "stumpings" | "directRunOuts" | "sharedRunOuts") => {
        const leagueFielder = resolveFielder(name, item.bowlingTeam, row.name);
        const isSubstituteFielder = /^\s*(?:\(sub\)|sub)\s*/i.test(name);
        if (isSubstituteFielder) {
          substituteFielderIds.add(leagueFielder.playerId);
          substituteFielders.set(leagueFielder.playerId, leagueFielder);
          if (input.substituteFielderPointsEnabled !== true) return;
        }
        const fielder = ensurePlayer(leagueFielder);
        if (fielder.fielding) fielder.fielding[category] += 1;
      };
      fielders.catches.forEach(name => creditFielder(name, "catches"));
      fielders.stumpings.forEach(name => creditFielder(name, "stumpings"));
      fielders.directRunOuts.forEach(name => creditFielder(name, "directRunOuts"));
      fielders.sharedRunOuts.forEach(name => creditFielder(name, "sharedRunOuts"));
    });
    item.batting.didNotBat.forEach((name, didNotBatIndex) => {
      const player = ensurePlayer(resolve(name, item.battingTeam));
      player.batting = { ...(player.batting ?? { runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: "none" }), dismissalText: "did not bat", innings: inningsIndex === 0 ? 1 : 2, order: item.batting.rows.length + didNotBatIndex };
    });
    item.bowling.forEach((row, bowlingOrder) => {
      const bowler = ensurePlayer(resolve(row.name, item.bowlingTeam));
      if (!bowler.bowling) return;
      bowler.bowling.balls = row.balls;
      bowler.bowling.runsConceded = row.runs;
      bowler.bowling.maidens = row.maidens;
      bowler.bowling.dots = row.dots;
      bowler.bowling.innings = inningsIndex === 0 ? 1 : 2;
      bowler.bowling.order = bowlingOrder;
      if (bowler.bowling.wickets.length !== row.wickets) {
        throw new ScorecardPasteError(`Wicket reconciliation failed for ${row.name}.`, [`Bowling table: ${row.wickets}; recognized dismissals: ${bowler.bowling.wickets.length}. Check copied dismissal text and aliases.`]);
      }
    });
  });

  const playerOfMatch = input.playerOfMatchName.trim()
    ? (() => {
        const alreadyResolved = [...sourceNames.values()].find(player => nameScore(input.playerOfMatchName, player.name) >= 94);
        if (alreadyResolved) return alreadyResolved;
        const fixtureTeams = [input.homeTeam, input.awayTeam];
        const matches = fixtureTeams.flatMap(team => {
          try { return [resolveScorecardPlayer(input.playerOfMatchName, team, input.leaguePlayers, aliases)]; }
          catch { return []; }
        });
        if (matches.length !== 1) {
          throw new ScorecardPasteError(`Player of the match “${input.playerOfMatchName}” could not be resolved uniquely.`, ["Add a player-name alias or leave this field blank and review it manually."]);
        }
        return matches[0];
      })()
    : null;
  const players = [...playersById.values()].sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
  const participantCounts = [input.homeTeam, input.awayTeam].map(team => {
    const teamCode = team.toUpperCase();
    const teamPlayers = players.filter(player => player.team === teamCode);
    const fieldingOnlySubstitutes = teamPlayers.filter(player => substituteFielderIds.has(player.playerId)
      && !player.batting?.dismissalText
      && player.bowling?.innings === undefined);
    return { team: teamCode, count: teamPlayers.length, coreCount: teamPlayers.length - fieldingOnlySubstitutes.length, fieldingOnlySubstitutes };
  });
  if (participantCounts.some(({ coreCount }) => coreCount < 11)) {
    throw new ScorecardPasteError(
      `Expected at least 11 core match participants per team but resolved ${participantCounts.map(({ team, coreCount, count }) => `${team} ${coreCount} core (${count} including substitute fielders)`).join(" and ")}.`,
      ["Copy every Did not bat row, include Impact or concussion substitutes who appeared, or add aliases for missing names. A team with 13 or more verified participants can continue as an admin-review exception."],
    );
  }

  return {
    schemaVersion: 1,
    leagueId: input.leagueId,
    fixtureId: input.fixtureId,
    matchNumber: input.matchNumber,
    ruleSetId: input.ruleSetId,
    source: {
      provider: "espncricinfo-copy-paste",
      externalMatchId: sourceMatchId(input.sourceUrl, input.matchNumber),
      sourceUrl: input.sourceUrl,
      retrievedAt: new Date().toISOString(),
    },
    expectedPlayerIds: players.map(player => player.playerId),
    match: {
      homeTeam: input.homeTeam.toUpperCase(),
      awayTeam: input.awayTeam.toUpperCase(),
      winnerTeam: input.winnerTeam.toUpperCase(),
      playerOfMatchId: playerOfMatch?.playerId ?? null,
      maxBallsPerBowler: input.maxBallsPerBowler ?? 24,
      resultSummary: input.resultSummary.trim(),
    },
    players,
    scorecard: {
      captureMethod: "admin-browser-copy-paste",
      firstInningsTeam: firstTeam,
      firstInningsScore: parseCricinfoInningsTotal(input.firstInningsBatting),
      secondInningsScore: parseCricinfoInningsTotal(input.secondInningsBatting),
      aliases: input.aliases?.trim() ?? "",
      fielderValidation: input.fielderValidation ?? null,
      substituteFielderPointsEnabled: input.substituteFielderPointsEnabled === true,
      substituteFielders: [...substituteFielders.values()]
        .sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name))
        .map(player => ({
          playerId: player.playerId,
          playerName: player.name,
          team: player.team.toUpperCase(),
          pointsAwarded: input.substituteFielderPointsEnabled === true,
        })),
      raw: {
        firstInningsBatting: input.firstInningsBatting,
        firstInningsBowling: input.firstInningsBowling,
        secondInningsBatting: input.secondInningsBatting,
        secondInningsBowling: input.secondInningsBowling,
      },
    },
  };
};
