import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedUser, setupTestDb, type TestDb } from "./__helpers__/test-db";

let db: TestDb;

vi.mock("@/db/client", () => ({
  get db() {
    return db;
  },
}));

const { listAccounts } = await import("./account.service");
const { listFinanceCategories } = await import("./finance-category.service");
const { createTransaction, deleteTransaction, listMonth, updateTransaction } =
  await import("./transaction.service");

describe("transactions", () => {
  let userId: string;
  let categoryId: string;
  let accountId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    userId = await seedUser(db);
    categoryId = (await listFinanceCategories(userId))[0].id;
    accountId = (await listAccounts(userId))[0].id;
  });

  const expense = (occurredOn: string, amountMinor: number) => ({
    type: "expense" as const,
    amountMinor,
    categoryId,
    accountId,
    occurredOn,
    note: null,
  });

  it("creates a transaction with its category and account attached", async () => {
    const created = await createTransaction(
      userId,
      expense("2026-07-27", 25000),
    );
    expect(created.amountMinor).toBe(25000);
    expect(created.category?.id).toBe(categoryId);
    expect(created.account?.id).toBe(accountId);
    expect(created.recurringId).toBeNull();
  });

  it("lists a month grouped by day with totals", async () => {
    await createTransaction(userId, expense("2026-07-27", 25000));
    await createTransaction(userId, expense("2026-07-25", 100000));
    await createTransaction(userId, {
      ...expense("2026-07-26", 2500000),
      type: "income",
    });

    const ledger = await listMonth(userId, "2026-07");

    expect(ledger.days.map((d) => d.date)).toEqual([
      "2026-07-27",
      "2026-07-26",
      "2026-07-25",
    ]);
    expect(ledger.totals).toEqual({
      expenseMinor: 125000,
      incomeMinor: 2500000,
      netMinor: 2375000,
    });
  });

  it("excludes other months", async () => {
    await createTransaction(userId, expense("2026-07-31", 1000));
    await createTransaction(userId, expense("2026-08-01", 9999));
    const ledger = await listMonth(userId, "2026-07");
    expect(ledger.totals.expenseMinor).toBe(1000);
  });

  it("excludes other users' rows", async () => {
    await createTransaction(userId, expense("2026-07-27", 25000));
    const other = await seedUser(db, "user-2");
    const ledger = await listMonth(other, "2026-07");
    expect(ledger.days).toEqual([]);
    expect(ledger.totals.expenseMinor).toBe(0);
  });

  it("filters by type, category and account", async () => {
    await createTransaction(userId, expense("2026-07-27", 25000));
    await createTransaction(userId, {
      ...expense("2026-07-27", 2500000),
      type: "income",
    });

    const onlyExpense = await listMonth(userId, "2026-07", { type: "expense" });
    expect(onlyExpense.totals.incomeMinor).toBe(0);

    const byCategory = await listMonth(userId, "2026-07", { categoryId });
    expect(byCategory.totals.expenseMinor).toBe(25000);

    const byAccount = await listMonth(userId, "2026-07", { accountId });
    expect(byAccount.days[0].items).toHaveLength(2);
  });

  it("searches notes", async () => {
    await createTransaction(userId, {
      ...expense("2026-07-27", 25000),
      note: "Kopi Tuku",
    });
    await createTransaction(userId, expense("2026-07-27", 70000));

    const found = await listMonth(userId, "2026-07", { q: "kopi" });
    expect(found.days[0].items).toHaveLength(1);
  });

  it("rejects a category belonging to another user", async () => {
    const other = await seedUser(db, "user-2");
    const foreign = (await listFinanceCategories(other))[0].id;
    await expect(
      createTransaction(userId, {
        ...expense("2026-07-27", 1000),
        categoryId: foreign,
      }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("rejects an account belonging to another user", async () => {
    const other = await seedUser(db, "user-2");
    const foreign = (await listAccounts(other))[0].id;
    await expect(
      createTransaction(userId, {
        ...expense("2026-07-27", 1000),
        accountId: foreign,
      }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("updates a transaction and bumps updatedAt", async () => {
    const created = await createTransaction(
      userId,
      expense("2026-07-27", 25000),
    );
    const updated = await updateTransaction(userId, created.id, {
      amountMinor: 30000,
      note: "Kopi",
    });
    expect(updated.amountMinor).toBe(30000);
    expect(updated.note).toBe("Kopi");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it("clears a category by passing null", async () => {
    const created = await createTransaction(
      userId,
      expense("2026-07-27", 25000),
    );
    const updated = await updateTransaction(userId, created.id, {
      categoryId: null,
    });
    expect(updated.categoryId).toBeNull();
    expect(updated.category).toBeNull();
  });

  it("refuses to update another user's transaction", async () => {
    const created = await createTransaction(
      userId,
      expense("2026-07-27", 25000),
    );
    const other = await seedUser(db, "user-2");
    await expect(
      updateTransaction(other, created.id, { amountMinor: 1 }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("deletes a transaction", async () => {
    const created = await createTransaction(
      userId,
      expense("2026-07-27", 25000),
    );
    await deleteTransaction(userId, created.id);
    const ledger = await listMonth(userId, "2026-07");
    expect(ledger.days).toEqual([]);
  });

  it("refuses to delete another user's transaction", async () => {
    const created = await createTransaction(
      userId,
      expense("2026-07-27", 25000),
    );
    const other = await seedUser(db, "user-2");
    await expect(deleteTransaction(other, created.id)).rejects.toThrow();
  });
});
