"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Grid3x3,
  LayoutList,
  Pin,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { coverGradientClass } from "@/lib/cover-palette";
import type { BadgeTone } from "@/lib/domain";
import { tagColorClass } from "@/lib/tag-colors";
import { cn, initials } from "@/lib/utils";
import { toggleClientPinAction } from "@/server/actions/clients";
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

/**
 * Alfinete pra fixar/desafixar no topo da galeria (ordenacao ja vem pronta
 * do servidor -- `loadClientsGallery` ordena por `pinned_at`). Fica dentro
 * do `Link` do card, entao precisa parar o clique de navegar.
 */
function PinButton({ client, className }: { client: ClientGalleryRow; className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title={client.pinned ? "Desafixar cliente" : "Fixar cliente no topo"}
      aria-pressed={client.pinned}
      disabled={isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        startTransition(async () => {
          await toggleClientPinAction(client.id, !client.pinned);
          router.refresh();
        });
      }}
      className={cn(
        "focus-ring inline-flex items-center justify-center rounded-full transition disabled:opacity-60",
        className,
      )}
    >
      <Pin className={cn("size-3.5", client.pinned && "fill-current")} aria-hidden />
    </button>
  );
}

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
          <PinButton
            client={client}
            className={cn(
              "size-6 text-ink-300 hover:bg-ink-100 hover:text-ink-600",
              client.pinned && "text-accent hover:text-accent",
            )}
          />
        </div>
      </Link>
    );
  }

  const isActive = client.status === "active";

  return (
    <Link
      href={href}
      title={attentionReason(client) || undefined}
      className="focus-ring group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:border-ink-300 hover:shadow-sm"
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

      <PinButton
        client={client}
        className={cn(
          "absolute top-2.5 left-2.5 size-6 bg-black/30 text-white/70 backdrop-blur-sm hover:bg-black/45 hover:text-white",
          client.pinned && "text-amber-300 opacity-100 hover:text-amber-200",
          !client.pinned && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      />

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

/**
 * Card grande dos clientes fixados -- so aparece na visao "Galeria" quando
 * ha pelo menos um fixado, em vez do card compacto do grid normal. Usa so
 * dados que a galeria ja carrega (nada de consulta nova).
 */
function FeaturedClientCard({ client, href }: { client: ClientGalleryRow; href: string }) {
  const status = displayStatus(client);
  const meta = STATUS_META[status];
  const isActive = client.status === "active";

  return (
    <Link
      href={href}
      title={attentionReason(client) || undefined}
      className="focus-ring group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-ink-300 hover:shadow-sm"
    >
      {/* Avatar posicionado dentro da propria capa (absolute), nunca por margem
          negativa -- margem negativa no primeiro filho de um bloco sem borda/
          padding no topo "vaza" pro pai e some, cortado pelo overflow-hidden
          do card (bug ja visto aqui). */}
      <div className={cn("relative h-20 w-full shrink-0 bg-gradient-to-br", coverGradientClass(client.coverColor))}>
        <span
          className={cn(
            "absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm",
            isActive ? "bg-violet-600/90" : "bg-ink-900/60",
          )}
        >
          {isActive ? "Ativo" : "Inativo"}
        </span>

        <span className="absolute -bottom-7 left-5 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface text-lg font-semibold text-ink-600 shadow-sm ring-2 ring-surface">
          {client.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.avatarUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            initials(client.companyName)
          )}
        </span>
      </div>

      <PinButton
        client={client}
        className="absolute top-3 left-3 size-7 bg-black/30 text-amber-300 backdrop-blur-sm hover:bg-black/45 hover:text-amber-200"
      />

      <div className="px-5 pt-9 pb-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-base font-semibold text-ink-900">{client.companyName}</h3>
          <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-600">
            {client.accessCode}
          </span>
        </div>
        <p className="text-xs text-ink-500">{client.name}</p>

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

        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-ink-50 px-3 py-2.5">
          <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden />
          <span className="truncate text-sm font-medium text-ink-900">
            {client.pendingApprovalCount > 0
              ? `${client.pendingApprovalCount} conteudo(s) aguardando aprovacao`
              : meta.label}
          </span>
        </div>

        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">
          Acessar painel
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
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

  const pinnedInView = useMemo(() => filtered.filter((client) => client.pinned), [filtered]);

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
            className="w-full bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-400 sm:text-sm"
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
        <>
          {!dense && pinnedInView.length > 0 ? (
            <section className="mb-6">
              <div className="mb-2.5 flex items-center gap-2">
                <Pin className="size-3.5 fill-current text-accent" aria-hidden />
                <h2 className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Clientes fixados</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {pinnedInView.map((client) => (
                  <FeaturedClientCard key={client.id} client={client} href={href(client.id)} />
                ))}
              </div>
            </section>
          ) : null}

          <div className={dense ? "space-y-1.5" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
            {(dense ? filtered : filtered.filter((client) => !client.pinned)).map((client) => (
              <ClientCard key={client.id} client={client} href={href(client.id)} dense={dense} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
