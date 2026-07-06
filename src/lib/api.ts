import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Uniform API contract (PRD 5A.4).
 * Every route handler returns `{ data, error }` with a standard error code and
 * matching HTTP status. Never return ad-hoc shapes.
 */

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INTERNAL: 500,
};

export type ApiSuccess<T> = { data: T; error: null };
export type ApiError = {
  data: null;
  error: { code: ErrorCode; message: string };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ data, error: null }, init);
}

export function fail(code: ErrorCode, message: string) {
  return NextResponse.json<ApiError>(
    { data: null, error: { code, message } },
    { status: STATUS_BY_CODE[code] },
  );
}

/** Domain error thrown from services; route handlers map it to `fail`. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Validate input at the boundary (PRD 5A.5). Throws AppError(VALIDATION_ERROR)
 * with the first readable issue; `handle()` maps it to the uniform contract.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AppError(
      "VALIDATION_ERROR",
      first?.message ?? "Please check your input.",
    );
  }
  return result.data;
}

/** Read + JSON-parse a request body, tolerating an empty body. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/**
 * Wrap a route handler body: converts AppError + unknown throws into the
 * uniform error contract so handlers stay thin.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) return fail(err.code, err.message);
    console.error("[api] unhandled error:", err);
    return fail("INTERNAL", "Something went wrong. Please try again.");
  }
}
