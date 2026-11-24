"use client";

// Gráfico de colunas agrupadas: PRs abertos x concluídos em cada intervalo.
// Recebe os dados prontos do servidor; aqui só desenha e mostra a dica ao passar o mouse.
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { SERIES_COLOR, SERIES_LABEL } from "./chart-colors";

export type VolumeChartPoint = {
  bucket: string;
  tick: string;
  title: string;
  partial: boolean;
  opened: number;
  concluded: number;
};

const AXIS_TICK = { fill: "var(--text-faint)", fontSize: 11 };

export function VolumeChart({ points, summary }: { points: VolumeChartPoint[]; summary: string }) {
  return (
    <div className="h-64 w-full sm:h-72" role="img" aria-label={summary}>
      <BarChart
        responsive
        style={{ width: "100%", height: "100%" }}
        data={points}
        margin={{ top: 8, right: 4, bottom: 0, left: -12 }}
        barGap={2}
        barCategoryGap="22%"
      >
        <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
        <XAxis
          dataKey="tick"
          tickLine={false}
          axisLine={{ stroke: "var(--border-strong)" }}
          tick={AXIS_TICK}
          interval="preserveStartEnd"
          minTickGap={14}
          tickMargin={8}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} width={44} />
        <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.035)" }} content={VolumeTooltip} isAnimationActive={false} />
        <Bar
          dataKey="opened"
          name={SERIES_LABEL.opened}
          fill={SERIES_COLOR.opened}
          radius={[4, 4, 0, 0]}
          maxBarSize={20}
          isAnimationActive={false}
        />
        <Bar
          dataKey="concluded"
          name={SERIES_LABEL.concluded}
          fill={SERIES_COLOR.concluded}
          radius={[4, 4, 0, 0]}
          maxBarSize={20}
          isAnimationActive={false}
        />
      </BarChart>
    </div>
  );
}

function VolumeTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as VolumeChartPoint | undefined;
  if (!active || !point) return null;
  const balance = point.opened - point.concluded;
  return (
    <div className="min-w-48 rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-xs shadow-xl shadow-black/40">
      <p className="font-semibold text-text">{point.title}</p>
      {point.partial && <p className="mt-0.5 text-[11px] text-faint">Intervalo parcial (cortado pelo período)</p>}
      <dl className="mt-2 space-y-1">
        <Row color={SERIES_COLOR.opened} label={SERIES_LABEL.opened} value={point.opened} />
        <Row color={SERIES_COLOR.concluded} label={SERIES_LABEL.concluded} value={point.concluded} />
      </dl>
      <p className="mt-2 border-t border-border pt-2 text-muted">
        Saldo: {balance === 0 ? "sem variação" : `${balance > 0 ? "+" : "−"}${Math.abs(balance)} na fila`}
      </p>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      <dt className="text-muted">{label}</dt>
      <dd className="ml-auto font-semibold text-text">{value}</dd>
    </div>
  );
}
