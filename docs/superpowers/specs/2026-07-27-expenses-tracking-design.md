# Design — Expenses Module (Expenses · Income · Budgets)

**Date:** 2026-07-27
**Status:** Approved for planning
**Module:** `expenses` — the fourth domain module alongside todo, reminder, habit
**Prototype:** https://claude.ai/code/artifact/16f2b2ec-e03a-42e1-8cc4-5d0ff872a2c4

---

## 1. Summary

A money-tracking module inside Toreha. The owner logs what they spend (and earn), sees where it went, and gets told when a category is running out of budget. Everything is single-user, single-currency, and manual entry — no bank sync, no OCR, no forecasting.

The module follows the existing architecture blueprint in `PRD-personal-productivity-app.md` §5A and the design principles in §5B. Nothing here introduces a new pattern.

### 1.1 Goals

- **Logging an expense takes ≤3 taps.** If entry is slow, the data stops being entered and the module is worthless.
- **One screen answers "where did my money go this month".**
- **Budgets warn before the month ends,** not after.
- Recurring costs (rent, subscriptions) appear on their own, with no manual re-entry.
- Data exportable to CSV — the user is never locked in.

### 1.2 Non-goals

- No bank/e-wallet sync, no receipt OCR, no receipt image attachments (Turso stores no blobs; adding object storage is a separate decision).
- No multi-currency and no FX rates.
- No shared/household budgets, no splitting bills.
- No forecasting, savings goals, net-worth tracking, or "financial health scores".
- No transfers between accounts in this version (the data model leaves room; see §11).

### 1.3 Success criteria

- Adding a typical expense from the month view: ≤3 taps, ≤5 seconds, one hand.
- Month view first paint shows real numbers (server-prefetched, per the existing pattern in `src/lib/query/server.ts`).
- Recurring costs for the current month exist without the user doing anything.
- All amounts are exact — no floating-point money anywhere in the stack.

---

## 2. Scope and phasing

The full scope is three features' worth of work. It ships in three phases; each phase is independently useful and independently shippable.

| Phase | Contents | Useful on its own? |
|---|---|---|
| **P1 — Ledger** | Schema, finance categories, accounts, transactions (expense + income), month view, add/edit sheet with both input modes, delete + undo | Yes — full manual tracking |
| **P2 — Budgets & insights** | Budgets with history, month summary endpoint, budget bars, insights screen | Yes — adds the "am I overspending" answer |
| **P3 — Automation & export** | Recurring rules with lazy materialization, upcoming-repeats rail, CSV export | Yes — removes repeated manual entry |

Each phase gets its own implementation plan. This document specifies all three so the schema is designed once and not migrated twice.

---

## 3. Data model

Four new tables plus one shared with nothing else. All follow existing conventions: text `id` from `crypto.randomUUID()`, `user_id` FK with `onDelete: "cascade"`, epoch-ms integer timestamps, `sort_order` integer, `is_archived` integer flag.

### 3.1 `finance_categories`

```ts
export const financeCategories = sqliteTable("finance_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),                       // ≤40 chars
  kind: text("kind").notNull(),                       // 'expense' | 'income'
  color: text("color"),                               // token name: chart-1..chart-5
  icon: text("icon"),                                 // single emoji, optional
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: integer("is_archived").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
```

**Decision: a new table, not the existing `categories`.** Todo categories ("Work", "Errands") and spend categories ("Food & drink", "Transport") are different vocabularies. Sharing one table would pollute both filter UIs and force a `kind` discriminator onto a table three other modules already read. Same *pattern*, separate table.

### 3.2 `accounts`

Payment methods / money sources.

```ts
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),                       // ≤40 chars
  type: text("type").notNull(),                       // 'cash' | 'bank' | 'ewallet' | 'card'
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: integer("is_archived").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
```

No `balance` column. Balances are derived from transactions; a stored balance is a second source of truth that drifts. Per-account totals are computed in the summary query.

### 3.3 `transactions`

