import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { financeCategories, type FinanceCategory } from "@/db/schema";
import { AppError } from "@/lib/api";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateFinanceCategoryInput,
  UpdateFinanceCategoryInput,
} from "@/lib/validations/finance-category";

/**
 * Seeded on first use. Without defaults, logging the very first expense costs
 * the user a setup detour and the module's whole premise — fast entry — fails
 * on day one. Everything here is renameable and archivable.
 */
const DEFAULTS: Array<
  Pick<FinanceCategory, "name" | "kind" | "color" | "icon">
> = [
  { name: "Food & drink", kind: "expense", color: "chart-3", icon: "🍽" },
  { name: "Transport", kind: "expense", color: "chart-1", icon: "🛵" },
  { name: "Groceries", kind: "expense", color: "chart-2", icon: "🛒" },
  { name: "Bills", kind: "expense", color: "chart-4", icon: "🧾" },
  { name: "Shopping", kind: "expense", color: "chart-5", icon: "🛍" },
  { name: "Health", kind: "expense", color: "chart-2", icon: "💊" },
  { name: "Entertainment", kind: "expense", color: "chart-1", icon: "🎬" },
  { name: "Other", kind: "expense", color: "chart-5", icon: "📦" },
  { name: "Salary", kind: "income", color: "chart-2", icon: "💼" },
  { name: "Other income", kind: "income", color: "chart-2", icon: "💰" },
];

async function seedDefaults(userId: string): Promise<void> {
  const now = epochNow();
  await db.insert(financeCategories).values(
    DEFAULTS.map((d, i) => ({
      id: newId(),
      userId,
      name: d.name,
      kind: d.kind,
      color: d.color,
      icon: d.icon,
      sortOrder: i,
      isArchived: 0,
      createdAt: now,
    })),
  );
}

/**
 * List a user's active categories, seeding the defaults the first time. An
 * empty result is itself the "never used this module" signal, so steady-state
 * reads cost no extra query.
 */
export async function listFinanceCategories(
  userId: string,
): Promise<FinanceCategory[]> {
  const read = () =>
    db
      .select()
      .from(financeCategories)
      .where(
        and(
          eq(financeCategories.userId, userId),
          eq(financeCategories.isArchived, 0),
        ),
      )
      .orderBy(
        asc(financeCategories.sortOrder),
        asc(financeCategories.createdAt),
      );

  const existing = await read();
  if (existing.length > 0) return existing;

  // Check for archived-only before seeding, or archiving everything would
  // resurrect the defaults on the next read.
  const any = await db
    .select({ id: financeCategories.id })
    .from(financeCategories)
    .where(eq(financeCategories.userId, userId))
    .limit(1);
  if (any.length > 0) return existing;

  await seedDefaults(userId);
  return read();
}

/**
 * Guard: a categoryId supplied by the client must belong to the same user.
 * The FK only proves the row exists — without this a request could attach
 * transactions to another user's category.
 */
export async function assertCategoryOwned(
  userId: string,
  categoryId: string,
): Promise<void> {
  const owned = await db
    .select({ id: financeCategories.id })
    .from(financeCategories)
    .where(
      and(
        eq(financeCategories.id, categoryId),
        eq(financeCategories.userId, userId),
      ),
    );

  if (owned.length === 0) {
    throw new AppError("NOT_FOUND", "That category no longer exists.");
  }
}

export async function createFinanceCategory(
  userId: string,
  input: CreateFinanceCategoryInput,
): Promise<FinanceCategory> {
  const siblings = await db
    .select({ sortOrder: financeCategories.sortOrder })
    .from(financeCategories)
    .where(eq(financeCategories.userId, userId));

  const maxOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1);

  const row: FinanceCategory = {
    id: newId(),
    userId,
    name: input.name,
    kind: input.kind,
    color: input.color ?? null,
    icon: input.icon ?? null,
    sortOrder: maxOrder + 1,
    isArchived: 0,
    createdAt: epochNow(),
  };

  await db.insert(financeCategories).values(row);
  return row;
}

export async function updateFinanceCategory(
  userId: string,
  id: string,
  input: UpdateFinanceCategoryInput,
): Promise<FinanceCategory> {
  const patch: Partial<FinanceCategory> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color ?? null;
  if (input.icon !== undefined) patch.icon = input.icon ?? null;
  if (input.isArchived !== undefined)
    patch.isArchived = input.isArchived ? 1 : 0;

  const updated = await db
    .update(financeCategories)
    .set(patch)
    .where(
      and(eq(financeCategories.id, id), eq(financeCategories.userId, userId)),
    )
    .returning();

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That category no longer exists.");
  }
  return updated[0];
}

/**
 * Archive, never delete: past transactions keep their category name. The
 * schema's `onDelete: "set null"` is the fallback for a real deletion.
 */
export async function archiveFinanceCategory(
  userId: string,
  id: string,
): Promise<void> {
  await updateFinanceCategory(userId, id, { isArchived: true });
}
