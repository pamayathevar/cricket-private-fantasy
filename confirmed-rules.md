# Confirmed app rules

Source: the supplied `Copy of IPL2026` Google Sheet plus the owner's decisions.

The live-auction module is temporarily disabled in the mobile navigation and deferred to a later phase.

## Owner decisions overriding the sheet or earlier prototype

- Squad capacity: maximum 30 players.
- Transfers: 105 during the league stage and 6 during playoffs.
- Include boosters.
- Exclude royalty points from the MVP.

## Retained sheet rules

- Ten private owners and a ₹100m auction budget per owner.
- Live auction with two active bidder positions.
- Role-based auction purchase requirements and IPL-team limits.
- An 11-player match lineup with role, team-count, and ₹100m cost validation.
- Captain 2× and vice-captain 1.5×.
- Another owner's eligible player can be used with the greater-of-30%-or-15-points deduction.
- Sheet-defined T20 event, milestone, strike-rate, and economy-rate scoring.
- Invalid lineups are rejected; the latest valid lineup is retained.
- The latest valid submitted XI automatically carries forward as the starting XI for the next match and remains editable until that match locks.
- Submitted XIs are private before match start. At the scheduled start, all locked owner lineups become visible to every owner in the private league.
- Each match permits one optional Impact player, marked as either BAI or BOI. Only the selected batting or bowling discipline scores at 2×; fielding and other bonuses do not score for that Impact calculation. The Impact player cannot be captain or vice-captain.
- Abandoned matches score zero and return applicable transfers.

## Implementation assumption requiring later confirmation

“Include only boosters” is interpreted as including boosters but excluding the royalty-points mechanism. The other-owner usage penalty remains active.

## Current league data imported from the Sheet

- The app supports 10 owner slots, but the current Sheet contains 9 active owners: Bala, Jeba, Johny, Mansur, Murali, Pandiyan, Saravana, Sashi, and Tamil.
- The `Squad` tab contains 192 currently assigned player records.
- Current overall ranking: Pandiyan, Sashi, Jeba, Saravana, Johny, Tamil, Murali, Mansur, and Bala.
- Prototype identity and sample auction player now use Sheet data rather than placeholder names.
