import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root: a stray lockfile higher up the tree otherwise makes
  // Next.js guess the wrong workspace root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
