// Prazos (SLA) de um PR: cálculo na abertura, recálculo quando a prioridade
// muda e situação atual (no prazo, próximo do vencimento, atrasado).
//
// Os prazos são em tempo corrido, como no Dashboard. Quando existir o
// calendário de expediente, o cálculo de prazo passará a usar o tempo útil
// a partir deste módulo, sem mudar as telas.
import { isActiveStatus, type TicketStatus } from "../status";

const MINUTE = 60_000;

export type SlaPolicy = { responseSlaMinutes: number; resolutionSlaMinutes: number; level: number };

export type Deadlines = { responseDueAt: Date; dueAt: Date };

/** Prazos na abertura: abertura + SLA de resposta / de resolução da prioridade. */
export function deadlinesAtOpening(openedAt: Date, priority: SlaPolicy): Deadlines {
  return {
    responseDueAt: new Date(openedAt.getTime() + priority.responseSlaMinutes * MINUTE),
    dueAt: new Date(openedAt.getTime() + priority.resolutionSlaMinutes * MINUTE),
  };
}

/**
 * Novos prazos quando a prioridade muda (política "híbrida", aprovada na Etapa 02):
 * - Mais urgente: o MENOR entre o prazo atual e "agora + novo SLA" (nunca estende).
 * - Menos urgente: "abertura + novo SLA", como se o PR tivesse sido classificado
 *   assim desde o início (o tempo já gasto continua contando).
 * Nível menor = mais urgente (1 = Crítica).
 */
export function deadlinesOnPriorityChange(
  ticket: { openedAt: Date } & Deadlines,
  from: SlaPolicy,
  to: SlaPolicy,
  at: Date,
): Deadlines {
  if (to.level < from.level) {
    const fresh = deadlinesAtOpening(at, to);
    return {
      responseDueAt: minDate(ticket.responseDueAt, fresh.responseDueAt),
      dueAt: minDate(ticket.dueAt, fresh.dueAt),
    };
  }
  return deadlinesAtOpening(ticket.openedAt, to);
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

// ---------------------------------------------------------------------------
// Situação do prazo
// ---------------------------------------------------------------------------

/** Fração do prazo total a partir da qual o PR é considerado "próximo do vencimento". */
export const NEAR_DUE_FRACTION = 0.25;

/** Atrasado = em atendimento e com o prazo vencido. Mesma regra das consultas do Dashboard. */
export function isOverdue(status: TicketStatus, dueAt: Date, now: Date): boolean {
  return isActiveStatus(status) && dueAt.getTime() < now.getTime();
}

export type SlaState =
  | { kind: "no_prazo"; remainingMinutes: number }
  | { kind: "proximo"; remainingMinutes: number }
  | { kind: "atrasado"; overdueMinutes: number }
  | { kind: "concluido_no_prazo" }
  | { kind: "concluido_com_atraso"; overdueMinutes: number }
  | { kind: "cancelado" };

/** Situação do prazo de resolução no instante informado. */
export function resolutionSlaState(
  ticket: { status: TicketStatus; openedAt: Date; dueAt: Date; closedAt: Date | null },
  now: Date,
): SlaState {
  if (ticket.status === "CANCELADO") return { kind: "cancelado" };
  if (ticket.status === "CONCLUIDO") {
    const late = minutesBetween(ticket.dueAt, ticket.closedAt ?? now);
    return late > 0 ? { kind: "concluido_com_atraso", overdueMinutes: late } : { kind: "concluido_no_prazo" };
  }
  const remaining = minutesBetween(now, ticket.dueAt);
  if (remaining < 0) return { kind: "atrasado", overdueMinutes: -remaining };
  const total = minutesBetween(ticket.openedAt, ticket.dueAt);
  return remaining <= total * NEAR_DUE_FRACTION
    ? { kind: "proximo", remainingMinutes: remaining }
    : { kind: "no_prazo", remainingMinutes: remaining };
}

/** Situação do prazo de primeira resposta. */
export type ResponseSlaState =
  | { kind: "respondido_no_prazo"; minutes: number }
  | { kind: "respondido_com_atraso"; minutes: number; overdueMinutes: number }
  | { kind: "aguardando"; remainingMinutes: number }
  | { kind: "vencido"; overdueMinutes: number };

export function responseSlaState(
  ticket: { openedAt: Date; responseDueAt: Date; firstResponseAt: Date | null },
  now: Date,
): ResponseSlaState {
  if (ticket.firstResponseAt) {
    const minutes = minutesBetween(ticket.openedAt, ticket.firstResponseAt);
    const late = minutesBetween(ticket.responseDueAt, ticket.firstResponseAt);
    return late > 0
      ? { kind: "respondido_com_atraso", minutes, overdueMinutes: late }
      : { kind: "respondido_no_prazo", minutes };
  }
  const remaining = minutesBetween(now, ticket.responseDueAt);
  return remaining < 0 ? { kind: "vencido", overdueMinutes: -remaining } : { kind: "aguardando", remainingMinutes: remaining };
}

/** Minutos de "a" até "b" (negativo se "b" for antes de "a"). */
function minutesBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MINUTE);
}
