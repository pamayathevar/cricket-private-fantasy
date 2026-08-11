# Match team-selection flow

Derived from the supplied Google Sheet's `League` tab.

## 1. Choose the IPL match

The owner opens the upcoming fixture. The app shows the scheduled lineup-lock time, transfers remaining, current valid lineup, and available boosters.

Every new match begins with the owner's most recently submitted valid XI carried forward automatically. The owner may alter and resubmit it before the new match's lock time. If no changes are made, the carried-forward XI remains active.

The planner always displays the next seven not-yet-started fixtures. As soon as a fixture reaches its scheduled start, it leaves the planner, moves to History, and the following scheduled fixture is appended so seven upcoming fixtures remain visible.

## 2. Build an 11-player team

The player picker includes the full eligible league pool, not only auction-owned players. Every player card shows:

- player name
- IPL team
- playing role
- match price
- ownership: Mine, Open, or the other owner's name
- whether selecting the player consumes a transfer
- any other-owner usage penalty
- unique-player restrictions

The screen continuously displays `Selected 0/11`, total cost, role counts, IPL-team counts, and transfers used.

## 3. Validate composition

A valid team must contain exactly 11 unique players and satisfy:

- minimum 2 batters
- minimum 2 bowlers
- minimum 1 wicketkeeper
- minimum 1 all-rounder
- maximum 7 players from one IPL team
- maximum ₹100m combined match price
- transfers within the current stage allowance

Selecting the owner's auction player does not consume a transfer. Selecting an eligible player outside the owner's auction squad does consume a transfer unless a booster overrides it.

## 4. Assign player markers

- one captain (`C`) for 2× points
- one vice-captain (`VC`) for 1.5× points
- optional Batting Impact (`BAI`) or Bowling Impact (`BOI`) marker
- optional Triple Impact (`3X`) where available

Unique-player and booster-combination restrictions are validated before submission.

Only one Impact marker may be selected per match: either BAI or BOI. BAI counts only batting points at 2×; BOI counts only bowling points at 2×. Fielding, winning-team, player-of-match, and all other bonus points are excluded for the Impact calculation. The Impact player cannot also be captain or vice-captain.

The app gives a non-blocking warning when BOI is assigned to a batter or wicketkeeper, or BAI is assigned to a bowler. All-rounders may use either marker. The owner may still submit after acknowledging the scoring consequence.

## 5. Select an optional match booster

The app shows only boosters still available for the relevant period. Incompatible combinations are disabled with an explanation.

## 6. Review and submit

The review screen separates validation into:

- **Errors:** submission is blocked.
- **Warnings:** submission is accepted, but the owner should review it.
- **Valid:** the lineup is ready.

The latest valid submission before scheduled match start becomes authoritative. If a later submission contains an error, it is rejected and the previous valid lineup remains active.

## 7. After match lock

The lineup becomes read-only. Before the scheduled start, it is private to its owner. At the scheduled start, every submitted owner's XI becomes visible to all owners in the private league. The app displays owner-by-owner lineups, player match points, deductions for using another owner's players, multipliers, booster effects, and match totals. An abandoned match scores zero and returns applicable transfers.

### Lineup privacy

- Before match start: only the submitting owner can view their full XI.
- At and after match start: all league owners can view every submitted XI for that match.
- Locked lineups cannot be changed.
- Owners who did not manually submit use their valid carried-forward XI.
- Commissioner access before lock must be restricted and recorded in the audit log.

## Mobile screens required

1. Upcoming match card
2. Player picker with filters
3. Selected XI and role/cost counters
4. Captain, vice-captain, and impact assignment
5. Booster picker
6. Validation and submission review
7. Locked lineup and points breakdown
8. History of submitted and locked lineups