```ts
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),                       // 'expense' | 'income'
  amountMinor: integer("amount_minor").notNull(),     // always positive; sign comes from type
  categoryId: text("category_id").references(() => financeCategories.id, { onDelete: "set null" }),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  occurredOn: text("occurred_on").notNull(),          // 'YYYY-MM-DD' local
  note: text("note"),                                 // ≤200 chars
  recurringId: text("recurring_id").references(() => recurringRules.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  index("tx_user_month_idx").on(t.userId, t.occurredOn),
  unique("tx_recurring_date_uq").on(t.recurringId, t.occurredOn),
]);
```

**Decision: one table with a `type` discriminator, not separate `expenses`/`incomes` tables.** Income and expense share every field. Splitting them duplicates the entire module for a boolean, and forces every timeline read to merge-sort two queries. A single table sorts, paginates and totals in one pass, and leaves `type: 'transfer'` available later.

**Decision: `amount_minor` is an integer, always.** No floats, no decimals, anywhere — not in the DB, not in the API, not in React state. For IDR (`decimals: 0`) one minor unit is one rupiah. Formatting and parsing live in one place, `src/lib/money.ts`.

**Decision: `occurred_on` is TEXT `'YYYY-MM-DD'` in local time,** the same precedent `habit_logs.date` set. A month query is `occurred_on LIKE '2026-07%'` — index-friendly and immune to timezone drift. `created_at`/`updated_at` stay epoch ms per §5A.5. All "today" values come from the existing `getLocalToday()` in `src/lib/utils.ts` — never computed ad-hoc.

**`unique(recurring_id, occurred_on)`** is what makes lazy materialization safe under concurrent requests (§6). It permits many NULL-`recurring_id` rows on the same date, because SQLite treats NULLs as distinct in unique indexes.

### 3.4 `budgets`

```ts
export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => financeCategories.id, { onDelete: "cascade" }),
  amountMinor: integer("amount_minor").notNull(),
  startMonth: text("start_month").notNull(),          // 'YYYY-MM', inclusive
  endMonth: text("end_month"),                        // 'YYYY-MM', inclusive; NULL = still active
  createdAt: integer("created_at").notNull(),
});
```

`category_id = NULL` means an overall monthly budget across all expenses.

**Decision: budget history via `start_month` / `end_month`, not a row per month.** A monthly limit is a standing rule, so one row expresses it. Editing a budget closes the current row (`end_month` = last month) and opens a new one — past months keep the limit they were actually judged against, and there is no job creating twelve rows a year.

Resolving the budget for month `M`:
```sql
WHERE user_id = ? AND start_month <= ? AND (end_month IS NULL OR end_month >= ?)
```

### 3.5 `recurring_rules`

```ts
export const recurringRules = sqliteTable("recurring_rules", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),                       // 'expense' | 'income'
  amountMinor: integer("amount_minor").notNull(),
  categoryId: text("category_id").references(() => financeCategories.id, { onDelete: "set null" }),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  note: text("note"),
  frequency: text("frequency").notNull(),             // 'daily' | 'weekly' | 'monthly' | 'yearly'
  dayOfMonth: integer("day_of_month"),                // 1..31, for monthly/yearly
  monthOfYear: integer("month_of_year"),              // 1..12, for yearly
  weekday: integer("weekday"),                        // 0..6, Sunday=0, for weekly
  startOn: text("start_on").notNull(),                // 'YYYY-MM-DD'
  endOn: text("end_on"),                              // 'YYYY-MM-DD', optional
  nextRunOn: text("next_run_on").notNull(),           // 'YYYY-MM-DD'
  lastRunOn: text("last_run_on"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});
```

`recurrence` naming intentionally mirrors `reminders.recurrence` so the two can be generalized later (§5A.7).

### 3.6 Seeded defaults

On a user's first read of any expenses endpoint, the service seeds defaults inside one transaction, keyed off "user has zero finance categories":

- **Expense categories:** Food & drink 🍽, Transport 🛵, Groceries 🛒, Bills 🧾, Shopping 🛍, Health 💊, Entertainment 🎬, Other 📦
- **Income categories:** Salary 💼, Other income 💰
- **Accounts:** Cash 💵, Bank 💳, E-wallet 📱

