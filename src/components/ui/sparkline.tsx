/**
 * Grafico de barras em CSS puro, sem lib de charting. Extraido de
 * `InstagramInsightsReportCard` (era local ali) para ser reaproveitado em
 * outros lugares -- ex.: tendencia de receita na Visao Geral.
 */
export function Sparkline({
  points,
  formatLabel,
}: {
  points: { value: number; endTime: string | null }[];
  /** Rotulo do tooltip de cada barra -- padrao mostra a data (formato usado no relatorio de Instagram). */
  formatLabel?: (point: { value: number; endTime: string | null }) => string;
}) {
  if (points.length === 0) return <p className="text-xs text-ink-400">Sem dados no periodo.</p>;
  const max = Math.max(...points.map((p) => p.value), 1);
  const label =
    formatLabel ??
    ((point: { value: number; endTime: string | null }) =>
      `${point.endTime ?? ""}: ${point.value.toLocaleString("pt-BR")}`);

  return (
    // Com poucos pontos, a barra `flex-1` estica pra preencher a largura toda
    // (como sempre foi). Com muitos (relatorio de 6/9 meses passa de 180
    // barras), o `min-width` do miolo forca a rolagem AQUI dentro -- sem o
    // wrapper `overflow-x-auto`, isso vazava e estourava a largura da pagina
    // inteira em vez de rolar so o grafico.
    <div className="scroll-slim overflow-x-auto">
      <div className="flex h-16 items-end gap-0.5" style={{ minWidth: `${points.length * 4}px` }}>
        {points.map((point, index) => (
          <div
            key={index}
            className="min-w-[3px] flex-1 rounded-t bg-accent/70"
            style={{ height: `${Math.max((point.value / max) * 100, 2)}%` }}
            title={label(point)}
          />
        ))}
      </div>
    </div>
  );
}
