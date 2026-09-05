"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Grid3x3,
  LayoutList,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { coverGradientClass } from "@/lib/cover-palette";
import type { BadgeTone } from "@/lib/domain";
import { tagColorClass } from "@/lib/tag-colors";
import { cn, initials } from "@/lib/utils";
import type { ClientGalleryRow } from "@/server/queries";

type DisplayStatus = "ajuste" | "aguardando" | "ok" | "inativo";

const STATUS_META: Record<DisplayStatus, { label: string; tone: BadgeTone }> = {
  ajuste: { label: "Precisa de ajuste", tone: "warning" },
  aguardando: { label: "Aguardando aprovacao", tone: "info" },
  ok: { label: "Em dia", tone: "success" },
  inativo: { label: "Inativo", tone: "neutral" },
};

const STATUS_ORDER: DisplayStatus[] = ["ajuste", "aguardando", "ok", "inativo"];

/** Bolinha de sinal ao lado do nome — mesmo status da galeria, so como cor. */
const STATUS_DOT: Record<DisplayStatus, string> = {
  ajuste: "bg-red-500",
  aguardando: "bg-amber-500",
  ok: "bg-emerald-500",
  inativo: "bg-ink-300",
};

const CONTENT_STAT_META = [
  { key: "draft", label: "Rascunho", dot: "bg-ink-500" },
  { key: "adjustment", label: "Ajuste", dot: "bg-orange-500" },
  { key: "awaitingApproval", label: "Aprovacao", dot: "bg-orange-400" },
  { key: "approved", label: "Aprovados", dot: "bg-emerald-500" },
] as const;

function displayStatus(client: ClientGalleryRow): DisplayStatus {
  if (client.status === "inactive") return "inativo";
  if (client.needsAdjustment || client.overdueInvoice || client.staleActivity) return "ajuste";
  if (client.pendingApprovalCount > 0) return "aguardando";
  return "ok";
}

function attentionReason(client: ClientGalleryRow): string {
  const reasons: string[] = [];
  if (client.needsAdjustment) reasons.push("conteudo com ajuste pedido");
  if (client.overdueInvoice) reasons.push("cobranca vencida");
  if (client.staleActivity) reasons.push("sem atividade ha 30+ dias");
  return reasons.join(" · ");
}

type View = "galeria" | "lista" | "status" | "atencao";

const VIEWS: { id: View; label: string; icon: typeof Grid3x3 }[] = [
  { id: "galeria", label: "Galeria", icon: Grid3x3 },
  { id: "lista", label: "Lista", icon: LayoutList },
  { id: "status", label: "Por status", icon: SlidersHorizontal },
  { id: "atencao", label: "Atencao", icon: AlertTriangle },
];

