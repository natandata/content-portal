"use client";

import { useRouter } from "next/navigation";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";

import { Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/** Filtros da tabela visual — refletidos na URL para poder ser compartilhados. */
export function ContentFilters({
  basePath,
  clients,
  statuses,
  selectedClientId,
  selectedStatus,
  selectedSort,
  professionalId,
}: {
  basePath: string;
  clients: { id: string; companyName: string }[];
  statuses: { value: string; label: string }[];
  selectedClientId?: string;
  selectedStatus?: string;
  /** "asc" (padrao, mais proximo primeiro) ou "desc" -- ordena por data prevista de postagem. */
  selectedSort?: "asc" | "desc";
  /** Preserva o filtro de profissional (vindo de Profissionais) ao trocar cliente/status. */
  professionalId?: string;
}) {
  const router = useRouter();
  const sort = selectedSort ?? "asc";

  function navigate(next: { client?: string; status?: string; sort?: string }) {
    const params = new URLSearchParams();
    const client = next.client ?? selectedClientId ?? "";
    const status = next.status ?? selectedStatus ?? "";
    const nextSort = next.sort ?? sort;

    if (client) params.set("client", client);
    if (status) params.set("status", status);
    if (nextSort && nextSort !== "asc") params.set("sort", nextSort);
    if (professionalId) params.set("professional", professionalId);

    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="grid gap-3 sm:grid-cols-2 sm:w-auto sm:min-w-[380px]">
        <Select
          aria-label="Filtrar por cliente"
          value={selectedClientId ?? ""}
          onChange={(event) => navigate({ client: event.target.value })}
        >
          <option value="">Todos os clientes</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.companyName}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filtrar por status"
          value={selectedStatus ?? ""}
          onChange={(event) => navigate({ status: event.target.value })}
        >
          <option value="">Todos os status</option>
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>
      </div>

      <button
        type="button"
        title="Ordenar por data prevista de postagem"
        onClick={() => navigate({ sort: sort === "asc" ? "desc" : "asc" })}
        className={cn(
          "focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-700 transition hover:bg-ink-50",
        )}
      >
        {sort === "asc" ? (
          <ArrowUpNarrowWide className="size-4" aria-hidden />
        ) : (
          <ArrowDownWideNarrow className="size-4" aria-hidden />
        )}
        Data prevista {sort === "asc" ? "(mais proxima primeiro)" : "(mais distante primeiro)"}
      </button>
    </div>
  );
}
