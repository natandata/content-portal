"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogOut, Settings } from "lucide-react";

import { NavBadge } from "@/components/shell/nav-badge";
import { clientNavItems } from "@/components/shell/nav-items";
import { ReloadAppButton } from "@/components/shell/reload-app-button";
import { IconButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import type { NavBadges } from "@/server/queries";

// So `locale` cruza de Server para Client Component — nunca o dicionario
// inteiro, que tem campos com funcao e o RSC nao sabe serializar.
export function ClientShell({
  companyName,
  accessCode,
  badges,
  locale,
  children,
}: {
  companyName: string;
  accessCode: string;
  badges: NavBadges;
  locale: Locale;
  children: ReactNode;
}) {
  const dict = getDictionary(locale);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const navLabel: Record<string, string> = {
    "/client/dashboard": dict.nav.home,
    "/client/content": dict.nav.content,
    "/client/feed": dict.nav.feed,
    "/client/documents": dict.nav.documents,
    "/client/chat": dict.nav.chat,
    "/client/payments": dict.nav.payments,
  };
  const items = clientNavItems.map((item) => ({
    ...item,
    label: navLabel[item.href] ?? item.label,
  }));
  const mobileItems = items.filter((item) => !item.hideOnMobileNav);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{companyName}</p>
            <p className="text-xs tracking-[0.18em] text-ink-400">{accessCode}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <nav className="hidden items-center gap-0.5 sm:flex">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "focus-ring flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive(item.href)
                      ? "bg-ink-100 text-ink-900"
                      : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
                  )}
                >
                  {item.label}
                  {item.badge ? <NavBadge count={badges[item.badge]} className="ml-0" /> : null}
                </Link>
              ))}
            </nav>

            <div className="w-[92px] shrink-0">
              <ThemeToggle compact locale={locale} />
            </div>

            <ReloadAppButton label={dict.common.reload} />

            <Link
              href="/client/settings"
              className={cn(
                "focus-ring flex size-9 shrink-0 items-center justify-center rounded-lg transition",
                isActive("/client/settings")
                  ? "bg-ink-100 text-ink-900"
                  : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
              )}
              aria-label={dict.nav.settings}
            >
              <Settings className="size-4" aria-hidden />
            </Link>

            <form action="/api/auth/logout" method="post">
              <IconButton label={dict.common.logout} type="submit">
                <LogOut className="size-4" />
              </IconButton>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 overflow-x-hidden px-4 pt-5 pb-24 sm:px-6 sm:pb-10">
        {children}
      </main>

      {/*
       * Navegacao inferior — prioridade mobile. grid-cols-5 porque so 5 dos
       * itens aparecem aqui (Inicio, Conteudos, Feed, Documentos, Chat) —
       * Cobrancas fica de fora (hideOnMobileNav), so no menu de topo, para
       * nao espremer uma sexta coluna em telas de 360-375px. O texto encolhe
       * um pouco em relacao ao topo para caber cinco colunas sem cortar.
       */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/97 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition",
                  active ? "text-ink-900" : "text-ink-400",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-5", active && "stroke-[2.3]")} aria-hidden />
                  {item.badge ? (
                    <NavBadge
                      count={badges[item.badge]}
                      className="absolute -top-1.5 -right-2 ml-0 min-w-4 px-1 text-[9px]"
                    />
                  ) : null}
                </span>
                <span className="truncate px-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
