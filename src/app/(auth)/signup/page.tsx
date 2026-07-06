import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account — Toreha" };

export default function SignupPage() {
  return (
    <div className="grid gap-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Create your account</h2>
        <p className="text-muted-foreground text-sm">
          Start organizing in under a minute.
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
