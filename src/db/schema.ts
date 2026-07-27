import {
  sqliteTable,
  text,
  integer,
  unique,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Better Auth tables                                                  */
/* Managed by the Better Auth Drizzle adapter (user/session/account/   */
/* verification). Column names must match Better Auth's defaults.      */
/* ------------------------------------------------------------------ */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

/* ------------------------------------------------------------------ */
/* App tables (PRD §6). Every table has user_id. Timestamps = epoch ms.*/
/* ------------------------------------------------------------------ */

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes"),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  isDone: integer("is_done").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  dueDate: integer("due_date"),
  priority: integer("priority").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
});

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  remindAt: integer("remind_at").notNull(),
  isDone: integer("is_done").notNull().default(0),
  recurrence: text("recurrence").notNull().default("none"),
  recurrenceDays: text("recurrence_days"),
  createdAt: integer("created_at").notNull(),
  completedAt: integer("completed_at"),
});

export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetCount: integer("target_count").notNull(),
  unit: text("unit"),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: integer("is_archived").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD (local)
    count: integer("count").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [unique().on(t.habitId, t.date)],
);

/* ------------------------------------------------------------------ */
/* Expenses module (spec 2026-07-27). Money = integer minor units;     */
/* occurred_on = local 'YYYY-MM-DD' like habit_logs.date.              */
/* ------------------------------------------------------------------ */

export const financeCategories = sqliteTable("finance_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'expense' | 'income'
  color: text("color"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: integer("is_archived").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'cash' | 'bank' | 'ewallet' | 'card'
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: integer("is_archived").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const recurringRules = sqliteTable("recurring_rules", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  categoryId: text("category_id").references(() => financeCategories.id, {
    onDelete: "set null",
  }),
  accountId: text("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  note: text("note"),
  frequency: text("frequency").notNull(), // 'daily' | 'weekly' | 'monthly' | 'yearly'
  dayOfMonth: integer("day_of_month"),
  monthOfYear: integer("month_of_year"),
  weekday: integer("weekday"),
  startOn: text("start_on").notNull(),
  endOn: text("end_on"),
  nextRunOn: text("next_run_on").notNull(),
  lastRunOn: text("last_run_on"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'expense' | 'income'
    amountMinor: integer("amount_minor").notNull(), // always positive
    categoryId: text("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    occurredOn: text("occurred_on").notNull(), // 'YYYY-MM-DD' local
    note: text("note"),
    recurringId: text("recurring_id").references(() => recurringRules.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("tx_user_month_idx").on(t.userId, t.occurredOn),
    // Guards lazy materialisation (P3) against duplicate inserts from
    // concurrent requests. NULLs are distinct in SQLite unique indexes, so
    // ordinary manual rows are unaffected.
    unique("tx_recurring_date_uq").on(t.recurringId, t.occurredOn),
  ],
);

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => financeCategories.id, {
    onDelete: "cascade",
  }), // NULL = overall monthly budget
  amountMinor: integer("amount_minor").notNull(),
  startMonth: text("start_month").notNull(), // 'YYYY-MM', inclusive
  endMonth: text("end_month"), // 'YYYY-MM', inclusive; NULL = still active
  createdAt: integer("created_at").notNull(),
});

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const categoriesRelations = relations(categories, ({ many }) => ({
  todos: many(todos),
}));

export const todosRelations = relations(todos, ({ one }) => ({
  category: one(categories, {
    fields: [todos.categoryId],
    references: [categories.id],
  }),
}));

export const habitsRelations = relations(habits, ({ many }) => ({
  logs: many(habitLogs),
}));

export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
  habit: one(habits, {
    fields: [habitLogs.habitId],
    references: [habits.id],
  }),
}));

export const financeCategoriesRelations = relations(
  financeCategories,
  ({ many }) => ({ transactions: many(transactions) }),
);

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(financeCategories, {
    fields: [transactions.categoryId],
    references: [financeCategories.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type Todo = typeof todos.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
export type FinanceCategory = typeof financeCategories.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
