# PRD — Personal Productivity App (Todo · Reminder · Habits)

**Version:** 3.0 (MVP + Auth + System Design & UI/UX Guide)
**Owner:** (you)
**Status:** Draft for build
**Audience of this doc:** AI coding agent (vibe coding) + solo dev

---

## 1. Product Summary

A web app to manage daily workflow: three core modules — **Todo List**, **Reminder**, and **Habits Tracker** — in a single app. The first release already includes **authentication** (email/password + Google login), so data is tied to an account and accessible from any device.

### 1.1 Goals
- One structured home for todos that are currently scattered.
- Lightweight reminders in the spirit of iPhone Reminders, but simpler (in-app visual only).
- Track habits with a numeric target + streaks.
- Data is secure and private per account (auth).

### 1.2 Non-Goals (MVP)
- No push notifications / OS notifications (reminders are in-app visual only, shown when the app is open).
- No collaboration / sharing between users.
- No native mobile app (responsive web; PWA optional).
- No complex roles/permissions (all users equal, data isolated per account).

---

## 2. Target User & Context
- **Primary user:** the owner. With auth, open to multiple users (each with separate data).
- **Frequency:** daily, several times a day.
- **Devices:** desktop & mobile browsers. Responsive, mobile-friendly UI.

---

## 3. Tech Stack (Final Decision)

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js (App Router, TypeScript)** | Full-stack React: UI + API routes / server actions in one app. |
| UI library | **shadcn/ui** + **Tailwind CSS** | Accessible, ownable (copy-paste) components, consistent, mobile-first. |
| Auth | **Better Auth** | Open source, free, self-hosted, no vendor lock-in, Drizzle & Google OAuth integration. |
| Database | **Turso (libSQL / SQLite cloud)** | Generous free tier, SQLite syntax, reliable persistence on serverless, no limits like Supabase. |
| ORM | **Drizzle ORM** | Type-safe, first-class libSQL/Turso support, also used by Better Auth. |
| Server logic | **Next.js Route Handlers** (`/app/api/**`) + **Server Actions** | REST/RPC without a separate backend. |
| Client state | **Zustand** + **TanStack Query** | Zustand for UI state; TanStack Query for server-state caching. |
| Deployment | **Vercel** | Free, native for Next.js, works well with Turso. |
| Date/time | **date-fns** | Date handling, recurrence, local-timezone "today". |
| Drag & drop | **dnd-kit** | Modern, accessible, ideal for list reordering. |

### 3.1 Why these choices
- **Next.js**: the React replacement for Nuxt, still full-stack (single app).
- **shadcn/ui**: your pick; you own the components fully (not a black-box dependency).
- **Better Auth**: fully free, self-hosted, no lock-in; avoids Supabase Auth since your free tier is exceeded.
- **Turso**: cloud SQLite, lightweight and persistent on serverless (a SQLite file does not persist on Vercel).

> ⚠️ **Decision needed (T-DB-1):** Agree on Turso? The Postgres alternative is **Neon** (also supported by Better Auth). Schemas in this PRD are SQLite-flavored.

---

## 4. Authentication (Details)

### 4.1 Decisions
- **Provider:** Better Auth (self-hosted, auth tables in the same Turso DB).
- **Login methods:** **Email + Password** and **Google OAuth** (both).
- **Session:** cookie-based session (Better Auth default), secure & simple.

### 4.2 Functional Requirements
- **F-AUTH-1:** Sign up with email + password.
- **F-AUTH-2:** Sign in with email + password.
- **F-AUTH-3:** Sign in / sign up with Google (OAuth).
- **F-AUTH-4:** Sign out.
- **F-AUTH-5:** All data routes (`/api/todos`, etc.) & app pages are **protected** — redirect to `/login` if unauthenticated.
- **F-AUTH-6:** Every DB query **must** be filtered by `user_id = session.user.id` (data isolation between users).
- **F-AUTH-7 (optional):** Email verification & password reset. *(see T-AUTH-1)*

### 4.3 Better Auth Setup (agent quick reference)
- Auth tables (`user`, `session`, `account`, `verification`) generated via the Better Auth Drizzle adapter.
- Google OAuth needs `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` (from Google Cloud Console).
- Next.js middleware for route protection.
- Server-side helper `getSession()` to get the user in API/Server Actions.

