import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Uploads de vídeo/carrossel passam por Server Actions em alguns fluxos.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
