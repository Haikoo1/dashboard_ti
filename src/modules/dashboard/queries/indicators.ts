// 2.1 — Indicadores principais (cards).
import { Prisma } from "@/generated/prisma/client";
import { compare, type Comparison } from "../domain/comparison";
import type { DashboardRange, TimeWindow } from "../domain/period";
import { ACTIVE_STATUS_SQL, asOf, conclusionsCte, hasTicketsBefore, stateAtCte, type Db } from "./shared";

export type StatusSnapshot = {
  open: number;
  inProgress: number;
  pending: number;
  overdue: number;
};

export type IndicatorCards = {
  /** PRs registrados (abertos) durante o período. */
  registered: Comparison;
  /** Situação no fim do período, comparada com o fim do período anterior. */
  open: Comparison;
  inProgress: Comparison;
  pending: Comparison;
  overdue: Comparison;
  /** PRs concluídos durante o período. */
  concluded: Comparison;
  /** false = não há PRs anteriores ao período; comparações ficam vazias. */
  hasComparison: boolean;
};

export async function getIndicatorCards(db: Db, range: DashboardRange): Promise<IndicatorCards> {
  const [hasComparison, nowState, prevState, registered, prevRegistered, concluded, prevConcluded] = await Promise.all([
    hasTicketsBefore(db, range.current.start),
    getStatusSnapshot(db, asOf(range.current, range.now)),
    getStatusSnapshot(db, range.previous.end),
    countRegistered(db, range.current),
    countRegistered(db, range.previous),
    countConcluded(db, range.current),
    countConcluded(db, range.previous),
  ]);
  const prev = <T>(value: T) => (hasComparison ? value : null);

  return {
    registered: compare(registered, prev(prevRegistered)),
    open: compare(nowState.open, prev(prevState.open)),
    inProgress: compare(nowState.inProgress, prev(prevState.inProgress)),
    pending: compare(nowState.pending, prev(prevState.pending)),
    overdue: compare(nowState.overdue, prev(prevState.overdue)),
    concluded: compare(concluded, prev(prevConcluded)),
    hasComparison,
  };
}

/** Quantos PRs estavam em cada situação no instante informado. */
export async function getStatusSnapshot(db: Db, at: Date): Promise<StatusSnapshot> {
  const rows = await db.$queryRaw<StatusSnapshot[]>(Prisma.sql`
    WITH ${stateAtCte(at)}
    SELECT
      COUNT(*) FILTER (WHERE status = 'ABERTO')::int        AS "open",
      COUNT(*) FILTER (WHERE status = 'EM_ANDAMENTO')::int  AS "inProgress",
      COUNT(*) FILTER (WHERE status = 'PENDENTE')::int      AS "pending",
      COUNT(*) FILTER (WHERE status IN ${ACTIVE_STATUS_SQL} AND prazo_em < ${at}::timestamptz)::int AS "overdue"
    FROM estado_em`);
  return rows[0];
}

export async function countRegistered(db: Db, w: TimeWindow): Promise<number> {
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM prs
    WHERE aberto_em >= ${w.start}::timestamptz AND aberto_em < ${w.end}::timestamptz`;
  return rows[0].n;
}

export async function countConcluded(db: Db, w: TimeWindow): Promise<number> {
  const rows = await db.$queryRaw<{ n: number }[]>(Prisma.sql`
    WITH ${conclusionsCte(w.start, w.end)}
    SELECT COUNT(*)::int AS n FROM conclusoes`);
  return rows[0].n;
}
