import type { NextConfig } from "next";

// Origins allowed to invoke server actions. Always includes localhost for dev; add the
// deployed host(s) via SERVER_ACTION_ORIGINS (comma-separated) in production.
const serverActionOrigins = [
  "localhost:3000",
  ...(process.env.SERVER_ACTION_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone) so the Docker image can run with a
  // minimal node_modules instead of the full install.
  output: "standalone",
  experimental: {
    serverActions: { allowedOrigins: serverActionOrigins },
  },
};

export default nextConfig;
