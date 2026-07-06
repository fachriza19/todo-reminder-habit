import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
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

export type Category = typeof categories.$inferSelect;
export type Todo = typeof todos.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
