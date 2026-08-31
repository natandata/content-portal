import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Content",
    short_name: "Content",
    description:
      "Plataforma de contratos, conteudos, aprovacoes e feed entre gestores de conteudo e seus clientes.",
    lang: "pt-BR",
    // A raiz redireciona para /login ou para a area da role ja autenticada.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f6f7",
    theme_color: "#ffffff",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", form_factor: "narrow" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", form_factor: "wide" },
    ],
  };
}
