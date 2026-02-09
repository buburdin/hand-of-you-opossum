import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading images from any source (user uploads)
  images: {
    unoptimized: true,
  },
  // Silence Turbopack warning about webpack config presence
  turbopack: {},
  // Enable WASM support for esm-potrace-wasm (used in webpack builds)
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    // Fix for WASM file emission in Next.js
    config.output = {
      ...config.output,
      webassemblyModuleFilename: "static/wasm/[modulehash].wasm",
    };
    return config;
  },
};

export default nextConfig;
