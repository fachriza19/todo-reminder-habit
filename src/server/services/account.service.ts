import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { accounts, type Account } from "@/db/schema";
import { AppError } from "@/lib/api";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from "@/lib/validations/account";

/**
 * Payment methods, seeded on first use for the same reason categories are: the
 * first entry must not require setup. No stored balance — a balance derived
 * from transactions can't drift out of sync with them.
 */
const DEFAULTS: Array<Pick<Account, "name" | "type">> = [
  { name: "Cash", type: "cash" },
  { name: "Bank", type: "bank" },
  { name: "E-wallet", type: "ewallet" },
];

async function seedDefaults(userId: string): Promise<void> {
  const now = epochNow();
  await db.insert(accounts).values(
    DEFAULTS.map((d, i) => ({
      id: newId(),
      userId,
      name: d.name,
      type: d.type,
      color: null,
      sortOrder: i,
      isArchived: 0,
      createdAt: now,
    })),
  );
}

export async function listAccounts(userId: string): Promise<Account[]> {
  const read = () =>
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, 0)))
      .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));

  const existing = await read();
  if (existing.length > 0) return existing;

  const any = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (any.length > 0) return existing;

  await seedDefaults(userId);
  return read();
}

/** Guard: an accountId from the client must belong to the same user. */
export async function assertAccountOwned(
  userId: string,
  accountId: string,
): Promise<void> {
  const owned = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  if (owned.length === 0) {
    throw new AppError("NOT_FOUND", "That account no longer exists.");
  }
}

export async function createAccount(
  userId: string,
  input: CreateAccountInput,
): Promise<Account> {
  const siblings = await db
    .select({ sortOrder: accounts.sortOrder })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const maxOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1);

  const row: Account = {
    id: newId(),
    userId,
    name: input.name,
    type: input.type,
    color: input.color ?? null,
    sortOrder: maxOrder + 1,
    isArchived: 0,
    createdAt: epochNow(),
  };

  await db.insert(accounts).values(row);
  return row;
}

export async function updateAccount(
  userId: string,
  id: string,
  input: UpdateAccountInput,
): Promise<Account> {
  const patch: Partial<Account> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type;
  if (input.color !== undefined) patch.color = input.color ?? null;
  if (input.isArchived !== undefined)
    patch.isArchived = input.isArchived ? 1 : 0;

  const updated = await db
    .update(accounts)
    .set(patch)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That account no longer exists.");
  }
  return updated[0];
}

export async function archiveAccount(
  userId: string,
  id: string,
): Promise<void> {
  await updateAccount(userId, id, { isArchived: true });
}
