// 2.6 — Alertas de PRs atrasados.
// Sempre reflete a situação ATUAL (não depende do filtro de período).
import type { TicketStatus } from "@/generated/prisma/enums";
import type { Db } from "./shared";

/** Nível da prioridade considerada crítica (destaque visual). */
export const CRITICAL_PRIORITY_LEVEL = 1;

export type OverdueAlert = {
  ticketId: number;
  number: string;
  title: string;
  status: TicketStatus;
  requesterName: string;
  assigneeName: string | null;
  priority: { name: string; level: number; color: string };
  openedAt: Date;
  dueAt: Date;
  overdueMinutes: number;
  critical: boolean;
};

export type OverdueAlerts = { total: number; critical: number; items: OverdueAlert[] };

type Row = Omit<OverdueAlert, "priority" | "overdueMinutes" | "critical"> & {
  priorityName: string;
  priorityLevel: number;
  priorityColor: string;
  total: number;
  criticalTotal: number;
};

export async function getOverdueAlerts(db: Db, now: Date, limit = 10): Promise<OverdueAlerts> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT
      p.id          AS "ticketId",
      p.numero      AS "number",
      p.titulo      AS "title",
      p.status      AS "status",
      sol.nome      AS "requesterName",
      resp.nome     AS "assigneeName",
      pr.nome       AS "priorityName",
      pr.nivel      AS "priorityLevel",
      pr.cor        AS "priorityColor",
      p.aberto_em   AS "openedAt",
      p.prazo_em    AS "dueAt",
      COUNT(*) OVER ()::int AS "total",
      (COUNT(*) FILTER (WHERE pr.nivel = ${CRITICAL_PRIORITY_LEVEL}) OVER ())::int AS "criticalTotal"
    FROM prs p
    JOIN usuarios sol ON sol.id = p.solicitante_id
    LEFT JOIN usuarios resp ON resp.id = p.responsavel_id
    JOIN prioridades pr ON pr.id = p.prioridade_id
    WHERE p.status IN ('ABERTO', 'EM_ANDAMENTO', 'PENDENTE') AND p.prazo_em < ${now}::timestamptz
    ORDER BY pr.nivel ASC, p.prazo_em ASC
    LIMIT ${limit}`;

  return {
    total: rows[0]?.total ?? 0,
    critical: rows[0]?.criticalTotal ?? 0,
    items: rows.map((r) => ({
      ticketId: r.ticketId,
      number: r.number,
      title: r.title,
      status: r.status,
      requesterName: r.requesterName,
      assigneeName: r.assigneeName,
      priority: { name: r.priorityName, level: r.priorityLevel, color: r.priorityColor },
      openedAt: r.openedAt,
      dueAt: r.dueAt,
      overdueMinutes: Math.floor((now.getTime() - r.dueAt.getTime()) / 60_000),
      critical: r.priorityLevel === CRITICAL_PRIORITY_LEVEL,
    })),
  };
}