Without this, the first expense costs the user a setup detour and the "≤3 taps" goal fails on day one. Everything is renameable and archivable.

---

## 4. Layering and module structure

Exactly the §5A.2 anatomy, replicated:

```
src/
├─ db/schema.ts                          # + finance_categories, accounts, transactions, budgets, recurring_rules
├─ lib/money.ts                          # formatMoney / parseAmountInput / CURRENCY config
├─ lib/expenses.ts                        # month helpers: monthKey(), monthRange(), nextRunDate()
├─ lib/validations/transaction.ts         # Zod: create/update/list-query
├─ lib/validations/finance-category.ts
├─ lib/validations/account.ts
├─ lib/validations/budget.ts
├─ lib/validations/recurring.ts
├─ server/services/transaction.service.ts # list, create, update, remove, summary
├─ server/services/finance-category.service.ts
├─ server/services/account.service.ts
├─ server/services/budget.service.ts
├─ server/services/recurring.service.ts   # rule CRUD + runDueRecurring()
├─ app/api/transactions/route.ts          # GET (month) / POST
├─ app/api/transactions/[id]/route.ts     # PATCH / DELETE
├─ app/api/transactions/summary/route.ts  # GET  ?month=YYYY-MM
├─ app/api/transactions/export/route.ts   # GET  ?from=&to=  → text/csv
├─ app/api/finance-categories/route.ts    # GET / POST  (+ [id], /reorder)
├─ app/api/accounts/route.ts              # GET / POST  (+ [id])
├─ app/api/budgets/route.ts               # GET / POST  (+ [id])
├─ app/api/recurring/route.ts             # GET / POST  (+ [id])
├─ hooks/use-transactions.ts              # useTransactions(month), useCreateTransaction(), …
├─ hooks/use-expense-summary.ts
├─ hooks/use-finance-categories.ts
├─ hooks/use-accounts.ts
├─ hooks/use-budgets.ts
├─ hooks/use-recurring.ts
├─ components/expenses/
│  ├─ expenses-view.tsx                   # page shell, month state
│  ├─ month-switcher.tsx
│  ├─ month-summary.tsx                   # Spent / Earned / Left
│  ├─ budget-bars.tsx
│  ├─ transaction-list.tsx                # day grouping + subtotals
│  ├─ transaction-item.tsx
│  ├─ transaction-sheet.tsx               # add/edit, both input modes
│  ├─ amount-field.tsx                    # the input + numpad contract
│  ├─ numpad.tsx
│  ├─ category-chips.tsx
│  ├─ account-picker.tsx
│  ├─ insights-panel.tsx
│  ├─ recurring-manager.tsx
│  ├─ transaction-empty.tsx
│  └─ transaction-skeleton.tsx
└─ app/(app)/expenses/
   ├─ page.tsx                            # server-prefetch + hydrate
   └─ loading.tsx                         # skeleton
```

Dependency direction is one-way per §5A.3: components → hooks → route handlers → services → Drizzle. Services take `userId` and know nothing about HTTP.

### 4.1 API contract

Every endpoint returns the §5A.4 shape: `{ data, error: null }` or `{ data: null, error: { code, message } }`, with codes `UNAUTHORIZED | VALIDATION_ERROR | NOT_FOUND | FORBIDDEN | INTERNAL`.

`GET /api/transactions?month=2026-07&type=&categoryId=&accountId=&q=` returns:

```jsonc
{
  "data": {
    "days": [
      { "date": "2026-07-27", "expenseMinor": 118000, "incomeMinor": 0,
        "items": [ { "id": "…", "type": "expense", "amountMinor": 25000,
                     "category": { "id": "…", "name": "Food & drink", "color": "chart-3", "icon": "☕" },
                     "account": { "id": "…", "name": "Cash", "type": "cash" },
                     "occurredOn": "2026-07-27", "note": "Kopi Tuku", "recurringId": null } ] }
    ],
    "totals": { "expenseMinor": 4182000, "incomeMinor": 12500000, "netMinor": 8318000 }
  },
  "error": null
}
```

Day grouping and subtotals are computed **server-side**. The client renders; it does not aggregate money.

