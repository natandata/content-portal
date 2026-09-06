"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import {
  listCalendlyEventTypesAction,
  setCalendlyEventTypeAction,
  type CalendlyEventTypeOption,
} from "@/server/actions/calendly-connect";

/**
 * So os Event Types que ja existem na conta do profissional — o app nunca
 * cria um. Carrega a lista ao montar (nao vem pronta do servidor porque
 * "listar da Calendly" e uma chamada de rede que pode falhar por conta
 * externa, e um botao de "tentar de novo" fica mais natural aqui do lado
 * do cliente).
 */
export function CalendlyEventTypePicker({ currentEventTypeUri }: { currentEventTypeUri: string | null }) {
  const router = useRouter();
  const [options, setOptions] = useState<CalendlyEventTypeOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState(currentEventTypeUri ?? "");
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void listCalendlyEventTypesAction().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setOptions(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function save() {
    const option = options?.find((item) => item.uri === selected);
    if (!option) return;

    start(async () => {
      const result = await setCalendlyEventTypeAction({
        eventTypeUri: option.uri,
        name: option.name,
        durationMinutes: option.durationMinutes,
        schedulingUrl: option.schedulingUrl,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tipo de reuniao salvo.");
      router.refresh();
    });
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  if (!options) {
    return <p className="text-sm text-ink-500">Carregando os tipos de evento da sua conta...</p>;
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        Nenhum tipo de evento ativo encontrado na sua conta Calendly. Crie um em calendly.com e volte aqui.
      </p>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <Field label="Tipo de reuniao" htmlFor="calendly-event-type" className="flex-1">
        <Select
          id="calendly-event-type"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={pending}
        >
          <option value="" disabled>
            Selecione...
          </option>
          {options.map((option) => (
            <option key={option.uri} value={option.uri}>
              {option.name} · {option.durationMinutes} min
            </option>
          ))}
        </Select>
      </Field>
      <Button loading={pending} disabled={!selected || selected === currentEventTypeUri} onClick={save}>
        Salvar
      </Button>
    </div>
  );
}
