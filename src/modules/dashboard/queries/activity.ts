// 2.7 — Atividades recentes.
import { describeActivity, type Activity, type ActivityEvent } from "../domain/activity";
import type { Db } from "./shared";

export async function getRecentActivity(db: Db, limit = 15): Promise<Activity[]> {
  const rows = await db.$queryRaw<ActivityEvent[]>`
    SELECT
      e.id                   AS "id",
      e.tipo                 AS "type",
      e.criado_em            AS "createdAt",
      p.id                   AS "ticketId",
      p.numero               AS "ticketNumber",
      a.id                   AS "actorId",
      a.nome                 AS "actorName",
      e.status_anterior      AS "fromStatus",
      e.status_novo          AS "toStatus",
      pa.nome                AS "fromPriorityName",
      pn.nome                AS "toPriorityName",
      ra.nome                AS "fromAssigneeName",
      e.responsavel_novo_id  AS "toAssigneeId",
      rn.nome                AS "toAssigneeName",
      LEFT(c.texto, 160)     AS "commentExcerpt"
    FROM pr_eventos e
    JOIN prs p ON p.id = e.pr_id
    JOIN usuarios a ON a.id = e.usuario_id
    LEFT JOIN prioridades pa ON pa.id = e.prioridade_anterior_id
    LEFT JOIN prioridades pn ON pn.id = e.prioridade_nova_id
    LEFT JOIN usuarios ra ON ra.id = e.responsavel_anterior_id
    LEFT JOIN usuarios rn ON rn.id = e.responsavel_novo_id
    LEFT JOIN pr_comentarios c ON c.id = e.comentario_id
    ORDER BY e.criado_em DESC, e.id DESC
    LIMIT ${limit}`;
  return rows.map(describeActivity);
}
