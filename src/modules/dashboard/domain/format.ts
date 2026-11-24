// Formatação dos números e datas exibidos no Dashboard (pt-BR, horário de Brasília).
import { zonedDateParts } from "@/lib/time-zone";
import type { Comparison } from "./comparison";
import type { Granularity, TimeWindow } from "./period";

const integerFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
  return integerFormat.format(value);
}

/** Percentual com sinal: "+12%", "−3,5%" (uma casa decimal abaixo de 10%). */
export function formatSignedPercent(value: number): string {
  const abs = Math.abs(value);
  const digits = abs < 10 && abs !== Math.round(abs) ? 1 : 0;
  const text = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(abs);
  if (text === "0") return "0%";
  return `${value > 0 ? "+" : "−"}${text}%`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Data do calendário (Brasília) no formato AAAA-MM-DD, usado no endereço da página. */
export function toIsoDate(instant: Date): string {
  const { year, month, day } = zonedDateParts(instant);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "24/11/2026" */
export function formatDate(instant: Date): string {
  const { year, month, day } = zonedDateParts(instant);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** Primeiro e último dia de calendário de uma janela [start, end). */
export function windowDays(window: TimeWindow): { first: Date; last: Date } {
  return { first: window.start, last: new Date(window.end.getTime() - 1) };
}

/** "26/10/2026 a 24/11/2026" (ou só a data, quando a janela cabe em um dia). */
export function formatWindow(window: TimeWindow): string {
  const { first, last } = windowDays(window);
  const a = formatDate(first);
  const b = formatDate(last);
  return a === b ? a : `${a} a ${b}`;
}

// ---------------------------------------------------------------------------
// Texto da comparação com o período anterior
// ---------------------------------------------------------------------------

/** Como interpretar uma alta do indicador. */
export type TrendMeaning = "higher-is-better" | "lower-is-better" | "neutral";

export type ComparisonView = {
  direction: "up" | "down" | "flat" | "none";
  /** Destaque visual: positivo, negativo ou neutro. */
  tone: "good" | "bad" | "neutral";
  /** Variação principal: "+12%", "+3", "0%". Vazio quando não há comparação. */
  change: string;
  /** Complemento: "antes: 34" ou "sem base de comparação". */
  detail: string;
};

export function describeComparison(c: Comparison, meaning: TrendMeaning): ComparisonView {
  if (c.previous === null || c.delta === null) {
    return { direction: "none", tone: "neutral", change: "", detail: "Sem base de comparação" };
  }
  const before = `antes: ${formatNumber(c.previous)}`;
  if (c.delta === 0) return { direction: "flat", tone: "neutral", change: "0%", detail: before };

  const direction = c.delta > 0 ? "up" : "down";
  // Anterior igual a zero: a variação percentual é indefinida; mostra a diferença absoluta.
  const change =
    c.deltaPercent === null ? `${c.delta > 0 ? "+" : "−"}${formatNumber(Math.abs(c.delta))}` : formatSignedPercent(c.deltaPercent);
  const tone =
    meaning === "neutral"
      ? "neutral"
      : (direction === "up") === (meaning === "higher-is-better")
        ? "good"
        : "bad";
  return { direction, tone, change, detail: before };
}

// ---------------------------------------------------------------------------
// Rótulos dos intervalos do gráfico de volume
// ---------------------------------------------------------------------------
// Os intervalos chegam como datas do calendário ("AAAA-MM-DD", já no horário de
// Brasília). As contas abaixo usam UTC só como calendário neutro, sem fuso.

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const WEEKDAYS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

function calendar(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const dayMonth = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;

/** Último dia (AAAA-MM-DD) do intervalo que começa em "bucket". */
export function bucketEnd(bucket: string, granularity: Granularity): string {
  const d = calendar(bucket);
  if (granularity === "semana") d.setUTCDate(d.getUTCDate() + 6);
  if (granularity === "mes") d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return isoOf(d);
}

/** Rótulo curto do eixo: "24/11" (dia e semana) ou "nov/26" (mês). */
export function bucketTick(bucket: string, granularity: Granularity): string {
  const d = calendar(bucket);
  if (granularity === "mes") return `${MONTHS_SHORT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
  return dayMonth(d);
}

/**
 * Rótulo completo (dica e tabela). Intervalos cortados pelo período (ex.: semana que
 * começou antes dele) informam os dias realmente considerados e ficam marcados como parciais.
 */
export function bucketTitle(
  bucket: string,
  granularity: Granularity,
  period: { first: string; last: string },
): { title: string; partial: boolean } {
  const d = calendar(bucket);
  if (granularity === "dia") {
    return { title: `${WEEKDAYS[d.getUTCDay()]} ${dayMonth(d)}/${d.getUTCFullYear()}`, partial: false };
  }
  const start = bucket < period.first ? period.first : bucket;
  const endIso = bucketEnd(bucket, granularity);
  const end = endIso > period.last ? period.last : endIso;
  const partial = start !== bucket || end !== endIso;
  if (granularity === "mes") {
    const name = `${MONTHS_LONG[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
    return {
      title: partial ? `${name} (${dayMonth(calendar(start))} a ${dayMonth(calendar(end))})` : name,
      partial,
    };
  }
  const e = calendar(end);
  return { title: `Semana de ${dayMonth(calendar(start))} a ${dayMonth(e)}/${e.getUTCFullYear()}`, partial };
}
