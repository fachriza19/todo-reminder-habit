import "server-only";

import { cache } from "react";
import { QueryClient } from "@tanstack/react-query";

/**
 * A request-scoped QueryClient for server-side prefetching.
 *
 * Pages `prefetchQuery` into this on the server, then ship the result to the
 * browser via `<HydrationBoundary state={dehydrate(queryClient)}>`. The client
 * hooks read the hydrated cache instead of firing their own fetch on mount —
 * collapsing the per-navigation "render shell -> hydrate -> fetch" waterfall
 * into a single streamed response.
 *
 * `cache()` scopes one instance per request: the page and anything it renders
 * share the same client, and it is never reused across users or requests.
 *
 * `staleTime` matches the client QueryClient (see providers.tsx) so hydrated
 * data lands "fresh" and the client does not immediately refetch it.
 */
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
        },
      },
    }),
);
