"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/form";

/** Filtros da tabela visual — refletidos na URL para poder ser compartilhados. */
export function ContentFilters({
  basePath,
  clients,
  statuses,
  selectedClientId,
  selectedStatus,
}: {
  basePath: string;
  clients: { id: string; companyName: string }[];
  statuses: { value: string; label: string }[];
  selectedClientId?: string;
  selectedStatus?: string;
}) {
  const router = useRouter();

  function navigate(next: { client?: string; status?: string }) {
    const params = new URLSearchParams();
    const client = next.client ?? selectedClientId ?? "";
    const status = next.status ?? selectedStatus ?? "";

    if (client) params.set("client", client);
    if (status) params.set("status", status);

    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-lg">
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
  );
}
