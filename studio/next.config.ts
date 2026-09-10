import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  distDir: process.env.STUDIO_PREVIEW ? ".next-preview" : ".next",
  outputFileTracingRoot: process.cwd(),
  experimental: { optimizePackageImports: ["@chakra-ui/react"] },
};
export default config;
