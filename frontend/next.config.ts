import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading images from any source (user uploads)
  images: {
    unoptimized: true,
  },
  // Turbopack config: stub out Node-only modules for browser builds
  turbopack: {
    resolveAlias: {
      fs: { browser: "./lib/empty-module.ts" },
      path: { browser: "./lib/empty-module.ts" },
    },
  },
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
    // Stub out Node-only modules for browser builds
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...(config.resolve?.fallback || {}),
        fs: false,
        path: false,
      },
    };
    return config;
  },
};

export default nextConfig;
