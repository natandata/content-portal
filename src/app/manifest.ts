import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Content Portal",
    short_name: "Content Portal",
    description:
      "Contratos, conteudos, aprovacoes e feed entre o gestor de conteudo e seus clientes.",
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
  };
}
