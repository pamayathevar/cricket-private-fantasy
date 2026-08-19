import { completedMatchStats } from "./completedMatchPoints";
import { squadPlayers } from "./squadData";
import { calculatePlayerPoints, calculatePointDetails, PlayerMatchStats, PointBreakdown } from "./scoringRules";
import { formatOversFromBalls, scorecardDismissalLabel } from "./scorecardRules";
import { parseScoreIngestionArtifact } from "./scoreIngestionArtifact";
import { scorecardFromIngestionPreview } from "./scorecardFromIngestionPreview";
export { formatOversFromBalls, latestPublishedPlayerPoints, scorecardDismissalLabel } from "./scorecardRules";

export type ScorecardBattingRow = {
  name: string;
  role: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  notOut: boolean;
  dismissalText?: string;
};

export type ScorecardBowlingRow = {
  name: string;
  role: string;
  balls: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  dots: number;
  economy: number;
};

export type ScorecardInnings = {
  team: string;
  score: string;
  overs: string;
  batting: ScorecardBattingRow[];
  didNotBat?: Array<{ name: string; role: string }>;
  bowling: ScorecardBowlingRow[];
};

export type SeededScorecard = {
  matchNumber: number;
  result: string;
  winnerTeam: string;
  playerOfMatch: string;
  sourceUrl: string;
  innings: ScorecardInnings[];
};

export type ScorecardFixture = {
  match_number?: unknown;
  external_ref?: unknown;
  scorecard_source_url?: unknown;
  player_match_points?: Array<{ raw_stats?: unknown }>;
  score_ingestion_batches?: Array<{
    status?: unknown;
    calculation_version?: unknown;
    source_url?: unknown;
    review_artifact?: unknown;
    published_at?: unknown;
  }>;
};

type SeededMeta = {
  teams: [string, string];
  scores: [string, string];
  overs: [string, string];
  notOut: [string[], string[]];
  didNotBat?: [string[], string[]];
  dismissals?: [Record<string, string>, Record<string, string>];
  result: string;
  winnerTeam: string;
  playerOfMatch: string;
  sourceUrl: string;
};

