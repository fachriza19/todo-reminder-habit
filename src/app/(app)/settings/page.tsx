import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

import { getSession } from "@/lib/get-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { ArchivedHabits } from "@/components/settings/archived-habits";
import { CategoryManager } from "@/components/todo/category-manager";

export const metadata: Metadata = { title: "Settings — Toreha" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your account and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{session.user.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Email</span>
            <span className="truncate font-medium">{session.user.email}</span>
          </div>
          <div className="pt-2">
            <SignOutButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Categories</CardTitle>
          <CategoryManager>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="size-4" />
              Manage
            </Button>
          </CategoryManager>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Organize todos into categories.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archived habits</CardTitle>
        </CardHeader>
        <CardContent>
          <ArchivedHabits />
        </CardContent>
      </Card>
    </div>
  );
}
