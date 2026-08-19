# Points calculation source

- Match source: Cricinfo full scorecard, match ID `1527674`.
- Rules source: Google Sheet tab `Play Rules and Points(T20)`.
- League standings and owner totals start at zero before Match 1 is processed.
- Match 1: SRH 201/9; RCB 203/4 in 15.4 overs; RCB won by six wickets; Jacob Duffy was Player of the Match.
- Captain: complete score ×2. Vice-captain: complete score ×1.5.
- BAI: doubled batting points only. BOI: doubled bowling points only. Fielding and bonus points are excluded for Impact selections.
- A wicket is worth 15 points when the dismissed player is a bowler and 20 points when the dismissed player is a non-bowler. The wicket-taker's own role does not change this value.
- An additional 10-point direct-wicket bonus applies when no fielder assists the bowler, including bowled, LBW and hit-wicket dismissals. It does not apply to any caught dismissal (including caught-and-bowled) or to stumpings. A caught-and-bowled dismissal receives the normal wicket value plus the configured catch points only.
- Duck and golden/diamond-duck deductions apply only to batters, wicketkeepers and all-rounders. A player classified as a bowler receives no duck deduction.
- League exception: `retired out` is treated exactly like `retired hurt`. The batter retains earned batting points, is not charged a duck/dismissal penalty, and no bowler or fielder receives wicket points.
- Publish totals only after the Cricinfo scorecard is final, retaining the match ID and calculation timestamp for auditing.

The scorecard supplies the runs, balls, batting boundaries, wickets, overs, runs conceded, maidens and dot-ball information required by the current rules. There is no points deduction for fours or sixes conceded by a bowler.
