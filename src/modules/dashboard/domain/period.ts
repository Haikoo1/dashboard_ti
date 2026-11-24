// Filtros de período do Dashboard.
//
// Regras:
// - "Últimos N dias": de 00:00 (Brasília) de N-1 dias atrás até agora (hoje incluso).
// - "Este ano": de 1º de janeiro até agora.
// - "Personalizado": de 00:00 do dia inicial até 23:59:59 do dia final (limitado a agora).
// - Período anterior: mesmo intervalo de tempo, deslocado para trás (N dias ou 1 ano).
//   Assim, "últimos 7 dias" às 10h de hoje compara com os 7 dias anteriores até as 10h,
//   mantendo a comparação justa mesmo com o dia atual incompleto.
import { z } from "zod";
import { addZonedDays, parseIsoDate, startOfZonedDay, zonedDateParts, zonedMidnight } from "@/lib/time-zone";

export const PERIOD_KEYS = ["7d", "30d", "90d", "ano", "personalizado"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  ano: "Este ano",
  personalizado: "Personalizado",
};

export const DEFAULT_PERIOD = "30d" satisfies PeriodKey;

/** Agrupamento dos gráficos de volume. */
export const GRANULARITIES = ["dia", "semana", "mes"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** Maior intervalo aceito no período personalizado. */
export const MAX_CUSTOM_DAYS = 731;

const ROLLING_DAYS: Partial<Record<PeriodKey, number>> = { "7d": 7, "30d": 30, "90d": 90 };

export type TimeWindow = { start: Date; end: Date };

export type DashboardRange = {
  key: PeriodKey;
  label: string;
  /** Período atual: [start, end). "end" nunca passa de "agora". */
  current: TimeWindow;
  /** Período anterior, de mesma duração, para comparação. */
  previous: TimeWindow;
  /** Quantidade de dias de calendário do período (inclui o dia atual). */
  days: number;
  /** Agrupamento sugerido para os gráficos. */
  granularity: Granularity;
  /** Momento de referência do cálculo ("agora"). */
  now: Date;
};

// ---------------------------------------------------------------------------
// Validação dos parâmetros recebidos pelo endereço (?periodo=30d&de=...&ate=...)
// ---------------------------------------------------------------------------
const isoDate = z.string().refine((v) => parseIsoDate(v) !== null, "Data inválida (use AAAA-MM-DD).");

export const periodInputSchema = z.discriminatedUnion("periodo", [
  z.object({ periodo: z.enum(["7d", "30d", "90d", "ano"]) }),
  z.object({ periodo: z.literal("personalizado"), de: isoDate, ate: isoDate }),
]);
export type PeriodInput = z.infer<typeof periodInputSchema>;

type SearchParams = Record<string, string | string[] | undefined>;

export type ParsedPeriod = { input: PeriodInput; error: string | null };

/**
 * Lê o período dos parâmetros do endereço. Valores ausentes ou inválidos
 * voltam para o padrão, com uma mensagem de erro para a interface exibir.
 */
export function parsePeriodParams(params: SearchParams): ParsedPeriod {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const raw = { periodo: first(params.periodo) ?? DEFAULT_PERIOD, de: first(params.de), ate: first(params.ate) };
  const parsed = periodInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { input: { periodo: DEFAULT_PERIOD }, error: "Período inválido. Exibindo os últimos 30 dias." };
  }
  return { input: parsed.data, error: null };
}

// ---------------------------------------------------------------------------
// Cálculo das janelas de tempo
// ---------------------------------------------------------------------------
export class PeriodError extends Error {}

export function resolvePeriod(input: PeriodInput, now: Date): DashboardRange {
  const todayStart = startOfZonedDay(now);
  let start: Date;
  let end: Date;
  let previousStart: Date;
  let days: number;
  let label = PERIOD_LABEL[input.periodo];

  if (input.periodo === "personalizado") {
    const from = parseIsoDate(input.de);
    const to = parseIsoDate(input.ate);
    if (!from || !to) throw new PeriodError("Datas inválidas.");
    start = zonedMidnight(from);
    const lastDayStart = zonedMidnight(to);
    if (lastDayStart < start) throw new PeriodError("A data inicial deve ser anterior ou igual à final.");
    if (lastDayStart > todayStart) throw new PeriodError("A data final não pode estar no futuro.");
    const dayAfter = addZonedDays(lastDayStart, 1);
    end = dayAfter < now ? dayAfter : now;
    days = countCalendarDays(start, lastDayStart);
    if (days > MAX_CUSTOM_DAYS) throw new PeriodError(`O período pode ter no máximo ${MAX_CUSTOM_DAYS} dias.`);
    previousStart = addZonedDays(start, -days);
    label = `${formatDay(start)} a ${formatDay(lastDayStart)}`;
  } else if (input.periodo === "ano") {
    const { year } = zonedDateParts(now);
    start = zonedMidnight({ year, month: 1, day: 1 });
    end = now;
    days = countCalendarDays(start, todayStart);
    previousStart = zonedMidnight({ year: year - 1, month: 1, day: 1 });
  } else {
    const n = ROLLING_DAYS[input.periodo]!;
    start = addZonedDays(todayStart, -(n - 1));
    end = now;
    days = n;
    previousStart = addZonedDays(start, -n);
  }

  const duration = end.getTime() - start.getTime();
  return {
    key: input.periodo,
    label,
    current: { start, end },
    previous: { start: previousStart, end: new Date(previousStart.getTime() + duration) },
    days,
    granularity: suggestGranularity(days),
    now,
  };
}

/**
 * Lê e resolve o período pedido no endereço. Qualquer problema (parâmetro
 * inválido, data no futuro, intervalo grande demais) cai no período padrão,
 * com uma mensagem explicando o motivo.
 */
export function resolvePeriodFromParams(params: SearchParams, now: Date): { range: DashboardRange; error: string | null } {
  const parsed = parsePeriodParams(params);
  try {
    return { range: resolvePeriod(parsed.input, now), error: parsed.error };
  } catch (e) {
    if (!(e instanceof PeriodError)) throw e;
    return {
      range: resolvePeriod({ periodo: DEFAULT_PERIOD }, now),
      error: `${e.message} Exibindo: ${PERIOD_LABEL[DEFAULT_PERIOD].toLowerCase()}.`,
    };
  }
}

export function suggestGranularity(days: number): Granularity {
  if (days <= 31) return "dia";
  if (days <= 120) return "semana";
  return "mes";
}

/** Dias de calendário entre duas meias-noites locais, contando ambas. */
function countCalendarDays(firstDay: Date, lastDay: Date): number {
  return Math.round((lastDay.getTime() - firstDay.getTime()) / 86_400_000) + 1;
}

function formatDay(midnight: Date): string {
  const { year, month, day } = zonedDateParts(midnight);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}
