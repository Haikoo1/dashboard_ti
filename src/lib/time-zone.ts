// Datas no fuso horário do sistema.
// O banco grava em UTC; "início do dia", "semana" e "mês" seguem o horário de
// Brasília. Os cálculos usam a base de fusos do próprio Node (Intl), então
// eventuais mudanças futuras de horário de verão são tratadas automaticamente.

export const APP_TIME_ZONE = "America/Sao_Paulo";

const DAY_MS = 24 * 60 * 60 * 1000;

type DateParts = { year: number; month: number; day: number };

/** Ano, mês (1–12) e dia do instante informado, no fuso indicado. */
export function zonedDateParts(instant: Date, timeZone = APP_TIME_ZONE): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Diferença (ms) entre o horário local do fuso e UTC, no instante informado. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instante (UTC) da meia-noite local de uma data do calendário. */
export function zonedMidnight({ year, month, day }: DateParts, timeZone = APP_TIME_ZONE): Date {
  const guess = Date.UTC(year, month - 1, day);
  // Duas iterações cobrem o caso de a meia-noite cair perto de uma troca de fuso.
  let result = guess - zoneOffsetMs(new Date(guess), timeZone);
  result = guess - zoneOffsetMs(new Date(result), timeZone);
  return new Date(result);
}

/** Início do dia (local) que contém o instante. */
export function startOfZonedDay(instant: Date, timeZone = APP_TIME_ZONE): Date {
  return zonedMidnight(zonedDateParts(instant, timeZone), timeZone);
}

/** Soma dias de calendário (local), preservando "meia-noite" mesmo com troca de fuso. */
export function addZonedDays(midnight: Date, days: number, timeZone = APP_TIME_ZONE): Date {
  const { year, month, day } = zonedDateParts(new Date(midnight.getTime() + 12 * 60 * 60 * 1000), timeZone);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return zonedMidnight(
    { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() },
    timeZone,
  );
}

/** Converte "AAAA-MM-DD" em partes de data, validando se o dia existe. */
export function parseIsoDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}
