// 2.4 — Chamados por setor.
import { compare, type Comparison } from "../domain/comparison";
import type { DashboardRange } from "../domain/period";
import { hasTicketsBefore, type Db } from "./shared";

export type SectorShare = {
  sectorId: number;
  name: string;
  count: Comparison;
  /** Participação no total do período (0–100). */
  percent: number;
};

export type SectorReport = {
  total: number;
  /** Ordenado do maior para o menor volume. */
  sectors: SectorShare[];
  hasComparison: boolean;
};

export async function getSectorReport(db: Db, range: DashboardRange): Promise<SectorReport> {
  const { current: c, previous: p } = range;
  const [hasComparison, rows] = await Promise.all([
    hasTicketsBefore(db, c.start),
    db.$queryRaw<{ sectorId: number; name: string; current: number; previous: number }[]>`
      SELECT
        s.id   AS "sectorId",
        s.nome AS "name",
        COUNT(*) FILTER (WHERE t.aberto_em >= ${c.start}::timestamptz AND t.aberto_em < ${c.end}::timestamptz)::int AS "current",
        COUNT(*) FILTER (WHERE t.aberto_em >= ${p.start}::timestamptz AND t.aberto_em < ${p.end}::timestamptz)::int AS "previous"
      FROM prs t
      JOIN setores s ON s.id = t.setor_id
      WHERE (t.aberto_em >= ${c.start}::timestamptz AND t.aberto_em < ${c.end}::timestamptz)
         OR (t.aberto_em >= ${p.start}::timestamptz AND t.aberto_em < ${p.end}::timestamptz)
      GROUP BY s.id, s.nome`,
  ]);

  const total = rows.reduce((sum, r) => sum + r.current, 0);
  const sectors = rows
    .map((r) => ({
      sectorId: r.sectorId,
      name: r.name,
      count: compare(r.current, hasComparison ? r.previous : null),
      percent: total === 0 ? 0 : (r.current / total) * 100,
    }))
    .sort((a, b) => b.count.current - a.count.current || a.name.localeCompare(b.name, "pt-BR"));

  return { total, sectors, hasComparison };
}
