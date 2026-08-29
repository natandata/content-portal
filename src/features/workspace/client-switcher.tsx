"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/form";

/** Troca o cliente em foco mantendo a rota atual. */
export function ClientSwitcher({
  basePath,
  clients,
  selectedClientId,
  label = "Cliente",
}: {
  basePath: string;
  clients: { id: string; companyName: string }[];
  selectedClientId?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <label className="block sm:w-72">
      <span className="field-label">{label}</span>
      <Select
        value={selectedClientId ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          router.push(value ? `${basePath}?client=${value}` : basePath);
        }}
      >
        <option value="">Selecione um cliente</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.companyName}
          </option>
        ))}
      </Select>
    </label>
  );
}
