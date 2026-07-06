import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained build output for Docker/Coolify: emits .next/standalone
  // with a minimal server.js and only the needed node_modules.
  output: "standalone",
  // Pin the workspace root: a stray lockfile in a parent dir otherwise makes
  // Next infer the wrong root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
