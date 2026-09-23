import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // store.ts reads these at runtime via process.cwd(); make sure Vercel ships them with the functions
  outputFileTracingIncludes: {
    "/api/*": ["./data/study.json", "./data/one-shots.json"],
  },
};

export default nextConfig;
