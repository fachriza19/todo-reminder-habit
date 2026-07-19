# Deploying Toreha to Netlify

Netlify hosts the app **serverless** — no Docker, no VPS. Its Next.js runtime
turns your App Router pages + `/api/*` route handlers into Netlify Functions.
The app still talks to your existing **Turso** DB over the network.

Target domain: **`toreha.falatech.net`**.

> ⚠️ **Compatibility check first.** This project runs **Next 16.2.10** — very new.
> Netlify's `@netlify/plugin-nextjs` (Next Runtime) must support Next 16 for the
> build to succeed. Confirm on Netlify's docs / plugin release notes before
> relying on this. If the build errors on an unsupported Next version, deploy via
> **Coolify** instead (see `COOLIFY.md`) — self-hosting has no such limit.

## What's already wired for Netlify
- `netlify.toml` → build command `pnpm build`, Node 22, the official
  `@netlify/plugin-nextjs` plugin.
- `next.config.ts` → `output: "standalone"` is auto-skipped on Netlify
  (`process.env.NETLIFY`), since the adapter manages output itself.
- `packageManager` pin + committed `pnpm-lock.yaml` → Netlify uses pnpm.

## 0. Prerequisites
- Public GitHub repo (done).
- Turso DB created and **migrated** (step 4).
- Access to DNS for `falatech.net`.
- A Netlify account.

## 1. Create the site
1. Netlify → **Add new site → Import an existing project** → GitHub → pick the repo.
2. Branch: `main`. Build command and publish dir are read from `netlify.toml` —
   leave defaults. Don't deploy yet; add env vars first (step 3).

## 2. — (build config comes from `netlify.toml`, nothing to set manually)

## 3. Environment variables (Site configuration → Environment variables)
Add for all deploy contexts (or Production):

```
TURSO_DATABASE_URL   = libsql://<db>.turso.io
TURSO_AUTH_TOKEN     = <token>

BETTER_AUTH_SECRET   = <openssl rand -base64 32>
BETTER_AUTH_URL      = https://toreha.falatech.net

GOOGLE_CLIENT_ID     = <from Google Cloud Console>
GOOGLE_CLIENT_SECRET = <from Google Cloud Console>
```

> `BETTER_AUTH_URL` must be the **exact** production origin
> `https://toreha.falatech.net` (no trailing slash). Mismatch breaks sign-in/CSRF.
> None of these are `NEXT_PUBLIC_*`, so they stay server-side (in Functions).

## 4. Migrate the database (once, and on every schema change)
Migrations do **not** run during the Netlify build. Run locally against the same
Turso DB the site uses:

```bash
pnpm db:migrate
```

## 5. First deploy
Trigger the deploy. Netlify installs deps with pnpm, runs `pnpm build`, and the
Next runtime plugin wires up the functions. Watch the build log — if it fails on
the Next version, see the compatibility note at the top.

## 6. Custom domain `toreha.falatech.net`
1. Netlify → **Domain management → Add a domain** → `toreha.falatech.net`.
2. In your DNS provider for `falatech.net`, add the record Netlify shows —
   typically a **CNAME**:
   ```
   Type: CNAME   Name: toreha   Value: <your-site>.netlify.app
   ```
   (Netlify may instead give an A/ALIAS to its load balancer — use whatever the
   dashboard specifies.)
3. Netlify auto-provisions the Let's Encrypt TLS cert once DNS resolves.

## 7. Google OAuth production redirect
Google Cloud Console → **Credentials → OAuth client (Web) → Authorized redirect
URIs**, add:

```
https://toreha.falatech.net/api/auth/callback/google
```

Keep localhost for dev. Publish the OAuth consent screen to allow non-test users.

## 8. Verify
- `https://toreha.falatech.net` → redirects to `/login`, valid TLS.
- Email signup + sign out works.
- Google sign-in → no `redirect_uri_mismatch`.
- Todo / habit / reminder data persists across reloads and devices.

## Redeploys
Push to `main` → Netlify auto-builds and deploys. Re-run `pnpm db:migrate`
yourself on schema changes.

## Netlify vs Coolify (quick call)
| | Netlify | Coolify (VPS) |
|---|---|---|
| Model | Serverless functions, managed | Docker container you host |
| Setup | Least effort, no server ops | You run the VPS |
| Next 16 support | Depends on plugin — **verify** | Any version (runs `next start`) |
| Cost | Free tier, scales to paid | Cost of your VPS |
| Files used | `netlify.toml` | `Dockerfile`, `.dockerignore` |

Both paths coexist in this repo; pick one. If the Netlify build rejects Next 16,
Coolify is the safe fallback.
