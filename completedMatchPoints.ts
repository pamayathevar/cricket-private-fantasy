import { squadPlayers } from "./squadData";
import { calculatePlayerPoints, PlayerMatchStats, PointBreakdown } from "./scoringRules";
import { match1PlayerPoints, match1Players } from "./match1Points";

type Bat = [string, number, number, number, number, PlayerMatchStats["dismissal"]?];
type Bowl = [string, number, number, string[], number, number?];
type MatchInput = { batting: Bat[]; bowling: Bowl[]; fielding: Record<string, number>; sharedRunOuts?: Record<string, number>; winners: string[]; potm: string };
const roles = Object.fromEntries(squadPlayers.map(player => [player.name, player.role]));
const milestoneDismissal = (name: string) => roles[name] === "BO";

function buildMatch(input: MatchInput) {
  const names = new Set([...input.batting.map(row => row[0]), ...input.bowling.map(row => row[0]), ...Object.keys(input.fielding), ...input.winners]);
  const batting = Object.fromEntries(input.batting.map(row => [row[0], row]));
  const bowling = Object.fromEntries(input.bowling.map(row => [row[0], row]));
  const stats = Object.fromEntries([...names].map(name => {
    const bat = batting[name] as Bat | undefined;
    const bowl = bowling[name] as Bowl | undefined;
    const victims = bowl?.[3] ?? [];
    const stats: PlayerMatchStats = {
      runs: bat?.[1] ?? 0, balls: bat?.[2] ?? 0, fours: bat?.[3] ?? 0, sixes: bat?.[4] ?? 0,
      playerIsBowler: milestoneDismissal(name), dismissal: bat?.[5] ?? "none",
      bowlerWickets: victims.filter(victim => milestoneDismissal(victim)).length,
      nonBowlerWickets: victims.filter(victim => !milestoneDismissal(victim)).length,
      ballsBowled: bowl?.[1] ?? 0, maxBalls: 24, runsConceded: bowl?.[2] ?? 0, dots: bowl?.[4] ?? 0, maidens: bowl?.[5] ?? 0,
      catches: input.fielding[name] ?? 0, stumpings: 0, runOuts: 0, sharedRunOuts: input.sharedRunOuts?.[name] ?? 0,
      playerOfMatch: name === input.potm, winningXI: input.winners.includes(name),
    };
    return [name, stats];
  })) as Record<string, PlayerMatchStats>;
  const points = Object.fromEntries(Object.entries(stats).map(([name, playerStats]) => [name, calculatePlayerPoints(playerStats)])) as Record<string, PointBreakdown>;
  return { points, stats };
}

