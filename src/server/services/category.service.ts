import { and, eq, asc, max } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, type Category } from "@/db/schema";
import { AppError } from "@/lib/api";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/lib/validations/category";

/** All categories for a user, ordered for display. Scoped to userId. */
export async function listCategories(userId: string): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.sortOrder), asc(categories.createdAt));
}

export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
): Promise<Category> {
  const [{ value: maxOrder } = { value: null }] = await db
    .select({ value: max(categories.sortOrder) })
    .from(categories)
    .where(eq(categories.userId, userId));

  const row: Category = {
    id: newId(),
    userId,
    name: input.name,
    color: input.color ?? null,
    sortOrder: (maxOrder ?? -1) + 1,
    createdAt: epochNow(),
  };
  await db.insert(categories).values(row);
  return row;
}

export async function updateCategory(
  userId: string,
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  const patch: Partial<Category> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color ?? null;

  const updated = await db
    .update(categories)
    .set(patch)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That category no longer exists.");
  }
  return updated[0];
}

export async function deleteCategory(
  userId: string,
  id: string,
): Promise<void> {
  const deleted = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning({ id: categories.id });

  if (deleted.length === 0) {
    throw new AppError("NOT_FOUND", "That category no longer exists.");
  }
}
