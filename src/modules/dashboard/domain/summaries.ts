// Resumos de tempo calculados a partir de linhas vindas do banco.
// São funções puras (sem acesso ao banco), testadas isoladamente.
import type { DurationCalculator, DurationMode } from "./duration";

/** Um PR concluído dentro do período. */
export type ConclusionRow = {
  ticketId: number;
  openedAt: Date;
  firstResponseAt: Date | null;
  concludedAt: Date;
  dueAt: Date;
  categoryId: number;
  categoryName: string;
  /** Responsável no momento da conclusão. */
  assigneeId: number | null;
  assigneeName: string | null;
};

/** Um PR aberto dentro do período, para o tempo de primeira resposta. */
export type OpeningRow = {
  openedAt: Date;
  firstResponseAt: Date | null;
};

export type TimeGroup = {
  id: number | null;
  name: string;
  count: number;
  avgMinutes: number | null;
  onTime: number;
  late: number;
};

export type ResolutionSummary = {
  mode: DurationMode;
  count: number;
  avgResolutionMinutes: number | null;
  onTime: number;
  late: number;
  /** % concluídos dentro do prazo (null se nenhum concluído). */
  onTimePercent: number | null;
  byCategory: TimeGroup[];
  byAssignee: TimeGroup[];
};

export type FirstResponseSummary = {
  mode: DurationMode;
  /** PRs que já tiveram primeira resposta (até o fim do período). */
  responded: number;
  /** PRs ainda sem nenhuma ação de técnico. */
  waiting: number;
  avgMinutes: number | null;
};

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Concluído dentro do prazo = concluído até o instante do prazo (inclusive). */
export function isOnTime(row: Pick<ConclusionRow, "concludedAt" | "dueAt">): boolean {
  return row.concludedAt.getTime() <= row.dueAt.getTime();
}

export function summarizeResolution(rows: ConclusionRow[], calc: DurationCalculator): ResolutionSummary {
  const durations = rows.map((r) => calc.minutesBetween(r.openedAt, r.concludedAt));
  const onTime = rows.filter(isOnTime).length;
  return {
    mode: calc.mode,
    count: rows.length,
    avgResolutionMinutes: average(durations),
    onTime,
    late: rows.length - onTime,
    onTimePercent: rows.length === 0 ? null : (onTime / rows.length) * 100,
    byCategory: groupTimes(rows, calc, (r) => ({ id: r.categoryId, name: r.categoryName })),
    byAssignee: groupTimes(rows, calc, (r) => ({ id: r.assigneeId, name: r.assigneeName ?? "Sem responsável" })),
  };
}

export function summarizeFirstResponse(rows: OpeningRow[], until: Date, calc: DurationCalculator): FirstResponseSummary {
  // Respostas posteriores ao fim do período ainda não "aconteceram" nele.
  const responded = rows.filter((r) => r.firstResponseAt !== null && r.firstResponseAt <= until);
  return {
    mode: calc.mode,
    responded: responded.length,
    waiting: rows.length - responded.length,
    avgMinutes: average(responded.map((r) => calc.minutesBetween(r.openedAt, r.firstResponseAt!))),
  };
}

function groupTimes(
  rows: ConclusionRow[],
  calc: DurationCalculator,
  keyOf: (row: ConclusionRow) => { id: number | null; name: string },
): TimeGroup[] {
  const groups = new Map<string, { id: number | null; name: string; minutes: number[]; onTime: number }>();
  for (const row of rows) {
    const { id, name } = keyOf(row);
    const key = String(id);
    const group = groups.get(key) ?? { id, name, minutes: [], onTime: 0 };
    group.minutes.push(calc.minutesBetween(row.openedAt, row.concludedAt));
    if (isOnTime(row)) group.onTime += 1;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({
      id: g.id,
      name: g.name,
      count: g.minutes.length,
      avgMinutes: average(g.minutes),
      onTime: g.onTime,
      late: g.minutes.length - g.onTime,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}
