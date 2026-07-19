import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { AppNav, MobileHeader, MobileTabBar } from "@/components/nav/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative auth gate (proxy.ts is only an optimistic cookie check).
  const session = await getSession();
  if (!session?.user) {
    // Go through the route handler rather than straight to /login: the stale
    // cookie is still set, so proxy.ts would bounce /login back here forever.
    // Only a Route Handler can delete it.
    redirect("/api/session/expired");
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };

  return (
    <div className="flex min-h-dvh">
      <AppNav user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader user={user} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
