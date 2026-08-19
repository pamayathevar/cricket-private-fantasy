# Cricket Private Fantasy League — Help & User Guide

This guide explains how to build, submit, and follow a fantasy XI, including transfer chains, boosters, special-player formats, scoring, privacy, resubmission, and No Result settlement.

League settings can change by competition, phase, or fixture. The values shown on the selected fixture's **League** sheet and the live **Rules** page are authoritative. Examples in this guide explain behavior; they do not override fixture-effective configuration.

## Quick start

1. Open **League** and choose an upcoming fixture.
2. Select a valid XI within the displayed budget, role, IPL-team, ownership, and special-player limits.
3. Optionally assign Captain, Vice-Captain, Batting Impact, Bowling Impact, or one available booster.
4. Review **Match Transfers** and **Period Transfers**, then select **Submit XI** before lock.
5. A **SAVED** status confirms that the current match sheet is stored. Edit it before lock if you need to resubmit.

## Navigation

- **League** — choose a fixture, build the Selected XI, assign match roles, review transfers, and submit.
- **Ranking** — view the Overall table and each configured phase table.
- **Results** — review match records, revealed owner XIs, transfer records, and published point breakdowns.
- **Fixtures** — see match dates, opponents, lock/status, and your submission state.
- **Player Pool** — inspect every player belonging to this season, including temporarily deactivated players. Identities carried from another season are excluded, while their historical records remain preserved.
- **Owner Squads** — review auction ownership, squad points, and Unique or Marquee selections.
- **Chatroom** — see active league members, approximate online/last-seen status, and the private league conversation.
- **Rules** — see the live league format, lineup limits, scoring, phases, transfer periods, boosters, and special-player settings.
- **Help** — search or browse the in-app version of this guide.

### Members and league chatroom

- Online status is approximate. It refreshes through a server heartbeat while a signed-in member has the app active.
- Only active members of the selected league can read its member board or chat messages.
- Messages are plain text and limited to 500 characters. Server-side rate limits protect the room from accidental duplicate sends or spam.
- Type `@` and choose a member to tag them. Their name is highlighted, and an unread badge appears on **Chatroom** (and **More** on mobile).
- Choose **Everyone** after typing `@`, or type the exact tag `@everyone`, to notify every other active member in the selected league. A sender can use the broadcast once per minute.
- In the installed iOS or Android app, each member may opt in to private mention alerts. Chat messages without a tag do not send a push alert. Tapping an alert opens the correct league chat.
- Mention alerts require notification permission on the phone and a current native app build. If permission is blocked, in-app unread and mention badges still work.
- A member can remove their own message; a league administrator can moderate any message. A removed item remains marked in the conversation and the action is audited.

### Match reminders

Open **Fixtures → Match reminders** to choose a push alert 24 hours before
a fixture, 30 minutes before it, or both. These preferences apply only to the
selected league. Push reminders are enabled from the installed iOS or Android
app and tapping one opens the correct fixture.

Email reminders are optional. Their switches appear only after the league's
verified transactional email sender has been configured. Reminder timing uses
the official fixture start, and started, cancelled, or abandoned fixtures do
not send reminders.

On mobile, **Player Pool**, **Owner Squads**, **Chatroom**, **Help**, and **Rules** are under **More**.

## 1. Selected XI and eligibility

The Selected XI is your match sheet for one fixture.

- Select the required number of active, eligible players. IPL 2026 normally uses 11 players and a ₹100m lineup budget.
- The XI must satisfy the fixture-effective minimum Batters (`BA`), Bowlers (`BO`), Wicketkeepers (`WK`), and All-rounders (`AL`).
- It must also respect the maximum number of players from one IPL team and any ownership or special-player restrictions.
- The server revalidates budget, roles, team limits, ownership, C/VC, impact markers, boosters, and match lock. An invalid request is rejected and the last valid XI remains saved.
- Tap a Selected XI row to edit that player or their match roles. Use **×** only to remove the player.
- The summary shows cost, ownership mix, role mix, Match Transfers, and Period Transfers.
- A withdrawn or deactivated player cannot be selected for a future unlocked match. Historical XIs and published scores are preserved.
- An official replacement player enters the league as an active Open Player with a selection cost. Ownership changes only through the audited admin workflow.

