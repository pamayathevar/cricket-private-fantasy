# Deployment and custom-domain runbook

This runbook records the production web and native delivery process for Cricket Rivalries League. It is intended for developers, QA, business analysts and release operators. It deliberately documents variable names and public endpoints but never secret values.

## Production service map

| Responsibility | Service | Production identity |
|---|---|---|
| Source control and deployment trigger | GitHub | `pamayathevar/cricket-private-fantasy`, branch `main` |
| Web build and CDN | Netlify | Project `cricketrivalriesleague` |
| Primary web address | Namecheap + Netlify | `https://cricketrivalriesleague.com` |
| Redirecting web alias | Namecheap + Netlify | `https://www.cricketrivalriesleague.com` |
| Netlify fallback address | Netlify | `https://cricketrivalriesleague.netlify.app` |
| Authentication and application data | Supabase | Project `lkhzoqfxhlirlhkzowzy` |
| Native Android/iOS builds | Expo Application Services | `haran-pandiyan-info-tech/cricketrivalriesleague` |
| Native application identity | Apple/Android | `com.cpfl.mobile` |

## Security boundary

- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` are required at build time. The key must be the Supabase public/publishable key, never the `service_role` key.
- `EXPO_PUBLIC_*` values are embedded in web/native bundles and must be treated as public configuration.
- Never commit `.env.local`, passwords, database credentials, service-role keys, Android keystores, Namecheap credentials or Netlify tokens.
- Netlify requires the two public Supabase variables in its environment configuration. EAS requires them independently in its preview and production environments.
- Supabase RLS and guarded RPCs remain the authorization boundary; hiding a key in a client is not authorization.

## One-time web hosting setup

### 1. Create the Netlify project

1. Choose the Netlify Free plan for the private-league workload.
2. In Netlify, choose **Import an existing project** and select GitHub.
3. Install the Netlify GitHub app for **Only select repositories** and select `pamayathevar/cricket-private-fantasy`.
4. Use the following build configuration:

| Setting | Value |
|---|---|
| Team | Cricket Rivalries League |
| Project name | `cricketrivalriesleague` |
| Branch to deploy | `main` |
| Base directory | blank |
| Build command | `npm run export:web` |
| Publish directory | `dist` |
| Functions directory | blank |

5. Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` under Netlify project environment variables. Use the public values from the intended production Supabase project; do not paste them into documentation or source control.
6. Trigger the initial deploy. A successful deploy must finish the Expo web export and publish the generated `dist` directory.
7. If the Netlify site was created as private, choose **Make public** before application testing. A private Netlify project returns HTTP `401` even when the build itself succeeded.

### 2. Register and verify the domain in Namecheap

1. Register `cricketrivalriesleague.com` through Namecheap.
2. Enable domain privacy and auto-renew according to the organization's renewal policy.
3. Complete the ICANN registrant-contact email verification immediately. The email normally comes from `verification@namecheap.com` or `support@namecheap.com`.
4. Confirm the Namecheap **Verify Contacts** warning clears. If it persists, resend verification, use the newest email link, wait several minutes, refresh the dashboard and contact Namecheap support if it remains unresolved.

Contact verification and DNS configuration are separate. DNS can be configured while the dashboard refreshes, but an unverified registration can eventually be suspended.

### 3. Add the domain to Netlify

1. Open Netlify **Domain management** for project `cricketrivalriesleague`.
2. Add `cricketrivalriesleague.com` as the custom production domain.
3. Keep the apex domain as the primary address. Netlify creates `www.cricketrivalriesleague.com` as an alias that redirects to the primary domain.
4. Open **Pending DNS verification** to confirm Netlify's current required DNS targets before editing the registrar.

### 4. Point Namecheap DNS to Netlify

In Namecheap, open **Domain List → Manage → Advanced DNS → Host Records**.

Delete the default parking records that conflict with Netlify, normally:

- `CNAME` host `www` pointing to `parkingpage.namecheap.com`
- `URL Redirect` host `@` pointing to the parked `www` address

Create these records:

| Type | Host | Value | TTL |
|---|---|---|---|
| `ALIAS` | `@` | `apex-loadbalancer.netlify.com` | Automatic or 5 minutes |
| `CNAME` | `www` | `cricketrivalriesleague.netlify.app` | Automatic |

Namecheap may display a final dot in the saved value, such as `apex-loadbalancer.netlify.com.`. This is valid DNS notation. Do not delete unrelated MX or TXT records if email or another verified service is later configured.

### 5. Verify DNS and enable HTTPS

1. Return to Netlify **Domain management** and select **Verify DNS configuration**.
2. After Netlify reports `DNS verification was successful`, select **Provision certificate**.
3. Use Netlify's automatic Let's Encrypt certificate. Do not upload a private certificate for this deployment.
4. Wait for Netlify to install the certificate, then test the HTTPS primary domain and the `www` redirect.

DNS often propagates in minutes but can take up to 24 hours. During propagation, HTTP may reach Netlify while HTTPS reports a certificate-name mismatch. That means DNS is resolving but the custom certificate is not ready yet.

### 6. Configure Supabase authentication URLs

In Supabase, open **Authentication → URL Configuration**.

Set **Site URL** to:

```text
https://cricketrivalriesleague.com
```

Add these allowed redirect URLs:

```text
https://cricketrivalriesleague.com/**
https://www.cricketrivalriesleague.com/**
https://cricketrivalriesleague.netlify.app/**
http://localhost:8081/**
http://localhost:8082/**
```

The Netlify fallback URL may be retained for controlled diagnostics. The localhost entries support the common local Expo web ports. Review and remove obsolete redirect URLs when they are no longer needed.

### 7. Production acceptance test

Use a private/incognito browser session so an existing Supabase session cannot hide an authentication problem.

1. Open `https://cricketrivalriesleague.com` and confirm HTTPS is valid.
2. Request an email login code and complete sign-in.
3. Confirm the browser remains on the `.com` domain.
4. Confirm the league list loads from Supabase.
5. Open the league and smoke-test League, Ranking, Results, Fixtures and More.
6. Confirm `https://www.cricketrivalriesleague.com` redirects to the apex domain.
7. Check responsive mobile and desktop widths.

## Routine web deployment

Netlify continuously deploys the `main` branch. A push to `main` is therefore a production web release.

```sh
nvm use
npm ci
npm run check:production
git diff --check
git status --short
```

After review and approval:

```sh
git add <approved-files>
git commit -m "<release description>"
git push origin main
```

Then:

1. Open Netlify **Deploys** and confirm the build is for the intended commit SHA.
2. Review the deploy log. The Expo export must complete and `dist` must be published.
3. Open the production deploy and perform the production acceptance smoke test.
4. Record the commit SHA, deploy time, verifier and any database migration IDs in the release evidence.

Changing a Netlify environment variable requires a new deploy because Expo public variables are compiled into the web bundle.

## Web rollback

If a newly deployed client is defective and no incompatible database change blocks rollback:

1. Open Netlify **Deploys**.
2. Select the last accepted successful deploy.
3. Publish/restore that deploy using Netlify's rollback action.
4. Smoke-test authentication, league access and the affected workflow.
5. Forward-fix `main` so the next automatic deploy does not reintroduce the defect.

Web rollback does not reverse Supabase migrations or data changes. Database recovery must follow the migration/forward-fix and backup policy in `PRODUCTION_READINESS.md`.

## Native Android/iOS deployment

Expo and EAS are independent of Netlify. Netlify hosts the web bundle; EAS compiles signed native applications.

```sh
# Signed APK for direct Android QA installation
npx eas-cli@latest build --profile preview --platform android

# Development-client APK (requires Metro for the JavaScript bundle)
npx eas-cli@latest build --profile development --platform android

# Signed production AAB for Google Play
npx eas-cli@latest build --profile production --platform android

# View recent EAS builds
npx eas-cli@latest build:list --limit 5
```

- Use the **preview** APK for standalone beta/QA testing on Samsung and other Android devices.
- A **development** build contains the custom development client and normally connects to a running Metro server; it is not the beta artifact.
- Use the **production** AAB for Google Play. A successful cloud build does not publish it automatically unless an EAS Submit/store workflow is run.
- Android 10 is supported only if the generated manifest's minimum SDK remains compatible. An install failure can also be caused by signing conflicts with an already installed build using the same package ID; uninstalling the old test build removes its local app data.

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| Netlify deploy succeeds but site returns `401` | Site access is private | Make the Netlify project public, then retest. |
| Domain shows Namecheap parking | Default parking/redirect records remain or DNS has not propagated | Remove conflicting `@`/`www` records and confirm the ALIAS/CNAME values. |
| Netlify shows Pending DNS verification | Registrar records do not match or propagation is incomplete | Recheck Host, Value and record type; wait and verify again. |
| HTTP works but HTTPS fails certificate validation | DNS resolved before Let's Encrypt provisioning completed | Verify DNS in Netlify, provision the certificate and wait. |
| Login returns to localhost or the Netlify subdomain | Supabase Site URL/redirect allowlist is stale | Correct Authentication URL Configuration and perform a new login. |
| Netlify build cannot connect to Supabase | Public variables are absent from the build environment | Add both `EXPO_PUBLIC_SUPABASE_*` variables and redeploy. |
| Expo Go says the project requires a newer client | Installed Expo Go does not support the project's SDK | Use the matching Expo Go release or, preferably, the EAS development/preview build. |
| Tunnel startup fails in ngrok | Tunnel dependency/service/network issue | Use LAN/local Wi-Fi, an EAS development build, or retry after checking ngrok status. |
| Direct Android install fails | Incompatible Android API, corrupted download or signing/package conflict | Confirm device/API compatibility, download again, and remove the conflicting old build only after preserving needed local data. |

Useful read-only checks:

```sh
dig +short cricketrivalriesleague.com
dig +short www.cricketrivalriesleague.com
curl -I https://cricketrivalriesleague.com
curl -I https://www.cricketrivalriesleague.com
```

Expected final state: the apex request returns a successful Netlify response over HTTPS, and `www` redirects to the apex domain.

## Ownership and renewal checklist

- Keep Namecheap registrant contact details current and verified.
- Enable and monitor domain auto-renew; retain access to the registrant email and payment method.
- Keep Netlify's GitHub app scoped to only the required repository.
- Require review before merging/pushing production changes to `main`.
- Review Netlify and Supabase access when team members change.
- Preserve EAS/Google Play signing ownership and do not create replacement keystores casually.
- Review certificate, DNS, authentication and a complete login at least once before each season launch.

Last verified: 14 August 2026 (America/Toronto).