const seededMeta: Record<number, SeededMeta> = {
  1: {
    teams: ["SRH", "RCB"], scores: ["201/9", "203/4"], overs: ["20.0", "15.4"],
    notOut: [["David Payne", "Jaydev Unadkat"], ["Virat Kohli", "Tim David"]],
    didNotBat: [["Eshan Malinga"], ["Romario Shepherd", "Krunal Pandya", "Bhuvneshwar Kumar", "Abhinandan Singh", "Jacob Duffy", "Suyash Sharma"]],
    dismissals: [{
      "Travis Head": "c Phil Salt b Jacob Duffy",
      "Abhishek Sharma": "c Jitesh Sharma b Jacob Duffy",
      "Ishan Kishan": "c Phil Salt b Abhinandan Singh",
      "Nitish Kumar Reddy": "c Abhinandan Singh b Jacob Duffy",
      "Heinrich Klaasen": "c Phil Salt b Romario Shepherd",
      "Salil Arora": "c Devdutt Padikkal b Suyash Sharma",
      "Aniket Verma": "c Virat Kohli b Romario Shepherd",
      "Harsh Dubey": "c Devdutt Padikkal b Romario Shepherd",
      "Harshal Patel": "c Devdutt Padikkal b Bhuvneshwar Kumar",
    }, {
      "Phil Salt": "c Heinrich Klaasen b Jaydev Unadkat",
      "Devdutt Padikkal": "c Heinrich Klaasen b Harsh Dubey",
      "Rajat Patidar": "c Harsh Dubey b David Payne",
      "Jitesh Sharma": "c Jaydev Unadkat b David Payne",
    }],
    result: "RCB won by 6 wickets", winnerTeam: "RCB", playerOfMatch: "Jacob Duffy",
    sourceUrl: "https://www.cricinfo.com/series/ipl-2026-1510719/royal-challengers-bengaluru-vs-sunrisers-hyderabad-1st-match-1527674/full-scorecard",
  },
  2: {
    teams: ["KKR", "MI"], scores: ["220/4", "224/4"], overs: ["20.0", "19.1"],
    notOut: [["Rinku Singh", "Ramandeep Singh"], ["Hardik Pandya", "Naman Dhir"]],
    didNotBat: [["Anukul Roy", "Sunil Narine", "Varun Chakravarthy", "Vaibhav Arora", "Blessing Muzarabani"], ["Sherfane Rutherford", "Shardul Thakur", "Mayank Markande", "AM Ghazanfar", "Trent Boult", "Jasprit Bumrah"]],
    result: "MI won by 6 wickets", winnerTeam: "MI", playerOfMatch: "Shardul Thakur",
    sourceUrl: "https://www.cricinfo.com/series/ipl-2026-1510719/mumbai-indians-vs-kolkata-knight-riders-2nd-match-1527675/full-scorecard",
  },
  3: {
    teams: ["CSK", "RR"], scores: ["127", "128/2"], overs: ["19.4", "12.1"],
    notOut: [[], ["Yashasvi Jaiswal", "Riyan Parag"]],
    didNotBat: [[], ["Shimron Hetmyer", "Ravindra Jadeja", "Jofra Archer", "Nandre Burger", "Sandeep Sharma", "Ravi Bishnoi", "Brijesh Sharma"]],
    result: "RR won by 8 wickets", winnerTeam: "RR", playerOfMatch: "Nandre Burger",
    sourceUrl: "https://www.cricinfo.com/series/ipl-2026-1510719/rajasthan-royals-vs-chennai-super-kings-3rd-match-1527676/full-scorecard",
  },
  4: {
    teams: ["GT", "PBKS"], scores: ["162/6", "165/7"], overs: ["20.0", "19.1"],
    notOut: [["Rahul Tewatia", "Rashid Khan"], ["Cooper Connolly", "Xavier Bartlett"]],
    didNotBat: [["Kagiso Rabada", "Ashok Sharma", "Mohammed Siraj"], ["Vijaykumar Vyshak", "Arshdeep Singh", "Yuzvendra Chahal"]],
    result: "PBKS won by 3 wickets", winnerTeam: "PBKS", playerOfMatch: "Cooper Connolly",
    sourceUrl: "https://www.cricinfo.com/series/ipl-2026-1510719/punjab-kings-vs-gujarat-titans-4th-match-1527677/full-scorecard",
  },
  5: {
    teams: ["LSG", "DC"], scores: ["141", "145/4"], overs: ["18.4", "17.1"],
    notOut: [[], ["Sameer Rizvi", "Tristan Stubbs"]],
    didNotBat: [["Prince Yadav"], ["David Miller", "Vipraj Nigam", "Lungi Ngidi", "Kuldeep Yadav", "T Natarajan", "Mukesh Kumar"]],
    result: "DC won by 6 wickets", winnerTeam: "DC", playerOfMatch: "Sameer Rizvi",
    sourceUrl: "https://www.cricinfo.com/series/ipl-2026-1510719/delhi-capitals-vs-lucknow-super-giants-5th-match-1527678/full-scorecard",
  },
};

const playerByName = Object.fromEntries(squadPlayers.map(player => [player.name, player]));

export function seededScorecardForFixture(fixture: ScorecardFixture) {
  const matchNumber = Number(fixture.match_number);
  const meta = seededMeta[matchNumber];
  if (!meta) return null;
  const externalRef = String(fixture.external_ref ?? "");
  const sourceUrl = String(fixture.scorecard_source_url ?? "");
  const isOfficialSeed = externalRef.startsWith("ipl-2026-") || sourceUrl.includes("1510719") || sourceUrl.includes(meta.sourceUrl.split("-").at(-2) ?? "__never__");
  if (!isOfficialSeed) return null;
  const matchStats = completedMatchStats[`M${matchNumber}`] ?? {};
  const innings = meta.teams.map((team, index) => {
    const opposition = meta.teams[index === 0 ? 1 : 0];
    const batting = Object.entries(matchStats).filter(([name, stats]) => {
      const player = playerByName[name];
      return player?.team === team && (stats.balls > 0 || stats.runs > 0 || (stats.dismissal && stats.dismissal !== "none"));
    }).map(([name, stats]) => ({
      name, role: playerByName[name]?.role ?? "—", runs: stats.runs, balls: stats.balls, fours: stats.fours, sixes: stats.sixes,
      strikeRate: stats.balls ? stats.runs * 100 / stats.balls : 0, notOut: meta.notOut[index].includes(name),
      dismissalText: meta.dismissals?.[index]?.[name],
    }));
    const bowling = Object.entries(matchStats).filter(([name, stats]) => playerByName[name]?.team === opposition && stats.ballsBowled > 0).map(([name, stats]) => ({
      name, role: playerByName[name]?.role ?? "—", balls: stats.ballsBowled, overs: formatOversFromBalls(stats.ballsBowled), maidens: stats.maidens,
      runs: stats.runsConceded, wickets: stats.bowlerWickets + stats.nonBowlerWickets, dots: stats.dots,
      economy: stats.ballsBowled ? stats.runsConceded / (stats.ballsBowled / 6) : 0,
    })).sort((left, right) => right.balls - left.balls || left.name.localeCompare(right.name));
    const didNotBat = (meta.didNotBat?.[index] ?? []).map(name => ({ name, role: playerByName[name]?.role ?? "—" }));
    return { team, score: meta.scores[index], overs: meta.overs[index], batting, didNotBat, bowling };
  });
  return { matchNumber, result: meta.result, winnerTeam: meta.winnerTeam, playerOfMatch: meta.playerOfMatch, sourceUrl: meta.sourceUrl, innings } satisfies SeededScorecard;
}

