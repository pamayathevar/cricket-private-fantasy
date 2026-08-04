export type PointBreakdown = { batting: number; bowling: number; fielding: number; bonus: number; total: number };
export type PlayerMatchStats = { runs: number; balls: number; fours: number; sixes: number; playerIsBowler: boolean; dismissal?: "none" | "duck" | "golden-duck" | "diamond-duck" | "retired-out" | "retired-hurt"; bowlerWickets: number; nonBowlerWickets: number; ballsBowled: number; maxBalls: number; runsConceded: number; maidens: number; dots: number; catches: number; stumpings: number; runOuts: number; sharedRunOuts: number; playerOfMatch: boolean; winningXI: boolean };
const band = (value: number, values: Array<[number, number]>) => { let result = values[0][1]; for (const [minimum, points] of values) if (value >= minimum) result = points; return result; };
const milestone = (value: number) => band(value, [[0, 0], [25, 2], [50, 6], [75, 12], [100, 20], [125, 30], [150, 42], [175, 56], [200, 72], [225, 90]]);
const wicketMilestone = (wickets: number) => band(wickets, [[0, 0], [2, 2], [3, 6], [4, 12], [5, 20], [6, 30], [7, 42], [8, 56], [9, 72], [10, 90]]);
export function calculatePlayerPoints(stats: PlayerMatchStats): PointBreakdown {
  const strikeRate = stats.balls ? stats.runs * 100 / stats.balls : 0;
  const strikeRatePoints = stats.balls >= 10 || stats.runs >= 20 ? band(strikeRate, [[0, -12], [25, -8], [50, -4], [75, -2], [90, 0], [100, 2], [125, 4], [150, 8], [175, 14], [225, 22], [275, 32], [325, 44]]) : 0;
  const dismissalPoints = stats.playerIsBowler ? 0 : stats.dismissal === "golden-duck" || stats.dismissal === "diamond-duck" ? -4 : stats.dismissal === "duck" ? -2 : 0;
  const batting = stats.runs + stats.fours + stats.sixes * 2 + milestone(stats.runs) + strikeRatePoints + dismissalPoints;
  const overs = stats.ballsBowled / 6;
  const economy = overs ? stats.runsConceded / overs : 0;
  const economyPoints = stats.ballsBowled >= 6 ? band(economy, [[0, 44], [1, 32], [2, 22], [3, 14], [4, 8], [5, 4], [6, 2], [7, 0], [8, -2], [10, -4], [12, -8], [14, -12]]) : 0;
  const wickets = stats.bowlerWickets + stats.nonBowlerWickets;
  const noWicketPenalty = wickets === 0 && stats.ballsBowled >= stats.maxBalls ? -4 : wickets === 0 && stats.ballsBowled >= Math.min(12, stats.maxBalls / 2) ? -2 : 0;
  const wicketPoints = stats.bowlerWickets * 15 + stats.nonBowlerWickets * 20;
  const bowling = wicketPoints + wicketMilestone(wickets) + stats.maidens * 10 + stats.dots * 2 + economyPoints + noWicketPenalty;
  const fielding = stats.catches * 10 + stats.stumpings * 10 + stats.runOuts * 10 + stats.sharedRunOuts * 8;
  const bonus = (stats.playerOfMatch ? 15 : 0) + (stats.winningXI ? 2 : 0);
  return { batting, bowling, fielding, bonus, total: batting + bowling + fielding + bonus };
}
export function calculatePointDetails(stats: PlayerMatchStats) {
  const strikeRate = stats.balls ? stats.runs * 100 / stats.balls : 0;
  const strikeRatePoints = stats.balls >= 10 || stats.runs >= 20 ? band(strikeRate, [[0, -12], [25, -8], [50, -4], [75, -2], [90, 0], [100, 2], [125, 4], [150, 8], [175, 14], [225, 22], [275, 32], [325, 44]]) : 0;
  const dismissalPoints = stats.playerIsBowler ? 0 : stats.dismissal === "golden-duck" || stats.dismissal === "diamond-duck" ? -4 : stats.dismissal === "duck" ? -2 : 0;
  const wickets = stats.bowlerWickets + stats.nonBowlerWickets;
  const overs = stats.ballsBowled / 6;
  const economy = overs ? stats.runsConceded / overs : 0;
  const economyPoints = stats.ballsBowled >= 6 ? band(economy, [[0, 44], [1, 32], [2, 22], [3, 14], [4, 8], [5, 4], [6, 2], [7, 0], [8, -2], [10, -4], [12, -8], [14, -12]]) : 0;
  const noWicketPenalty = wickets === 0 && stats.ballsBowled >= stats.maxBalls ? -4 : wickets === 0 && stats.ballsBowled >= Math.min(12, stats.maxBalls / 2) ? -2 : 0;
  return {
    batting: [["Runs", stats.runs], ["Fours", stats.fours], ["Sixes", stats.sixes * 2], ["Run milestone", milestone(stats.runs)], ["Strike rate", strikeRatePoints], ["Dismissal", dismissalPoints]] as Array<[string, number]>,
    bowling: [["Bowler wickets", stats.bowlerWickets * 15], ["Non-bowler wickets", stats.nonBowlerWickets * 20], ["Wicket milestone", wicketMilestone(wickets)], ["Maidens", stats.maidens * 10], ["Dot balls", stats.dots * 2], ["Economy", economyPoints], ["No-wicket adjustment", noWicketPenalty]] as Array<[string, number]>,
    fielding: [["Catches", stats.catches * 10], ["Stumpings", stats.stumpings * 10], ["Run-outs", stats.runOuts * 10], ["Shared run-outs", stats.sharedRunOuts * 8]] as Array<[string, number]>,
    bonus: [["Player of the Match", stats.playerOfMatch ? 15 : 0], ["Winning team", stats.winningXI ? 2 : 0]] as Array<[string, number]>,
  };
}
export function applyFantasyMarkers(points: PointBreakdown, marker: "" | "C" | "VC" | "BAI" | "BOI") {
  if (marker === "C") return points.total * 2;
  if (marker === "VC") return points.total * 1.5;
  if (marker === "BAI") return points.batting * 2;
  if (marker === "BOI") return points.bowling * 2;
  return points.total;
}
export const match1Source = { id: "1527674", teams: "RCB vs SRH", result: "RCB won by 6 wickets", score: "SRH 201/9; RCB 203/4 (15.4 overs)", playerOfMatch: "Jacob Duffy", scorecardUrl: "https://www.cricinfo.com/series/ipl-2026-1510719/royal-challengers-bengaluru-vs-sunrisers-hyderabad-1st-match-1527674/full-scorecard" } as const;
