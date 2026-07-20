import { and, eq, asc, isNull, max, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, todos, type Todo } from "@/db/schema";
import { AppError } from "@/lib/api";
import { epochNow, newId } from "@/lib/utils";
import type {
  CreateTodoInput,
  UpdateTodoInput,
  ReorderTodosInput,
} from "@/lib/validations/todo";

type ListTodosOptions = {
  /** undefined = all, null = uncategorized only, string = that category. */
  categoryId?: string | null;
  showDone?: boolean;
};

/**
 * List todos for a user. Ordered active-first, then by sort_order (drag order).
 * Scoped to userId. `showDone=false` hides completed items (F-TODO-5).
 */
export async function listTodos(
  userId: string,
  opts: ListTodosOptions = {},
): Promise<Todo[]> {
  const filters = [eq(todos.userId, userId)];

  if (opts.categoryId === null) {
    filters.push(isNull(todos.categoryId));
  } else if (typeof opts.categoryId === "string") {
    filters.push(eq(todos.categoryId, opts.categoryId));
  }

  if (opts.showDone === false) {
    filters.push(eq(todos.isDone, 0));
  }

  return db
    .select()
    .from(todos)
    .where(and(...filters))
    .orderBy(asc(todos.isDone), asc(todos.sortOrder), asc(todos.createdAt));
}

/**
 * Guard: a categoryId supplied by the client must belong to the same user
 * (F-AUTH-6). The FK only proves the category exists — without this check a
 * request could attach todos to another user's category.
 */
async function assertCategoryOwned(
  userId: string,
  categoryId: string,
): Promise<void> {
  const owned = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

  if (owned.length === 0) {
    throw new AppError("NOT_FOUND", "That category no longer exists.");
  }
}

export async function createTodo(
  userId: string,
  input: CreateTodoInput,
): Promise<Todo> {
  if (input.categoryId) await assertCategoryOwned(userId, input.categoryId);

  const [{ value: maxOrder } = { value: null }] = await db
    .select({ value: max(todos.sortOrder) })
    .from(todos)
    .where(eq(todos.userId, userId));

  const row: Todo = {
    id: newId(),
    userId,
    title: input.title,
    notes: input.notes ?? null,
    categoryId: input.categoryId ?? null,
    isDone: 0,
    sortOrder: (maxOrder ?? -1) + 1,
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? 0,
    createdAt: epochNow(),
    completedAt: null,
  };
  await db.insert(todos).values(row);
  return row;
}

export async function updateTodo(
  userId: string,
  id: string,
  input: UpdateTodoInput,
): Promise<Todo> {
  if (input.categoryId) await assertCategoryOwned(userId, input.categoryId);

  const patch: Partial<Todo> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.notes !== undefined) patch.notes = input.notes ?? null;
  if (input.categoryId !== undefined)
    patch.categoryId = input.categoryId ?? null;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate ?? null;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.isDone !== undefined) {
    patch.isDone = input.isDone ? 1 : 0;
    patch.completedAt = input.isDone ? epochNow() : null;
  }

  const updated = await db
    .update(todos)
    .set(patch)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning();

  if (updated.length === 0) {
    throw new AppError("NOT_FOUND", "That task no longer exists.");
  }
  return updated[0];
}

export async function deleteTodo(userId: string, id: string): Promise<void> {
  const deleted = await db
    .delete(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning({ id: todos.id });

  if (deleted.length === 0) {
    throw new AppError("NOT_FOUND", "That task no longer exists.");
  }
}

/**
 * Persist a new drag order (F-TODO-4). Only items owned by the user and
 * present in the payload are updated, in a single transaction.
 */
export async function reorderTodos(
  userId: string,
  input: ReorderTodosInput,
): Promise<void> {
  const ids = input.items.map((i) => i.id);

  // Guard: every id must belong to this user (F-AUTH-6).
  const owned = await db
    .select({ id: todos.id })
    .from(todos)
    .where(and(eq(todos.userId, userId), inArray(todos.id, ids)));

  if (owned.length !== ids.length) {
    throw new AppError("NOT_FOUND", "Some tasks could not be reordered.");
  }

  await db.transaction(async (tx) => {
    for (const item of input.items) {
      await tx
        .update(todos)
        .set({ sortOrder: item.sortOrder })
        .where(and(eq(todos.id, item.id), eq(todos.userId, userId)));
    }
  });
}
