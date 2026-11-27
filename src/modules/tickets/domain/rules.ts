// Regras de negócio do ciclo de vida de um PR (funções puras, sem banco).
import type { TicketStatus, UserRole } from "@/generated/prisma/enums";
import { zonedDateParts } from "@/lib/time-zone";

// ---------------------------------------------------------------------------
// Número do PR: PR-AAAA-NNNN, sequência reiniciada a cada ano (horário de Brasília)
// ---------------------------------------------------------------------------

export function ticketNumberYear(openedAt: Date): number {
  return zonedDateParts(openedAt).year;
}

export function formatTicketNumber(year: number, sequence: number): string {
  return `PR-${year}-${String(sequence).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Erros de regra de negócio (mensagens prontas para exibir ao usuário)
// ---------------------------------------------------------------------------

export type TicketErrorCode =
  | "NAO_ENCONTRADO"
  | "USUARIO_INVALIDO"
  | "SEM_PERMISSAO"
  | "DADOS_INVALIDOS"
  | "TRANSICAO_INVALIDA"
  | "PR_ENCERRADO"
  | "CONFLITO"
  | "SEM_ALTERACAO";

export class TicketError extends Error {
  constructor(
    readonly code: TicketErrorCode,
    message: string,
    /** Campo do formulário relacionado ao erro, quando houver. */
    readonly field?: string,
  ) {
    super(message);
    this.name = "TicketError";
  }
}

// ---------------------------------------------------------------------------
// Papéis e permissões (sem autenticação: identifica quem fez, não protege)
// ---------------------------------------------------------------------------

/** Técnicos e administradores atendem PRs; solicitantes abrem e comentam. */
export function isStaff(role: UserRole): boolean {
  return role === "TECNICO" || role === "ADMIN";
}

/** Só técnicos e administradores ativos podem ser responsáveis. */
export function canBeAssignee(user: { role: UserRole; active: boolean }): boolean {
  return user.active && isStaff(user.role);
}

// ---------------------------------------------------------------------------
// Transições de status
// ---------------------------------------------------------------------------

/** Mudanças de status permitidas pelo fluxo normal (a reabertura tem operação própria). */
const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  ABERTO: ["EM_ANDAMENTO", "PENDENTE", "CONCLUIDO", "CANCELADO"],
  EM_ANDAMENTO: ["PENDENTE", "CONCLUIDO", "CANCELADO"],
  PENDENTE: ["EM_ANDAMENTO", "CONCLUIDO", "CANCELADO"],
  CONCLUIDO: [],
  CANCELADO: [],
};

export function allowedTransitions(from: TicketStatus): readonly TicketStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Status de destino que exigem texto explicativo (motivo, solução, justificativa). */
export function requiresDetail(to: TicketStatus): boolean {
  return to === "PENDENTE" || to === "CONCLUIDO" || to === "CANCELADO";
}

/** Iniciar o atendimento e concluir exigem um responsável. */
export function requiresAssignee(to: TicketStatus): boolean {
  return to === "EM_ANDAMENTO" || to === "CONCLUIDO";
}

export function isClosed(status: TicketStatus): boolean {
  return status === "CONCLUIDO" || status === "CANCELADO";
}

// ---------------------------------------------------------------------------
// Reabertura: só PRs concluídos, até 30 dias após a conclusão
// ---------------------------------------------------------------------------

export const REOPEN_WINDOW_DAYS = 30;

export function canReopen(ticket: { status: TicketStatus; closedAt: Date | null }, now: Date): boolean {
  if (ticket.status !== "CONCLUIDO" || !ticket.closedAt) return false;
  return now.getTime() - ticket.closedAt.getTime() <= REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Primeira resposta
// ---------------------------------------------------------------------------

/**
 * Uma ação conta como primeira resposta se o PR ainda não tiver uma e se quem
 * agiu não for o solicitante. A abertura em si (evento CRIADO) nunca conta,
 * mesmo quando um técnico registra o PR em nome do solicitante.
 */
export function isFirstResponse(ticket: { firstResponseAt: Date | null; requesterId: number }, actorId: number): boolean {
  return ticket.firstResponseAt === null && actorId !== ticket.requesterId;
}

// ---------------------------------------------------------------------------
// Limites dos campos
// ---------------------------------------------------------------------------

export const LIMITS = {
  titleMin: 5,
  titleMax: 200,
  descriptionMin: 10,
  descriptionMax: 10_000,
  commentMax: 5_000,
  detailMax: 5_000,
} as const;
