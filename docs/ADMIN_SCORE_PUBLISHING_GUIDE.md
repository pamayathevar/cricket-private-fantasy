# Administrator guide: capture, review, and publish match scores

This guide is for a Cricket Rivalries league administrator using Google Chrome on a desktop computer. It covers the complete supported path from an ESPNcricinfo Full Scorecard to published fantasy points.

The workflow has three separate safety steps:

1. **Capture** reads the visible scorecard and creates a preview.
2. **Stage for review** saves the verified calculation without changing Results or Ranking.
3. **Publish scores → Confirm publish now** applies the staged points to owner XIs and updates league rankings.

The Chrome extension cannot access the database, stage a review, or publish a score. Only a signed-in `league_admin` can perform the last two steps in the app.

## Before you start

You need:

- desktop Google Chrome;
- the released `browser-extension` folder supplied by the league operator;
- an active Cricket Rivalries account with the `league_admin` role;
- the ESPNcricinfo and Cricbuzz series pages, configured once for the league; or the exact match URLs as a manual fallback.

Wait until the official scorecard is complete before publishing. Do not publish a live, incomplete, or provisional scorecard.

## 1. Install the Chrome extension once

Repeat this section on every computer or Chrome profile that an administrator will use.

1. Extract the supplied extension package if it is zipped. Keep all files together inside the `browser-extension` folder.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** in the top-right corner.
4. Select **Load unpacked**.
5. Choose the `browser-extension` folder itself, not the repository root or an individual file.
6. Confirm that **Cricket Rivalries Scorecard Capture** appears and is enabled. The current released manifest version is `0.3.1`.
7. Open or reload [Cricket Rivalries League](https://cricketrivalriesleague.com), sign in, and open the correct league.
8. Go to **Rules → Match Scoring**, open a match with **Import score source**, and paste an ESPNcricinfo URL.
9. Confirm that the dialog says **Browser capture extension connected**.

The extension is now ready. Pinning its toolbar icon is optional; capture is started from the Cricket Rivalries admin screen.

### Updating the extension

When the league operator supplies a newer extension folder:

1. replace the old folder with the supplied version;
2. open `chrome://extensions`;
3. select **Reload** on the Cricket Rivalries extension card;
4. reload the Cricket Rivalries admin page;
5. confirm **Browser capture extension connected** before the next import.

Do not install an extension folder received from an untrusted source and do not add database keys or passwords to its files.

## 2. Configure both series once

Do this once when a league is created, or repeat it when a provider changes its series page.

1. Go to **Rules → Match Scoring** and find **Automatic scorecard URLs**.
2. Paste the ESPNcricinfo series schedule URL and the Cricbuzz series matches URL.
3. Confirm **Browser capture extension connected**.
4. Select **Discover & save fixture URLs**. Chrome visibly opens each provider page and returns to Cricket Rivalries.
5. Review the saved count and each match card's **CRICINFO READY** and **CRICBUZZ READY** indicators.

The app accepts a league-stage link only when its match number and both teams match the fixture. Playoff labels map explicitly as Qualifier 1 → Match 71, Eliminator → Match 72, Qualifier 2 → Match 73 and Final → Match 74, and both teams must still match. It also checks the date when the provider exposes a machine-readable date. Ambiguous links are rejected instead of guessed. The configuration and exact fixture mappings are league-scoped and audited. You can rerun discovery safely to pick up provider links that were not available earlier.

Importing a match now prefills both URLs. If one provider is missing, paste that match's exact URL manually; this does not change any other fixture.

## 3. Open the correct fixture

1. Sign in to the production web app using the administrator account.
2. Open the correct league.
3. Go to **Rules → Match Scoring**.
4. Locate the required match and verify its match number and teams.
5. Select **Import score source**. For a previously published fixture, the button is **Import correction**.
6. Keep the **Provider URL** tab selected.

Stop if the match number or teams do not match the official scorecard.

## 4. Capture the ESPNcricinfo scorecard

1. Open the match's ESPNcricinfo **Full Scorecard** page and copy its HTTPS URL. Use a URL ending in, or resolving to, `/full-scorecard`.
2. Paste the URL into **Authorized score source URL**.
3. Wait for **Browser capture extension connected**.
4. Select **Capture scorecard & generate preview**.
5. Chrome opens ESPNcricinfo in a visible tab. If the site displays a normal cookie, consent, or access prompt, complete it and leave the Full Scorecard visible.
6. Do not close the Cricket Rivalries admin tab. The extension waits for the four rendered scorecard tables and then returns focus to the admin tab.
7. Wait for the human-readable preview. The capture can take up to two minutes.

Nothing is staged or published during capture.

## 5. Resolve a fielder-name warning

ESPNcricinfo sometimes shows only a surname or wicketkeeper shorthand in a dismissal. If the app cannot identify exactly one league player, it displays **Fielder name needs validation**.

Preferred validation:

1. Open the same match on Cricbuzz and copy its **live cricket scorecard** URL.
2. Paste it into **Matching Cricbuzz scorecard URL**.
3. Select **Validate with Cricbuzz & generate preview**.
4. Allow Chrome to open Cricbuzz and return to the admin tab.
5. Review the corrected dismissal name in the preview.

ESPNcricinfo remains the primary scoring source. Cricbuzz is used only to supply missing or ambiguous catch, stumping, or run-out names—including a dismissal shown only as `run out`—and the correction is retained in the review audit data.

If Cricbuzz still cannot resolve the name, use **Player name aliases** in the **Scorecard capture** tab:

```text
Cricinfo name = Exact league player name
N Reddy = Nitish Kumar Reddy
```

Add only the alias reported by the app. Do not use aliases to change runs, wickets, or other score facts.

## 6. Review the human-readable scoreboard

Do not stage until every check below passes.

### Match identity

- Correct league, match number, and teams.
- Correct first-innings team and innings order.
- Correct winner and official result summary.
- Correct Player of the Match.

### Cricket scorecard

- First-innings batting total and wickets.
- First-innings bowling figures.
- Second-innings batting total and wickets.
- Second-innings bowling figures.
- Batter runs, balls, fours, sixes, strike rates, and dismissal text.
- Bowler overs, runs, wickets, economy, and dot balls.
- Catch, stumping, and run-out fielders.
- Every playing, Impact, or verified concussion substitute who batted or bowled.

### Fantasy calculation

- Every expected league player has a row.
- Team player lists and roles are correct.
- `BAT`, `BOWL`, `FIELD`, `BONUS`, and `TOTAL` reconcile for each player and team.
- Captain, Vice-Captain, BAI, BOI, boosters, ownership deductions, and royalty are not manually added to the captured cricket facts. The publication workflow applies the fixture-effective league configuration to owner XIs.

Use **Show raw JSON** only for an audit or an approved correction. The readable scoreboard is the normal review surface.

### Warnings and substitutes

- A substitute who bats or bowls receives the normal points for those recorded contributions.
- A fielding-only substitute scores only when **Playing Rules → Substitute fielder points** is enabled for that fixture; the default is off.
- A team with 13 or more verified participants produces a warning. Confirm the extra player's role and enter a clear explanation under **Admin approval required** before staging.
- Never dismiss a warning without checking the official scorecard.

## 7. Stage the reviewed calculation

1. After the preview is correct, select **Stage for review**.
2. Wait for the staged confirmation. The footer changes to **Publish scores**.
3. Review the preview one final time.

Staging creates an immutable calculation version and audit record. It does not update public Results or Ranking.

If the app says the scorecard is already staged, select **Review staged batch**, inspect it, and continue only if it is the intended calculation.

## 8. Publish the scores

Publication is intentionally a separate confirmation.

1. Select **Publish scores**.
2. Read the **Publish Match _n_ now?** warning.
3. To stop, select **Keep reviewing**.
4. To proceed, select **Confirm publish now** once.
5. Wait for the success panel:

   > **Match _n_ published**
   >
   > **Player points, owner totals and league rankings were updated successfully.**

6. Select **Close** only after the success message appears.

Do not click repeatedly while the button is busy. If publication is blocked, keep the modal open and record the complete error message.

## 9. Verify publication

After closing the dialog:

1. In **Rules → Match Scoring**, confirm the match shows **PUBLISHED**.
2. Open **Results**, select the match, and verify:
   - the cricket Scorecard is available;
   - Fantasy points show player/category totals;
   - owner XIs show match transfers, player contributions, multipliers, deductions, and ROY details;
   - owner totals match the published calculation.
3. Open **Ranking** and confirm the match is included in the overall and applicable phase standings.
4. If the screen was already open, refresh the browser once before reporting missing data.

The scoring task is complete only after Results and Ranking both reflect the publication.

## 10. Correct a published score

Never edit published player points or standings directly.

1. Return to **Rules → Match Scoring**.
2. Select **Import correction** for the published fixture.
3. Capture the corrected official scorecard or use **Regenerate saved scorecard** when the stored four tables are still correct and only the fixture-effective rules need to be reapplied.
4. Review the entire new preview, not only the changed player.
5. Add warning or correction notes when requested.
6. Select **Stage for review**.
7. Select **Publish scores → Confirm publish now**.
8. Recheck Results and Ranking and notify league members if published totals changed.

The earlier artifact and publication remain in the audit history.

## 11. Troubleshooting

### Browser capture extension not detected

- Confirm Chrome—not Safari, Firefox, or an in-app browser—is being used.
- Confirm the extension is enabled at `chrome://extensions`.
- Select **Reload** on the extension card, then reload the Cricket Rivalries page.
- Confirm the complete `browser-extension` folder was loaded.
- Exit Incognito mode unless the extension has explicitly been allowed there.
- Use the **Scorecard capture** tab as the no-terminal fallback.

### Capture opens ESPNcricinfo but no preview appears

- Confirm the page is the Full Scorecard, not commentary or match summary.
- Complete any normal provider prompt and ensure both innings are rendered.
- Return to the admin tab after two minutes and read the displayed error.
- Retry once. If it still fails, use **Scorecard capture** and copy all four rendered tables.
- Both bowling tables must include `O`, `R`, `W`, and dot balls (`0s`, `Dots`, or `D`). Screenshots cannot be parsed.

### Wrong fixture or teams

Cancel the import, reopen the correct Match Scoring card, and paste the matching URL. Never override a fixture-identity error with an alias.

### Player name is unresolved

Use Cricbuzz validation when requested. Otherwise add one exact reviewed alias in **Scorecard capture** and generate the review again.

### Participant-count warning

Check Impact and concussion substitutes. A player who batted or bowled is included. Explain any verified 13th participant in the approval notes before staging.

### Publish button is not visible

The artifact has not been staged. Complete the preview, resolve warnings, and select **Stage for review** first.

### Publication has no visible confirmation

Stay in the dialog and scroll to the bottom. Publication is complete only when **Match _n_ published** appears. If an error appears, preserve it and do not assume the scores were published. Refresh Match Scoring, Results, and Ranking before retrying.

### No Result, abandoned, or cancelled match

Do not publish a normal score artifact. Use the administrator's No Result settlement workflow documented in [No Result fixture settlement](./no-result-settlement.md).

## Final administrator checklist

- [ ] Extension connected.
- [ ] Correct fixture and Full Scorecard URL.
- [ ] Both innings and team totals verified.
- [ ] Winner and Player of the Match verified.
- [ ] Dismissals, wickets, dot balls, and fielders verified.
- [ ] Player and category fantasy totals reconciled.
- [ ] All warnings explained in review notes.
- [ ] **Stage for review** completed.
- [ ] **Publish scores → Confirm publish now** completed.
- [ ] Publication success message displayed.
- [ ] Results and Ranking verified.