### Ownership labels

- **Mine** — the player belongs to your auction squad.
- **Open** — no league owner currently owns the player.
- An owner's name — the player belongs to that owner but can be borrowed when the active league format permits it.

In an all-open league, auction ownership and auction prices are hidden. Every active eligible player is available, but configured transfer rules still apply.

## 2. Transfers and carry-forward

### Match Transfers

**Match Transfers** counts chargeable players entering the current XI compared with your previous valid submitted XI. It does not count the number of removals.

- Adding one of your own auction players is not charged in an ownership league.
- Adding an Open Player or another owner's player is charged when ownership is active.
- In an all-open league, incoming lineup changes are chargeable because there is no ownership exemption.
- A first actual valid submission in a period can be free when **First match free** is enabled.
- If you missed the nominal first match or it became No Result, the first actual valid submission can still receive that configured free submission.

### Period Transfers

**Period Transfers** is the total charged usage inside the active configured match range. Transfer periods cannot overlap or leave gaps in the configured sequence.

IPL 2026 currently uses:

| Period | Matches | Allowance | Free submission |
| --- | ---: | ---: | --- |
| League stage | 1–70 | 105 | Owner's first valid XI in the period |
| Playoffs | 71–74 | 4 | Owner's first valid XI in the period |

Always check **Rules** in case an administrator publishes a future effective version.

### Submission order

- An earlier scheduled match that is still open must be submitted before a later fixture.
- A missed earlier fixture whose lock has passed is skipped and does not permanently block later submission.
- The latest valid submitted XI automatically becomes the starting XI for the next match.
- That carried XI remains editable until the next fixture locks.
- Players carry forward; boosters never do.

## 3. Submit, edit, resubmit, and lock

### First submission

When the XI is valid, select **Submit XI**. **SAVED** is confirmation, not an action button.

### Editing before lock

Tap a player to change the XI or its match roles. After a saved XI changes, the action becomes **Resubmit XI**. Review the new transfer effect and confirm before lock.

### Resubmitting an earlier fixture

When an earlier fixture is resubmitted before lock:

1. The revised valid XI replaces that fixture's prior submission.
2. Every later submitted XI that is still unlocked is reset.
3. Transfers and boosters charged to those reset XIs are refunded.
4. The revised earlier XI becomes the carry-forward baseline.
5. The later fixtures must be reviewed and submitted again in sequence.

The confirmation warning explains this effect before the resubmission proceeds.

Normal resubmission cannot change an earlier XI after a later submitted XI has locked. A No Result settlement is the controlled exception: it preserves the later locked players and recalculates only their transfer baseline.

### Match lock

Locking uses server time for the fixture. After lock, the XI, Captain, Vice-Captain, BAI/BOI, and booster cannot be edited.

If an active owner does not submit a new XI before lock, their latest eligible valid XI is automatically carried into the locked fixture. Results labels it **AUTO / CARRIED**, charges zero match transfers, and does not copy a booster. An owner with no earlier valid XI has nothing to carry and therefore has no team for that fixture. Before scores are published, the server materializes these carried XIs so scoring, rankings, ownership usage, and audit records all use the same effective team shown in Results.

## 4. Captain, Vice-Captain, and Impact roles

All four roles are optional. A valid XI can be submitted without them.

- **C (Captain)** — normally 2× the player's eligible full contribution.
- **VC (Vice-Captain)** — normally 1.5× the player's eligible full contribution.
- **BAI (Batting Impact)** — normally 2× batting points only.
- **BOI (Bowling Impact)** — normally 2× bowling points only.

