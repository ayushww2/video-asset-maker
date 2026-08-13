import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "openai", "@aws-sdk/client-s3"],
};

export default nextConfig;
