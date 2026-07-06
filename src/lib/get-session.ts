import { headers } from "next/headers";
import { auth } from "./auth";
import { AppError } from "./api";

/**
 * Read the current Better Auth session on the server. Returns null if none.
 * Use in Server Components / layouts where "not signed in" is a valid branch.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Require an authenticated user in a route handler / server action.
 * Throws AppError(UNAUTHORIZED) — caught by `handle()` and mapped to the
 * uniform error contract. Returns the userId for scoping every query (F-AUTH-6).
 */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new AppError("UNAUTHORIZED", "You need to sign in to do that.");
  }
  return session.user.id;
}
