// 2.2 — Indicadores de desempenho e 2.5 — Tempos de atendimento e resolução.
import { Prisma } from "@/generated/prisma/client";
import { compare, type Comparison } from "../domain/comparison";
import type { DurationCalculator } from "../domain/duration";
import type { DashboardRange, TimeWindow } from "../domain/period";
import {
  summarizeFirstResponse,
  summarizeResolution,
  type ConclusionRow,
  type FirstResponseSummary,
  type OpeningRow,
  type ResolutionSummary,
} from "../domain/summaries";
import { asOf, conclusionsCte, hasTicketsBefore, stateAtCte, type Db } from "./shared";

export type Performance = {
  firstResponse: FirstResponseSummary & { previousAvgMinutes: number | null };
  resolution: ResolutionSummary & { previousAvgMinutes: number | null };
  /** PRs concluídos no período, comparados com o anterior. */
  concluded: Comparison;
  /**
   * Dos PRs abertos no período (exceto cancelados), quantos estão concluídos
   * no fim do período.
   */
  completion: { concluded: number; considered: number; percent: number | null };
  hasComparison: boolean;
};

export async function getPerformance(db: Db, range: DashboardRange, calc: DurationCalculator): Promise<Performance> {
  const until = asOf(range.current, range.now);
  const [hasComparison, rows, prevRows, openings, prevOpenings, completion] = await Promise.all([
    hasTicketsBefore(db, range.current.start),
    getConclusionRows(db, range.current),
    getConclusionRows(db, range.previous),
    getOpeningRows(db, range.current),
    getOpeningRows(db, range.previous),
    getCompletion(db, range.current, until),
  ]);

  const resolution = summarizeResolution(rows, calc);
  const prevResolution = summarizeResolution(prevRows, calc);
  const firstResponse = summarizeFirstResponse(openings, until, calc);
  const prevFirstResponse = summarizeFirstResponse(prevOpenings, range.previous.end, calc);

  return {
    firstResponse: { ...firstResponse, previousAvgMinutes: hasComparison ? prevFirstResponse.avgMinutes : null },
    resolution: { ...resolution, previousAvgMinutes: hasComparison ? prevResolution.avgResolutionMinutes : null },
    concluded: compare(resolution.count, hasComparison ? prevResolution.count : null),
    completion,
    hasComparison,
  };
}

/** Tempos de resolução por categoria e por responsável (2.5). */
export async function getResolutionTimes(db: Db, range: DashboardRange, calc: DurationCalculator) {
  const rows = await getConclusionRows(db, range.current);
  return summarizeResolution(rows, calc);
}

/** PRs concluídos na janela, com o responsável no momento da conclusão. */
export async function getConclusionRows(db: Db, w: TimeWindow): Promise<ConclusionRow[]> {
  return db.$queryRaw<ConclusionRow[]>(Prisma.sql`
    WITH ${conclusionsCte(w.start, w.end)}
    SELECT
      p.id                    AS "ticketId",
      p.aberto_em             AS "openedAt",
      p.primeira_resposta_em  AS "firstResponseAt",
      c.concluido_em          AS "concludedAt",
      p.prazo_em              AS "dueAt",
      cat.id                  AS "categoryId",
      cat.nome                AS "categoryName",
      r.id                    AS "assigneeId",
      r.nome                  AS "assigneeName"
    FROM conclusoes c
    JOIN prs p ON p.id = c.pr_id
    JOIN categorias cat ON cat.id = p.categoria_id
    LEFT JOIN LATERAL (
      SELECT e.responsavel_novo_id FROM pr_eventos e
      WHERE e.pr_id = p.id AND e.tipo = 'ATRIBUIDO' AND e.criado_em <= c.concluido_em
      ORDER BY e.criado_em DESC, e.id DESC LIMIT 1
    ) a ON TRUE
    LEFT JOIN usuarios r ON r.id = a.responsavel_novo_id
    ORDER BY c.concluido_em`);
}

/** PRs abertos na janela (para o tempo de primeira resposta). */
export async function getOpeningRows(db: Db, w: TimeWindow): Promise<OpeningRow[]> {
  return db.$queryRaw<OpeningRow[]>`
    SELECT aberto_em AS "openedAt", primeira_resposta_em AS "firstResponseAt"
    FROM prs
    WHERE aberto_em >= ${w.start}::timestamptz AND aberto_em < ${w.end}::timestamptz`;
}

async function getCompletion(db: Db, w: TimeWindow, until: Date): Promise<Performance["completion"]> {
  const rows = await db.$queryRaw<{ concluded: number; considered: number }[]>(Prisma.sql`
    WITH ${stateAtCte(until)}
    SELECT
      COUNT(*) FILTER (WHERE s.status = 'CONCLUIDO')::int AS concluded,
      COUNT(*) FILTER (WHERE s.status <> 'CANCELADO')::int AS considered
    FROM estado_em s
    JOIN prs p ON p.id = s.id
    WHERE p.aberto_em >= ${w.start}::timestamptz AND p.aberto_em < ${w.end}::timestamptz`);
  const { concluded, considered } = rows[0];
  return { concluded, considered, percent: considered === 0 ? null : (concluded / considered) * 100 };
}
