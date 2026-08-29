import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { ServiceWorkerRegistration } from "@/components/pwa/service-worker";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Content Portal",
    template: "%s · Content Portal",
  },
  description:
    "Portal de contratos, conteudos e aprovacoes entre gestores de conteudo e seus clientes.",
  robots: { index: false, follow: false },
  applicationName: "Content Portal",
  appleWebApp: {
    capable: true,
    title: "Content Portal",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // Instalado como app, a area segura do aparelho precisa ser respeitada.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
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
