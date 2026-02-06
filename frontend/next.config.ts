import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading images from any source (user uploads)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
