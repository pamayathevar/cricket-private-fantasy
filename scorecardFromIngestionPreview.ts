import type { ScoreIngestionArtifactPreview } from "./scoreIngestionArtifact";

export type PublishedScorecard = {
  matchNumber: number;
  result: string;
  winnerTeam: string;
  playerOfMatch: string;
  sourceUrl: string;
  innings: Array<{
    team: string;
    score: string;
    overs: string;
    batting: Array<{
      name: string;
      role: string;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      strikeRate: number;
      notOut: boolean;
      dismissalText?: string;
    }>;
    didNotBat: Array<{ name: string; role: string }>;
    bowling: Array<{
      name: string;
      role: string;
      balls: number;
      overs: string;
      maidens: number;
      runs: number;
      wickets: number;
      dots: number;
      economy: number;
    }>;
  }>;
};

const formatOvers = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

export function scorecardFromIngestionPreview(
  preview: ScoreIngestionArtifactPreview,
  matchNumber: number,
  sourceUrl: string,
): PublishedScorecard {
  const innings = [
    { team: preview.firstInningsTeam, opposition: preview.secondInningsTeam, score: preview.firstInningsScore },
    { team: preview.secondInningsTeam, opposition: preview.firstInningsTeam, score: preview.secondInningsScore },
  ].map(item => {
    const teamPlayers = preview.players.filter(player => player.team === item.team)
      .sort((left, right) => left.battingOrder - right.battingOrder || left.name.localeCompare(right.name));
    const batting = teamPlayers.filter(player => player.dismissalText && player.dismissalText !== "did not bat").map(player => ({
      name: player.name,
      role: player.role,
      runs: player.runs,
      balls: player.balls,
      fours: player.fours,
      sixes: player.sixes,
      strikeRate: player.balls ? player.runs * 100 / player.balls : 0,
      notOut: player.dismissalText.toLocaleLowerCase() === "not out",
      dismissalText: player.dismissalText,
    }));
    const didNotBat = teamPlayers.filter(player => player.dismissalText === "did not bat")
      .map(player => ({ name: player.name, role: player.role }));
    const bowling = preview.players.filter(player => player.team === item.opposition && player.ballsBowled > 0)
      .sort((left, right) => left.bowlingOrder - right.bowlingOrder || left.name.localeCompare(right.name))
      .map(player => ({
        name: player.name,
        role: player.role,
        balls: player.ballsBowled,
        overs: formatOvers(player.ballsBowled),
        maidens: player.maidens,
        runs: player.runsConceded,
        wickets: player.wickets,
        dots: player.dots,
        economy: player.ballsBowled ? player.runsConceded * 6 / player.ballsBowled : 0,
      }));
    const inningsBalls = bowling.reduce((total, player) => total + player.balls, 0);
    return { team: item.team, score: item.score, overs: formatOvers(inningsBalls), batting, didNotBat, bowling };
  });

  return {
    matchNumber,
    result: preview.resultSummary,
    winnerTeam: preview.winnerTeam,
    playerOfMatch: preview.playerOfMatchName || "—",
    sourceUrl,
    innings,
  };
}
