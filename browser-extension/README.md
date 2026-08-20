# Cricket Rivalries scorecard capture extension

This Chrome Manifest V3 extension reads a visible ESPNcricinfo Full Scorecard and returns the four rendered tables to the Cricket Rivalries admin review screen. When Cricinfo omits a run-out fielder or supplies an ambiguous fielder surname, it can also read the matching Cricbuzz scorecard to validate that dismissal. It cannot access Supabase, stage a score or publish a score.

For the complete administrator workflow—including installation, capture, human review, staging, publication, verification, corrections, and troubleshooting—see [Administrator guide: capture, review, and publish match scores](../docs/ADMIN_SCORE_PUBLISHING_GUIDE.md).

## One-time local installation

1. Open `chrome://extensions` in Google Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository's `browser-extension` folder.
5. Reload the Cricket Rivalries web app.

After updating the repository, return to `chrome://extensions`, confirm version **0.2.2** (or newer), and select **Reload**. Deploying the web app does not automatically reload an unpacked local extension.

The Match Scoring dialog will show **Browser capture extension connected**. Paste an ESPNcricinfo Full Scorecard URL and select **Capture scorecard & generate preview**.

If the app finds a missing or ambiguous catcher, wicketkeeper or run-out fielder—including a Cricinfo dismissal shown only as `run out`—it asks for the matching Cricbuzz scorecard URL. Select **Validate with Cricbuzz & generate preview**. Cricinfo remains the primary source; Cricbuzz changes only the incomplete fielder names, and those corrections are saved in the review audit data. Manual aliases remain available as a fallback when a name is present.

## Permissions

- The bridge runs only on the local Cricket Rivalries app and the documented production domains.
- Primary scorecard extraction runs only on `espncricinfo.com` or `cricinfo.com`; targeted dismissal validation also allows `cricbuzz.com`.
- The extension returns scorecard facts to the requesting admin tab and has no database credentials.
- A captured score remains an unpublished review until the administrator separately stages and confirms publication.

Keep the guided manual capture form available if Cricinfo changes its page structure or Chrome blocks the extension.