const builtM2 = buildMatch({
  batting: [["Ajinkya Rahane",67,40,3,5],["Finn Allen",37,17,6,2],["Cameron Green",18,10,1,1],["Angkrish Raghuvanshi",51,29,6,2],["Rinku Singh",33,21,4,0],["Ramandeep Singh",4,4,0,0],["Ryan Rickelton",81,43,4,8],["Rohit Sharma",78,38,6,6],["Suryakumar Yadav",16,8,3,0],["Tilak Varma",20,14,4,0],["Hardik Pandya",18,11,3,0],["Naman Dhir",5,2,1,0]],
  bowling: [["Trent Boult",24,38,[],7],["Hardik Pandya",18,39,["Angkrish Raghuvanshi"],7],["AM Ghazanfar",24,51,[],6],["Jasprit Bumrah",24,35,[],4],["Shardul Thakur",24,39,["Ajinkya Rahane","Finn Allen","Cameron Green"],7],["Mayank Markande",6,16,[],1],["Vaibhav Arora",24,52,["Rohit Sharma"],8],["Blessing Muzarabani",18,34,[],6],["Varun Chakravarthy",24,48,[],5],["Kartik Tyagi",24,43,["Suryakumar Yadav"],9],["Sunil Narine",18,30,["Tilak Varma"],6],["Anukul Roy",7,15,[],1]],
  fielding: {"Hardik Pandya":1,"Tilak Varma":2,"Sherfane Rutherford":1,"Anukul Roy":2,"Rinku Singh":1,"Manish Pandey":1},
  winners: ["Ryan Rickelton","Rohit Sharma","Suryakumar Yadav","Tilak Varma","Hardik Pandya","Naman Dhir","Trent Boult","AM Ghazanfar","Jasprit Bumrah","Shardul Thakur","Mayank Markande"], potm:"Shardul Thakur"
});
const builtM3 = buildMatch({
  batting: [["Sanju Samson",6,7,1,0],["Ruturaj Gaikwad",6,11,1,0],["Ayush Mhatre",0,1,0,0,"golden-duck"],["Matthew Short",2,7,0,0],["Sarfaraz Khan",17,12,2,1],["Kartik Sharma",18,15,0,1],["Shivam Dube",6,4,0,1],["Jamie Overton",43,36,2,2],["Noor Ahmad",1,9,0,0],["Matt Henry",5,7,1,0],["Anshul Kamboj",7,10,1,0],["Yashasvi Jaiswal",38,36,3,1],["Vaibhav Sooryavanshi",52,17,4,5],["Dhruv Jurel",18,9,4,0],["Riyan Parag",14,11,1,1]],
  bowling: [["Jofra Archer",24,19,["Ruturaj Gaikwad","Noor Ahmad"],17],["Nandre Burger",24,26,["Sanju Samson","Ayush Mhatre"],14],["Brijesh Sharma",18,17,["Kartik Sharma"],10],["Sandeep Sharma",16,22,["Matthew Short"],3],["Ravi Bishnoi",18,16,["Matt Henry"],8],["Ravindra Jadeja",18,18,["Sarfaraz Khan","Shivam Dube"],11],["Matt Henry",18,40,[],2],["Khaleel Ahmed",18,17,[],10],["Anshul Kamboj",18,27,["Vaibhav Sooryavanshi","Dhruv Jurel"],8],["Noor Ahmad",12,24,[],4],["Jamie Overton",6,14,[],1],["Matthew Short",1,1,[],0]],
  fielding: {"Dhruv Jurel":2,"Yashasvi Jaiswal":1,"Ravi Bishnoi":2,"Sarfaraz Khan":1}, sharedRunOuts:{"Shimron Hetmyer":1,"Dhruv Jurel":1},
  winners:["Yashasvi Jaiswal","Vaibhav Sooryavanshi","Dhruv Jurel","Riyan Parag","Jofra Archer","Nandre Burger","Brijesh Sharma","Sandeep Sharma","Ravi Bishnoi","Ravindra Jadeja","Shimron Hetmyer"],potm:"Nandre Burger"
});
const builtM4 = buildMatch({
  batting: [["Sai Sudharsan",13,11,2,0],["Shubman Gill",39,27,6,0],["Jos Buttler",38,33,3,2],["Glenn Phillips",25,17,1,1],["Washington Sundar",18,16,2,0],["M Shahrukh Khan",4,6,0,0],["Rahul Tewatia",11,10,1,0],["Rashid Khan",0,1,0,0],["Priyansh Arya",7,8,0,1],["Prabhsimran Singh",37,24,1,4],["Cooper Connolly",72,44,5,5],["Shreyas Iyer",18,11,0,2],["Nehal Wadhera",3,6,0,0],["Shashank Singh",4,5,0,0],["Marcus Stoinis",0,2,0,0,"duck"],["Marco Jansen",9,10,0,1],["Xavier Bartlett",11,5,0,1]],
  bowling: [["Arshdeep Singh",24,42,[],9],["Xavier Bartlett",24,36,[],9],["Marco Jansen",24,20,["Sai Sudharsan"],8],["Vijaykumar Vyshak",24,34,["Glenn Phillips","Washington Sundar","M Shahrukh Khan"],8],["Yuzvendra Chahal",24,28,["Shubman Gill","Jos Buttler"],9],["Mohammed Siraj",12,15,[],6],["Kagiso Rabada",18,34,["Priyansh Arya"],7],["Ashok Sharma",18,31,["Marco Jansen"],8],["Rashid Khan",24,29,["Prabhsimran Singh"],10],["Washington Sundar",19,27,["Nehal Wadhera"],6],["Prasidh Krishna",24,29,["Shreyas Iyer","Shashank Singh","Marcus Stoinis"],11]],
  fielding:{"Shreyas Iyer":1,"Cooper Connolly":1,"Xavier Bartlett":1,"Marco Jansen":1,"Arshdeep Singh":2,"Ashok Sharma":1,"Prasidh Krishna":1,"Washington Sundar":1,"Shubman Gill":2,"Jos Buttler":1,"Rashid Khan":1},
  winners:["Priyansh Arya","Prabhsimran Singh","Cooper Connolly","Shreyas Iyer","Nehal Wadhera","Shashank Singh","Marcus Stoinis","Marco Jansen","Xavier Bartlett","Arshdeep Singh","Vijaykumar Vyshak","Yuzvendra Chahal"],potm:"Cooper Connolly"
});
const builtM5 = buildMatch({
  batting: [["Mitchell Marsh",35,28,2,3],["Rishabh Pant",7,9,1,0],["Aiden Markram",11,8,1,1],["Ayush Badoni",0,3,0,0,"duck"],["Nicholas Pooran",8,8,1,0],["Abdul Samad",36,25,3,1],["Mukul Choudhary",14,11,2,0],["Shahbaz Ahmed",15,16,1,0],["Mohammed Shami",1,2,0,0],["Anrich Nortje",0,1,0,0,"golden-duck"],["Mohsin Khan",0,1,0,0,"golden-duck"],["KL Rahul",0,1,0,0,"golden-duck"],["Pathum Nissanka",1,5,0,0],["Nitish Rana",15,17,2,1],["Sameer Rizvi",70,47,5,4],["Axar Patel",0,1,0,0,"golden-duck"],["Tristan Stubbs",39,32,3,1]],
  bowling: [["Mukesh Kumar",18,17,[],11],["Lungi Ngidi",22,27,["Nicholas Pooran","Anrich Nortje","Mohsin Khan"],9],["Axar Patel",18,17,["Aiden Markram"],9],["T Natarajan",24,29,["Ayush Badoni","Abdul Samad","Mohammed Shami"],8],["Kuldeep Yadav",24,31,["Mitchell Marsh","Mukul Choudhary"],8],["Vipraj Nigam",6,8,[],2],["Mohammed Shami",24,28,["KL Rahul"],12],["Prince Yadav",18,20,["Pathum Nissanka","Axar Patel"],10],["Mohsin Khan",24,19,["Nitish Rana"],15,1],["Anrich Nortje",24,39,[],7],["Shahbaz Ahmed",6,16,[],0],["Aiden Markram",6,13,[],2],["Abdul Samad",1,6,[],0]],
  fielding:{"Tristan Stubbs":2,"KL Rahul":1,"David Miller":1,"Kuldeep Yadav":2,"Mukesh Kumar":1,"Mohsin Khan":1,"Rishabh Pant":1,"Abdul Samad":1},
  winners:["KL Rahul","Pathum Nissanka","Nitish Rana","Sameer Rizvi","Axar Patel","Tristan Stubbs","Mukesh Kumar","Lungi Ngidi","T Natarajan","Kuldeep Yadav","Vipraj Nigam"],potm:"Sameer Rizvi"
});

export const completedMatchPoints: Record<string, Record<string, PointBreakdown>> = { M1: match1PlayerPoints, M2: builtM2.points, M3: builtM3.points, M4: builtM4.points, M5: builtM5.points };
export const completedMatchStats: Record<string, Record<string, PlayerMatchStats>> = {
  M1: Object.fromEntries(match1Players.map(({ name, ...stats }) => [name, stats])), M2: builtM2.stats, M3: builtM3.stats, M4: builtM4.stats, M5: builtM5.stats,
};
