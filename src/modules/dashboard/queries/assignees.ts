// 2.3 — Chamados por responsável.
import { Prisma } from "@/generated/prisma/client";
import type { AssigneeStats } from "../domain/assignees";
import type { DurationCalculator } from "../domain/duration";
import type { DashboardRange } from "../domain/period";
import { summarizeResolution } from "../domain/summaries";
import { getConclusionRows } from "./performance";
import { ACTIVE_STATUS_SQL, asOf, stateAtCte, type Db } from "./shared";

export type AssigneeReport = {
  assignees: AssigneeStats[];
  /** PRs em atendimento sem responsável, no fim do período. */
  unassigned: { open: number; overdue: number };
};

type WorkloadRow = { userId: number | null; open: number; inProgress: number; pending: number; overdue: number };

export async function getAssigneeReport(db: Db, range: DashboardRange, calc: DurationCalculator): Promise<AssigneeReport> {
  const until = asOf(range.current, range.now);
  const { start, end } = range.current;

  const [technicians, assignedRows, workloadRows, conclusionRows] = await Promise.all([
    db.user.findMany({ where: { role: "TECNICO", active: true }, select: { id: true, name: true } }),
    db.$queryRaw<{ userId: number; assigned: number }[]>`
      SELECT responsavel_novo_id AS "userId", COUNT(DISTINCT pr_id)::int AS assigned
      FROM pr_eventos
      WHERE tipo = 'ATRIBUIDO' AND responsavel_novo_id IS NOT NULL
        AND criado_em >= ${start}::timestamptz AND criado_em < ${end}::timestamptz
      GROUP BY responsavel_novo_id`,
    db.$queryRaw<WorkloadRow[]>(Prisma.sql`
      WITH ${stateAtCte(until)}
      SELECT
        responsavel_id AS "userId",
        COUNT(*) FILTER (WHERE status = 'ABERTO')::int       AS "open",
        COUNT(*) FILTER (WHERE status = 'EM_ANDAMENTO')::int AS "inProgress",
        COUNT(*) FILTER (WHERE status = 'PENDENTE')::int     AS "pending",
        COUNT(*) FILTER (WHERE prazo_em < ${until}::timestamptz)::int AS "overdue"
      FROM estado_em
      WHERE status IN ${ACTIVE_STATUS_SQL}
      GROUP BY responsavel_id`),
    getConclusionRows(db, range.current),
  ]);

  const byAssignee = new Map(
    summarizeResolution(conclusionRows, calc).byAssignee.map((g) => [g.id, g] as const),
  );
  const assigned = new Map(assignedRows.map((r) => [r.userId, r.assigned]));
  const workload = new Map(workloadRows.map((r) => [r.userId, r]));

  // Técnicos ativos + qualquer outro usuário que tenha aparecido como responsável.
  const people = new Map(technicians.map((t) => [t.id, t.name]));
  const extraIds = [...assigned.keys(), ...workload.keys(), ...byAssignee.keys()].filter(
    (id): id is number => id !== null && !people.has(id),
  );
  if (extraIds.length > 0) {
    const extras = await db.user.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true } });
    for (const u of extras) people.set(u.id, u.name);
  }

  const assignees: AssigneeStats[] = [...people].map(([userId, name]) => {
    const w = workload.get(userId);
    const g = byAssignee.get(userId);
    return {
      userId,
      name,
      assigned: assigned.get(userId) ?? 0,
      open: w?.open ?? 0,
      inProgress: w?.inProgress ?? 0,
      pending: w?.pending ?? 0,
      overdue: w?.overdue ?? 0,
      concluded: g?.count ?? 0,
      avgResolutionMinutes: g?.avgMinutes ?? null,
      onTimePercent: g && g.count > 0 ? (g.onTime / g.count) * 100 : null,
    };
  });

  const none = workload.get(null);
  return {
    assignees,
    unassigned: { open: none ? none.open + none.inProgress + none.pending : 0, overdue: none?.overdue ?? 0 },
  };
}
