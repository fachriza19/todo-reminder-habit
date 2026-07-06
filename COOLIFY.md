# Deploying Toreha to Coolify

Target domain: **`toreha.falatech.net`**. The app runs as a single Docker
container (built from the repo `Dockerfile`) and talks to your existing **Turso**
database over the network — no database container is needed on the VPS.

## What's already wired for Coolify
- `next.config.ts` → `output: "standalone"` (self-contained server).
- `Dockerfile` → multi-stage build (Node 22 + pnpm), runs `node server.js`,
  listens on **port 3000**.
- `.dockerignore` → keeps secrets/`.env*` and junk out of the image.

## 0. Prerequisites
- Coolify installed and reachable on your VPS.
- The GitHub repo (public — no deploy key needed).
- Turso DB already created and **migrated** (see step 4).
- Access to your DNS provider for `falatech.net`.

## 1. Point DNS at the VPS
In your DNS provider for `falatech.net`, add:

```
Type: A     Name: toreha     Value: <your VPS public IP>     Proxy: off (DNS only)
```

Wait for it to resolve (`dig toreha.falatech.net +short` → your IP) before
Coolify tries to issue the TLS cert.

## 2. Create the application in Coolify
1. Coolify → your Project → **+ New** → **Application**.
2. Source: **Public Repository** → paste the repo URL, branch `main`.
3. Build Pack: **Dockerfile** (Coolify auto-detects it; if not, select it and
   leave the path as `Dockerfile`).
4. **Ports Exposes:** `3000` (matches the Dockerfile `EXPOSE`/`PORT`).
5. Don't deploy yet — set the domain and env vars first.

## 3. Domain + HTTPS
1. In the app's **Configuration → Domains**, set:
   ```
   https://toreha.falatech.net
   ```
   Use `https://` so Coolify's Traefik requests a Let's Encrypt cert
   automatically. No manual port in the URL.
2. **Health check:** the app redirects `/` → `/login` (307). Point the health
   check at a 200 path or disable it:
   - Health Check Path: `/login`  (returns 200), **or** turn health checks off.

## 4. Migrate the database (once, and on every schema change)
Migrations do **not** run inside the container. Run them from your machine
against the same Turso DB the app will use:

```bash
pnpm db:migrate      # uses .env locally (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
```

To keep prod data separate from local, create a second Turso DB and migrate that
one, then use its URL/token in the Coolify env vars below.

## 5. Environment variables (Coolify → Configuration → Environment Variables)
Add these (mark them as **Build & Runtime** is unnecessary — runtime is enough,
none are `NEXT_PUBLIC_*`). Set **Production** values:

```
TURSO_DATABASE_URL   = libsql://<db>.turso.io
TURSO_AUTH_TOKEN     = <token>

BETTER_AUTH_SECRET   = <openssl rand -base64 32>
BETTER_AUTH_URL      = https://toreha.falatech.net

GOOGLE_CLIENT_ID     = <from Google Cloud Console>
GOOGLE_CLIENT_SECRET = <from Google Cloud Console>
```

> `BETTER_AUTH_URL` must be the **exact** origin `https://toreha.falatech.net`
> (no trailing slash, https). A mismatch blocks sign-in / breaks CSRF.

## 6. Deploy
Hit **Deploy**. Coolify builds the Dockerfile and starts the container. Watch the
build logs; first build pulls the pnpm store so it's the slowest.

## 7. Google OAuth production redirect
In Google Cloud Console → **Credentials → your OAuth client (Web)** →
**Authorized redirect URIs**, add:

```
https://toreha.falatech.net/api/auth/callback/google
```

Keep the localhost one for local dev. If the OAuth consent screen is in
"Testing", only listed test users can sign in — **Publish** it to open sign-up.

## 8. Verify
- Visit `https://toreha.falatech.net` → redirects to `/login`, valid TLS.
- Sign up with email, sign out.
- Sign in with Google → no `redirect_uri_mismatch`.
- Add a todo / habit / reminder → persists across reloads and devices.

## Redeploys
Push to `main` → Coolify redeploys (enable **auto-deploy** / webhook in the app
settings if you want it automatic). Re-run `pnpm db:migrate` yourself whenever
the schema changes.

## Troubleshooting
- **502 / unhealthy:** health check hitting `/` gets a 307 — set it to `/login`
  or disable (step 3).
- **Sign-in fails / CSRF errors:** `BETTER_AUTH_URL` doesn't exactly match the
  domain, or the cert isn't issued yet (check DNS resolves first).
- **Build fails on install:** ensure `pnpm-lock.yaml` is committed (it is) so
  `--frozen-lockfile` succeeds.
- **DB errors at runtime:** wrong/rotated `TURSO_AUTH_TOKEN`, or you migrated a
  different DB than the one in `TURSO_DATABASE_URL`.
