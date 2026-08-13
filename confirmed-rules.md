# Confirmed app rules

Source: the supplied `Copy of IPL2026` Google Sheet plus the owner's decisions.

The live-auction module is temporarily disabled in the mobile navigation and deferred to a later phase.

## Owner decisions overriding the sheet or earlier prototype

- Squad capacity: maximum 30 players.
- Transfers are configured as match-range periods. IPL 2026 currently uses 105 for Matches 1–70 (Match 1 free) and 4 for Matches 71–74 (Match 71 free).
- Include boosters.
- Exclude royalty points from the MVP.

## Retained sheet rules

- Ten private owners and a ₹100m auction budget per owner.
- Live auction with two active bidder positions.
- Role-based auction purchase requirements and IPL-team limits.
- An 11-player match lineup with role, team-count, and ₹100m cost validation.
- Captain 2× and vice-captain 1.5× when selected. Captain, Vice-Captain, BAI and BOI are all optional; an owner may submit a valid XI without any of these markers.
- Another owner's eligible player can be used with the greater-of-30%-or-15-points deduction.
- Sheet-defined T20 event, milestone, strike-rate, and economy-rate scoring.
- Invalid lineups are rejected; the latest valid lineup is retained.
- The latest valid submitted XI automatically carries forward as the starting XI for the next match and remains editable until that match locks.
- Submitted XIs are private before match start. At the scheduled start, all locked owner lineups become visible to every owner in the private league.
- Each match permits one optional Impact player, marked as either BAI or BOI. Only the selected batting or bowling discipline scores at 2×; fielding and other bonuses do not score for that Impact calculation. The Impact player cannot be captain or vice-captain.
- BAI/BOI and C/VC are mutually exclusive on the same player. A player marked C or VC cannot receive BAI or BOI, and an Impact player cannot receive C or VC.
- A fixture marked abandoned or cancelled is settled as **No Result**: owners score zero with no match rank, its transfers and booster usage are returned, and its XI does not carry forward. For each owner who submitted that fixture, every later submitted XI that is still unlocked is reset. A later locked XI is never changed, but the first surviving locked XI's transfer charge is recalculated against the latest valid XI before the No Result fixture; that locked XI then becomes the normal carry-forward baseline. For example, if Match 4 is void after Match 5 locks, Match 5's players stay fixed, its transfers are recalculated from Match 3, and later submissions carry forward from Match 5. If no later XI has locked, the next submission carries forward from Match 3. Owners who skipped Match 4 are unaffected.

## Confirmed boosters

- Only one booster may be activated for a match. `3X`, `2UP`, and `SUP-TR` cannot be combined with one another.
- `3X` Triple Impact may be used once across all phases. It targets one selected player and multiplies eligible points by 3. It may stack multiplicatively with Captain (`6×`), Vice-Captain (`4.5×`), BAI (`6×` batting only), or BOI (`6×` bowling only).
- `2UP` Double Up may be used twice: once during Phase 1 (matches 1–35) and once during Phase 2 (matches 36–70). It doubles the owner's final total for that match.
- `SUP-TR` Super Transfer may be used once across all phases. It permits unlimited player transfers for that match, and the resulting submitted XI carries forward.
- Phase 3 consists of matches 71–74 and does not permit `2UP`.
- Boosters never carry forward. A submitted booster applies only to that fixture; the XI may carry forward, but the next fixture always starts with no booster selected.

## League phases and rankings

- Phase definitions are configurable for each league; they are not fixed globally in application code.
- IPL 2026 has Phase 1 for matches 1–35, Phase 2 for matches 36–70, and Phase 3 / Playoffs for matches 71–74.
- Active phase match ranges cannot overlap.
- League Ranking shows an Overall ranking across every published match and a separate ranking for each configured phase.
- Future competitions can use different phase names, counts and match ranges by configuring `league_phases` before importing fixtures.

## League administration

- Only active `league_admin` members can see the League Admin tab or publish rule changes.
- Rule edits publish new playing-rule and points-rule versions; previously published match calculations retain their original version.
- Publishing both rule sets is transactional and writes an administrative audit event.
- Playing and Points rule versions each have an independently configurable Effective from match. Started matches retain the version already applicable to them.
- Client and server lineup validation resolve the same fixture-effective Playing Rules version. Point processing resolves and stores the fixture-effective Points Rules version.

## Implementation assumption requiring later confirmation

“Include only boosters” is interpreted as including boosters but excluding the royalty-points mechanism. The other-owner usage penalty remains active.

## Confirmed future league modes

- A Unique-player-driven league lets each owner choose exactly two owned Unique Players per phase. Those players remain selectable by all owners. Their owning owner may apply C, VC, BAI, BOI or `3X`; borrowing owners cannot. Using another owner's player deducts the greater of 30% of the player's final contribution or 15 points; therefore 100 becomes 70 and 0 becomes -15. Royalty is disabled.
- A Royalty-driven league lets each owner choose exactly two owned Marquee Players per phase. Other-owner usage keeps 100% of its final credited player contribution and adds royalty to the owning owner: the greater of 5% or 5 points for a regular player, and the greater of 15% or 15 points for a Marquee Player.
- The royalty base includes the borrowing owner's applicable C, VC, BAI/BOI, `3X` or `2UP` result. `3X`, `2UP` and `SUP-TR` remain mutually exclusive match boosters.
- Royalty is never negative, but its configured minimum applies even when final credited player points are zero or negative: 5 points for a regular player and 15 points for a Marquee Player by default. Each borrowing owner's royalty credit is rounded immediately to a whole point before credits are summed.
- In Royalty mode, only locked-XI appearances by borrowing owners in scored fixtures involving the player's IPL team count toward Automatic Unique. The owning owner's use, fixtures between other IPL teams and No Result fixtures do not count. On the 57th qualifying borrowed appearance, the player becomes automatically Unique starting with the next match. Other owners can still select the player but cannot apply C, VC, BAI, BOI or `3X`; the owning owner can. Marquee status and its 15% rate may continue.
- Unique/Marquee changes for a later non-playoff phase open only when the preceding phase starts and close 24 hours before that phase's first match. Future phases cannot be edited early. If no valid change is submitted, the previous selections carry forward. The final/playoff phase never permits changes; the preceding phase's selections carry forward automatically.
- Injured, withdrawn or deactivated Unique/Marquee Players cannot be replaced during their current phase. They may be changed only in the next eligible phase-selection window; playoff carry-forward remains mandatory.
- Unique, Marquee, royalty and automatic-Unique values are configurable in League Rules by league admins. Defaults preserve the confirmed values above. Changes are versioned with an effective-from match, apply only to future unlocked matches, revalidate affected unlocked submissions, and never silently recalculate locked or published matches. Owners can view these settings but cannot edit them.

## Official squad changes

- Squad imports preserve historical player, ownership, lineup and scoring records.
- A player marked Withdrawn by the configured squad source is deactivated only for the affected league/season and cannot be selected in future lineups.
- A replacement player is added as an active OpenPlayer with a league selection cost. Ownership changes only through the existing audited league-admin player-edit workflow.

## Current league data imported from the Sheet

- The app supports 10 owner slots, but the current Sheet contains 9 active owners: Bala, Jeba, Johny, Mansur, Murali, Pandiyan, Saravana, Sashi, and Tamil.
- The `Squad` tab contains 192 currently assigned player records.
- Current overall ranking: Pandiyan, Sashi, Jeba, Saravana, Johny, Tamil, Murali, Mansur, and Bala.
- Prototype identity and sample auction player now use Sheet data rather than placeholder names.
