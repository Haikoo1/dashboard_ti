// Montagem de cenários de teste no banco de TESTES.
// Cada PR é descrito pela sua sequência de eventos; os campos do PR
// (status, responsável, primeira resposta, encerramento) são derivados dela,
// exatamente como o futuro módulo de PRs deverá fazer.
import type { PrismaClient } from "@/generated/prisma/client";
import type { TicketStatus } from "@/generated/prisma/enums";
import { createPrismaClient } from "@/lib/db";
import { assertTestDatabaseUrl } from "../global-setup";

export function createTestDb(): PrismaClient {
  return createPrismaClient(assertTestDatabaseUrl());
}

export async function resetDatabase(db: PrismaClient) {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "pr_eventos", "pr_comentarios", "prs", "usuarios", "setores", "prioridades", "categorias" RESTART IDENTITY CASCADE',
  );
}

/** Data/hora de março/2026 no horário de Brasília (UTC−3). */
export function mar(day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 2, day, hour + 3, minute));
}

export type ScenarioEvent =
  | { at: Date; by: number; assign: number | null }
  | { at: Date; by: number; status: TicketStatus }
  | { at: Date; by: number; comment: string }
  | { at: Date; by: number; priority: number };

export type TicketSpec = {
  number: string;
  openedAt: Date;
  priorityId: number;
  resolutionSlaMinutes: number;
  categoryId: number;
  requesterId: number;
  sectorId: number;
  events: ScenarioEvent[];
};

export async function createTicket(db: PrismaClient, spec: TicketSpec) {
  let status: TicketStatus = "ABERTO";
  let assigneeId: number | null = null;
  let priorityId = spec.priorityId;
  let firstResponseAt: Date | null = null;
  let closedAt: Date | null = null;

  for (const e of spec.events) {
    if (firstResponseAt === null && e.by !== spec.requesterId) firstResponseAt = e.at;
    if ("assign" in e) assigneeId = e.assign;
    if ("priority" in e) priorityId = e.priority;
    if ("status" in e) {
      status = e.status;
      closedAt = status === "CONCLUIDO" || status === "CANCELADO" ? e.at : null;
    }
  }

  const ticket = await db.ticket.create({
    data: {
      number: spec.number,
      title: `Cenário ${spec.number}`,
      description: "Teste automatizado",
      status,
      priorityId,
      categoryId: spec.categoryId,
      requesterId: spec.requesterId,
      assigneeId,
      sectorId: spec.sectorId,
      openedAt: spec.openedAt,
      firstResponseAt,
      dueAt: new Date(spec.openedAt.getTime() + spec.resolutionSlaMinutes * 60_000),
      closedAt,
    },
  });

  await db.ticketEvent.create({
    data: { ticketId: ticket.id, actorId: spec.requesterId, type: "CRIADO", toStatus: "ABERTO", createdAt: spec.openedAt },
  });

  let currentStatus: TicketStatus = "ABERTO";
  let currentAssignee: number | null = null;
  let currentPriority = spec.priorityId;
  for (const e of spec.events) {
    const common = { ticketId: ticket.id, actorId: e.by, createdAt: e.at };
    if ("assign" in e) {
      await db.ticketEvent.create({
        data: { ...common, type: "ATRIBUIDO", fromAssigneeId: currentAssignee, toAssigneeId: e.assign },
      });
      currentAssignee = e.assign;
    } else if ("status" in e) {
      await db.ticketEvent.create({
        data: { ...common, type: "STATUS_ALTERADO", fromStatus: currentStatus, toStatus: e.status },
      });
      currentStatus = e.status;
    } else if ("priority" in e) {
      await db.ticketEvent.create({
        data: { ...common, type: "PRIORIDADE_ALTERADA", fromPriorityId: currentPriority, toPriorityId: e.priority },
      });
      currentPriority = e.priority;
    } else {
      const comment = await db.ticketComment.create({
        data: { ticketId: ticket.id, authorId: e.by, body: e.comment, createdAt: e.at },
      });
      await db.ticketEvent.create({ data: { ...common, type: "COMENTARIO", commentId: comment.id } });
    }
  }
  return ticket;
}