### 4.4 Environment Variables
```
TURSO_DATABASE_URL=libsql://<db>.turso.io
TURSO_AUTH_TOKEN=<token>

BETTER_AUTH_SECRET=<random-strong-secret>
BETTER_AUTH_URL=https://<your-app>.vercel.app   # or http://localhost:3000

GOOGLE_CLIENT_ID=<...>
GOOGLE_CLIENT_SECRET=<...>
```

> ⚠️ **T-AUTH-1:** Need email verification + password reset in MVP? (requires an email sender such as Resend). Default: **no** for MVP — password + Google only.
> ⚠️ **T-AUTH-2:** Restrict who can register (e.g. specific emails / invite-only), or open sign-up? Default: **open sign-up**.

---

## 5. High-Level Architecture

```
[ Browser (Next.js React) ]
        |  fetch /api/* or Server Action
        v
[ Next.js Route Handlers / Server Actions ]
        |  getSession() (Better Auth) -> user_id
        |  Drizzle
        v
[ Turso (libSQL) ]  (app data + Better Auth tables)
```

- DB & auth credentials live only on the server (env vars).
- Every request validates the session; queries are scoped to `user_id`.
- Reminders are evaluated on the client while the app is active (lightweight interval).

---

## 5A. System Design & Architecture Patterns (AGENT MUST FOLLOW)

> **Purpose of this section:** provide a *blueprint* so every new feature is built with the same pattern. The AI agent **must** follow this pattern when adding any module/feature, so the codebase stays consistent, maintainable, and never "hacked together". If a new feature does not fit this pattern, stop and confirm with the owner first.

### 5A.1 Core Architecture Principles
1. **Feature-based module structure.** Each domain (todo, reminder, habit, category) is a self-contained module with a uniform structure. Adding a feature = copying the existing module pattern, not inventing a new one.
2. **Server-authoritative, client-optimistic.** The source of truth is the server (Turso). The client may apply optimistic updates for speed, but always reconciles with the server & rolls back on failure.
3. **Thin components, logic in hooks/services.** React components focus on rendering; data logic lives in custom hooks (TanStack Query) + a service layer. No raw fetches scattered across components.
4. **Every DB access scoped to `user_id`.** No exceptions. Query helpers must accept `userId` and filter by it.
5. **Validation at the boundary.** All input validated with **Zod** on the server (route handler / server action) before touching the DB. The Zod schema is the single source of truth for request types.
6. **Consistent API contract.** All endpoints follow the same response shape (see 5A.4).

### 5A.2 Anatomy of a Module (the pattern replicated for new features)
For a domain `X` (e.g. `todo`), the required structure is:

```
src/
├─ db/schema/x.ts                 # Drizzle table + relations
├─ lib/validations/x.ts           # Zod schemas (create/update)
├─ server/services/x.service.ts   # pure query functions (take userId), no HTTP
├─ app/api/x/route.ts             # GET/POST  → call service
├─ app/api/x/[id]/route.ts        # PATCH/DELETE
├─ hooks/use-x.ts                 # TanStack Query: useX(), useCreateX(), etc.
├─ components/x/
│  ├─ x-list.tsx                  # list
│  ├─ x-item.tsx                  # single item
│  ├─ x-form.tsx                  # create/edit (shadcn Form + Zod)
│  └─ x-empty.tsx                 # empty state
└─ app/(app)/x/page.tsx           # page
```

**Rule:** adding a new feature = create the files above with an identical pattern. Names, argument order, and return shapes must be consistent with existing modules.

### 5A.3 Layering — one-directional dependencies
```
UI (components/pages)
   ↓ uses
Hooks (TanStack Query)          ← server state & caching
   ↓ calls (fetch)
Route Handlers / Server Actions ← auth check + Zod validate
   ↓ calls
Services (x.service.ts)         ← business logic + queries, take userId
   ↓ uses
Drizzle + Turso                 ← DB
```
- UI **must not** call services/DB directly.
- Services **must not** know about HTTP/req/res (pure: input args → output data).
- Auth & validation **always** in the route/action layer, before the service.

