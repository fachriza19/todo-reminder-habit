import type { ApiResponse, ErrorCode } from "@/lib/api";

export class ApiClientError extends Error {
  constructor(
    public code: ErrorCode | "NETWORK",
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * A session can die mid-visit (expiry, revocation, rotated secret). When that
 * happens several in-flight queries tend to 401 at once, so latch on the first
 * one — otherwise each would kick off its own navigation.
 */
let signingOut = false;

function bailToLogin() {
  if (typeof window === "undefined" || signingOut) return;
  signingOut = true;
  // Full page load, not router.push: the route handler must clear the cookie
  // before /login renders, and the whole client cache is stale anyway.
  window.location.href = "/api/session/expired";
}

/**
 * Fetch a `{ data, error }` endpoint and unwrap it. Throws ApiClientError on
 * failure so TanStack Query can surface it to error states / rollback.
 */
export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError("NETWORK", "Network error. Check your connection.");
  }

  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError("INTERNAL", "Unexpected response from the server.");
  }

  if (!res.ok || body.error) {
    const err = body.error;
    const code = err?.code ?? "INTERNAL";
    // The session is gone. Sign out for real instead of rendering "you need to
    // sign in" inside a page the user can no longer use.
    if (code === "UNAUTHORIZED") bailToLogin();
    throw new ApiClientError(code, err?.message ?? "Something went wrong.");
  }

  return body.data as T;
}
