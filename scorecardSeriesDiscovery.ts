export type ScorecardSeriesProvider = "espncricinfo" | "cricbuzz";

export type ScorecardSeriesMatch = {
  matchNumber: number;
  teamTokens: string[];
  scorecardUrl: string;
  scheduledText?: string;
};

export type ScorecardSeriesCapture = {
  schemaVersion: 1;
  captureMethod: "cricket-rivalries-series-scorecard-discovery";
  provider: ScorecardSeriesProvider;
  sourceUrl: string;
  capturedAt: string;
  matches: ScorecardSeriesMatch[];
};

export type ScorecardDiscoveryFixture = {
  id: string;
  match_number: number;
  scheduled_start?: string;
  home?: { code?: string; name?: string };
  away?: { code?: string; name?: string };
};

export type ScorecardSeriesAssignment = {
  fixtureId: string;
  matchNumber: number;
  scorecardUrl: string;
};

const identity = (value: string) => value
  .normalize("NFKD")
  .replace(/[^a-zA-Z0-9]+/g, "")
  .toLocaleLowerCase();

const fixtureTeamIdentities = (team?: ScorecardDiscoveryFixture["home"]) => new Set(
  [team?.code, team?.name].filter((value): value is string => Boolean(value)).map(identity),
);

const tokenMatchesTeam = (token: string, team?: ScorecardDiscoveryFixture["home"]) => {
  const normalized = identity(token);
  if (!normalized) return false;
  return [...fixtureTeamIdentities(team)].some(candidate => (
    normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized)
  ));
};

const sameScheduledDateWhenAvailable = (fixture: ScorecardDiscoveryFixture, scheduledText?: string) => {
  if (!fixture.scheduled_start || !scheduledText) return true;
  const captured = Date.parse(scheduledText);
  if (!Number.isFinite(captured)) return true;
  const fixtureDate = new Date(fixture.scheduled_start);
  const captureDate = new Date(captured);
  return fixtureDate.getUTCFullYear() === captureDate.getUTCFullYear()
    && fixtureDate.getUTCMonth() === captureDate.getUTCMonth()
    && fixtureDate.getUTCDate() === captureDate.getUTCDate();
};

export const isScorecardSeriesCapture = (value: unknown): value is ScorecardSeriesCapture => {
  const capture = value as ScorecardSeriesCapture | null;
  return Boolean(
    capture
    && capture.schemaVersion === 1
    && capture.captureMethod === "cricket-rivalries-series-scorecard-discovery"
    && (capture.provider === "espncricinfo" || capture.provider === "cricbuzz")
    && typeof capture.sourceUrl === "string"
    && Array.isArray(capture.matches)
    && capture.matches.every(match => Number.isInteger(match.matchNumber)
      && match.matchNumber > 0
      && Array.isArray(match.teamTokens)
      && match.teamTokens.length >= 2
      && typeof match.scorecardUrl === "string"),
  );
};

export const matchSeriesScorecardsToFixtures = (
  fixtures: ScorecardDiscoveryFixture[],
  capture: ScorecardSeriesCapture,
) => {
  const assignments: ScorecardSeriesAssignment[] = [];
  const unresolved: number[] = [];
  const ambiguous: number[] = [];

  for (const fixture of fixtures) {
    const candidates = capture.matches.filter(match => (
      match.matchNumber === fixture.match_number
      && match.teamTokens.some(token => tokenMatchesTeam(token, fixture.home))
      && match.teamTokens.some(token => tokenMatchesTeam(token, fixture.away))
      && sameScheduledDateWhenAvailable(fixture, match.scheduledText)
    ));
    const uniqueUrls = [...new Set(candidates.map(candidate => candidate.scorecardUrl))];
    if (uniqueUrls.length === 1) {
      assignments.push({ fixtureId: fixture.id, matchNumber: fixture.match_number, scorecardUrl: uniqueUrls[0] });
    } else if (uniqueUrls.length > 1) {
      ambiguous.push(fixture.match_number);
    } else {
      unresolved.push(fixture.match_number);
    }
  }

  return { assignments, unresolved, ambiguous };
};
