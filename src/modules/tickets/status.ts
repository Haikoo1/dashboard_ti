// Regras de status de PR compartilhadas por todos os módulos
// (Dashboard agora; Gerenciamento de PRs e Histórico no futuro).
import { TicketStatus } from "@/generated/prisma/enums";

export { TicketStatus };

export const STATUS_LABEL: Record<TicketStatus, string> = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em andamento",
  PENDENTE: "Pendente",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

/** Status em que o PR ainda exige trabalho (podem ficar atrasados). */
export const ACTIVE_STATUSES = [TicketStatus.ABERTO, TicketStatus.EM_ANDAMENTO, TicketStatus.PENDENTE] as const;

/** Status de encerramento. */
export const CLOSED_STATUSES = [TicketStatus.CONCLUIDO, TicketStatus.CANCELADO] as const;

export function isActiveStatus(status: TicketStatus): boolean {
  return (ACTIVE_STATUSES as readonly TicketStatus[]).includes(status);
}
