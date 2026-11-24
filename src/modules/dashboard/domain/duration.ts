// Cálculo de duração entre dois instantes.
//
// "corrido": tempo de relógio (inclui noites, fins de semana e feriados).
// "util":    somente horário de expediente — RESERVADO para quando existir o
//            calendário de expediente. Todos os indicadores de tempo passam por
//            esta interface; implementar o tempo útil não exigirá mudar as telas.

export type DurationMode = "corrido" | "util";

export type DurationCalculator = {
  mode: DurationMode;
  /** Minutos entre os instantes (0 se o fim for anterior ao início). */
  minutesBetween(start: Date, end: Date): number;
};

export const elapsedTime: DurationCalculator = {
  mode: "corrido",
  minutesBetween(start, end) {
    return Math.max(0, (end.getTime() - start.getTime()) / 60_000);
  },
};

const CALCULATORS: Partial<Record<DurationMode, DurationCalculator>> = {
  corrido: elapsedTime,
};

export function getDurationCalculator(mode: DurationMode): DurationCalculator | null {
  return CALCULATORS[mode] ?? null;
}
