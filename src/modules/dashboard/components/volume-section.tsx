// Seção "Volume de PRs": abertos x concluídos ao longo do período.
import { ChartColumnBig } from "lucide-react";
import { db } from "@/lib/db";
import { bucketTick, bucketTitle, formatNumber, toIsoDate, windowDays } from "../domain/format";
import { allowedGranularities, GRANULARITY_LABEL, type DashboardRange, type Granularity } from "../domain/period";
import { getVolumeSeries } from "../queries/volume";
import { SERIES_COLOR, SERIES_LABEL } from "./chart-colors";
import { GranularityPicker } from "./granularity-picker";
import { VolumeChart, type VolumeChartPoint } from "./volume-chart";

type Props = {
  range: DashboardRange;
  granularity: Granularity;
  periodParams: Record<string, string>;
};

const CARD = "flex flex-col rounded-xl border border-border bg-surface p-4 transition-opacity sm:p-5 group-has-data-pending:opacity-50";

export async function VolumeSection({ range, granularity, periodParams }: Props) {
  const series = await getVolumeSeries(db, range.current, granularity);
  const { first, last } = windowDays(range.current);
  const period = { first: toIsoDate(first), last: toIsoDate(last) };

  const points: VolumeChartPoint[] = series.map((p) => ({
    ...p,
    ...bucketTitle(p.bucket, granularity, period),
    tick: bucketTick(p.bucket, granularity),
  }));
  const opened = points.reduce((sum, p) => sum + p.opened, 0);
  const concluded = points.reduce((sum, p) => sum + p.concluded, 0);
  const balance = opened - concluded;
  const unit = GRANULARITY_LABEL[granularity].toLowerCase();

  const summary =
    `${formatNumber(opened)} PRs abertos e ${formatNumber(concluded)} concluídos no período, ` +
    `agrupados por ${unit}. ` +
    (balance === 0 ? "A fila ficou estável." : balance > 0 ? `A fila cresceu ${balance}.` : `A fila diminuiu ${-balance}.`);

  return (
    <section aria-labelledby="volume-titulo" className={CARD}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="volume-titulo" className="text-sm font-semibold">
            Volume de PRs
          </h2>
          <p className="mt-0.5 text-xs text-faint">Abertos x concluídos, por {unit}</p>
        </div>
        <GranularityPicker
          value={granularity}
          options={allowedGranularities(range.days)}
          suggested={range.granularity}
          periodParams={periodParams}
        />
      </header>

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" aria-label="Totais do período">
        <LegendItem color={SERIES_COLOR.opened} label={SERIES_LABEL.opened} value={opened} />
        <LegendItem color={SERIES_COLOR.concluded} label={SERIES_LABEL.concluded} value={concluded} />
        <li className="text-faint">
          Saldo da fila:{" "}
          <span className="font-semibold text-muted">
            {balance === 0 ? "estável" : `${balance > 0 ? "+" : "−"}${formatNumber(Math.abs(balance))}`}
          </span>
        </li>
      </ul>

      {opened === 0 && concluded === 0 ? (
        <div className="mt-4 grid h-64 place-items-center rounded-lg border border-dashed border-border-strong text-center sm:h-72">
          <div className="max-w-xs px-4">
            <ChartColumnBig className="mx-auto size-7 text-gold-dim" strokeWidth={1.6} aria-hidden />
            <p className="mt-3 text-sm font-medium text-muted">Nenhum PR aberto ou concluído neste período</p>
            <p className="mt-1 text-xs text-faint">Escolha outro período para ver a evolução.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <VolumeChart points={points} summary={summary} />
          </div>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-faint select-none hover:text-muted">Ver dados em tabela</summary>
            <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-surface-2 text-faint">
                  <tr>
                    <th className="px-3 py-2 font-medium">{GRANULARITY_LABEL[granularity]}</th>
                    <th className="px-3 py-2 text-right font-medium">Abertos</th>
                    <th className="px-3 py-2 text-right font-medium">Concluídos</th>
                    <th className="px-3 py-2 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.bucket} className="border-t border-border text-muted">
                      <td className="px-3 py-1.5">
                        {p.title}
                        {p.partial && <span className="text-faint"> · parcial</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">{p.opened}</td>
                      <td className="px-3 py-1.5 text-right">{p.concluded}</td>
                      <td className="px-3 py-1.5 text-right">{signed(p.opened - p.concluded)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-text">{formatNumber(value)}</span>
    </li>
  );
}

function signed(n: number): string {
  return n === 0 ? "0" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
}

export function VolumeSectionSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-4 sm:p-5" aria-hidden>
      <div className="h-4 w-32 animate-pulse rounded bg-surface-3" />
      <div className="mt-2 h-3 w-44 animate-pulse rounded bg-surface-2" />
      <div className="mt-5 h-64 animate-pulse rounded-lg bg-surface-2/60 sm:h-72" />
    </div>
  );
}
