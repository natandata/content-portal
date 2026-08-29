import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ContentForm } from "@/components/content/content-form";
import { PageHeader } from "@/components/ui/layout";
import { basePath, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function clientOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("status", "active")
    .order("company_name");

  return (data ?? []).map((client) => ({ id: client.id, companyName: client.company_name }));
}

export async function ContentCreate({ defaultClientId }: { defaultClientId?: string }) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const clients = await clientOptions();

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href={`${base}/content`}
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Conteudos
          </Link>
        }
        title="Novo conteudo"
        description="Salve como rascunho ou envie direto para a aprovacao do cliente."
      />

      <ContentForm basePath={base} clients={clients} defaultClientId={defaultClientId} />
    </>
  );
}

export async function ContentEdit({ contentId }: { contentId: string }) {
  const actor = await requireStaff();
  const base = basePath(actor.role);
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", contentId)
    .maybeSingle();

  if (!content) notFound();

  // Se o conteudo ja usa link externo, o formulario abre na aba de link.
  const { data: externalFile } = await supabase
    .from("content_files")
    .select("external_url")
    .eq("content_id", contentId)
    .not("external_url", "is", null)
    .order("position")
    .limit(1)
    .maybeSingle();

  const clients = await clientOptions();

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href={`${base}/content/${contentId}`}
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {content.title}
          </Link>
        }
        title="Editar conteudo"
        description="Atualize os dados ou substitua os arquivos antes de reenviar."
      />

      <ContentForm
        basePath={base}
        clients={clients}
        content={content}
        currentLink={externalFile?.external_url ?? null}
      />
    </>
  );
}
