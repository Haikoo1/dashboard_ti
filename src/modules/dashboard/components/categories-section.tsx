// Seção "Tempo por categoria": tempo médio de resolução de cada categoria,
// considerando os PRs concluídos no período. Mais demoradas primeiro.
import { Tags } from "lucide-react";
import { db } from "@/lib/db";
import { elapsedTime } from "../domain/duration";
import { formatDuration, formatNumber, formatPercent } from "../domain/format";
import type { DashboardRange } from "../domain/period";
import { getResolutionTimes } from "../queries/performance";
import { ElapsedTimeBadge, SectionCard, SectionEmpty, SectionSkeleton } from "./section-card";

export async function CategoriesSection({ range }: { range: DashboardRange }) {
  const { byCategory } = await getResolutionTimes(db, range, elapsedTime);
  const categories = [...byCategory].sort((a, b) => (b.avgMinutes ?? 0) - (a.avgMinutes ?? 0));
  const max = Math.max(0, ...categories.map((c) => c.avgMinutes ?? 0));

  return (
    <SectionCard
      id="categorias-titulo"
      title="Tempo de resolução por categoria"
      subtitle="Média dos PRs concluídos no período"
      actions={<ElapsedTimeBadge />}
      className="h-full"
    >
      {categories.length === 0 ? (
        <SectionEmpty
          icon={<Tags className="size-7" strokeWidth={1.6} />}
          title="Nenhum PR concluído neste período"
          hint="Os tempos por categoria aparecem quando houver conclusões no período."
        />
      ) : (
        <ol className="space-y-3.5">
          {categories.map((c) => (
            <li key={c.id ?? c.name}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-medium text-text">{c.name}</span>
                <span className="shrink-0 font-semibold text-text">
                  {c.avgMinutes === null ? "—" : formatDuration(c.avgMinutes)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <div className="h-full rounded-full bg-gold" style={{ width: `${max === 0 ? 0 : ((c.avgMinutes ?? 0) / max) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-faint">
                {formatNumber(c.count)} {c.count === 1 ? "concluído" : "concluídos"} ·{" "}
                {formatPercent((c.onTime / c.count) * 100)} no prazo
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

export function CategoriesSectionSkeleton() {
  return <SectionSkeleton rows={6} className="h-full" />;
}
