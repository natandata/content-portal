"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { NavBadge } from "@/components/shell/nav-badge";
import { navBadgeCount, type NavBadgeKey, type NavItem } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";
import type { NavBadges } from "@/server/queries";

const CLOSE_DELAY_MS = 150;

/**
 * Item de menu de topo (desktop) que agrupa varios destinos num dropdown --
 * o rotulo em si nunca navega, so abre/fecha o painel. Nao existe primitivo
 * de dropdown no projeto ainda; construido do zero aqui, escopo minimo
 * (sem navegacao por seta entre os itens do painel, so Tab normal).
 *
 * Painel usa `position: fixed` com coordenadas calculadas do botao, em vez
 * de `absolute` ancorado no proprio wrapper -- o botao mora dentro do
 * `<nav className="overflow-x-auto">` do menu, e `overflow` de um ancestral
 * corta qualquer descendente `absolute` que escape da caixa dele.
 * `fixed` usa o viewport como referencia (contanto que nenhum ancestral
 * tenha `transform`/`filter`/`will-change`, o que nao e o caso aqui — so
 * `backdrop-blur` no header, que nao cria novo bloco de contencao para
 * `fixed`), entao escapa desse corte.
 */
export function NavDropdown({
  item,
  badges,
  isActive,
}: {
  item: NavItem;
  badges: NavBadges;
  isActive: (href: string) => boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const children = item.children ?? [];
  const badgeKeys = children.flatMap((child) =>
    child.badge ? (Array.isArray(child.badge) ? child.badge : [child.badge]) : [],
  ) as NavBadgeKey[];
  const badgeCount = navBadgeCount(badges, badgeKeys);
  const active = children.some((child) => child.href && isActive(child.href));

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  function measure() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });
  }

  function openMenu() {
    measure();
    setOpen(true);
  }

  // Fecha ao trocar de rota -- mesmo padrao da gaveta mobile em workspace-shell.tsx.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Clique fora fecha; Escape fecha e devolve o foco pro botao; redimensionar
  // a janela fecha tambem, em vez de deixar o painel flutuando fora do lugar.
  useEffect(() => {
    if (!open) return;

    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    function onResize() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  const Icon = item.icon;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onMouseEnter={() => {
          cancelClose();
          if (!open) openMenu();
        }}
        onMouseLeave={scheduleClose}
        className={cn(
          "focus-ring flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition",
          active ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
        )}
      >
        <Icon className="size-[17px] shrink-0" aria-hidden />
        <span className="whitespace-nowrap">{item.label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
        {badgeCount > 0 ? <NavBadge count={badgeCount} className="ml-0" /> : null}
      </button>

      {open && position ? (
        <div
          ref={panelRef}
          style={{ top: position.top, left: position.left }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="fixed z-40 min-w-[200px] rounded-[14px] border border-line bg-surface p-1 shadow-lg"
        >
          {children.map((child) => {
            const ChildIcon = child.icon;
            const childActive = child.href ? isActive(child.href) : false;
            return (
              <Link
                key={child.href}
                href={child.href ?? "#"}
                onClick={() => setOpen(false)}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  childActive ? "bg-ink-900 text-on-ink" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                <ChildIcon className="size-[18px] shrink-0" aria-hidden />
                <span className="truncate">{child.label}</span>
                {child.badge ? (
                  <NavBadge count={navBadgeCount(badges, child.badge)} tone={childActive ? "onDark" : "default"} />
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