Rules:

- Captain and Vice-Captain must be different players.
- C or VC cannot be combined with BAI or BOI on the same player.
- The Impact player must be different from both C and VC.
- BAI does not double bowling, fielding, or unrelated bonuses.
- BOI does not double batting, fielding, or unrelated bonuses.
- Borrowed Unique or automatically Unique players can restrict C, VC, BAI, BOI, or `3X`. Their owning owner can use the roles permitted by live Rules.

## 5. Boosters

Only one booster can be active in one match. `3X`, `2UP`, and `SUP-TR` cannot be combined.

### 3X — Triple Impact

- Normally available once across the league.
- Targets one selected player.
- Multiplies eligible points by 3.
- Stacks multiplicatively: C+3X = 6×, VC+3X = 4.5×, BAI+3X = 6× batting only, and BOI+3X = 6× bowling only.

### 2UP — Double Up

- Doubles the owner's final match total after player contributions and ownership adjustments.
- IPL 2026 permits one use in Phase 1 and one use in Phase 2.
- It is unavailable in Phase 3 / Playoffs.

### SUP-TR — Super Transfer

- Normally available once across all phases.
- Removes the match transfer limit for that one fixture.
- It does not remove lineup, ownership, role, or special-player validation.
- The submitted XI becomes the normal carry-forward baseline.

Boosters apply only to the submitted fixture. The next fixture always starts without a booster. Resetting an unlocked XI or settling its fixture as No Result returns that fixture's booster usage.

## 6. Ownership formats and special players

### Standard ownership fee / Unique-player league

- Another owner's eligible player can be selected.
- The borrowing owner's credited contribution is reduced by the configured greater-of percentage or minimum fee.
- The current confirmed default is the greater of 30% or 15 points: 100 becomes 70, while 0 becomes −15.
- Negative player or owner totals are valid when penalties or a minimum borrowing fee exceed positive points.

In a Unique-player-driven league:

- Each owner normally chooses exactly two owned Unique Players per phase.
- All owners may still select them.
- Their owning owner may use C, VC, BAI, BOI, or `3X` when otherwise valid.
- A borrowing owner cannot use those restricted power roles and still pays the configured other-player fee.
- Royalty is disabled.

### Royalty / Marquee league

- Each owner normally chooses exactly two owned Marquee Players per phase.
- A borrower keeps 100% of the credited player contribution.
- The owning owner receives a separate royalty credit; using your own player never creates royalty.
- Current defaults are the greater of 5% or 5 points for a regular borrowed player, and the greater of 15% or 15 points for a Marquee Player.
- The minimum royalty can apply even when the credited contribution is zero or negative, but royalty itself is never negative.
- Each borrower's royalty is rounded immediately to a whole point before credits are summed.
- The royalty base includes that borrower's applicable C, VC, BAI/BOI, `3X`, or `2UP` result.

### Automatic Unique status

In Royalty mode, a player accumulates qualifying usage only when another owner includes that player in a locked XI for a scored fixture involving the player's IPL team. The owning owner's own XI, fixtures between other IPL teams and No Result fixtures do not count. With the default threshold of 56 qualifying borrowed appearances:

- the 57th qualifying borrowed appearance triggers automatic Unique status starting with the next match;
- locked and published matches are never recalculated;
- other owners can still select that player but cannot use the restricted power roles;
- the owning owner can use those roles when otherwise valid;
- Marquee status and its higher royalty rate can remain active at the same time.

### Phase selection windows

- A later non-playoff phase's selection window opens when the preceding phase starts.
- It normally closes 24 hours before the later phase's first fixture.
- If no valid change is submitted, the previous phase's selections carry forward.
- The final/playoff phase does not permit a new Unique or Marquee selection.
- Injured, withdrawn, or deactivated Unique/Marquee Players cannot be replaced mid-phase unless live Rules explicitly permit it.