### 5A.4 Uniform API Contract
All endpoints return a consistent shape:
```jsonc
// success
{ "data": <payload>, "error": null }
// failure
{ "data": null, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```
Standard error codes: `UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `INTERNAL`. HTTP status follows (401/400/404/403/500).

### 5A.5 Required Patterns for Recurring Situations
- **Optimistic update:** use the TanStack Query `onMutate` pattern (snapshot → update cache → rollback `onError` → `invalidate` `onSettled`). Same for all mutations.
- **Reorder (drag & drop):** send an array of `{id, sort_order}` to a `/reorder` endpoint; the server updates in a single transaction.
- **"Today" calculation:** all dates (habits, reminder grouping) go through a single helper `getLocalToday()` in `lib/utils.ts` — never compute dates ad-hoc.
- **ID generation:** `crypto.randomUUID()` on the server, consistently.
- **Timestamp:** epoch ms via `Date.now()`, consistently.

### 5A.6 New-Feature Checklist (agent MUST run through this)
Before declaring a feature done, ensure:
- [ ] Follows the module structure in 5A.2 (consistent naming).
- [ ] Zod schema exists for all inputs.
- [ ] All queries scoped to `user_id`.
- [ ] Endpoints use the 5A.4 response contract.
- [ ] Mutations use the optimistic + rollback pattern.
- [ ] UI has empty, loading, and error states.
- [ ] Components use shadcn/ui and follow the design principles in §5B.
- [ ] Responsive (mobile + desktop) & keyboard-accessible.
- [ ] No new pattern introduced without reason; if needed, confirm with the owner.

### 5A.7 Extensibility (readiness for future features)
The design is prepared for additions without major refactors:
- Universal `sort_order` column → reorder can be reused by any module.
- The `logs` pattern (habit_logs) can be a template for other date-based tracking.
- Reminder `recurrence` can be generalized if todos/habits later need recurrence.
- The `categories` table can be extended into general tagging if needed.

---

## 5B. UI/UX Design Principles (DESIGN TASTE GUIDE for the AGENT)

> **Purpose:** ensure the agent builds a UI that is **pleasant, fast, clean, and consistent** — not merely functional. This is a *utility* app used daily, so the priority is **clarity & speed**, not decoration. Every screen must feel light and non-fatiguing.

### 5B.1 Design Philosophy
- **Clarity over cleverness.** Function must be immediately legible. No confusing elements.
- **Speed & low friction.** The most frequent actions (add todo, +1 habit, mark done) should take ≤1–2 taps/clicks. Minimize steps.
- **Calm, focused, uncluttered.** Plenty of whitespace, clear hierarchy, not busy. A cluttered productivity app is stressful.
- **Consistency builds trust.** Same components, spacing, and language across the app. Once the user learns a pattern, it applies everywhere.
- **Mobile-first, one-handed.** Primary actions within thumb reach; tap targets ≥44px.

### 5B.2 Design Tokens (the basis of consistency)
Define once (Tailwind theme + CSS vars via shadcn), then **always** use tokens — no ad-hoc values.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 (multiples of 4). No margin/padding outside this scale.
- **Radius:** one consistent radius for cards & buttons (e.g. `rounded-lg`). Don't mix many radii.
- **Typography scale:** max 4–5 sizes (page title, section, body, caption). Body 14–16px, line-height ~1.5.
- **Color:** neutrals as the base (grays), **one accent** for actions/primary, plus semantics: success (habit complete), warning/overdue (reminder due), muted (done items). Maintain AA contrast.
- **Category & habit colors:** colorful is fine but as *small dots/labels*, not dominating the screen.
- **Dark mode:** prepared from the start via CSS variables (shadcn supports it). *(see T-UI-1)*

### 5B.3 Interaction Patterns (must be consistent across all modules)
- **Instant feedback:** every action gives an immediate response (optimistic UI). Mark done → strike/disappear immediately, don't wait for the server.
- **Toast for light confirmations** ("Todo added"), not a modal. Modals only for destructive actions.
- **Undo over confirmation** for non-fatal actions when possible (e.g. delete todo → toast "Deleted · Undo") — faster than a dialog.
- **Loading:** use skeletons (not a big spinner) for lists; buttons show a pending state.
- **Drag & drop:** clear handle, a placeholder while dragging, smooth animation (dnd-kit). Works via keyboard too.
- **Forms:** inline validation (Zod + shadcn Form), specific and helpful error messages, not "invalid".

### 5B.4 Three Mandatory States on Every Screen/List
Every list/module **must** handle:
1. **Empty state** — a light icon + an inviting line ("No tasks yet. Add your first one 👇") + an action button. Not a blank screen.
2. **Loading state** — a skeleton resembling the content.
3. **Error state** — explain what went wrong + how to retry, in a calm tone (no over-apologizing, not vague).

### 5B.5 Language & Microcopy (UX writing)
- **Sentence case**, active verbs, plain language. Buttons name their action: "Add task", not "Submit".
- **Consistent vocabulary:** a "Complete" button → toast "Completed". The action keeps the same name across the flow.
- **Write from the user's side**, using terms the user recognizes ("reminder", not "cron job").
- **Empty & error = direction, not mood.** Empty = a call to act; error = what happened + next step.
- Pick one primary UI language and stay consistent. *(see T-UI-2)*

### 5B.6 Accessibility (quality floor, non-negotiable)
- Color contrast at least WCAG AA.
- Visible focus ring for keyboard navigation; all actions possible via keyboard (including reorder).
- Tap targets ≥44px; labels on all controls; correct `aria` (shadcn is good by default).
- Respect `prefers-reduced-motion` (disable non-essential animation).

### 5B.7 Motion (sparing, meaningful)
- Animate only to clarify state changes: items entering/leaving a list, reorder, the habit progress ring filling, a due badge appearing.
- Short durations (~150–250ms), smooth easing. **Avoid** excessive animation that slows daily interaction.

### 5B.8 Anti-Patterns (the agent must NOT do)
- Don't use a modal/confirmation for trivial actions.
- Don't use a full-screen spinner for fast operations.
- Don't use ad-hoc spacing/colors outside tokens.
- Don't leave a blank screen without an empty state.
- Don't write generic microcopy ("Error", "Success", "Submit").
- Don't cram too many actions/information into one screen — prioritize the most frequent.
- Don't make the UI color-noisy; color conveys *meaning* (status), not decoration.

### 5B.9 Taste Reference (calibration)
Aim for a **fast & clean** feel like Things 3, Todoist, or Apple Reminders/Notes: focused, generous whitespace, clear hierarchy, one prominent primary action per screen. Not a dense dashboard, not a decorative landing page.

---

## 6. Data Model

> Multi-user: **every data table has `user_id`** (FK to the Better Auth `user` table). Timestamps = epoch ms (integer). Auth tables (`user`, `session`, `account`, `verification`) are managed by Better Auth — not detailed here.

### 6.1 `categories`
| Column | Type | Notes |
|---|---|---|
| id | text (uuid) PK | |
| user_id | text FK → user.id NOT NULL | |
| name | text NOT NULL | |
| color | text | hex, optional |
| sort_order | integer | |
| created_at | integer | epoch ms |

### 6.2 `todos`
| Column | Type | Notes |
|---|---|---|
| id | text (uuid) PK | |
| user_id | text FK → user.id NOT NULL | |
| title | text NOT NULL | |
| notes | text | optional |
| category_id | text FK → categories.id | nullable |
| is_done | integer (0/1) | default 0 |
| sort_order | integer | for drag reorder (priority/order) |
| due_date | integer | epoch ms, nullable *(T-TODO-1)* |
| priority | integer | 0=none,1=low,2=med,3=high *(optional)* |
| created_at | integer | |
| completed_at | integer | nullable |

### 6.3 `reminders`
| Column | Type | Notes |
|---|---|---|
| id | text (uuid) PK | |
| user_id | text FK → user.id NOT NULL | |
| title | text NOT NULL | |
| remind_at | integer | epoch ms |
| is_done | integer (0/1) | default 0 |
| recurrence | text | `none`\|`daily`\|`weekly` *(T-REM-1)* |
| recurrence_days | text | JSON array for weekly, e.g. `[1,3,5]` |
| created_at | integer | |
| completed_at | integer | nullable |

### 6.4 `habits`
| Column | Type | Notes |
|---|---|---|
| id | text (uuid) PK | |
| user_id | text FK → user.id NOT NULL | |
| name | text NOT NULL | |
| target_count | integer NOT NULL | e.g. 8 |
| unit | text | e.g. "glasses" |
| color | text | optional |
| sort_order | integer | |
| is_archived | integer (0/1) | default 0 |
| created_at | integer | |

### 6.5 `habit_logs`
| Column | Type | Notes |
|---|---|---|
| id | text (uuid) PK | |
| user_id | text FK → user.id NOT NULL | |
| habit_id | text FK → habits.id | |
| date | text | `YYYY-MM-DD` (local) |
| count | integer | amount achieved that day |
| created_at | integer | |
| updated_at | integer | |
| **UNIQUE(habit_id, date)** | | 1 log per day |

> **Streak:** a day is "complete" if `count >= target_count`; streak = number of consecutive complete days up to today.

---

## 7. Features & Functional Requirements

### 7.1 Module: Todo List

**Description:** a task list with categories, **drag & drop to change priority/order**, mark done, and hide completed items.

- **F-TODO-1:** Add a todo (title required; notes, category optional).
- **F-TODO-2:** Edit & delete a todo.
- **F-TODO-3:** Mark done / undone (checkbox) → set/unset `completed_at`.
- **F-TODO-4:** **Drag & drop reorder (dnd-kit)** to change **priority/order** → update `sort_order`. Order persists permanently.
- **F-TODO-5:** **Show/Hide completed todos** (global toggle).
- **F-TODO-6:** **Categories:** CRUD categories; filter per category; no category → "Uncategorized".
- **F-TODO-7:** *(optional)* due date & priority badge.

**Acceptance criteria:**
- Dragging an item up → `sort_order` updates, order persists after refresh.
- Toggling "hide done" hides completed items without a reload.

**UX:** large checkbox, clear drag handle on mobile, friendly empty state.

---

### 7.2 Module: Reminder

**Description:** simple reminders in the spirit of iPhone Reminders, **in-app visual only** (badge/highlight), no OS notifications.

- **F-REM-1:** Add a reminder (title + `remind_at`).
- **F-REM-2:** Edit & delete.
- **F-REM-3:** Mark complete.
- **F-REM-4:** **Visual indicator when due:** `remind_at <= now` & not done → prominent display + a "due" count badge in the nav.
- **F-REM-5:** Grouped view: **Overdue / Today / Upcoming / Completed**.
- **F-REM-6:** *(optional)* Recurring daily/weekly → on complete, create the next occurrence.

**Constraint (communicated to the user):** reminders are only visible when the app is open; no sound/notification when the tab is closed.

**Due detection:** a client interval (~30–60s) compares `now` vs `remind_at`.

---

### 7.3 Module: Habits Tracker (numeric target)

**Description:** track habits based on a **numeric target** (e.g. 8 glasses), fillable incrementally throughout the day, with streaks.

- **F-HAB-1:** Create a habit (name, target_count, unit).
- **F-HAB-2:** Edit, archive, delete.
- **F-HAB-3:** **+1 / −1 today's count** or enter the number directly (upsert into `habit_logs`).
- **F-HAB-4:** **Daily progress** (e.g. `5/8` + progress ring/bar).
- **F-HAB-5:** **Streak counter**.
- **F-HAB-6:** **Calendar history** (GitHub-style grid) — complete/partial/empty. *(T-HAB-1)*

**Rules:** complete if `count >= target`; resets per day (log per local date).

**Acceptance:** tapping +1 eight times (target 8) → today complete, streak +1; missing a day without completing → streak resets.

---

## 8. Non-Functional Requirements
- **Security:** every endpoint validates the session; queries scoped to `user_id`; secrets server-only.
- **Performance:** optimistic UI (feels <100ms), async DB writes.
- **Responsive:** mobile-first, usable one-handed.
- **Data safety:** confirmation for deletes.
- **Accessibility:** shadcn/ui accessible defaults; tap targets ≥44px.
- **Timezone:** local device timezone for "today" (habits) & reminder grouping.

---

## 9. API Surface (Next.js Route Handlers / Server Actions)

> All endpoints require a valid session; automatically filter by `user_id`.

**Auth (Better Auth):** `/api/auth/*` (handled by Better Auth: sign-in, sign-up, Google callback, sign-out, session).

**Todos**
- `GET /api/todos?category=&showDone=`
- `POST /api/todos`
- `PATCH /api/todos/:id`
- `PATCH /api/todos/reorder` — body: array of `{id, sort_order}`
- `DELETE /api/todos/:id`

**Categories**
- `GET/POST /api/categories`
- `PATCH/DELETE /api/categories/:id`

**Reminders**
- `GET /api/reminders` (grouped)
- `POST /api/reminders`
- `PATCH /api/reminders/:id` (including complete + recurrence)
- `DELETE /api/reminders/:id`

**Habits**
- `GET /api/habits` (including today's log + streak)
- `POST /api/habits`
- `PATCH/DELETE /api/habits/:id`
- `POST /api/habits/:id/log` — `{date, count}` (upsert)
- `GET /api/habits/:id/history?from=&to=`

---

## 10. Pages / Navigation

- **/login**, **/signup** — auth pages (shadcn form + Google button).
- App (protected), bottom nav (mobile) / sidebar (desktop):
  1. **Todo** — list + category filter + hide-done toggle + drag reorder + add button.
  2. **Reminders** — Overdue/Today/Upcoming/Completed groups + due badge.
  3. **Habits** — habit cards (progress ring + +1) + detail (streak + calendar).
