"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogOut, Settings } from "lucide-react";

import { NavBadge } from "@/components/shell/nav-badge";
import { clientNavItems } from "@/components/shell/nav-items";
import { IconButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import type { NavBadges } from "@/server/queries";

export function ClientShell({
  companyName,
  accessCode,
  badges,
  children,
}: {
  companyName: string;
  accessCode: string;
  badges: NavBadges;
  children: ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
              {clientNavItems.map((item) => (
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
              <ThemeToggle compact />
            </div>

            <Link
              href="/client/settings"
              className={cn(
                "focus-ring flex size-9 shrink-0 items-center justify-center rounded-lg transition",
                isActive("/client/settings")
                  ? "bg-ink-100 text-ink-900"
                  : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
              )}
              aria-label="Configuracoes"
            >
              <Settings className="size-4" aria-hidden />
            </Link>

            <form action="/api/auth/logout" method="post">
              <IconButton label="Sair" type="submit">
                <LogOut className="size-4" />
              </IconButton>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 overflow-x-hidden px-4 pt-5 pb-24 sm:px-6 sm:pb-10">
        {children}
      </main>

      {/* Navegacao inferior — prioridade mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/97 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {clientNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition",
                  active ? "text-ink-900" : "text-ink-400",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-5", active && "stroke-[2.3]")} aria-hidden />
                  {item.badge ? (
                    <NavBadge
                      count={badges[item.badge]}
                      className="absolute -top-1.5 -right-2.5 ml-0"
                    />
                  ) : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
