import type { NextConfig } from "next";

const lanHost = process.env.NEXT_PUBLIC_LOCAL_IP;

const nextConfig: NextConfig = {
  allowedDevOrigins: [lanHost, "localhost", "127.0.0.1"].filter(Boolean) as string[],
};

export default nextConfig;
