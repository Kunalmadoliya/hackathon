/**
 * FILE GUIDE
 * Next.js settings: Cache Components on, and a 2.2 MB upload limit for banner images.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Theme banners are up to 2 MB; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "2.2mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
