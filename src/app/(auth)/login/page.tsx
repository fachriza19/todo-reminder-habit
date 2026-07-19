import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in — Toreha" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  // Set by /api/session/expired so a timed-out session reads as intentional
  // rather than as being randomly kicked out.
  const { expired } = await searchParams;

  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Welcome back</h2>
        <p className="text-muted-foreground text-sm">
          Sign in to pick up where you left off.
        </p>
      </div>
      {expired ? (
        <p
          role="status"
          className="border-border bg-muted text-muted-foreground rounded-md border px-3 py-2 text-center text-sm"
        >
          Your session expired. Please sign in again.
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
