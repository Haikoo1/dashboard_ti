// Seção "PRs por setor": participação de cada setor nos PRs abertos no período.
import { Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { describeComparison, formatNumber, formatPercent } from "../domain/format";
import type { DashboardRange } from "../domain/period";
import { getSectorReport } from "../queries/sectors";
import { SERIES_COLOR } from "./chart-colors";
import { ComparisonLine } from "./indicator-card";
import { SectionCard, SectionEmpty, SectionSkeleton } from "./section-card";

export async function SectorsSection({ range }: { range: DashboardRange }) {
  const report = await getSectorReport(db, range);
  // Só setores com PRs no período (os que só tinham no anterior não ocupam espaço).
  const sectors = report.sectors.filter((s) => s.count.current > 0);
  const max = Math.max(0, ...sectors.map((s) => s.count.current));

  return (
    <SectionCard
      id="setores-titulo"
      title="PRs por setor"
      subtitle={`${formatNumber(report.total)} abertos no período, por setor solicitante`}
      className="h-full"
    >
      {sectors.length === 0 ? (
        <SectionEmpty
          icon={<Building2 className="size-7" strokeWidth={1.6} />}
          title="Nenhum PR aberto neste período"
          hint="A distribuição por setor aparece quando houver PRs no período."
        />
      ) : (
        <ol className="space-y-3.5">
          {sectors.map((s) => (
            <li key={s.sectorId}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-medium text-text">{s.name}</span>
                <span className="shrink-0 text-muted">
                  <span className="font-semibold text-text">{formatNumber(s.count.current)}</span>
                  <span className="text-faint"> · {formatPercent(s.percent)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(s.count.current / max) * 100}%`, background: SERIES_COLOR.opened }}
                />
              </div>
              {report.hasComparison && (
                <ComparisonLine view={describeComparison(s.count, "neutral")} className="mt-1 min-h-0 text-[11px]" />
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-auto pt-4 text-[11px] text-faint">
        Setor registrado na abertura do PR. Barras proporcionais ao maior setor.
      </p>
    </SectionCard>
  );
}

export function SectorsSectionSkeleton() {
  return <SectionSkeleton rows={6} className="h-full" />;
}
