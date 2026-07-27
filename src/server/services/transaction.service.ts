import { and, desc, eq, gte, like, lte } from "drizzle-orm";

import { db } from "@/db/client";
import {
  accounts,
  financeCategories,
  transactions,
  type Transaction,
} from "@/db/schema";
import { AppError } from "@/lib/api";
import {
  buildLedger,
  monthBounds,
  type MonthKey,
  type MonthLedger,
  type TransactionType,
} from "@/lib/expenses";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "@/lib/validations/transaction";
import { assertAccountOwned } from "./account.service";
import { assertCategoryOwned } from "./finance-category.service";

export type CategoryRef = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
};

export type AccountRef = { id: string; name: string; type: string };

/**
 * A transaction with the two labels the UI needs, resolved server-side.
 *
 * `type` is narrowed from the column's `string` to the union: SQLite has no
 * enum, but every write goes through `createTransactionSchema`, so the value is
 * constrained in practice. Narrowing here means no casts anywhere downstream.
 */
export type TransactionRow = Omit<Transaction, "type"> & {
  type: TransactionType;
  category: CategoryRef | null;
  account: AccountRef | null;
};

export type MonthFilters = {
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  /** Case-insensitive substring match on the note. */
  q?: string;
};

const selection = {
  id: transactions.id,
  userId: transactions.userId,
  type: transactions.type,
  amountMinor: transactions.amountMinor,
  categoryId: transactions.categoryId,
  accountId: transactions.accountId,
  occurredOn: transactions.occurredOn,
  note: transactions.note,
  recurringId: transactions.recurringId,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
  categoryName: financeCategories.name,
  categoryColor: financeCategories.color,
  categoryIcon: financeCategories.icon,
  accountName: accounts.name,
  accountType: accounts.type,
};

type JoinedRow = {
  [K in keyof typeof selection]: K extends
    | "id"
    | "userId"
    | "type"
    | "occurredOn"
    ? string
    : K extends "amountMinor" | "createdAt" | "updatedAt"
      ? number
      : string | null;
};

/** Fold the flat join result into the nested shape the UI consumes. */
function toRow(r: JoinedRow): TransactionRow {
  return {
    id: r.id,
    userId: r.userId,
    type: r.type as TransactionType,
    amountMinor: r.amountMinor,
    categoryId: r.categoryId,
    accountId: r.accountId,
    occurredOn: r.occurredOn,
    note: r.note,
    recurringId: r.recurringId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    category: r.categoryId
      ? {
          id: r.categoryId,
          name: r.categoryName ?? "",
          color: r.categoryColor,
          icon: r.categoryIcon,
        }
      : null,
    account: r.accountId
      ? {
          id: r.accountId,
          name: r.accountName ?? "",
          type: r.accountType ?? "",
        }
      : null,
  };
}

function baseQuery() {
  return db
    .select(selection)
    .from(transactions)
    .leftJoin(
      financeCategories,
      eq(transactions.categoryId, financeCategories.id),
    )
    .leftJoin(accounts, eq(transactions.accountId, accounts.id));
}

/**
 * One month of transactions, grouped by day with per-day and month totals.
 * Grouping and summing happen here — the client renders money, it never
 * aggregates it.
 */
export async function listMonth(
  userId: string,
  month: MonthKey,
  filters: MonthFilters = {},
): Promise<MonthLedger<TransactionRow>> {
  const { start, end } = monthBounds(month);

  const where = [
    eq(transactions.userId, userId),
    gte(transactions.occurredOn, start),
    lte(transactions.occurredOn, end),
  ];

  if (filters.type) where.push(eq(transactions.type, filters.type));
  if (filters.categoryId)
    where.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.accountId)
    where.push(eq(transactions.accountId, filters.accountId));
  if (filters.q) where.push(like(transactions.note, `%${filters.q}%`));

  const rows = await baseQuery()
    .where(and(...where))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt));

  return buildLedger(rows.map(toRow));
}

async function readOne(userId: string, id: string): Promise<TransactionRow> {
  const rows = await baseQuery().where(
    and(eq(transactions.id, id), eq(transactions.userId, userId)),
  );

  if (rows.length === 0) {
    throw new AppError("NOT_FOUND", "That entry no longer exists.");
  }
  return toRow(rows[0]);
}

/**
 * Guard: ids supplied by the client must belong to the same user. The FKs only
 * prove the rows exist — without this a request could attach its transactions
 * to another user's category or account.
 */
async function assertRefsOwned(
  userId: string,
  categoryId?: string | null,
  accountId?: string | null,
): Promise<void> {
  if (categoryId) await assertCategoryOwned(userId, categoryId);
  if (accountId) await assertAccountOwned(userId, accountId);
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
): Promise<TransactionRow> {
  await assertRefsOwned(userId, input.categoryId, input.accountId);

  const now = epochNow();
  const id = newId();

  await db.insert(transactions).values({
    id,
    userId,
    type: input.type,
    amountMinor: input.amountMinor,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
    occurredOn: input.occurredOn,
    note: input.note ?? null,
    recurringId: null,
    createdAt: now,
    updatedAt: now,
  });

  return readOne(userId, id);
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionRow> {
  await assertRefsOwned(userId, input.categoryId, input.accountId);

  const patch: Partial<Transaction> = { updatedAt: epochNow() };
  if (input.type !== undefined) patch.type = input.type;
  if (input.amountMinor !== undefined) patch.amountMinor = input.amountMinor;
  if (input.categoryId !== undefined)
    patch.categoryId = input.categoryId ?? null;
  if (input.accountId !== undefined) patch.accountId = input.accountId ?? null;
  if (input.occurredOn !== undefined) patch.occurredOn = input.occurredOn;
  if (input.note !== undefined) patch.note = input.note ?? null;

  const updated = await db
    .update(transactions)
    .set(patch)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning({ id: transactions.id });

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That entry no longer exists.");
  }

  return readOne(userId, id);
}

export async function deleteTransaction(
  userId: string,
  id: string,
): Promise<void> {
  const deleted = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning({ id: transactions.id });

  if (deleted.length === 0) {
    throw new AppError("NOT_FOUND", "That entry no longer exists.");
  }
}