export function scorecardForFixture(fixture: ScorecardFixture): SeededScorecard | null {
  const stored = (fixture.player_match_points ?? []).map(row => row.raw_stats).find(rawStats => rawStats && typeof rawStats === "object" && "scorecard" in rawStats) as { scorecard?: unknown } | undefined;
  const candidate = stored?.scorecard as Partial<SeededScorecard> | undefined;
  if (candidate && typeof candidate.result === "string" && typeof candidate.winnerTeam === "string" && Array.isArray(candidate.innings) && candidate.innings.length >= 2) {
    return {
      matchNumber: Number(candidate.matchNumber ?? fixture.match_number), result: candidate.result, winnerTeam: candidate.winnerTeam,
      playerOfMatch: String(candidate.playerOfMatch ?? "—"), sourceUrl: String(candidate.sourceUrl ?? fixture.scorecard_source_url ?? ""),
      innings: candidate.innings.map(item => {
        const innings = item as ScorecardInnings & { did_not_bat?: unknown };
        const rawDidNotBat = innings.didNotBat ?? innings.did_not_bat;
        const didNotBat = Array.isArray(rawDidNotBat) ? rawDidNotBat.map(value => {
          if (typeof value === "string") return { name: value, role: playerByName[value]?.role ?? "—" };
          if (!value || typeof value !== "object") return null;
          const row = value as Record<string, unknown>;
          const name = String(row.name ?? row.playerName ?? row.player_name ?? "").trim();
          return name ? { name, role: String(row.role ?? playerByName[name]?.role ?? "—") } : null;
        }).filter((row): row is { name: string; role: string } => Boolean(row)) : [];
        return {
          ...innings,
          didNotBat,
          batting: Array.isArray(innings.batting) ? innings.batting.map(itemRow => {
            const row = itemRow as ScorecardBattingRow & Record<string, unknown>;
            const dismissalText = scorecardDismissalLabel(row);
            const notOut = Boolean(row.notOut ?? row.not_out) || dismissalText.toLowerCase() === "not out";
            return { ...row, notOut, dismissalText: dismissalText || undefined };
          }) : [],
        };
      }),
    };
  }
  const publishedBatch = [...(fixture.score_ingestion_batches ?? [])]
    .filter(batch => batch.status === "published" && batch.review_artifact)
    .sort((left, right) => Number(right.calculation_version ?? 0) - Number(left.calculation_version ?? 0))[0];
  if (publishedBatch?.review_artifact && typeof publishedBatch.review_artifact === "object") {
    const artifact = publishedBatch.review_artifact as Record<string, unknown>;
    try {
      const parsed = parseScoreIngestionArtifact(JSON.stringify(artifact), {
        leagueId: String(artifact.leagueId ?? ""),
        fixtureId: String(artifact.fixtureId ?? ""),
        matchNumber: Number(artifact.matchNumber ?? fixture.match_number),
      });
      return scorecardFromIngestionPreview(
        parsed.preview,
        Number(artifact.matchNumber ?? fixture.match_number),
        parsed.summary.sourceUrl || String(publishedBatch.source_url ?? fixture.scorecard_source_url ?? ""),
      );
    } catch {
      // Keep the legacy seeded fallback for older published matches whose
      // review artifacts predate the complete two-innings format.
    }
  }
  return seededScorecardForFixture(fixture);
}

export function seededPlayerStats(matchNumber: number, playerName: string): PlayerMatchStats | null {
  return completedMatchStats[`M${matchNumber}`]?.[playerName] ?? null;
}

export function seededPlayerPointDetails(matchNumber: number, playerName: string) {
  const stats = seededPlayerStats(matchNumber, playerName);
  return stats ? calculatePointDetails(stats) : null;
}

export function seededPlayerPoints(matchNumber: number, playerName: string): PointBreakdown | null {
  const stats = seededPlayerStats(matchNumber, playerName);
  return stats ? calculatePlayerPoints(stats) : null;
}
