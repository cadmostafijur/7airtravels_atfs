import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["node-zklib", "pg", "@prisma/client"],
};

export default nextConfig;
