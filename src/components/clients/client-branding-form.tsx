"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/layout";
import { Field, Input, Textarea } from "@/components/ui/form";
import { BRAND_ARCHETYPE_LABEL, BRAND_ARCHETYPES } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { saveClientBrandingAction } from "@/server/actions/branding";
import type { BrandArchetype, ClientBrandingRow } from "@/types/database";

const TABS = [
  { id: "conceituacao", label: "Conceituacao" },
  { id: "expressao", label: "Expressao" },
  { id: "estrategia", label: "Estrategia" },
  { id: "recursos", label: "Recursos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ESSENCE_QUESTIONS = [
  { key: "essencePersona", label: "Se a marca fosse uma pessoa, como ela seria numa mesa de bar?" },
  { key: "essenceDefends", label: "O que essa marca defende com unhas e dentes?" },
  { key: "essenceRejects", label: "O que ela nunca vai tolerar ou aceitar?" },
  { key: "essenceMissed", label: "Se essa marca sumisse hoje, do que as pessoas sentiriam falta?" },
  { key: "essenceWord", label: "Em uma palavra, o que essa marca representa?" },
] as const;

const EXPRESSION_QUESTIONS = [
  { key: "voiceTone", label: "Tom de voz", hint: "Como a marca fala — formal, brincalhona, direta, tecnica..." },
  { key: "colorPalette", label: "Paleta de cores", hint: "Cores principais e o que cada uma carrega de sentido." },
  { key: "typography", label: "Tipografia", hint: "Fontes usadas e a personalidade que elas passam." },
  { key: "visualReferences", label: "Referencias visuais", hint: "Marcas, perfis ou materiais que inspiram a linha visual." },
] as const;

const STRATEGY_QUESTIONS = [
  { key: "targetAudience", label: "Publico-alvo", hint: "Quem essa marca precisa convencer." },
  { key: "valueProposition", label: "Proposta de valor", hint: "O problema que ela resolve, em uma frase." },
  { key: "differentiators", label: "Diferenciais competitivos", hint: "Por que escolher essa marca e nao a concorrencia." },
  { key: "contentPillars", label: "Pilares de conteudo", hint: "Os temas que sustentam o calendario editorial." },
] as const;

type FormValues = Record<
  | (typeof ESSENCE_QUESTIONS)[number]["key"]
  | (typeof EXPRESSION_QUESTIONS)[number]["key"]
  | (typeof STRATEGY_QUESTIONS)[number]["key"],
  string
> & { archetypeNotes: string };

function initialValues(branding: ClientBrandingRow | null): FormValues {
  return {
    essencePersona: branding?.essence_persona ?? "",
    essenceDefends: branding?.essence_defends ?? "",
    essenceRejects: branding?.essence_rejects ?? "",
    essenceMissed: branding?.essence_missed ?? "",
    essenceWord: branding?.essence_word ?? "",
    archetypeNotes: branding?.archetype_notes ?? "",
    voiceTone: branding?.voice_tone ?? "",
    colorPalette: branding?.color_palette ?? "",
    typography: branding?.typography ?? "",
    visualReferences: branding?.visual_references ?? "",
    targetAudience: branding?.target_audience ?? "",
    valueProposition: branding?.value_proposition ?? "",
    differentiators: branding?.differentiators ?? "",
    contentPillars: branding?.content_pillars ?? "",
  };
}

/**
 * Ferramenta de estrategia de marca — pensada para a equipe usar antes de
 * criar conteudo, nao para o cliente ver. Um unico "Salvar" grava tudo de
 * uma vez; as abas so organizam a leitura.
 */
export function ClientBrandingForm({
  clientId,
  branding,
  basePath,
}: {
  clientId: string;
  branding: ClientBrandingRow | null;
  basePath: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("conceituacao");
  const [values, setValues] = useState<FormValues>(() => initialValues(branding));
  const [archetype, setArchetype] = useState<BrandArchetype | null>(branding?.archetype ?? null);
  const [pending, start] = useTransition();

  function set(key: keyof FormValues) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((prev) => ({ ...prev, [key]: event.target.value }));
  }

  function save() {
    start(async () => {
      const result = await saveClientBrandingAction({ clientId, archetype, ...values });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Branding salvo.");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "focus-ring shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              tab === item.id
                ? "border-accent text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "conceituacao" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Essencia da Marca</h3>
            <div className="space-y-4">
              {ESSENCE_QUESTIONS.map((question) => (
                <Field key={question.key} label={question.label}>
                  <Input
                    value={values[question.key]}
                    onChange={set(question.key)}
                    placeholder="Sua resposta..."
                    disabled={pending}
                  />
                </Field>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-semibold text-ink-900">Arquetipo da Marca</h3>
            <div className="grid grid-cols-2 gap-2">
              {BRAND_ARCHETYPES.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
                >
                  <input
                    type="radio"
                    name="archetype"
                    checked={archetype === key}
                    onChange={() => setArchetype(key)}
                    disabled={pending}
                    className="accent-accent"
                  />
                  {BRAND_ARCHETYPE_LABEL[key]}
                </label>
              ))}
            </div>
            <Field label="Justificativa e exemplos" className="mt-4">
              <Textarea
                value={values.archetypeNotes}
                onChange={set("archetypeNotes")}
                placeholder="Como esse arquetipo aparece na comunicacao..."
                rows={4}
                disabled={pending}
              />
            </Field>
          </Card>
        </div>
      ) : tab === "expressao" ? (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {EXPRESSION_QUESTIONS.map((question) => (
              <Field key={question.key} label={question.label} hint={question.hint}>
                <Textarea value={values[question.key]} onChange={set(question.key)} rows={4} disabled={pending} />
              </Field>
            ))}
          </div>
        </Card>
      ) : tab === "estrategia" ? (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {STRATEGY_QUESTIONS.map((question) => (
              <Field key={question.key} label={question.label} hint={question.hint}>
                <Textarea value={values[question.key]} onChange={set(question.key)} rows={4} disabled={pending} />
              </Field>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-ink-900">Materiais de marca</h3>
          <p className="mb-4 text-sm text-ink-500">
            Brandbook, manual de identidade e mockups ficam junto dos outros documentos do cliente.
          </p>
          <Link
            href={`${basePath}/documents?client=${clientId}`}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
          >
            <FileText className="size-4" aria-hidden />
            Abrir documentos
          </Link>
        </Card>
      )}

      <div className="mt-5 flex justify-end">
        <Button loading={pending} onClick={save}>
          Salvar branding
        </Button>
      </div>
    </div>
  );
}
