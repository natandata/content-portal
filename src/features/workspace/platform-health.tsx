import {
  Database,
  Gauge,
  HardDrive,
  Server,
} from "lucide-react";

import { OrphanCleanup } from "@/components/platform/orphan-cleanup";
import { Card, CardHeader, PageHeader } from "@/components/ui/layout";
import { requireAdmin } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import type { PlatformStats } from "@/types/database";

/*
 * Limites do plano Free do Supabase. Ficam aqui como referencia das barras — a
 * cobranca oficial e sempre a do painel do Supabase.
 */
const DATABASE_LIMIT_BYTES = 500 * 1024 * 1024;
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

/** Nomes tecnicos das tabelas em portugues, para a lista fazer sentido. */
const TABLE_LABEL: Record<string, string> = {
  users: "Usuarios",
  clients: "Clientes",
  client_credentials: "Credenciais de cliente",
  client_profiles: "Perfis de Instagram",
  profile_highlights: "Destaques",
  contents: "Conteudos",
  content_files: "Arquivos de conteudo",
  contracts: "Documentos",
  approvals: "Aprovacoes",
  approval_history: "Historico",
  feed_items: "Itens de feed",
  platform_snapshots: "Medicoes semanais",
};

const BUCKET_LABEL: Record<string, string> = {
  content: "Conteudos",
  thumbnails: "Miniaturas",
  contracts: "Documentos enviados",
  "signed-contracts": "Documentos assinados",
  profiles: "Fotos de perfil e capas",
};