## 7. Scoring and ranking

Player totals use the fixture-effective batting, bowling, fielding, bonus, milestone, strike-rate, and economy rules shown in **Rules**.

The explainable calculation order is:

1. Calculate the player's base cricket contribution.
2. Apply the valid C, VC, BAI, BOI, and `3X` effects.
3. Apply the active ownership-format deduction or royalty calculation.
4. Sum the owner's match result and apply `2UP` where selected.
5. Review and publish the score.

Additional rules:

- Negative player and owner totals are valid.
- Ranking changes only from published scores.
- Overall Ranking includes every published scored fixture.
- A phase table includes only fixtures assigned to that configured phase.
- Rank and points-behind values update after publication or an audited correction.
- Every match retains the playing and scoring version effective for it. A later rules update never silently rewrites a locked or published result.

## 8. Privacy and Results

- You can always see your own saved XI.
- When lineup privacy is enabled, other owners cannot see it before lock.
- At lock, eligible submitted XIs become visible to active members of the private league.
- **Results** clearly groups information by fixture and then by owner XI.
- Published player rows show the team, role, owner label, markers, base points, and credited points.
- A No Result fixture remains in history for audit purposes but contributes zero points, no match rank, and no matches-scored count.

## 9. Cancelled, abandoned, or No Result fixtures

An active league administrator settles a rain-affected, abandoned, or cancelled fixture as **No Result**. Settlement is one audited transaction and is safe against an accidental repeat.

### What is returned

- Every submitted owner scores zero and receives no match rank.
- The fixture is excluded from Overall and phase matches-scored counts.
- Its XI is cancelled and cannot carry forward.
- Its charged transfers return to the period allowance.
- Its booster returns to the owner's available usage.

### What happens to later fixtures

For each owner who submitted the No Result fixture:

- every later submitted XI that is still unlocked is reset;
- those reset XIs also return their charged transfers and boosters;
- the next unlocked fixture starts from the latest surviving valid XI;
- an owner who skipped the No Result fixture is not reset or recharged.

### Edge case: the next match already locked

Suppose Match 4 and Match 5 occur on the same day. Match 5 locks before Match 4 is declared No Result.

1. Match 4's XI is cancelled and its transfer/booster usage is returned.
2. Match 5's players, C/VC, BAI/BOI, and booster stay exactly as submitted because Match 5 is locked.
3. Match 5's old transfer charge is removed.
4. Match 5 transfers are recalculated by comparing the latest valid XI before Match 4—Match 3 in this example—directly with the locked Match 5 XI.
5. Match 5 becomes the valid carry-forward baseline for later fixtures.
6. Match 6 and any other later unlocked submitted XIs are reset and must be submitted again.

If Match 5 had not locked, it would be reset and the next submission would start from the valid Match 3 XI.

Full operational details are in [No Result fixture settlement](./no-result-settlement.md).

## 10. Current IPL 2026 defaults

These are the confirmed defaults for the current IPL 2026 league. The live **Rules** page still takes priority.

- Private owner capacity: 10; current imported active owners: 9.
- Auction budget: ₹100m per owner.
- Auction squad capacity: maximum 30 players.
- Match XI: 11 players with a ₹100m lineup budget and configured role/IPL-team limits.
- Captain: 2×; Vice-Captain: 1.5×; BAI/BOI: 2× for the selected discipline.
- Phase 1: Matches 1–35.
- Phase 2: Matches 36–70.
- Phase 3 / Playoffs: Matches 71–74.
- League-stage transfers: 105 for Matches 1–70, with the owner's first valid submission free.
- Playoff transfers: 4 for Matches 71–74, with the owner's first valid submission free.
- `3X`: once across all phases.
- `2UP`: once in Phase 1 and once in Phase 2; unavailable in Phase 3.
- `SUP-TR`: once across all phases.
- Boosters never carry forward.

## 11. League administration and rule versions

