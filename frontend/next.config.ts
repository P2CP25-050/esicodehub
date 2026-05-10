import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactCompiler: true,
  reactStrictMode: true,
  images: {
    unoptimized: true,
    domains: ["storage.googleapis.com"],
  },
};

export default nextConfig;
