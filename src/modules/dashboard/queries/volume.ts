// 2.8 — Volume de PRs (abertos x concluídos) por dia, semana ou mês.
import { Prisma } from "@/generated/prisma/client";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import type { Granularity, TimeWindow } from "../domain/period";
import { conclusionsCte, type Db } from "./shared";

export type VolumePoint = {
  /** Início do intervalo no calendário local (AAAA-MM-DD). Semanas começam na segunda-feira. */
  bucket: string;
  opened: number;
  concluded: number;
};

// Valores fixos (nunca texto vindo do usuário) para montar o SQL.
const TRUNC_UNIT: Record<Granularity, Prisma.Sql> = {
  dia: Prisma.raw("'day'"),
  semana: Prisma.raw("'week'"),
  mes: Prisma.raw("'month'"),
};
const STEP: Record<Granularity, Prisma.Sql> = {
  dia: Prisma.raw("INTERVAL '1 day'"),
  semana: Prisma.raw("INTERVAL '1 week'"),
  mes: Prisma.raw("INTERVAL '1 month'"),
};

/**
 * Série contínua (intervalos sem PRs aparecem com zero) dentro da janela.
 * O primeiro e o último intervalo podem estar incompletos (ex.: semana que
 * começou antes do período); as contagens consideram só o que está na janela.
 */
export async function getVolumeSeries(db: Db, w: TimeWindow, granularity: Granularity): Promise<VolumePoint[]> {
  const unit = TRUNC_UNIT[granularity];
  const tz = Prisma.sql`${APP_TIME_ZONE}::text`;
  return db.$queryRaw<VolumePoint[]>(Prisma.sql`
    WITH ${conclusionsCte(w.start, w.end)},
    intervalos AS (
      SELECT generate_series(
        date_trunc(${unit}, ${w.start}::timestamptz AT TIME ZONE ${tz}),
        date_trunc(${unit}, (${w.end}::timestamptz - INTERVAL '1 millisecond') AT TIME ZONE ${tz}),
        ${STEP[granularity]}
      ) AS inicio
    ),
    abertos AS (
      SELECT date_trunc(${unit}, aberto_em AT TIME ZONE ${tz}) AS inicio, COUNT(*)::int AS n
      FROM prs
      WHERE aberto_em >= ${w.start}::timestamptz AND aberto_em < ${w.end}::timestamptz
      GROUP BY 1
    ),
    concluidos AS (
      SELECT date_trunc(${unit}, concluido_em AT TIME ZONE ${tz}) AS inicio, COUNT(*)::int AS n
      FROM conclusoes
      GROUP BY 1
    )
    SELECT
      to_char(i.inicio, 'YYYY-MM-DD') AS "bucket",
      COALESCE(a.n, 0)::int AS "opened",
      COALESCE(c.n, 0)::int AS "concluded"
    FROM intervalos i
    LEFT JOIN abertos a ON a.inicio = i.inicio
    LEFT JOIN concluidos c ON c.inicio = i.inicio
    ORDER BY i.inicio`);
}
