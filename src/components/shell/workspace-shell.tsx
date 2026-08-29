"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { staffNavItems } from "@/components/shell/nav-items";
import { IconButton } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/domain";
import { cn, initials } from "@/lib/utils";
import type { UserRole } from "@/types/database";

export function WorkspaceShell({
  role,
  name,
  email,
  children,
}: {
  role: UserRole;
  name: string;
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = staffNavItems(role);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
                ? "bg-ink-900 text-white"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-50 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{name}</p>
        <p className="truncate text-xs text-ink-500" title={email}>
          {ROLE_LABEL[role]} · {email}
        </p>
      </div>
      <form action="/api/auth/logout" method="post">
        <IconButton label="Sair" type="submit">
          <LogOut className="size-4" />
        </IconButton>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link href={items[0]?.href ?? "/"} className="mb-6 flex items-center gap-2.5 px-1">
          <span className="grid size-8 grid-cols-2 gap-[2px] rounded-lg bg-ink-900 p-[5px]">
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-white/55" />
            <span className="rounded-[2px] bg-white/55" />
            <span className="rounded-[2px] bg-white" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink-900">Content Portal</span>
        </Link>

        <div className="scroll-slim flex-1 overflow-y-auto">{nav}</div>
        <div className="pt-4">{identity}</div>
      </aside>

      {/* Topbar — mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href={items[0]?.href ?? "/"} className="flex items-center gap-2">
          <span className="grid size-7 grid-cols-2 gap-[2px] rounded-md bg-ink-900 p-1">
            <span className="rounded-[2px] bg-white" />
            <span className="rounded-[2px] bg-white/55" />
            <span className="rounded-[2px] bg-white/55" />
            <span className="rounded-[2px] bg-white" />
          </span>
          <span className="text-sm font-semibold text-ink-900">Content Portal</span>
        </Link>
        <IconButton label="Abrir menu" onClick={() => setMenuOpen(true)}>
          <Menu className="size-5" />
        </IconButton>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-surface p-4 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-900">Menu</span>
              <IconButton label="Fechar menu" onClick={() => setMenuOpen(false)}>
                <X className="size-5" />
              </IconButton>
            </div>
            <div className="scroll-slim flex-1 overflow-y-auto">{nav}</div>
            <div className="pt-4">{identity}</div>
          </div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
