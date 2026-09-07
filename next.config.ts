import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Uploads de vídeo/carrossel passam por Server Actions em alguns fluxos.
    serverActions: { bodySizeLimit: "10mb" },
  },
  // @react-pdf/renderer (via @react-pdf/pdfkit -> pdfkit) carrega as fontes
  // padrao (Helvetica etc.) com require() dinamico -- o bundler do App
  // Router nao inclui esses arquivos no pacote da function, e falha em
  // runtime na Vercel com "Cannot find module .../standard-fonts/*.cjs"
  // (funciona local, so quebra em producao -- confirmado via delivery_error
  // real). Isso e o motivo por tras do relatorio de Instagram nunca chegar
  // em Documentos.
  serverExternalPackages: ["@react-pdf/renderer", "@react-pdf/pdfkit", "pdfkit"],

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
