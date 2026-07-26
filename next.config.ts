import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained build output for Docker/Coolify: emits .next/standalone
  // with a minimal server.js and only the needed node_modules.
  // Skipped on Netlify — its Next.js runtime adapter handles output itself
  // and conflicts with `standalone`.
  output: process.env.NETLIFY ? undefined : "standalone",
  // Pin the workspace root: a stray lockfile in a parent dir otherwise makes
  // Next infer the wrong root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // Every app route is dynamic (session cookie) and has a loading.tsx, so
    // Next prefetches each nav link's shell. The default dynamic client-cache
    // TTL is 0 — the prefetched RSC payload is discarded immediately and
    // refetched on click. Giving it 30s lets the sidebar's in-viewport
    // prefetches actually be reused, so navigation skips the round trip.
    // 30s matches the TanStack Query staleTime; stale re-entries are corrected
    // by React Query's own refetch and by router.refresh() on sign-out.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
