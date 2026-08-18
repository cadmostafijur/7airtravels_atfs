import type { NextConfig } from "next";

/**
 * Standalone output is for Docker/VPS only.
 * Vercel uses its own tracer — standalone breaks onBuildComplete (next-server.js.nft.json).
 */
const nextConfig: NextConfig = {
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["node-zklib", "pg", "@prisma/client"],
};

export default nextConfig;
