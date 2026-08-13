import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "openai", "@fal-ai/client", "@aws-sdk/client-s3"],
};

export default nextConfig;
