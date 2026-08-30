import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Uploads de vídeo/carrossel passam por Server Actions em alguns fluxos.
    serverActions: { bodySizeLimit: "10mb" },
  },

  // "Contratos" virou "Documentos": link salvo ou atalho do PWA continua valendo.
  async redirects() {
    return [
      { source: "/admin/contracts", destination: "/admin/documents", permanent: true },
      {
        source: "/professional/contracts",
        destination: "/professional/documents",
        permanent: true,
      },
      { source: "/client/contract", destination: "/client/documents", permanent: true },
    ];
  },
};

export default nextConfig;
