import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import { seedUser, setupTestDb } from "./test-db";

describe("test-db harness", () => {
  it("applies migrations and accepts a user row", async () => {
    const db = await setupTestDb();
    const userId = await seedUser(db);

    const rows = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId));

    expect(rows).toHaveLength(1);
  });

  it("creates the expenses tables", async () => {
    const db = await setupTestDb();
    await expect(db.select().from(schema.transactions)).resolves.toEqual([]);
    await expect(db.select().from(schema.financeCategories)).resolves.toEqual([]);
    await expect(db.select().from(schema.accounts)).resolves.toEqual([]);
  });
});
