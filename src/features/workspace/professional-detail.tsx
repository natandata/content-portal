import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  FileText,
  Grid3x3,
  Images,
  MessageCircle,
  Users,
} from "lucide-react";

import { ProfessionalFormModal } from "@/components/professionals/professional-form-modal";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader, StatCard } from "@/components/ui/layout";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const SECTIONS = [
  {
    href: "/admin/clients",
    label: "Clientes",
    icon: Users,
    description: "Cadastro, codigo de acesso e responsavel.",
  },
  {
    href: "/admin/content",
    label: "Conteudo",
    icon: Images,
    description: "Tudo que foi enviado para os clientes.",
  },
  {
    href: "/admin/approvals",
    label: "Aprovacoes",
    icon: CheckCircle2,
    description: "O que esta com o cliente e o que voltou.",
  },
  {
    href: "/admin/documents",
    label: "Documentos",
    icon: FileText,
    description: "Contratos e outros documentos enviados.",
  },
  {
    href: "/admin/payments",
    label: "Cobrancas",
    icon: Banknote,
    description: "Boletos, links e chaves Pix.",
  },
  {
    href: "/admin/feed",
    label: "Feed",
    icon: Grid3x3,
    description: "Simulacao do feed de cada cliente.",
  },
];

/**
 * Visao do admin sobre um profissional: dados, numeros e o acesso completo
 * aos clientes que ele atende (Clientes, Conteudo, Aprovacoes, Documentos,
 * Cobrancas e Feed) — nada disso fica no menu principal do admin, so aqui.
 */
export async function ProfessionalDetail({ professionalId }: { professionalId: string }) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: professional } = await supabase
    .from("users")
    .select("*")
    .eq("id", professionalId)
    .eq("role", "professional")
    .maybeSingle();

  if (!professional) notFound();

  const [{ count: clientCount }, { count: activeClientCount }] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", professionalId),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", professionalId)
      .eq("status", "active"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/admin/professionals"
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Profissionais
          </Link>
        }
        title={professional.name}
        description={professional.email}
        actions={
          <>
            <Link
              href={`/admin/chat/${professional.id}`}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
            >
              <MessageCircle className="size-4" aria-hidden />
              Conversar
            </Link>
            <ProfessionalFormModal professional={professional} />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {professional.status === "inactive" ? (
          <Badge tone="neutral">Inativo</Badge>
        ) : (
          <Badge tone="success">Ativo</Badge>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Clientes atendidos" value={clientCount ?? 0} />
        <StatCard label="Clientes ativos" value={activeClientCount ?? 0} tone="success" />
      </div>

      <Card padded={false}>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Gerenciar</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Acesso completo aos clientes deste profissional.
          </p>
        </div>
        <ul className="divide-y divide-line">
          {SECTIONS.map((section) => (
            <li key={section.href}>
              <Link
                href={`${section.href}?professional=${professional.id}`}
                className="focus-ring flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-50 sm:px-5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                  <section.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">{section.label}</p>
                  <p className="truncate text-xs text-ink-500">{section.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
