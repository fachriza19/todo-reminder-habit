import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in — Toreha" };

export default function LoginPage() {
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Welcome back</h2>
        <p className="text-muted-foreground text-sm">
          Sign in to pick up where you left off.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
