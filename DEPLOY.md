# Deploying Toreha to Vercel

The app is production-ready (`pnpm build` passes). Deployment needs your Vercel
account and a couple of production-only settings. Follow these steps.

## 0. Prerequisites
- Code pushed to a GitHub/GitLab/Bitbucket repo (Vercel deploys from git).
- Your Turso DB already exists and is migrated (the same one you used locally is
  fine — data carries over. To keep prod data separate, create a second DB with
  `turso db create flow-prod`, then run `pnpm db:migrate` against it).

## 1. Import the project in Vercel
1. https://vercel.com → **Add New… → Project** → import your repo.
2. Framework preset: **Next.js** (auto-detected). Build command / output: defaults.
3. Don't deploy yet — add env vars first (next step).

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)
Add these for the **Production** environment:

```
TURSO_DATABASE_URL      = libsql://<db>.turso.io
TURSO_AUTH_TOKEN        = <token>
BETTER_AUTH_SECRET      = <same or a new `openssl rand -base64 32`>
BETTER_AUTH_URL         = https://<your-app>.vercel.app   # set after first deploy, see step 4
GOOGLE_CLIENT_ID        = <from Google Cloud Console>
GOOGLE_CLIENT_SECRET    = <from Google Cloud Console>
```

> `BETTER_AUTH_URL` must be the exact production origin (no trailing slash).
> Better Auth trusts this origin for auth/CSRF; a mismatch blocks sign-in.

## 3. First deploy
Deploy. Vercel assigns a URL like `https://flow-xyz.vercel.app`.

## 4. Point auth at the production URL
1. Set **`BETTER_AUTH_URL`** to that exact URL (Settings → Env Vars) and
   **redeploy** so it takes effect.
2. **Google OAuth** (Google Cloud Console → Credentials → your OAuth client):
   add an **Authorized redirect URI**:
   ```
   https://<your-app>.vercel.app/api/auth/callback/google
   ```
   Keep the localhost one too for local dev. Save.
3. (Optional) OAuth consent screen: while in "Testing", only added test users can
   sign in. To open it up, **Publish app** on the consent screen.

## 5. Verify
- Visit the URL → redirected to `/login`.
- Sign up with email, then sign out.
- Sign in with Google (should not show `redirect_uri_mismatch`).
- Add a todo / habit / reminder — data persists across reloads and devices.

## Custom domain (optional)
Add it in Vercel → Domains, then update `BETTER_AUTH_URL` to the custom domain
and add its `/api/auth/callback/google` redirect URI in Google. Redeploy.

## Notes
- Migrations run locally against Turso (`pnpm db:migrate`), not during the Vercel
  build. Run it whenever the schema changes.
- Secrets live only in Vercel env vars + your local `.env` (gitignored). Never
  commit them.
