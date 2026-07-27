import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedUser, setupTestDb, type TestDb } from "./__helpers__/test-db";

let db: TestDb;

vi.mock("@/db/client", () => ({
  get db() {
    return db;
  },
}));

const {
  archiveFinanceCategory,
  assertCategoryOwned,
  createFinanceCategory,
  listFinanceCategories,
  updateFinanceCategory,
} = await import("./finance-category.service");

describe("finance categories", () => {
  let userId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    userId = await seedUser(db);
  });

  it("seeds defaults on the first read", async () => {
    const list = await listFinanceCategories(userId);
    const names = list.map((c) => c.name);

    expect(names).toContain("Food & drink");
    expect(names).toContain("Salary");
    expect(list.filter((c) => c.kind === "expense").length).toBeGreaterThan(4);
    expect(list.filter((c) => c.kind === "income").length).toBeGreaterThan(0);
  });

  it("seeds only once", async () => {
    const first = await listFinanceCategories(userId);
    const second = await listFinanceCategories(userId);
    expect(second).toHaveLength(first.length);
  });

  it("does not seed one user's defaults into another", async () => {
    await listFinanceCategories(userId);
    const other = await seedUser(db, "user-2");
    const otherList = await listFinanceCategories(other);
    expect(otherList.every((c) => c.userId === other)).toBe(true);
  });

  it("creates a category at the end of its kind's order", async () => {
    await listFinanceCategories(userId);
    const created = await createFinanceCategory(userId, {
      name: "Kopi",
      kind: "expense",
      color: "chart-3",
      icon: "☕",
    });
    expect(created.name).toBe("Kopi");
    expect(created.userId).toBe(userId);
    expect(created.isArchived).toBe(0);
  });

  it("renames a category", async () => {
    const [first] = await listFinanceCategories(userId);
    const updated = await updateFinanceCategory(userId, first.id, {
      name: "Makan",
    });
    expect(updated.name).toBe("Makan");
  });

  it("refuses to update another user's category", async () => {
    const [first] = await listFinanceCategories(userId);
    const other = await seedUser(db, "user-2");
    await expect(
      updateFinanceCategory(other, first.id, { name: "Stolen" }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("archives instead of deleting", async () => {
    const [first] = await listFinanceCategories(userId);
    await archiveFinanceCategory(userId, first.id);
    const list = await listFinanceCategories(userId);
    expect(list.find((c) => c.id === first.id)).toBeUndefined();
  });

  it("does not re-seed after everything is archived", async () => {
    const list = await listFinanceCategories(userId);
    for (const c of list) await archiveFinanceCategory(userId, c.id);
    expect(await listFinanceCategories(userId)).toEqual([]);
  });

  it("asserts ownership", async () => {
    const [first] = await listFinanceCategories(userId);
    await expect(assertCategoryOwned(userId, first.id)).resolves.toBeUndefined();

    const other = await seedUser(db, "user-2");
    await expect(assertCategoryOwned(other, first.id)).rejects.toThrow();
  });
});
