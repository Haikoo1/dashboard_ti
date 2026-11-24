// Conteúdo do Dashboard, montado no servidor a cada acesso.
//
// Fluxo: lê o período do endereço → verifica se há PRs → mostra o cabeçalho com o
// filtro na hora e carrega cada seção em seguida (com esqueleto enquanto isso).
import { TriangleAlert } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { db, getDataMode } from "@/lib/db";
import { formatWindow, toIsoDate, windowDays } from "../domain/format";
import { DEFAULT_PERIOD, resolveGranularity, resolvePeriodFromParams, type DashboardRange } from "../domain/period";
import { hasAnyTicket } from "../queries/shared";
import { DashboardEmpty } from "./dashboard-empty";
import { IndicatorsSection, IndicatorsSectionSkeleton } from "./indicators-section";
import { PeriodFilter } from "./period-filter";
import { VolumeSection, VolumeSectionSkeleton } from "./volume-section";

// Áreas que ainda serão implementadas, com a parte prevista.
const UPCOMING = [
  { title: "Alertas de atraso", part: "Parte 8", span: "" },
  { title: "Desempenho dos responsáveis", part: "Parte 7", span: "md:col-span-2" },
  { title: "PRs por setor", part: "Parte 7", span: "" },
  { title: "Atividades recentes", part: "Parte 8", span: "md:col-span-3" },
] as const;

type SearchParams = Record<string, string | string[] | undefined>;

export async function DashboardView({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const now = new Date();

  if (!(await hasAnyTicket(db))) {
    return (
      <>
        <Heading subtitle="Nenhum dado para exibir" />
        <DashboardEmpty demoAvailable={getDataMode() === "real"} />
      </>
    );
  }

  const { range, error } = resolvePeriodFromParams(searchParams, now);
  const { first, last } = windowDays(range.current);
  const granularity = resolveGranularity(searchParams.agrupar, range.days);
  const subtitle = range.key === "personalizado" ? range.label : `${range.label} · ${formatWindow(range.current)}`;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Heading subtitle={subtitle} />
        <PeriodFilter value={range.key} from={toIsoDate(first)} to={toIsoDate(last)} today={toIsoDate(now)} />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <Suspense fallback={<IndicatorsSectionSkeleton />}>
        <IndicatorsSection range={range} />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <Suspense fallback={<VolumeSectionSkeleton />}>
            <VolumeSection range={range} granularity={granularity} periodParams={periodParams(range)} />
          </Suspense>
        </div>
        {UPCOMING.map((section) => (
          <section
            key={section.title}
            className={`flex min-h-36 flex-col justify-between rounded-xl border border-dashed border-border-strong bg-surface/40 p-5 ${section.span}`}
          >
            <h3 className="text-sm font-semibold text-muted">{section.title}</h3>
            <p className="font-mono text-[11px] tracking-wide text-faint uppercase">Previsto: {section.part}</p>
          </section>
        ))}
      </div>
    </>
  );
}

/** Parâmetros do endereço que descrevem o período em exibição (já validado). */
function periodParams(range: DashboardRange): Record<string, string> {
  if (range.key === DEFAULT_PERIOD) return {};
  if (range.key !== "personalizado") return { periodo: range.key };
  const { first, last } = windowDays(range.current);
  return { periodo: range.key, de: toIsoDate(first), ate: toIsoDate(last) };
}

function Heading({ subtitle }: { subtitle: string }) {
  return (
    <div className="shrink-0">
      <h2 className="text-lg font-semibold tracking-tight">Visão geral</h2>
      <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

export function DashboardViewSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" aria-hidden>
        <div className="space-y-2">
          <div className="h-5 w-32 animate-pulse rounded bg-surface-3" />
          <div className="h-3.5 w-64 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="h-9 w-full animate-pulse rounded-xl bg-surface sm:w-96" />
      </div>
      <IndicatorsSectionSkeleton />
    </>
  );
}