function UsageBar({
  used,
  limit,
  tone,
}: {
  used: number;
  limit: number;
  tone: "accent" | "amber";
}) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div className="mt-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "accent" ? "bg-accent" : "bg-amber-500",
          )}
          style={{ width: `${Math.max(percent, used > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-ink-500 tabular-nums">{percent}% usado</p>
    </div>
  );
}

function Meter({
  icon,
  title,
  hint,
  used,
  limit,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  used: number;
  limit: number;
  tone: "accent" | "amber";
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <span className="text-ink-400">{icon}</span>
          {title}
        </h2>
        <span className="shrink-0 text-xs text-ink-500">{hint}</span>
      </div>

      <p className="mt-3">
        <span className="text-2xl font-semibold text-ink-900 tabular-nums">
          {formatBytes(used)}
        </span>
        <span className="ml-1.5 text-sm text-ink-500">
          de {formatBytes(limit)} (plano Free)
        </span>
      </p>

      <UsageBar used={used} limit={limit} tone={tone} />
    </Card>
  );
}

function Detail({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; value: string; hint?: string }[];
}) {
  return (
    <details className="card group px-5 py-4">
      <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink-900">
        <span className="text-ink-400 transition group-open:rotate-90">▸</span>
        {title}
      </summary>

      <ul className="mt-4 divide-y divide-line">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-4 py-2">
            <span className="min-w-0 truncate text-sm text-ink-700">{row.label}</span>
            <span className="shrink-0 text-sm text-ink-900 tabular-nums">
              {row.value}
              {row.hint ? <span className="ml-2 text-xs text-ink-400">{row.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export async function PlatformHealth() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("platform_stats");

  if (error || !data) {
    return (
      <>
        <PageHeader title="Saude da plataforma" />
        <Card>
          <p className="text-sm text-ink-600">
            Nao foi possivel ler as metricas: {error?.message ?? "resposta vazia"}
          </p>
        </Card>
      </>
    );
  }

  const stats = data as PlatformStats;
  const projectRef = publicEnv.supabaseUrl
    ? (new URL(publicEnv.supabaseUrl).hostname.split(".")[0] ?? "—")
    : "—";

  const counts: { label: string; value: number }[] = [
    { label: "Clientes", value: stats.counts.clients },
    { label: "Usuarios", value: stats.counts.users },
    { label: "Conteudos", value: stats.counts.contents },
    { label: "Arquivos de conteudo", value: stats.counts.content_files },
    { label: "Documentos", value: stats.counts.documents },
    { label: "Aprovacoes", value: stats.counts.approvals },
    { label: "Registros de historico", value: stats.counts.history },
    { label: "Itens no feed", value: stats.counts.feed_items },
    { label: "Destaques", value: stats.counts.highlights },
  ];

  return (
    <>
      <PageHeader
        title="Saude da plataforma"
        description="Quanto o portal esta consumindo e onde o espaco esta indo."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Meter
          icon={<Database className="size-4" aria-hidden />}
          title="Banco de dados"
          hint={`Postgres ${stats.postgres_version.split(" ")[0] ?? ""}`}
          used={stats.database_bytes}
          limit={DATABASE_LIMIT_BYTES}
          tone="accent"
        />

        <div>
          <Meter
            icon={<HardDrive className="size-4" aria-hidden />}
            title="Armazenamento de arquivos"
            hint="conteudos, documentos, fotos"
            used={stats.storage_bytes}
            limit={STORAGE_LIMIT_BYTES}
            tone="amber"
          />

          <div className="mt-5">
            <OrphanCleanup />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <Card>
          <CardHeader
            title="Consumo semana a semana"
            description="Uma medicao e gravada na primeira vez que esta tela e aberta depois de sete dias."
          />

          {stats.snapshots.length === 0 ? (
            <p className="text-sm text-ink-500">Nenhuma medicao registrada ainda.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-500">
                    <th className="px-1 pb-2 font-medium">Data</th>
                    <th className="px-1 pb-2 font-medium">Clientes</th>
                    <th className="px-1 pb-2 font-medium">Conteudos</th>
                    <th className="px-1 pb-2 font-medium">Banco</th>
                    <th className="px-1 pb-2 font-medium">Arquivos</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.snapshots.map((snapshot) => (
                    <tr key={snapshot.captured_at} className="border-b border-line last:border-0">
                      <td className="px-1 py-2 text-ink-700">
                        {formatDate(snapshot.captured_at)}
                      </td>
                      <td className="px-1 py-2 text-ink-900 tabular-nums">
                        {snapshot.clients_count}
                      </td>
                      <td className="px-1 py-2 text-ink-900 tabular-nums">
                        {snapshot.contents_count}
                      </td>
                      <td className="px-1 py-2 text-ink-900 tabular-nums">
                        {formatBytes(snapshot.database_bytes)}
                      </td>
                      <td className="px-1 py-2 text-ink-900 tabular-nums">
                        {formatBytes(snapshot.storage_bytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-ink-500">
            Trafego de rede nao aparece aqui: quem mede e o painel do Supabase, e o limite do
            plano Free e de 5 GB por mes.
          </p>
        </Card>

        <Card>
          <CardHeader title="Volume de dados por area" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {counts.map((item) => (
              <div key={item.label}>
                <p className="text-xs text-ink-500">{item.label}</p>
                <p className="text-lg font-semibold text-ink-900 tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Detail
          title="O que esta ocupando o banco de dados"
          rows={stats.tables.map((table) => ({
            key: table.name,
            label: TABLE_LABEL[table.name] ?? table.name,
            value: formatBytes(table.bytes),
            hint: `${table.rows} linha(s)`,
          }))}
        />

        <Detail
          title="O que esta ocupando o armazenamento de arquivos"
          rows={stats.buckets.map((bucket) => ({
            key: bucket.name,
            label: BUCKET_LABEL[bucket.name] ?? bucket.name,
            value: formatBytes(bucket.bytes),
            hint: `${bucket.files} arquivo(s)`,
          }))}
        />

        <Card>
          <CardHeader title="Hospedagem" />
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-ink-500">
                <Server className="size-3.5" aria-hidden />
                App
              </dt>
              <dd className="mt-0.5 break-all text-ink-900">Vercel</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-ink-500">
                <Database className="size-3.5" aria-hidden />
                Banco
              </dt>
              <dd className="mt-0.5 break-all text-ink-900">{projectRef}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-ink-500">
                <Gauge className="size-3.5" aria-hidden />
                Postgres
              </dt>
              <dd className="mt-0.5 text-ink-900">{stats.postgres_version.split(" ")[0]}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Plano</dt>
              <dd className="mt-0.5 text-ink-900">Free</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