- **/settings** — profile, manage categories & habits, sign out, export data (optional).

---

## 11. Project Structure (for the AI agent)

```
/
├─ drizzle.config.ts
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/page.tsx
│  │  ├─ (auth)/signup/page.tsx
│  │  ├─ (app)/todos/page.tsx
│  │  ├─ (app)/reminders/page.tsx
│  │  ├─ (app)/habits/page.tsx
│  │  ├─ (app)/habits/[id]/page.tsx
│  │  ├─ (app)/settings/page.tsx
│  │  ├─ api/
│  │  │  ├─ auth/[...all]/route.ts   # Better Auth handler
│  │  │  ├─ todos/…
│  │  │  ├─ categories/…
│  │  │  ├─ reminders/…
│  │  │  └─ habits/…
│  │  └─ layout.tsx
│  ├─ components/
│  │  ├─ ui/                # shadcn/ui components
│  │  ├─ todo/  reminder/  habit/  auth/
│  ├─ db/
│  │  ├─ schema.ts          # Drizzle schema (§6) + auth tables
│  │  ├─ client.ts          # Turso connection
│  │  └─ migrations/
│  ├─ lib/
│  │  ├─ auth.ts            # Better Auth config (server)
│  │  ├─ auth-client.ts     # Better Auth client hooks
│  │  └─ utils.ts           # streak calc, recurrence, dates
│  ├─ stores/               # Zustand / TanStack Query
│  └─ middleware.ts         # route protection
├─ .env
```

