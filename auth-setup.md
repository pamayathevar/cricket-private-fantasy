# Authentication and member mapping

IPL 2026 currently has nine active members. Pandiyan and Saravana are league administrators; the other seven members are owners.

## Email code login flow

1. Normalize the submitted email to lowercase and trim whitespace.
2. Ask the authentication provider to email a short-lived one-time code.
3. Verify the code through the provider; never validate or store raw codes in the mobile app.
4. Use the provider's permanent authenticated user ID to locate or create the user profile.
5. Match the verified email to the invited league member once, then store the permanent user ID on that membership.
6. Load permissions from the membership role for the selected league.

Production membership records should live in the backend, not in the application bundle. The local `leagueMembers.ts` file is prototype seed data only.

## Permissions

- `league_admin`: configure the league, members, squads, fixtures, locks, scorecards and recalculations; can also submit a team.
- `owner`: submit and alter their own team before lock; view revealed teams after lock.
- `viewer`: read-only access.

All administrative changes should write an audit record containing administrator ID, league ID, action, affected record and timestamp.