function ClientCard({
  client,
  href,
  dense,
}: {
  client: ClientGalleryRow;
  href: string;
  dense: boolean;
}) {
  const status = displayStatus(client);
  const meta = STATUS_META[status];

  if (dense) {
    return (
      <Link
        href={href}
        className="focus-ring group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition hover:border-ink-300 hover:shadow-sm"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
          {initials(client.companyName)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">{client.companyName}</p>
          <p className="truncate text-xs text-ink-500">{client.name}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {client.pendingApprovalCount > 0 ? (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600 tabular-nums">
              {client.pendingApprovalCount} pendente(s)
            </span>
          ) : null}
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
      </Link>
    );
  }

  const isActive = client.status === "active";

  return (
    <Link
      href={href}
      title={attentionReason(client) || undefined}
      className="focus-ring group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:border-ink-300 hover:shadow-sm"
    >
      {/* So cor — a mesma escolhida na tela do cliente. */}
      <div className={cn("relative h-16 w-full shrink-0 bg-gradient-to-br", coverGradientClass(client.coverColor))}>
        <span
          className={cn(
            "absolute top-2.5 right-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm",
            isActive ? "bg-violet-600/90" : "bg-ink-900/60",
          )}
        >
          {isActive ? "Ativo" : "Inativo"}
        </span>

        <span className="absolute -bottom-4 left-3 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-100 text-xs font-semibold text-ink-600 ring-2 ring-surface">
          {client.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.avatarUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            initials(client.companyName)
          )}
        </span>
      </div>

      <div className="min-w-0 flex-1 p-4 pt-6">
        <div className="flex items-center gap-1.5">
          <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden />
          <p className="truncate text-sm font-semibold text-ink-900">{client.companyName}</p>
        </div>
        <p className="truncate text-xs text-ink-500">{client.handle}</p>

        {client.tag ? (
          <span
            className={cn(
              "mt-2 inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              tagColorClass(client.tag),
            )}
          >
            {client.tag}
          </span>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {CONTENT_STAT_META.map((stat) => (
            <div key={stat.key} className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className={cn("size-1.5 shrink-0 rounded-full", stat.dot)} aria-hidden />
              <span className="tabular-nums">{client.contentCounts[stat.key]}</span>
              <span className="truncate text-ink-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function Group({
  title,
  clients,
  href,
  dense,
}: {
  title: string;
  clients: ClientGalleryRow[];
  href: (id: string) => string;
  dense: boolean;
}) {
  if (clients.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{title}</h2>
        <span className="text-xs text-ink-400 tabular-nums">{clients.length}</span>
      </div>
      <div className={dense ? "space-y-1.5" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
        {clients.map((client) => (
          <ClientCard key={client.id} client={client} href={href(client.id)} dense={dense} />
        ))}
      </div>
    </section>
  );
}

export function ClientsGallery({
  clients,
  basePath,
}: {
  clients: ClientGalleryRow[];
  basePath: string;
}) {
  const [view, setView] = useState<View>("galeria");
  const [query, setQuery] = useState("");

  const href = (id: string) => `${basePath}/clients/${id}`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (client) =>
        client.companyName.toLowerCase().includes(q) || client.name.toLowerCase().includes(q),
    );
  }, [clients, query]);

  const attentionCount = useMemo(
    () => clients.filter((client) => displayStatus(client) === "ajuste").length,
    [clients],
  );

  const dense = view === "lista";

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 border-b border-line overflow-x-auto">
        {VIEWS.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "focus-ring inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "border-accent text-ink-900"
                  : "border-transparent text-ink-500 hover:text-ink-800",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
              {item.id === "atencao" && attentionCount > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    active ? "bg-accent-soft text-accent" : "bg-ink-100 text-ink-500",
                  )}
                >
                  {attentionCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mb-5">
        <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 sm:w-64">
          <Search className="size-4 shrink-0 text-ink-400" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cliente..."
            className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="Nenhum cliente encontrado"
          description="Ajuste a busca ou troque de visao."
        />
      ) : view === "status" ? (
        <>
          {STATUS_ORDER.map((status) => (
            <Group
              key={status}
              title={STATUS_META[status].label}
              clients={filtered.filter((client) => displayStatus(client) === status)}
              href={href}
              dense={false}
            />
          ))}
        </>
      ) : view === "atencao" ? (
        filtered.filter((client) => displayStatus(client) === "ajuste").length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="size-5" />}
            title="Nenhum cliente pedindo atencao"
            description="Assim que algo precisar de ajuste, cobranca atrasar ou um cliente ficar 30 dias sem atividade, aparece aqui."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered
              .filter((client) => displayStatus(client) === "ajuste")
              .map((client) => (
                <div key={client.id} className="flex flex-col gap-1.5">
                  <ClientCard client={client} href={href(client.id)} dense={false} />
                  <p className="px-1 text-xs text-ink-500">{attentionReason(client)}</p>
                </div>
              ))}
          </div>
        )
      ) : (
        <div className={dense ? "space-y-1.5" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} href={href(client.id)} dense={dense} />
          ))}
        </div>
      )}
    </div>
  );
}
