"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <h1 className="text-xl font-semibold text-ink-900">Algo deu errado</h1>
      <p className="mt-2 max-w-md text-sm text-ink-500">
        {error.message || "Nao foi possivel carregar esta pagina."}
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </main>
  );
}
