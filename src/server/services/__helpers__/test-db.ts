import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/db/schema";

export type TestDb = LibSQLDatabase<typeof schema>;

/**
 * A throwaway in-memory database with the real migrations applied. Services
 * import the `db` singleton, so a test file mocks `@/db/client` to return the
 * instance this creates:
 *
 *   let db: TestDb;
 *   vi.mock("@/db/client", () => ({ get db() { return db; } }));
 *   beforeEach(async () => { db = await setupTestDb(); });
 */
export async function setupTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  return db;
}

/** Insert a user so foreign keys resolve; returns the user id. */
export async function seedUser(db: TestDb, id = "user-1"): Promise<string> {
  const now = new Date();
  await db.insert(schema.user).values({
    id,
    name: `Test ${id}`,
    email: `${id}@example.test`,
    emailVerified: false,
    image: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
