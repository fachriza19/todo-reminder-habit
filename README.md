# Toreha

A personal productivity web app that puts three daily-workflow modules — **Todos**, **Reminders**, and **Habits** — in one place, behind a private per-user account. Fast, clean, mobile-first, in the spirit of Things 3 / Todoist / Apple Reminders.

## Features

- **Todos** — CRUD tasks with categories, drag-and-drop reordering (dnd-kit), done/undone toggle, hide-completed, optional due date & priority.
- **Reminders** — one-time reminders grouped **Overdue / Today / Upcoming / Completed**, with a live in-app "due" badge in the nav. In-app visual only (no OS/push notifications).
- **Habits** — numeric-target habits (e.g. 8 glasses), `+1 / −1` or direct-count entry, daily progress ring, streaks, and a GitHub-style calendar history.
- **Auth** — email/password + Google OAuth (Better Auth). All routes protected; every query scoped to `user_id` for full per-user data isolation.
- **UX** — optimistic updates with rollback, undo toasts, empty/loading/error states everywhere, dark mode, safe-area support for notched devices, keyboard-accessible.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, TypeScript) |
| UI | React 19, Tailwind CSS v4, shadcn/ui (base-ui primitives) |
| Auth | Better Auth (email/password + Google OAuth) |
| Database | Turso (libSQL / SQLite) |
| ORM | Drizzle ORM |
| Server state | TanStack Query |
| Client state | Zustand |
| Dates | date-fns |
| Drag & drop | dnd-kit |
| Deploy | Vercel |

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

Deploys to Vercel from git. See [DEPLOY.md](./DEPLOY.md) for the full walkthrough (production env vars, first deploy, and pointing Better Auth + Google OAuth at the production URL). Migrations run locally against Turso, not during the Vercel build.

## License

Private project. All rights reserved.
