// Seção "Indicadores principais": seis cards calculados no servidor.
import { AlarmClock, CircleCheck, CircleDot, CirclePause, Inbox, Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatWindow, windowDays } from "../domain/format";
import type { DashboardRange } from "../domain/period";
import { getIndicatorCards } from "../queries/indicators";
import { IndicatorCard, IndicatorCardSkeleton } from "./indicator-card";

const GRID = "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6";

export async function IndicatorsSection({ range }: { range: DashboardRange }) {
  const cards = await getIndicatorCards(db, range);

  // Cards de "situação" mostram como os PRs estavam no fim do período:
  // nos filtros que terminam agora, é a situação atual.
  const endsNow = range.current.end.getTime() >= range.now.getTime();
  const snapshotScope = endsNow ? "Situação atual" : `Situação em ${formatDate(windowDays(range.current).last)}`;

  return (
    <section aria-labelledby="indicadores-titulo" className="space-y-3">
      <h2 id="indicadores-titulo" className="sr-only">
        Indicadores principais
      </h2>
      <div className={GRID}>
        <IndicatorCard label="PRs registrados" icon={Inbox} value={cards.registered} meaning="neutral" scope="Abertos no período" />
        <IndicatorCard label="Abertos" icon={CircleDot} value={cards.open} meaning="neutral" scope={snapshotScope} />
        <IndicatorCard label="Em andamento" icon={Wrench} value={cards.inProgress} meaning="neutral" scope={snapshotScope} />
        <IndicatorCard label="Pendentes" icon={CirclePause} value={cards.pending} meaning="lower-is-better" scope={snapshotScope} />
        <IndicatorCard
          label="Concluídos"
          icon={CircleCheck}
          value={cards.concluded}
          meaning="higher-is-better"
          scope="Concluídos no período"
        />
        <IndicatorCard
          label="Atrasados"
          icon={AlarmClock}
          value={cards.overdue}
          meaning="lower-is-better"
          scope={snapshotScope}
          alert={cards.overdue.current > 0}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-faint">
        {cards.hasComparison ? (
          <>
            Comparação com {formatWindow(range.previous)}. Nos cards de situação, compara-se com a situação no fim
            daquele período.
          </>
        ) : (
          <>Sem comparação: não há PRs registrados antes de {formatDate(range.current.start)}.</>
        )}
      </p>
    </section>
  );
}

export function IndicatorsSectionSkeleton() {
  return (
    <div className={GRID}>
      {Array.from({ length: 6 }, (_, i) => (
        <IndicatorCardSkeleton key={i} />
      ))}
    </div>
  );
}
