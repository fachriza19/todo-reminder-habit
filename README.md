# Toreha

A personal productivity web app that puts three daily-workflow modules — **Todos**, **Reminders**, and **Habits** — in one place, behind a private per-user account. Fast, clean, mobile-first, in the spirit of Things 3 / Todoist / Apple Reminders.

## Features

- **Todos** — CRUD tasks with categories, drag-and-drop reordering (dnd-kit), done/undone toggle, hide-completed, optional due date & priority.
- **Reminders** — one-time reminders grouped **Overdue / Today / Upcoming / Completed**, with a live in-app "due" badge in the nav. In-app visual only (no OS/push notifications).
- **Habits** — numeric-target habits (e.g. 8 glasses), `+1 / −1` or direct-count entry, daily progress ring, streaks, and a GitHub-style calendar history.
- **Auth** — email/password + Google OAuth (Better Auth). All routes protected; every query scoped to `user_id` for full per-user data isolation.
- **UX** — optimistic updates with rollback, undo toasts, empty/loading/error states everywhere, dark mode, safe-area support for notched devices, keyboard-accessible.

## Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 22 |
| Package manager | pnpm (pinned via `packageManager`) | 10.34.3 |
| Framework | Next.js — App Router, Turbopack, RSC | 16.2.10 |
| UI runtime | React / React DOM | 19.2.4 |
| Styling | Tailwind CSS (`@tailwindcss/postcss`) | 4.x |
| Components | shadcn/ui on Base UI primitives | `@base-ui/react` 1.6 |
| Auth | Better Auth — email/password + Google OAuth | 1.6.23 |
| Database | Turso (libSQL / SQLite) via `@libsql/client` | 0.17.4 |
| ORM | Drizzle ORM (+ `drizzle-kit` for migrations) | 0.45.2 |
| Validation | Zod — at every route boundary | 4.4.3 |
| Server state | TanStack Query | 5.101.2 |
| Client state | Zustand | 5.0.14 |
| Theming | next-themes | 0.4.6 |
| Dates | date-fns | 4.4.0 |
| Drag & drop | dnd-kit (core / sortable / modifiers) | 6.3.1 |
| Lint | ESLint + `eslint-config-next` | 9.x |
| Deploy | Docker (Coolify), Netlify, or Vercel | — |

## Architecture

Feature-based modules with strict one-directional layering. Each domain (`todo`, `reminder`, `habit`, `category`) follows the same anatomy:

```
schema (Drizzle) → validations (Zod) → service (pure, takes userId)
  → route handler (auth + validate) → hook (TanStack Query) → components → page
```

Rules enforced across every feature:

- UI never calls services/DB directly; services never touch HTTP.
- Every DB query is scoped to `user_id`. No exceptions.
- Input validated with Zod at the route boundary.
- Uniform API contract: `{ data, error }` with codes `UNAUTHORIZED` / `VALIDATION_ERROR` / `NOT_FOUND` / `FORBIDDEN` / `INTERNAL`.
- Mutations use the optimistic-update + rollback pattern.
- All "today" logic goes through a single `getLocalToday()` helper.

### Project structure

```
src/
├─ app/
│  ├─ (auth)/login, (auth)/signup    # auth pages
│  ├─ (app)/todos, reminders, habits, settings
│  ├─ api/                           # route handlers (+ Better Auth)
│  └─ layout.tsx
├─ components/    ui/ + todo/ reminder/ habit/ settings/
├─ db/            Drizzle schema + client + migrations
├─ hooks/         TanStack Query hooks
├─ lib/           auth, validations, utils (streak, dates)
├─ server/        service layer (pure query functions)
├─ stores/        Zustand
└─ proxy.ts       route protection (Next 16 renamed middleware → proxy)
```

## Getting Started

Requires **Node 22** and **pnpm**.

```bash
pnpm install
```

Create a `.env` file (gitignored) in the project root:

```
TURSO_DATABASE_URL=libsql://<db>.turso.io
TURSO_AUTH_TOKEN=<token>

BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3100

GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

Apply the database schema, then start the dev server:

```bash
pnpm db:migrate     # apply migrations to Turso
pnpm dev            # http://localhost:3100
```

> Google OAuth redirect URI (local): `http://localhost:3100/api/auth/callback/google`

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Dev server (Turbopack) on port 3100 |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build on port 3100 |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate Drizzle migrations from schema |
| `pnpm db:migrate` | Apply migrations to Turso |
| `pnpm db:push` | Push schema directly (no migration files) |
| `pnpm db:studio` | Drizzle Studio |

## Deployment

Three supported targets. Pick one:

| Target | Guide | Notes |
|---|---|---|
| Coolify (self-hosted Docker) | [COOLIFY.md](./COOLIFY.md) | Uses the multi-stage [`Dockerfile`](./Dockerfile) + Next.js `output: "standalone"` |
| Netlify (serverless) | [NETLIFY.md](./NETLIFY.md) | Uses [`netlify.toml`](./netlify.toml) + `@netlify/plugin-nextjs` |
| Vercel | [DEPLOY.md](./DEPLOY.md) | Zero-config |

`next.config.ts` switches output mode automatically: `standalone` everywhere except Netlify, whose Next.js runtime adapter manages output itself and conflicts with `standalone`.

Applies to all targets:

- Run `pnpm db:migrate` **locally** against the production Turso database. Migrations never run during a build or inside the container.
- Set the same env vars as `.env.example`, with `BETTER_AUTH_URL` pointing at the production origin.
- Add the production Google OAuth redirect URI: `https://<your-domain>/api/auth/callback/google`.

## Troubleshooting

**Every page crawls / hangs, then works again once you clear cookies.** *(fixed — kept here as background)*

A stale session cookie used to cause an infinite redirect loop. `src/proxy.ts` only checks that the cookie *exists* (an intentionally cheap edge check, no DB), while `src/app/(app)/layout.tsx` does the authoritative DB lookup. When the cookie was present but its session was gone — DB re-migrated, `BETTER_AUTH_SECRET` rotated, session expired — the two disagreed forever:

```
/todos → proxy sees cookie, allows through
       → layout does DB session lookup, gets null, redirects to /login
/login → proxy sees cookie, redirects to /todos
       → loop, one Turso round-trip burned per cycle
```

Now the layout redirects to **`/api/session/expired`** instead. That Route Handler deletes every Better Auth cookie and forwards to `/login?expired=1`, which shows a "session expired" notice. Cookies can only be deleted in a Route Handler or Server Function — never during Server Component render — which is why the layout hands off rather than clearing them itself.

The client half is covered too: `apiFetch` sends the browser to the same handler on any `UNAUTHORIZED` response (latched, so simultaneous 401s trigger one navigation), and TanStack Query no longer retries 401s.

**Dev server feels slow in general.** Turso is a *remote* database — each query is a network round-trip (~90ms+ from Southeast Asia to an `ap-northeast-1` instance), and an authenticated page makes several. For faster local work, point `TURSO_DATABASE_URL` at a local file (`file:./local.db`) and run `pnpm db:push`.

**`Could not find module global-error.js in React Client Manifest`.** Stale Turbopack cache. Stop the dev server, move `.next` aside, restart.

**Chrome shows an error page on `localhost:3100`.** Chrome may resolve `localhost` to IPv6 while the dev server binds IPv4. Use `http://127.0.0.1:3100` — but note real auth flows need `localhost`, since that is what `BETTER_AUTH_URL` and the Google redirect URI are registered as.

## License

Private project. All rights reserved.
