// Seção "Desempenho": primeira resposta, resolução, conclusão e prazo.
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";
import { compare } from "../domain/comparison";
import { elapsedTime } from "../domain/duration";
import { describeComparison, formatDuration, formatNumber, formatPercent, type ComparisonView } from "../domain/format";
import type { DashboardRange } from "../domain/period";
import { getPerformance } from "../queries/performance";
import { ComparisonLine } from "./indicator-card";
import { ElapsedTimeBadge, SectionCard, SectionSkeleton } from "./section-card";

const NO_BASE: ComparisonView = { direction: "none", tone: "neutral", change: "", detail: "Sem base de comparação" };

/** Compara médias de tempo (menor é melhor); sem comparação se faltar um dos lados. */
function compareTimes(current: number | null, previous: number | null): ComparisonView {
  if (current === null || previous === null) return NO_BASE;
  return describeComparison(compare(Math.round(current), Math.round(previous)), "lower-is-better", formatDuration);
}

export async function PerformanceSection({ range }: { range: DashboardRange }) {
  const p = await getPerformance(db, range, elapsedTime);
  const { firstResponse: fr, resolution: res, completion } = p;

  return (
    <SectionCard
      id="desempenho-titulo"
      title="Desempenho"
      subtitle="Atendimento e resolução dos PRs no período"
      actions={<ElapsedTimeBadge />}
    >
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Primeira resposta"
          hint="Média da abertura até a primeira ação de um técnico"
          value={fr.avgMinutes === null ? "—" : formatDuration(fr.avgMinutes)}
          comparison={compareTimes(fr.avgMinutes, fr.previousAvgMinutes)}
          footer={
            <>
              {formatNumber(fr.responded)} respondidos
              {fr.waiting > 0 && <> · <span className="text-warning">{formatNumber(fr.waiting)} aguardando</span></>}
            </>
          }
        />
        <Tile
          label="Tempo de resolução"
          hint="Média da abertura até a conclusão"
          value={res.avgResolutionMinutes === null ? "—" : formatDuration(res.avgResolutionMinutes)}
          comparison={compareTimes(res.avgResolutionMinutes, res.previousAvgMinutes)}
          footer={<>{formatNumber(res.count)} concluídos no período</>}
        />
        <Tile
          label="Taxa de conclusão"
          hint="Dos PRs abertos no período, quantos já foram concluídos (cancelados não contam)"
          value={completion.percent === null ? "—" : formatPercent(completion.percent)}
          meter={completion.percent === null ? undefined : { percent: completion.percent, tone: "gold" }}
          footer={
            <>
              {formatNumber(completion.concluded)} de {formatNumber(completion.considered)} abertos no período
            </>
          }
        />
        <Tile
          label="Dentro do prazo"
          hint="Concluídos até o prazo definido pela prioridade (SLA)"
          value={res.onTimePercent === null ? "—" : formatPercent(res.onTimePercent)}
          meter={res.onTimePercent === null ? undefined : { percent: res.onTimePercent, tone: "success" }}
          footer={
            <>
              {formatNumber(res.onTime)} no prazo ·{" "}
              <span className={res.late > 0 ? "text-danger" : undefined}>{formatNumber(res.late)} fora do prazo</span>
            </>
          }
        />
      </div>
    </SectionCard>
  );
}

type TileProps = {
  label: string;
  hint: string;
  value: string;
  comparison?: ComparisonView;
  meter?: { percent: number; tone: "gold" | "success" };
  footer: ReactNode;
};

function Tile({ label, hint, value, comparison, meter, footer }: TileProps) {
  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface-2/50 p-4">
      <h3 className="text-[13px] font-medium text-muted" title={hint}>
        {label}
      </h3>
      <p className="mt-0.5 text-[11px] leading-snug text-faint">{hint}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {meter && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div
            className={cn("h-full rounded-full", meter.tone === "gold" ? "bg-gold" : "bg-success")}
            style={{ width: `${Math.min(100, Math.max(0, meter.percent))}%` }}
          />
        </div>
      )}
      {comparison && <ComparisonLine view={comparison} className="mt-2" />}
      <div className="mt-auto pt-3">
        <p className="border-t border-border pt-2.5 text-xs text-faint">{footer}</p>
      </div>
    </article>
  );
}

export function PerformanceSectionSkeleton() {
  return <SectionSkeleton rows={3} />;
}
