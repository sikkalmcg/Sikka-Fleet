import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: 'export' }),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

