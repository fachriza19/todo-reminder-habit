"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ApiClientError } from "@/lib/fetcher";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * App-wide client providers: TanStack Query (server state) + next-themes
 * (dark mode) + Sonner toaster (light confirmations, PRD 5B.3).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // A 401 will never succeed on retry — it just costs another
            // round-trip and delays the redirect to /login.
            retry: (failureCount, error) =>
              error instanceof ApiClientError && error.code === "UNAUTHORIZED"
                ? false
                : failureCount < 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider delay={300}>{children}</TooltipProvider>
        <Toaster richColors position="bottom-center" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
