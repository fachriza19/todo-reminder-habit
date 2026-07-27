import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedUser, setupTestDb, type TestDb } from "./__helpers__/test-db";

let db: TestDb;

vi.mock("@/db/client", () => ({
  get db() {
    return db;
  },
}));

const {
  archiveAccount,
  assertAccountOwned,
  createAccount,
  listAccounts,
  updateAccount,
} = await import("./account.service");

describe("accounts", () => {
  let userId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    userId = await seedUser(db);
  });

  it("seeds Cash, Bank and E-wallet on the first read", async () => {
    const list = await listAccounts(userId);
    expect(list.map((a) => a.name)).toEqual(["Cash", "Bank", "E-wallet"]);
  });

  it("seeds only once", async () => {
    const first = await listAccounts(userId);
    const second = await listAccounts(userId);
    expect(second).toHaveLength(first.length);
  });

  it("creates an account", async () => {
    await listAccounts(userId);
    const created = await createAccount(userId, {
      name: "GoPay",
      type: "ewallet",
    });
    expect(created.name).toBe("GoPay");
    expect(created.type).toBe("ewallet");
  });

  it("refuses to update another user's account", async () => {
    const [first] = await listAccounts(userId);
    const other = await seedUser(db, "user-2");
    await expect(
      updateAccount(other, first.id, { name: "Stolen" }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("archives instead of deleting", async () => {
    const [first] = await listAccounts(userId);
    await archiveAccount(userId, first.id);
    const list = await listAccounts(userId);
    expect(list.find((a) => a.id === first.id)).toBeUndefined();
  });

  it("asserts ownership", async () => {
    const [first] = await listAccounts(userId);
    await expect(assertAccountOwned(userId, first.id)).resolves.toBeUndefined();
    const other = await seedUser(db, "user-2");
    await expect(assertAccountOwned(other, first.id)).rejects.toThrow();
  });
});
