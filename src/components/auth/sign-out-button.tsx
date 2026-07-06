"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await authClient.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      <LogOut className="size-4" />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