Administrators responsible for match scoring should follow [Administrator guide: capture, review, and publish match scores](./ADMIN_SCORE_PUBLISHING_GUIDE.md). It includes the one-time Chrome extension setup, exact capture and publication buttons, Cricbuzz fielder validation, the required review checklist, correction flow, and troubleshooting.

- Only an active `league_admin` can publish rule/configuration changes or settle scoring.
- Owners have read-only access to active Rules.
- League format, ownership, lineup limits, scoring, phases, transfer periods, boosters, Unique/Marquee, royalty, and automatic-Unique settings are league-specific.
- Playing, scoring, and special-player changes create a new version with an **Effective from match** value.
- Started, locked, and published fixtures retain the rule version already applicable to them.
- Active phase ranges cannot overlap.
- Transfer periods must cover the configured sequence without overlaps or gaps.
- Administrative publications and No Result settlements write audit records.
- For a match that already has a saved Cricinfo review, choose **Regenerate saved scorecard** on its Match Scoring card. The admin screen reuses the four captured tables stored in the immutable batch, applies the rules effective for that fixture, and opens a new human-readable preview. No terminal or local capture file is required, and nothing is staged or published automatically.
- For the first Cricinfo import, use **Import score source → Provider URL** with the Chrome extension. If the extension is unavailable, use **Scorecard capture** and paste the four Full Scorecard tables. Verify every total and use the alias field only when the app reports an unresolved source name.
- An Impact or concussion substitute who appears in the official batting or bowling table receives the normal points for those contributions. A fielding-only substitute receives catch, stumping, or run-out points only when **Playing Rules → Substitute fielder points** is enabled; the default is OFF.
- If an official scorecard resolves 13 or more participants for one team, preview generation continues with a warning. The administrator must verify the extra participant, explain the exception in the required approval notes, and then explicitly stage the review. Fewer than 11 core participants remain an import error.
- If the app was not running when capture finished, start it and retry from the saved file: `npm run score:fetch -- --capture ".local/score-imports/<capture-file>.json" --app-url http://localhost:8081`. Use the port printed by Expo if it is not `8081`.

## Frequently asked questions

### Why is SAVED not tappable?

**SAVED** confirms that the current XI is stored. Change a player or match role to enable **Resubmit XI**.

### Why is my transfer count lower than the number of player changes?

Match Transfers counts chargeable incoming players, not removals. Your own players are exempt in an ownership league, and a free first submission or `SUP-TR` can reduce the displayed charge to zero.

### What happens when I resubmit an earlier match?

Every later submitted XI that is still unlocked is reset, its charged transfers and booster are refunded, and the revised XI becomes the carry-forward baseline. Submit the later fixtures again in order.

### Can I resubmit when a later match has locked?

No. Normal resubmission cannot rewrite a chain with a later locked XI. No Result settlement is the controlled exception; it preserves the locked later team and recalculates only its transfer baseline.

### What if I did not submit the cancelled match?

Your later XI and transfer records are untouched. No Result settlement changes only owners whose lineup chain used that fixture.

### Does a booster carry forward?

No. Players may carry forward, but every fixture starts with no booster selected.

### Why did an other-owner player score negative points?

The configured minimum borrowing fee may exceed the player's positive contribution. With the current 15-point minimum, zero becomes −15.

### When can other owners see my XI?

When lineup privacy is enabled, they cannot see it until the fixture locks.

### Why can I not submit a later fixture?

An earlier open fixture may require a submitted XI first. Open the indicated match, submit it, and return. A genuinely missed earlier match is skipped after its lock passes.

### Can an injured Unique or Marquee Player be replaced immediately?

Not under the confirmed default. The player remains fixed for the current phase and can change only in the next eligible selection window. The playoff phase does not allow a change.

### Which rule value should I trust?

Use the values displayed on the selected fixture's **League** sheet and live **Rules** page. They take priority over examples and defaults in this guide.
