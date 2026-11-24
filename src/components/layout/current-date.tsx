import { connection } from "next/server";
import { APP_TIME_ZONE } from "@/lib/time-zone";

/**
 * Data de hoje no horário de Brasília, calculada a cada acesso.
 * `connection()` informa ao Next.js que este valor depende do momento da
 * requisição (sem isso, a data ficaria congelada no dia da compilação).
 */
export async function CurrentDate() {
  await connection();
  const now = new Date();
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return <time dateTime={now.toISOString()}>{label}</time>;
}

export function CurrentDateFallback() {
  return <span className="inline-block h-3 w-40 animate-pulse rounded bg-surface-3 align-middle" />;
}
