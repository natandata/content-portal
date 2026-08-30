"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { NavBadge } from "@/components/shell/nav-badge";
import { staffNavItems } from "@/components/shell/nav-items";
import { ReloadAppButton } from "@/components/shell/reload-app-button";
import { IconButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ROLE_LABEL } from "@/lib/domain";
import { cn, initials } from "@/lib/utils";
import type { NavBadges } from "@/server/queries";
import type { UserRole } from "@/types/database";

export function WorkspaceShell({
  role,
  name,
  email,
  badges,
  children,
}: {
  role: UserRole;
  name: string;
  email: string;
  badges: NavBadges;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = staffNavItems(role);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Com a gaveta aberta, o fundo nao pode rolar por tras dela.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-ink-900 text-on-ink"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <NavBadge count={badges[item.badge]} tone={active ? "onDark" : "default"} />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-50 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-on-ink">
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{name}</p>
        <p className="truncate text-xs text-ink-500" title={email}>
          {ROLE_LABEL[role]} · {email}
        </p>
      </div>
      <ReloadAppButton label="Recarregar o app" />
      <form action="/api/auth/logout" method="post">
        <IconButton label="Sair" type="submit">
          <LogOut className="size-4" />
        </IconButton>
      </form>
    </div>
  );

  const themePicker = (
    <div className="mb-2">
      <ThemeToggle compact />
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link href={items[0]?.href ?? "/"} className="mb-6 flex items-center gap-2.5 px-1">
          <span className="grid size-8 grid-cols-2 gap-[2px] rounded-lg bg-ink-900 p-[5px]">
            <span className="rounded-[2px] bg-on-ink" />
            <span className="rounded-[2px] bg-on-ink/55" />
            <span className="rounded-[2px] bg-on-ink/55" />
            <span className="rounded-[2px] bg-on-ink" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink-900">Content Portal</span>
        </Link>

        <div className="scroll-slim flex-1 overflow-y-auto">{nav}</div>
        <div className="pt-4">
          {themePicker}
          {identity}
        </div>
      </aside>

      {/* Topbar — mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur lg:hidden">
        <Link href={items[0]?.href ?? "/"} className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 grid-cols-2 gap-[2px] rounded-md bg-ink-900 p-1">
            <span className="rounded-[2px] bg-on-ink" />
            <span className="rounded-[2px] bg-on-ink/55" />
            <span className="rounded-[2px] bg-on-ink/55" />
            <span className="rounded-[2px] bg-on-ink" />
          </span>
          <span className="truncate text-sm font-semibold text-ink-900">Content Portal</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <ReloadAppButton label="Recarregar o app" />
          <IconButton label="Abrir menu" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/40 dark:bg-black/60"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          {/* Abre pela direita: e o lado do botao que a abriu. */}
          <div className="absolute inset-y-0 right-0 flex w-[280px] max-w-[85vw] flex-col bg-surface p-4 pr-[max(1rem,env(safe-area-inset-right))] shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-900">Menu</span>
              <IconButton label="Fechar menu" onClick={() => setMenuOpen(false)}>
                <X className="size-5" />
              </IconButton>
            </div>
            <div className="scroll-slim flex-1 overflow-y-auto">{nav}</div>
            <div className="pt-4">
              {themePicker}
              {identity}
            </div>
          </div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
