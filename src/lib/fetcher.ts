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
    throw new ApiClientError(
      err?.code ?? "INTERNAL",
      err?.message ?? "Something went wrong.",
    );
  }

  return body.data as T;
}