---

## 12. Phased Build Plan (for vibe coding)

**Sprint 0 — Setup & Auth**
1. Init Next.js (App Router, TS) + Tailwind + shadcn/ui.
2. Turso + Drizzle + schema (data + auth tables).
3. Better Auth: email/password + Google OAuth + route-protection middleware + login/signup pages.

**Sprint 1 — Todo**
4. CRUD todo + categories (all scoped to user_id).
5. Done checkbox + hide/show done.
6. Drag & drop reorder (dnd-kit) → priority/order.

**Sprint 2 — Habits**
7. CRUD habit with target.
8. +1/−1 daily count + progress ring.
9. Streak + calendar history.

**Sprint 3 — Reminders**
10. CRUD reminder + time.
11. Overdue/Today/Upcoming groups + due badge (interval checker).
12. Recurrence (optional).

**Sprint 4 — Polish & Deploy**
13. Empty states, delete confirmation, toasts, optimistic UI, settings/sign-out.
14. Final responsiveness + deploy to Vercel + set the production Google OAuth redirect URL.

---

## 13. Definition of Done (MVP)
- Auth works: sign up/in via email & Google, sign out, protected routes, per-user data isolation.
- Todo: CRUD, categories, done, hide-done, **drag reorder priority** — all persist.
- Reminder: due visual + correct grouping.
- Habit: numeric target, incremental +1, streak (calendar per T-HAB-1).
- Deployed & accessible across devices via URL.

---

## 14. Open Questions (need your decision)

| Code | Question | Default |
|---|---|---|
| **T-DB-1** | Turso or Neon (Postgres)? | Turso |
| **T-AUTH-1** | Email verification + password reset in MVP? (needs an email sender, e.g. Resend) | No for MVP |
| **T-AUTH-2** | Open sign-up or invite-only / email whitelist? | Open sign-up |
| **T-TODO-1** | `due_date` & `priority` in MVP or keep it minimal? | Columns exist, minimal UI |
| **T-TODO-2** | Drag reorder global or per-category? | Per active view |
| **T-REM-1** | Recurring reminder in MVP or a later phase? | Later phase (Sprint 3) |
| **T-HAB-1** | Calendar history in MVP or streak first? | Streak first, calendar end of Sprint 2 |
| **T-HAB-2** | Habit input: +1, direct number, or both? | Both |
| **T-UI-1** | Dark mode in MVP, or light first? | Prepare dark mode from the start (toggle) |
| **T-UI-2** | Primary UI language: English or Indonesian? | English |
| **T-GEN-1** | Export/backup data (JSON) in Settings? | Nice-to-have, not MVP |

Answer whichever you'd like to change from the defaults; the rest are considered agreed and ready for the agent.