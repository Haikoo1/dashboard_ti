// Descrição em português das atividades recentes (eventos dos PRs).
import { TicketEventType, type TicketStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL, isActiveStatus } from "@/modules/tickets/status";

export type ActivityKind =
  | "aberto"
  | "atribuido"
  | "responsavel_removido"
  | "prioridade"
  | "status"
  | "concluido"
  | "cancelado"
  | "reaberto"
  | "comentario"
  | "editado";

/** Evento com os nomes já resolvidos pelo banco. */
export type ActivityEvent = {
  id: number;
  type: TicketEventType;
  createdAt: Date;
  ticketId: number;
  ticketNumber: string;
  actorId: number;
  actorName: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  fromPriorityName: string | null;
  toPriorityName: string | null;
  fromAssigneeName: string | null;
  toAssigneeId: number | null;
  toAssigneeName: string | null;
  commentExcerpt: string | null;
};

export type Activity = {
  id: number;
  kind: ActivityKind;
  createdAt: Date;
  ticketNumber: string;
  actorName: string;
  /** Ação, sem o nome de quem fez. Ex.: "concluiu o PR-2026-0012". */
  action: string;
  /** Trecho do comentário, quando houver. */
  excerpt: string | null;
};

export function describeActivity(e: ActivityEvent): Activity {
  const pr = e.ticketNumber;
  const base = { id: e.id, createdAt: e.createdAt, ticketNumber: pr, actorName: e.actorName, excerpt: null };

  switch (e.type) {
    case TicketEventType.CRIADO:
      return { ...base, kind: "aberto", action: `abriu o ${pr}` };

    case TicketEventType.ATRIBUIDO:
      if (e.toAssigneeId === null) {
        return { ...base, kind: "responsavel_removido", action: `removeu o responsável do ${pr}` };
      }
      if (e.toAssigneeId === e.actorId) {
        return { ...base, kind: "atribuido", action: `assumiu o ${pr}` };
      }
      return { ...base, kind: "atribuido", action: `atribuiu o ${pr} a ${e.toAssigneeName ?? "outro técnico"}` };

    case TicketEventType.PRIORIDADE_ALTERADA:
      return {
        ...base,
        kind: "prioridade",
        action: `alterou a prioridade do ${pr} de ${e.fromPriorityName ?? "—"} para ${e.toPriorityName ?? "—"}`,
      };

    case TicketEventType.STATUS_ALTERADO: {
      const to = e.toStatus!;
      if (to === "CONCLUIDO") return { ...base, kind: "concluido", action: `concluiu o ${pr}` };
      if (to === "CANCELADO") return { ...base, kind: "cancelado", action: `cancelou o ${pr}` };
      if (e.fromStatus && !isActiveStatus(e.fromStatus)) {
        return { ...base, kind: "reaberto", action: `reabriu o ${pr}` };
      }
      const from = e.fromStatus ? STATUS_LABEL[e.fromStatus] : "—";
      return { ...base, kind: "status", action: `alterou o status do ${pr} de ${from} para ${STATUS_LABEL[to]}` };
    }

    case TicketEventType.COMENTARIO:
      return { ...base, kind: "comentario", action: `comentou no ${pr}`, excerpt: e.commentExcerpt };

    case TicketEventType.DADOS_ALTERADOS:
      return { ...base, kind: "editado", action: `editou as informações do ${pr}` };
  }
}
