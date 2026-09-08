import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { ServiceWorkerRegistration } from "@/components/pwa/service-worker";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Content",
    template: "%s · Content",
  },
  description:
    "Plataforma de contratos, conteudos e aprovacoes entre gestores de conteudo e seus clientes.",
  robots: { index: false, follow: false },
  applicationName: "Content",
  appleWebApp: {
    capable: true,
    title: "Content",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e12" },
  ],
  width: "device-width",
  initialScale: 1,
  // Trava o zoom por pinca/duplo toque -- e' pra parecer um app de verdade,
  // nao uma pagina web onde a pessoa fica dando zoom e a tela "samba".
  // maximumScale sozinho ja resolve a maioria dos navegadores; userScalable
  // reforca nos que ainda respeitam a flag (Android/Chrome).
  maximumScale: 1,
  userScalable: false,
  // Instalado como app, a area segura do aparelho precisa ser respeitada.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Favicon em todas as guias */}
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        {/* Antes da primeira pintura: sem isso o app pisca claro antes de escurecer. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ServiceWorkerRegistration />
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </body>
    </html>
  );
}
