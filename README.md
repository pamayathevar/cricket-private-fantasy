# Cricket Private Fantasy League MVP

A private, 10-owner IPL fantasy league mobile app.

## Project documentation

- [Product specification](SPEC.md)
- [Confirmed detailed rules](confirmed-rules.md)
- [Production readiness plan](PRODUCTION_READINESS.md)
- [Coding-agent steering guide](AGENTS.md)
- [Implementation audit](IMPLEMENTATION_AUDIT.md)
- [Prioritized implementation plan](IMPLEMENTATION_PLAN.md)
- [Configurable data model](DATA_MODEL.md)

## Run the prototype

Install Node.js 20.19 or newer, then run `npm install` and `npm start` in this directory. Use the Expo Go app or an iOS/Android simulator to open it. The prototype targets Expo SDK 54.

## Confirmed rules

- 10 owners, one fantasy franchise each
- Live player auction
- ₹100 million starting budget per owner
- Up to 30 unique players per squad
- Playing XI selected for each IPL match
- 105 transfers during the league stage and 4 during the playoffs
- Sheet-derived T20 scoring, configurable by the commissioner
- Captain scores 2× and vice-captain scores 1.5×
- Boosters are included; royalty points are excluded from the MVP

## MVP modules

1. Private league creation and invite-code joining
2. Live auction room with nominations, countdowns, bids, and commissioner controls — deferred/disabled for the current prototype
3. Squad, remaining budget, and roster validation
4. Per-match playing XI selection and deadline locking
5. Free-agent transfers with separate league-stage and playoff counters
6. Match points, corrections, and overall standings
7. Commissioner dashboard

The detailed lineup workflow is documented in [team-selection-flow.md](team-selection-flow.md).

## Recommended implementation

- Mobile: React Native with Expo and TypeScript
- Backend: Supabase (Postgres, authentication, realtime, and server functions)
- Match data: start with commissioner-entered/imported scorecards; connect a licensed cricket-data provider before public release

## Important auction safeguards

- A player can be owned by only one franchise.
- A bid cannot exceed the owner's spendable balance.
- Spendable balance reserves the minimum required amount for every empty squad slot.
- The server, not the phone, decides bid ordering and auction expiry.
- Reconnecting owners receive the authoritative auction state.
- Commissioner actions are logged and reversible where practical.

## Initial scoring preset

| Event | Points |
|---|---:|
| Run | 1 |
| Four bonus | 1 |
| Six bonus | 2 |
| Duck (eligible batters) | -2 |
| Golden/diamond duck | -4 |
| Wicket by a designated bowler | 15 |
| Wicket by a non-bowler | 20 |
| Maiden over | 10 |
| Dot ball | 2 |
| Four conceded | -1 |
| Six conceded | -2 |
| Catch | 10 |
| Stumping | 10 |
| Run-out | 10 |
| Shared run-out | 8 per involved fielder |
| Player of the match | 15 |
| Player in winning IPL XI | 2 |

Run milestones (25/50/75/100 and above), wicket milestones, strike-rate adjustments, and economy-rate adjustments follow the tier tables in the source Google Sheet. All values remain editable by the commissioner.

## Boosters included in the MVP

- Triple Impact (`3X`): one selected player earns 3× points; usable once.
- Double Up (`2UP`): doubles the full match total; usable twice during the league stage, once per 35-match period.
- Super Transfer (`SUP-TR`): unlimited transfers for one match, with the resulting team retained; usable once.
- Super Impact (`SUP-IMP`): selects one Batting Impact or Bowling Impact player. Only the selected discipline scores and is doubled. It cannot be combined with another player-level booster.
- Super Offer and Super User remain supported by the data model but default to zero availability, matching the sheet configuration.

Royalty points are excluded. Using another owner's non-unique player remains permitted with a deduction equal to the greater of 30% of that player's match points or 15 points.

## Auction and roster constraints

- Minimum purchases: 3 batters, 1 wicketkeeper, 3 all-rounders, and 3 bowlers.
- At least one purchased player from every IPL team.
- No more than three purchased players from one IPL team.
- Maximum 30 purchased players.
- Two active bidders are allowed at a time; an owner may re-enter after exiting when a bidder slot is available.
- Bid increment: ₹0.5m below ₹10m, ₹1m from ₹10m to ₹20m, and ₹2m above ₹20m.

## Playing XI constraints

- Exactly 11 players: minimum 2 batters, 2 bowlers, 1 wicketkeeper, and 1 all-rounder.
- Maximum seven players from one IPL team.
- ₹100m maximum playing-XI cost.
- Captain earns 2× and vice-captain earns 1.5×.
- The last valid lineup submitted before the scheduled start is used.
- An invalid submission is rejected and the previous valid lineup applies.
- Abandoned matches award no points and return applicable transfers.

## Product decisions still open

- App and league name/branding
- Auction timer length, bid increments, and nomination order
- Overseas-player restrictions, if any
- Whether owner-to-owner trades are allowed
- Match-data provider and automation level
- Tie-break rules and playoff format
