import { calculatePlayerPoints, PointBreakdown, PlayerMatchStats } from "./scoringRules";

type MatchPlayer = PlayerMatchStats & { name: string };
const base = { balls: 0, fours: 0, sixes: 0, playerIsBowler: false, dismissal: "none" as const, bowlerWickets: 0, nonBowlerWickets: 0, ballsBowled: 0, maxBalls: 24, runsConceded: 0, maidens: 0, dots: 0, catches: 0, stumpings: 0, runOuts: 0, sharedRunOuts: 0, playerOfMatch: false, winningXI: false };
const p = (name: string, stats: Partial<PlayerMatchStats> & Pick<PlayerMatchStats, "runs">): MatchPlayer => ({ name, ...base, ...stats });

export const match1Players: MatchPlayer[] = [
  p("Travis Head", { runs: 11, balls: 9, fours: 2 }),
  p("Abhishek Sharma", { runs: 7, balls: 8, sixes: 1 }),
  p("Ishan Kishan", { runs: 80, balls: 38, fours: 8, sixes: 5 }),
  p("Nitish Kumar Reddy", { runs: 1, balls: 6, ballsBowled: 12, runsConceded: 19, dots: 5 }),
  p("Heinrich Klaasen", { runs: 31, balls: 22, fours: 2, sixes: 1, catches: 2 }),
  p("Salil Arora", { runs: 9, balls: 6, sixes: 1 }),
  p("Aniket Verma", { runs: 43, balls: 18, fours: 3, sixes: 4 }),
  p("Harsh Dubey", { runs: 3, balls: 3, ballsBowled: 18, runsConceded: 35, dots: 4, nonBowlerWickets: 1, catches: 1 }),
  p("Harshal Patel", { runs: 0, balls: 2, playerIsBowler: true, dismissal: "duck", ballsBowled: 16, runsConceded: 39, dots: 3 }),
  p("David Payne", { runs: 6, balls: 5, playerIsBowler: true, ballsBowled: 18, runsConceded: 35, dots: 5, nonBowlerWickets: 2 }),
  p("Jaydev Unadkat", { runs: 4, balls: 3, playerIsBowler: true, ballsBowled: 18, runsConceded: 29, dots: 6, nonBowlerWickets: 1, catches: 1 }),
  p("Eshan Malinga", { runs: 0, playerIsBowler: true, ballsBowled: 12, runsConceded: 35, dots: 3 }),
  p("Phil Salt", { runs: 8, balls: 7, fours: 2, catches: 3, winningXI: true }),
  p("Virat Kohli", { runs: 69, balls: 38, fours: 5, sixes: 5, catches: 1, winningXI: true }),
  p("Devdutt Padikkal", { runs: 61, balls: 26, fours: 7, sixes: 4, catches: 3, winningXI: true }),
  p("Rajat Patidar", { runs: 31, balls: 12, fours: 2, sixes: 3, winningXI: true }),
  p("Jitesh Sharma", { runs: 0, balls: 1, dismissal: "golden-duck", catches: 1, winningXI: true }),
  p("Tim David", { runs: 16, balls: 10, fours: 1, sixes: 1, winningXI: true }),
  p("Jacob Duffy", { runs: 0, playerIsBowler: true, ballsBowled: 24, runsConceded: 22, dots: 13, nonBowlerWickets: 3, playerOfMatch: true, winningXI: true }),
  p("Bhuvneshwar Kumar", { runs: 0, playerIsBowler: true, ballsBowled: 24, runsConceded: 31, dots: 9, bowlerWickets: 1, winningXI: true }),
  p("Abhinandan Singh", { runs: 0, playerIsBowler: true, ballsBowled: 18, runsConceded: 38, dots: 7, nonBowlerWickets: 1, catches: 1, winningXI: true }),
  p("Romario Shepherd", { runs: 0, ballsBowled: 24, runsConceded: 54, dots: 5, nonBowlerWickets: 3, winningXI: true }),
  p("Suyash Sharma", { runs: 0, playerIsBowler: true, ballsBowled: 18, runsConceded: 28, dots: 6, nonBowlerWickets: 1, winningXI: true }),
  p("Krunal Pandya", { runs: 0, ballsBowled: 12, runsConceded: 26, dots: 1, winningXI: true }),
];

export const match1PlayerPoints: Record<string, PointBreakdown> = Object.fromEntries(match1Players.map(player => [player.name, calculatePlayerPoints(player)]));
