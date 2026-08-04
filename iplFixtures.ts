export type FixtureStatus = "Calculated" | "Upcoming";
const rows: Array<[string, string]> = [
  ["Mar 28","SRH vs RCB"],["Mar 29","KKR vs MI"],["Mar 30","CSK vs RR"],["Mar 31","GT vs PBKS"],["Apr 1","LSG vs DC"],
  ["Apr 2","SRH vs KKR"],["Apr 3","CSK vs PBKS"],["Apr 4","MI vs DC"],["Apr 4","RR vs GT"],["Apr 5","SRH vs LSG"],
  ["Apr 5","RCB vs CSK"],["Apr 6","KKR vs PBKS"],["Apr 7","RR vs MI"],["Apr 8","GT vs DC"],["Apr 9","KKR vs LSG"],
  ["Apr 10","RCB vs RR"],["Apr 11","SRH vs PBKS"],["Apr 11","CSK vs DC"],["Apr 12","LSG vs GT"],["Apr 12","RCB vs MI"],
  ["Apr 13","SRH vs RR"],["Apr 14","CSK vs KKR"],["Apr 15","LSG vs RCB"],["Apr 16","MI vs PBKS"],["Apr 17","KKR vs GT"],
  ["Apr 18","RCB vs DC"],["Apr 18","SRH vs CSK"],["Apr 19","RR vs KKR"],["Apr 19","PBKS vs LSG"],["Apr 20","MI vs GT"],
  ["Apr 21","SRH vs DC"],["Apr 22","RR vs LSG"],["Apr 23","CSK vs MI"],["Apr 24","GT vs RCB"],["Apr 25","DC vs PBKS"],
  ["Apr 25","RR vs SRH"],["Apr 26","CSK vs GT"],["Apr 26","KKR vs LSG"],["Apr 27","DC vs RCB"],["Apr 28","PBKS vs RR"],
  ["Apr 29","MI vs SRH"],["Apr 30","RCB vs GT"],["May 1","RR vs DC"],["May 2","MI vs CSK"],["May 3","SRH vs KKR"],
  ["May 3","PBKS vs GT"],["May 4","LSG vs MI"],["May 5","DC vs CSK"],["May 6","SRH vs PBKS"],["May 7","LSG vs RCB"],
  ["May 8","DC vs KKR"],["May 9","GT vs RR"],["May 10","LSG vs CSK"],["May 10","MI vs RCB"],["May 11","PBKS vs DC"],
  ["May 12","GT vs SRH"],["May 13","KKR vs RCB"],["May 14","PBKS vs MI"],["May 15","CSK vs LSG"],["May 16","KKR vs GT"],
  ["May 17","RCB vs PBKS"],["May 17","RR vs DC"],["May 18","CSK vs SRH"],["May 19","LSG vs RR"],["May 20","MI vs KKR"],
  ["May 21","GT vs CSK"],["May 22","SRH vs RCB"],["May 23","LSG vs PBKS"],["May 24","RR vs MI"],["May 24","DC vs KKR"],
];
export const iplFixtures = rows.map(([date, teams], index) => ({ id: `M${index + 1}`, number: index + 1, date, teams, status: (index < 5 ? "Calculated" : "Upcoming") as FixtureStatus }));
