"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { startPublicReportAction } from "@/server/actions/instagram-public-report";

export function InstagramPublicReportForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!username.trim()) {
      toast.error("Informe o @ do perfil.");
      return;
    }

    setBusy(true);
    try {
      const result = await startPublicReportAction({ clientId, username });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Relatorio disparado -- aparece aqui assim que a coleta terminar.");
      setUsername("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="min-w-0 flex-1 sm:max-w-xs">
        <label className="field-label" htmlFor="instagram-public-username">
          Perfil do Instagram
        </label>
        <Input
          id="instagram-public-username"
          placeholder="@perfil"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={busy}
        />
      </div>
      <Button type="submit" loading={busy}>
        <Search className="size-4" aria-hidden />
        Gerar relatorio
      </Button>
    </form>
  );
}
