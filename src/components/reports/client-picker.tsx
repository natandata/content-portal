"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/form";

export function ClientPicker({
  clients,
  value,
}: {
  clients: { id: string; companyName: string }[];
  value?: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={value ?? ""}
      onChange={(event) => {
        const id = event.target.value;
        router.push(id ? `/professional/reports?client=${id}` : "/professional/reports");
      }}
      className="max-w-xs"
    >
      <option value="">Selecione um cliente...</option>
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.companyName}
        </option>
      ))}
    </Select>
  );
}