`GET /api/transactions/summary?month=2026-07` returns per-category totals, budget progress rows, per-account totals, and a six-month spending trend — everything the insights screen needs, in one request.

### 4.2 Ownership validation

Before any insert or update, the route handler verifies that the supplied `categoryId` and `accountId` belong to the session user. Passing a foreign UUID must return `FORBIDDEN`, not silently write a cross-user reference. (This closes the gap noted in the todos module's `categoryId` handling.)

---

## 5. Money handling

`src/lib/money.ts` is the only place money is formatted or parsed.

```ts
export const CURRENCY = { code: "IDR", symbol: "Rp", decimals: 0, locale: "id-ID" } as const;

formatMoney(minor: number): string          // 25000 → "Rp 25.000"
formatMoneyCompact(minor: number): string   // 25000 → "25.000"   (for dense columns)
parseAmountInput(raw: string): number       // "25.000" | "25000" → 25000
```

Rules:
- `amountMinor` is a positive integer. Sign is presentational and derives from `type`.
- Zod validates `int().positive().max(999_999_999_999)` — roughly a trillion rupiah, well inside `Number.MAX_SAFE_INTEGER`, and enough that a fat-fingered entry is caught.
- Every total is summed in SQL (`SUM`), never in JavaScript across paginated pages.
- All digit columns get `font-variant-numeric: tabular-nums`.

Currency is a module-level constant, not a user setting. Making it configurable later means changing `CURRENCY` and adding a settings row — no data migration, because `amount_minor` is already scale-aware.

---

## 6. Recurring transactions

**Decision: lazy materialization on read.**

Netlify's free tier has no dependable scheduler, and this app has already committed to being in-app-only (reminders fire no push). So generation happens when the user looks:

1. `GET /api/transactions` and `GET /api/transactions/summary` both call `runDueRecurring(userId, getLocalToday())` before reading.
2. For every active rule where `next_run_on <= today`, insert a real `transactions` row with `recurring_id` set, then advance `next_run_on`. Loop until `next_run_on > today` or `end_on` passes.
3. All inserts and the rule update happen in one Drizzle transaction per rule.
4. The `unique(recurring_id, occurred_on)` index makes a duplicate insert from a concurrent request fail harmlessly; the conflict is swallowed and the rule advanced.

Materialized rows are ordinary transactions: editable, deletable, counted in budgets, present in CSV. Editing one does not change the rule. Deleting one does not resurrect it — the unique index is what prevents that.

**Catch-up cap:** at most 60 instances per rule per run. If a rule has been dormant longer, `next_run_on` jumps forward to the current period and the run stops — a rule forgotten for three years must not insert a thousand rows on a page load.

**Next-date arithmetic** lives in `nextRunDate(rule, from)` in `src/lib/expenses.ts`, pure and unit-tested:
- `monthly` with `day_of_month = 31` clamps to the last day of shorter months (Feb → 28/29), and does **not** drift permanently — the following month returns to 31.
- `weekly` advances to the next matching weekday.
- `yearly` uses `month_of_year` + `day_of_month`, with the same clamping (29 Feb → 28 Feb in common years).
- Dates are computed on `'YYYY-MM-DD'` strings via `date-fns`; no `Date` arithmetic across timezones.

---

## 7. UX specification

Reference prototype: https://claude.ai/code/artifact/16f2b2ec-e03a-42e1-8cc4-5d0ff872a2c4

### 7.1 Navigation

One new sidebar item, **Expenses** (`lucide-react` `Wallet`), placed after Habits in `NAV_ITEMS`. No sub-routes — budgets and insights are sections of `/expenses`, not separate pages.

### 7.2 Month view (`/expenses`)

Top to bottom: month switcher → summary strip → budget bars → transaction list. FAB pinned bottom-right.

**Month switcher.** `‹ July 2026 ›`. State lives in a URL search param (`?m=2026-07`) so a month is linkable and the back button works. Default is the current month.

**Summary strip.** Three cells: Spent · Earned · Left. Currency symbol omitted inside the strip — the whole page is one currency and the labels carry the meaning. "Left" is `income − expense` for the month, in the primary accent; it is not a bank balance and is never presented as one.

**Budget bars.** Only categories with a budget for that month appear. Under budget: primary blue. Over budget: `--warning` amber plus a line stating the overage and days remaining ("▲ 180.000 over, 4 days left in the month"). Never red, never an alert icon — overspending is information, not a system error.

**Transaction list.** Grouped by day, newest first, with a sticky day header carrying the day's subtotal. A day with both expense and income shows both figures (`−107.000 · +2.500.000`) rather than a misleading net. Income rows use `--success` and a `+` prefix; expense rows use the foreground color and `−`. Recurring-generated rows carry a small `↻ Monthly` badge.

Rows are long-text safe per the existing convention: `min-w-0` on the row root, `TruncatedText` for notes and category names.

**Interactions.**
- Tap a row → the same sheet, prefilled, titled "Edit".
- Swipe a row (or the row's overflow menu on desktop) → delete, with an undo toast. No confirmation dialog — the action is reversible (§5B.3).
- Filter control opens a popover: type, category, account, and a note search.

### 7.3 Add / edit sheet — the critical path

Opens from the FAB with the amount field already focused. Layout top to bottom: `[Expense | Income]` segmented control and the input-mode toggle · amount · category chips · account / date / note / repeat chips · keypad or system keyboard.

**Three taps to save:** type the amount, tap a category, tap Save. Everything else has a default.

**Amount.**
- The field is a real `<input inputmode="decimal">` in both modes. It is never a display-only element wrapped around a custom widget, so paste, dictation, hardware keyboards, and the system numeric keypad all work.
- Formatting is applied live (`25000` → `25.000`) with the caret pinned to the end; only digits are retained from input.
- Amount is the only required field. Save enables the moment it is non-zero.

**Two input modes, one sheet.**
- **Numpad (default on touch):** an in-sheet grid — `7 8 9 / 4 5 6 / 1 2 3 / 0 000 C`, with `⌫` and a **Save button spanning two rows on the right**, the largest and most thumb-reachable target. The `000` key exists because rupiah amounts are thousands: 25.000 is four taps.
- **System keyboard:** the header toggle (`⌨ Keyboard` / `🔢 Numpad`) collapses the numpad and focuses the input, raising the OS keyboard. **Save relocates to a full-width button above the keyboard** so it is never occluded — this is the single most common failure of quick-add sheets on mobile.
- The chosen mode is persisted per device in `localStorage` and restored on the next open.
- Notes always use the system keyboard.

**Category chips.** Horizontally scrolling toggle buttons, ordered by the user's own usage (most-used first, computed server-side over the last 90 days), with a trailing "＋ New" chip. No dropdown, no modal, no second screen. Switching to Income swaps the chip set to income categories.

**Account / date / note / repeat chips.** Account defaults to last-used, date defaults to today. A solid chip means "set"; a dashed chip means "optional, not set". The date chip opens Today / Yesterday / pick-a-date. The repeat chip opens the recurrence editor and, when set, converts the entry into a rule that also creates today's instance.

**Mode color logic.** In income mode the amount and the Save button turn `--success`. The mode is never ambiguous.

**Desktop.** The sheet is replaced by an inline add row at the top of the list. `N` focuses it, digits type the amount, `Tab` reaches the chips, `Enter` saves and refocuses the row for the next entry — batch entry for catching up on a week. `Esc` clears. The sheet remains available for editing.

### 7.4 Insights

One question per block: **Where it went** (categories ranked as horizontal bars with percentage and amount — not a pie chart, because bars sort, label and compare themselves) · **Last 6 months** (bar trend with the current month emphasized, so a single month's total has context) · **Accounts** (per-account totals for the month).

No forecasts, no scores, no advice. The app reports; the user decides.

### 7.5 Budgets editor

Reached from "Edit" beside the budget block. A list of expense categories with an optional monthly amount each, plus one overall budget. Saving a changed amount closes the current `budgets` row and opens a new one starting this month (§3.4).

### 7.6 CSV export

Settings → Expenses → Export, and a menu item on the month view. `GET /api/transactions/export?from=&to=` streams `text/csv` with `Content-Disposition: attachment`, columns: `date,type,amount,currency,category,account,note`. Amounts are written as plain integers so spreadsheets do not re-interpret them.

### 7.7 Required states

Per §5B.4, every list handles all three:

- **Empty (no transactions this month):** a light wallet icon, "Nothing logged for July yet. Add your first expense 👇", and the add button. Never a blank screen.
- **Empty (never used the module):** the seeded categories are already present, so the same empty state applies — the user goes straight to adding.
- **Loading:** `transaction-skeleton.tsx` mirroring the day-grouped layout, plus `loading.tsx` for the route.
- **Error:** what failed and how to retry, in a calm tone. Mutation failures roll back the optimistic update and surface a toast with a Retry action.

### 7.8 Accessibility

- Numpad keys are real `<button>`s with `aria-label`s; the whole pad is reachable by keyboard.
- Chips are toggle buttons with `aria-pressed`.
- The sheet is a Base UI dialog: focus trapped, `Esc` closes, focus returns to the FAB.
- Every tap target ≥44px.
- Amount and note inputs have associated labels; live-formatted values are announced via the input's own value, not a separate live region.
- Color never carries meaning alone — income has a `+` sign, over-budget has a text line.
- `prefers-reduced-motion` disables the sheet slide and bar-fill transitions.

---

## 8. Client state and caching

Follows the existing pattern exactly:

- **Server prefetch + hydrate.** `app/(app)/expenses/page.tsx` prefetches the current month via `src/lib/query/server.ts` and hydrates the client cache, matching the fix already applied to the other routes.
- **Query keys:** `["transactions", month, filters]`, `["expense-summary", month]`, `["finance-categories"]`, `["accounts"]`, `["budgets", month]`, `["recurring"]`.
- **Optimistic mutations** with the standard `onMutate` snapshot → patch → `onError` rollback → `onSettled` invalidate. Creating a transaction invalidates both the month list and the summary.
- **Zustand** holds sheet UI state only (open/closed, editing id, input mode) — never server data.

---

## 9. Testing

Vitest, matching the existing suite's scope (pure logic, not React rendering):

| Area | Cases |
|---|---|
| `lib/money.ts` | format grouping; parse strips separators; parse rejects letters; round-trip identity; zero and max bounds |
| `lib/expenses.ts` | `monthKey`/`monthRange` boundaries incl. December→January; day grouping order |
| `nextRunDate()` | monthly day-31 clamping into February and back out; leap-year 29 Feb yearly; weekly wrap across the week; `end_on` termination |
| `runDueRecurring()` | generates exactly the missed instances; is idempotent on a second run; respects the 60-instance cap; skips inactive rules |
| Budget resolution | picks the row covering a given month; ignores closed rows; overall vs per-category |
| Summary totals | expense/income separation; excludes other users' rows |

Ownership enforcement (foreign `categoryId` → `FORBIDDEN`) gets a service-level test.

---

## 10. Migration

One Drizzle migration adds five tables and two indexes. No existing table is altered. `pnpm db:generate` then `pnpm db:migrate`, per the project's standard flow. There is no data to backfill.

---

## 11. Deliberately deferred

Recorded so the next person does not re-litigate them:

- **Transfers between accounts.** The `type` column has room for `'transfer'`; a transfer needs a second account reference and must be excluded from spending totals. Not needed until per-account balances matter.
- **Receipt images.** Requires object storage; Turso cannot hold blobs.
- **Multi-currency.** `amount_minor` is already scale-aware, so this is additive: a `currency` column plus rate storage.
- **Budget rollover** (unspent budget carrying to the next month). A rule change, not a schema change.
- **Splitting a transaction across categories.** Would need a line-items table; personal tracking rarely justifies it.

---

## 12. Open questions

None blocking. Two judgement calls made in this document, flagged for the owner to reverse cheaply if wrong:

1. **"Left" = income − expense for the month**, not a running account balance. Reversing this means computing balances from all history, which requires opening balances per account.
2. **Recurring instances are materialized, not virtual.** Reversing this would break editing, budgets and CSV, so it is effectively a one-way decision — it is called out here for that reason.
