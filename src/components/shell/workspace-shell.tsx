"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { NavBadge } from "@/components/shell/nav-badge";
import { navBadgeCount, staffNavItems } from "@/components/shell/nav-items";
import type { NavGroup, NavItem } from "@/components/shell/nav-items";
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
  const navData = staffNavItems(role);

  // Helper para checar se é um NavGroup (tem label) ou array simples de NavItems
  const isNavGroup = (item: unknown): item is NavGroup => {
    return typeof item === "object" && item !== null && "items" in item;
  };

  // Converte para um array de grupos consistente. O admin devolve uma lista
  // plana de NavItem; o profissional ja devolve NavGroup[]. So precisa olhar
  // o PRIMEIRO elemento para saber qual formato veio -- mapear item por item
  // e embrulhar o array inteiro a cada iteracao repete o menu inteiro uma vez
  // por item (bug corrigido aqui).
  const navGroups: NavGroup[] =
    navData.length > 0 && isNavGroup(navData[0]) ? (navData as NavGroup[]) : [{ items: navData as NavItem[] }];
  const homeHref = navGroups[0]?.items[0]?.href ?? "/";

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

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Item da barra HORIZONTAL de topo (desktop) — mais compacto que o da gaveta.
  const renderTopNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition",
          active ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
        )}
      >
        <Icon className="size-[17px] shrink-0" aria-hidden />
        <span className="whitespace-nowrap">{item.label}</span>
        {item.badge ? <NavBadge count={navBadgeCount(badges, item.badge)} className="ml-0" /> : null}
      </Link>
    );
  };

  // Item da gaveta (mobile) — mesmo desenho de sempre, com grupos rotulados.
  const renderDrawerNavItem = (item: NavItem) => {
    const active = isActive(item.href);
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
          <NavBadge count={navBadgeCount(badges, item.badge)} tone={active ? "onDark" : "default"} />
        ) : null}
      </Link>
    );
  };

  const logo = (
    <span className="grid size-7 shrink-0 grid-cols-2 gap-[2px] rounded-md bg-ink-900 p-1">
      <span className="rounded-[2px] bg-on-ink" />
      <span className="rounded-[2px] bg-on-ink/55" />
      <span className="rounded-[2px] bg-on-ink/55" />
      <span className="rounded-[2px] bg-on-ink" />
    </span>
  );

  const drawerNav = (
    <nav className="flex flex-col gap-6">
      {navGroups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-0.5">
          {group.label && (
            <p className="px-3 py-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
              {group.label}
            </p>
          )}
          {group.items.map((item) => renderDrawerNavItem(item))}
        </div>
      ))}
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

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
       * Barra superior — desktop. Mesma posicao (topo, nao lateral) do shell
       * do cliente (`ClientShell`). Os grupos do menu do profissional viram
       * um separador vertical fino entre blocos de itens, ja que rotulo de
       * grupo nao cabe numa barra horizontal; `overflow-x-auto` cobre telas
       * mais estreitas sem cortar item nenhum.
       */}
      <header className="sticky top-0 z-30 hidden border-b border-line bg-surface/95 backdrop-blur lg:block">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-6 py-2.5">
          <Link href={homeHref} className="flex shrink-0 items-center gap-2 pr-1">
            {logo}
            <span className="text-sm font-semibold tracking-tight text-ink-900">Content</span>
          </Link>

          <nav className="scroll-slim flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {navGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="flex shrink-0 items-center gap-0.5">
                {groupIndex > 0 ? <span className="mx-1.5 h-5 w-px shrink-0 bg-line" aria-hidden /> : null}
                {group.items.map((item) => renderTopNavItem(item))}
              </div>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1 pl-1">
            <ThemeToggle compact />
            <ReloadAppButton label="Recarregar o app" />
            <span
              className="flex size-9 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-on-ink"
              title={`${name} — ${ROLE_LABEL[role]} · ${email}`}
            >
              {initials(name)}
            </span>
            <form action="/api/auth/logout" method="post">
              <IconButton label="Sair" type="submit">
                <LogOut className="size-4" />
              </IconButton>
            </form>
          </div>
        </div>
      </header>

      {/* Topbar — mobile (com gaveta lateral, ja no topo desde sempre) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur lg:hidden">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2">
          {logo}
          <span className="truncate text-sm font-semibold text-ink-900">Content</span>
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
            <div className="scroll-slim flex-1 overflow-y-auto">{drawerNav}</div>
            <div className="pt-4">
              <div className="mb-2">
                <ThemeToggle compact />
              </div>
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
