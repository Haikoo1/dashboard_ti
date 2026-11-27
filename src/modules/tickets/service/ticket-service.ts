// Operações sobre PRs. É o ÚNICO ponto do sistema que grava em
// prs, pr_eventos e pr_comentarios.
//
// Garantias de cada operação:
// - valida os dados (zod) e as regras de negócio antes de gravar;
// - executa tudo numa única transação: a alteração do PR e o evento do
//   histórico são gravados juntos, ou nada é gravado;
// - trava o PR durante a operação (SELECT ... FOR UPDATE) e, quando informado,
//   confere se ele não foi alterado por outra pessoa desde que a tela foi aberta;
// - registra a primeira resposta quando a ação vier de alguém que não é o solicitante.
//
// "now" é opcional e existe para os testes; nas telas, vale o horário atual.
import type { Prisma, PrismaClient, Ticket, User } from "@/generated/prisma/client";
import type { TicketStatus } from "@/generated/prisma/enums";
import type { z } from "zod";
import { STATUS_LABEL } from "../status";
import {
  canBeAssignee,
  canReopen,
  canTransition,
  formatTicketNumber,
  isClosed,
  isFirstResponse,
  isStaff,
  REOPEN_WINDOW_DAYS,
  requiresAssignee,
  requiresDetail,
  TicketError,
  ticketNumberYear,
} from "../domain/rules";
import {
  commentSchema,
  createTicketSchema,
  detailSchema,
  editTicketSchema,
  notesSchema,
  type CreateTicketInput,
  type EditTicketInput,
} from "../domain/schemas";
import { deadlinesAtOpening, deadlinesOnPriorityChange } from "../domain/sla";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;
type Options = { now?: Date };

/** Versão do PR que a tela tinha ao enviar a alteração (proteção contra edição simultânea). */
type Expected = { expectedUpdatedAt?: Date };

// ---------------------------------------------------------------------------
// Abertura
// ---------------------------------------------------------------------------

export async function createTicket(db: Db, actorId: number, input: CreateTicketInput, opts: Options = {}): Promise<Ticket> {
  const data = parse(createTicketSchema, input);
  const now = opts.now ?? new Date();

  return db.$transaction(async (tx) => {
    const actor = await loadActor(tx, actorId);
    const requester = await tx.user.findUnique({ where: { id: data.requesterId } });
    if (!requester?.active) throw new TicketError("DADOS_INVALIDOS", "Solicitante não encontrado ou inativo.", "requesterId");
    if (requester.sectorId === null) {
      throw new TicketError("DADOS_INVALIDOS", "O solicitante não tem setor cadastrado. Atualize o cadastro dele antes.", "requesterId");
    }
    if (!isStaff(actor.role)) {
      if (actor.id !== requester.id) throw new TicketError("SEM_PERMISSAO", "Solicitantes só podem abrir PRs em seu próprio nome.");
      if (data.assigneeId) throw new TicketError("SEM_PERMISSAO", "Somente técnicos podem definir o responsável.");
    }

    const [category, priority] = await Promise.all([
      tx.category.findUnique({ where: { id: data.categoryId } }),
      tx.priority.findUnique({ where: { id: data.priorityId } }),
    ]);
    if (!category?.active) throw new TicketError("DADOS_INVALIDOS", "Categoria inválida.", "categoryId");
    if (!priority?.active) throw new TicketError("DADOS_INVALIDOS", "Prioridade inválida.", "priorityId");
    const assignee = data.assigneeId ? await loadAssignee(tx, data.assigneeId) : null;

    const number = await nextTicketNumber(tx, ticketNumberYear(now));
    const deadlines = deadlinesAtOpening(now, priority);
    const respondsNow = assignee !== null && isFirstResponse({ firstResponseAt: null, requesterId: requester.id }, actor.id);

    const ticket = await tx.ticket.create({
      data: {
        number,
        title: data.title,
        description: data.description,
        status: "ABERTO",
        priorityId: priority.id,
        categoryId: category.id,
        requesterId: requester.id,
        assigneeId: assignee?.id ?? null,
        sectorId: requester.sectorId,
        openedAt: now,
        firstResponseAt: respondsNow ? now : null,
        responseDueAt: deadlines.responseDueAt,
        dueAt: deadlines.dueAt,
      },
    });

    await tx.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: actor.id, type: "CRIADO", toStatus: "ABERTO", createdAt: now },
    });
    if (assignee) {
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId: actor.id, type: "ATRIBUIDO", fromAssigneeId: null, toAssigneeId: assignee.id, createdAt: now },
      });
    }
    return ticket;
  });
}

/** Próximo número do ano. O UPDATE trava a linha do contador até o fim da transação. */
async function nextTicketNumber(tx: Tx, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO contador_prs (ano, ultimo) VALUES (${year}, 1)
    ON CONFLICT (ano) DO UPDATE SET ultimo = contador_prs.ultimo + 1
    RETURNING ultimo`;
  return formatTicketNumber(year, rows[0].ultimo);
}

// ---------------------------------------------------------------------------
// Responsável
// ---------------------------------------------------------------------------

/** Atribui, troca ou remove (assigneeId = null) o responsável. */
export async function assignTicket(
  db: Db,
  actorId: number,
  input: { ticketId: number; assigneeId: number | null } & Expected,
  opts: Options = {},
): Promise<Ticket> {
  const now = opts.now ?? new Date();
  return db.$transaction(async (tx) => {
    const actor = await loadStaffActor(tx, actorId);
    const ticket = await lockTicket(tx, input.ticketId, input.expectedUpdatedAt);
    assertOpen(ticket);
    if (ticket.assigneeId === input.assigneeId) throw new TicketError("SEM_ALTERACAO", "O PR já está com esse responsável.");
    if (input.assigneeId === null && requiresAssignee(ticket.status)) {
      throw new TicketError(
        "TRANSICAO_INVALIDA",
        `Um PR "${STATUS_LABEL[ticket.status]}" precisa de responsável. Coloque-o como pendente antes de remover.`,
      );
    }
    const assignee = input.assigneeId === null ? null : await loadAssignee(tx, input.assigneeId);

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { assigneeId: assignee?.id ?? null, ...firstResponsePatch(ticket, actor.id, now) },
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.id,
        type: "ATRIBUIDO",
        fromAssigneeId: ticket.assigneeId,
        toAssigneeId: assignee?.id ?? null,
        createdAt: now,
      },
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

type ChangeStatusInput = {
  ticketId: number;
  to: Exclude<TicketStatus, "ABERTO">;
  /** Motivo da pendência, solução aplicada ou justificativa do cancelamento. */
  detail?: string;
  /** Observações finais (só na conclusão). */
  notes?: string;
} & Expected;

/**
 * Muda o status pelo fluxo normal. Ao iniciar o atendimento sem responsável,
 * um técnico assume o PR automaticamente (dois eventos, mesma transação).
 */
export async function changeTicketStatus(db: Db, actorId: number, input: ChangeStatusInput, opts: Options = {}): Promise<Ticket> {
  const now = opts.now ?? new Date();
  const detail = requiresDetail(input.to) ? parse(detailSchema, input.detail, detailLabel(input.to)) : null;
  const notes = input.to === "CONCLUIDO" ? parse(notesSchema, input.notes) || null : null;

  return db.$transaction(async (tx) => {
    const actor = await loadStaffActor(tx, actorId);
    const ticket = await lockTicket(tx, input.ticketId, input.expectedUpdatedAt);
    assertOpen(ticket);
    if (!canTransition(ticket.status, input.to)) {
      throw new TicketError(
        "TRANSICAO_INVALIDA",
        `Não é possível passar de "${STATUS_LABEL[ticket.status]}" para "${STATUS_LABEL[input.to]}".`,
      );
    }

    let assigneeId = ticket.assigneeId;
    if (requiresAssignee(input.to) && assigneeId === null) {
      if (input.to !== "EM_ANDAMENTO" || !canBeAssignee(actor)) {
        throw new TicketError("DADOS_INVALIDOS", "Defina um responsável antes de concluir o PR.");
      }
      assigneeId = actor.id;
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId: actor.id, type: "ATRIBUIDO", fromAssigneeId: null, toAssigneeId: actor.id, createdAt: now },
      });
    }

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: input.to,
        assigneeId,
        closedAt: isClosed(input.to) ? now : null,
        ...firstResponsePatch(ticket, actor.id, now),
      },
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.id,
        type: "STATUS_ALTERADO",
        fromStatus: ticket.status,
        toStatus: input.to,
        detail,
        notes,
        createdAt: now,
      },
    });
    return updated;
  });
}

export function concludeTicket(
  db: Db,
  actorId: number,
  input: { ticketId: number; solution: string; notes?: string } & Expected,
  opts?: Options,
) {
  return changeTicketStatus(
    db,
    actorId,
    { ticketId: input.ticketId, to: "CONCLUIDO", detail: input.solution, notes: input.notes, expectedUpdatedAt: input.expectedUpdatedAt },
    opts,
  );
}

export function cancelTicket(db: Db, actorId: number, input: { ticketId: number; reason: string } & Expected, opts?: Options) {
  return changeTicketStatus(
    db,
    actorId,
    { ticketId: input.ticketId, to: "CANCELADO", detail: input.reason, expectedUpdatedAt: input.expectedUpdatedAt },
    opts,
  );
}

/** Reabre um PR concluído (até 30 dias). Volta para "Em andamento", mantendo responsável e prazo. */
export async function reopenTicket(
  db: Db,
  actorId: number,
  input: { ticketId: number; reason: string } & Expected,
  opts: Options = {},
): Promise<Ticket> {
  const now = opts.now ?? new Date();
  const reason = parse(detailSchema, input.reason, "a justificativa da reabertura");
  return db.$transaction(async (tx) => {
    const actor = await loadStaffActor(tx, actorId);
    const ticket = await lockTicket(tx, input.ticketId, input.expectedUpdatedAt);
    if (!canReopen(ticket, now)) {
      throw new TicketError(
        "TRANSICAO_INVALIDA",
        ticket.status === "CONCLUIDO"
          ? `Só é possível reabrir até ${REOPEN_WINDOW_DAYS} dias após a conclusão. Abra um novo PR.`
          : "Somente PRs concluídos podem ser reabertos.",
      );
    }
    const to: TicketStatus = ticket.assigneeId === null ? "ABERTO" : "EM_ANDAMENTO";
    const updated = await tx.ticket.update({ where: { id: ticket.id }, data: { status: to, closedAt: null } });
    await tx.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: actor.id, type: "STATUS_ALTERADO", fromStatus: "CONCLUIDO", toStatus: to, detail: reason, createdAt: now },
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Prioridade
// ---------------------------------------------------------------------------

/** Muda a prioridade e recalcula os prazos pela política aprovada (ver domain/sla.ts). */
export async function changeTicketPriority(
  db: Db,
  actorId: number,
  input: { ticketId: number; priorityId: number } & Expected,
  opts: Options = {},
): Promise<Ticket> {
  const now = opts.now ?? new Date();
  return db.$transaction(async (tx) => {
    const actor = await loadStaffActor(tx, actorId);
    const ticket = await lockTicket(tx, input.ticketId, input.expectedUpdatedAt);
    assertOpen(ticket);
    if (ticket.priorityId === input.priorityId) throw new TicketError("SEM_ALTERACAO", "O PR já tem essa prioridade.");
    const [from, to] = await Promise.all([
      tx.priority.findUniqueOrThrow({ where: { id: ticket.priorityId } }),
      tx.priority.findUnique({ where: { id: input.priorityId } }),
    ]);
    if (!to?.active) throw new TicketError("DADOS_INVALIDOS", "Prioridade inválida.");

    const next = deadlinesOnPriorityChange(ticket, from, to, now);
    // Se a primeira resposta já aconteceu, o prazo dela é um fato encerrado.
    const responseDueAt = ticket.firstResponseAt ? ticket.responseDueAt : next.responseDueAt;

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: { priorityId: to.id, dueAt: next.dueAt, responseDueAt, ...firstResponsePatch(ticket, actor.id, now) },
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.id,
        type: "PRIORIDADE_ALTERADA",
        fromPriorityId: from.id,
        toPriorityId: to.id,
        fromDueAt: ticket.dueAt,
        toDueAt: next.dueAt,
        fromResponseDueAt: ticket.responseDueAt,
        toResponseDueAt: responseDueAt,
        createdAt: now,
      },
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Edição de título, descrição e categoria
// ---------------------------------------------------------------------------

export async function editTicket(
  db: Db,
  actorId: number,
  input: { ticketId: number } & EditTicketInput & Expected,
  opts: Options = {},
): Promise<Ticket> {
  const now = opts.now ?? new Date();
  const data = parse(editTicketSchema, { title: input.title, description: input.description, categoryId: input.categoryId });
  return db.$transaction(async (tx) => {
    const actor = await loadStaffActor(tx, actorId);
    const ticket = await lockTicket(tx, input.ticketId, input.expectedUpdatedAt);
    assertOpen(ticket);

    const changes: Record<string, { de: Prisma.InputJsonValue; para: Prisma.InputJsonValue }> = {};
    if (data.title !== undefined && data.title !== ticket.title) changes.titulo = { de: ticket.title, para: data.title };
    if (data.description !== undefined && data.description !== ticket.description) {
      changes.descricao = { de: ticket.description, para: data.description };
    }
    if (data.categoryId !== undefined && data.categoryId !== ticket.categoryId) {
      const [from, to] = await Promise.all([
        tx.category.findUniqueOrThrow({ where: { id: ticket.categoryId } }),
        tx.category.findUnique({ where: { id: data.categoryId } }),
      ]);
      if (!to?.active) throw new TicketError("DADOS_INVALIDOS", "Categoria inválida.");
      changes.categoria = { de: { id: from.id, nome: from.name }, para: { id: to.id, nome: to.name } };
    }
    if (Object.keys(changes).length === 0) throw new TicketError("SEM_ALTERACAO", "Nenhuma informação foi alterada.");

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        ...(changes.titulo && { title: data.title }),
        ...(changes.descricao && { description: data.description }),
        ...(changes.categoria && { categoryId: data.categoryId }),
      },
    });
    await tx.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: actor.id, type: "DADOS_ALTERADOS", changes, createdAt: now },
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

/**
 * Adiciona um comentário (permitido também em PRs encerrados).
 * Solicitantes só comentam nos próprios PRs. Todos os comentários são públicos nesta etapa.
 */
export async function addComment(db: Db, actorId: number, input: { ticketId: number; body: string }, opts: Options = {}) {
  const now = opts.now ?? new Date();
  const body = parse(commentSchema, input.body);
  return db.$transaction(async (tx) => {
    const actor = await loadActor(tx, actorId);
    const ticket = await lockTicket(tx, input.ticketId);
    if (!isStaff(actor.role) && actor.id !== ticket.requesterId) {
      throw new TicketError("SEM_PERMISSAO", "Solicitantes só podem comentar nos próprios PRs.");
    }
    const comment = await tx.ticketComment.create({
      data: { ticketId: ticket.id, authorId: actor.id, body, visibility: "PUBLICO", createdAt: now },
    });
    await tx.ticketEvent.create({
      data: { ticketId: ticket.id, actorId: actor.id, type: "COMENTARIO", commentId: comment.id, createdAt: now },
    });
    const patch = firstResponsePatch(ticket, actor.id, now);
    if (patch.firstResponseAt) await tx.ticket.update({ where: { id: ticket.id }, data: patch });
    return comment;
  });
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function parse<S extends z.ZodType>(schema: S, value: unknown, label?: string): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const message = issue?.message ?? "Dados inválidos.";
    throw new TicketError("DADOS_INVALIDOS", label ? message.replace("o texto", label) : message, issue?.path[0]?.toString());
  }
  return result.data;
}

function detailLabel(to: TicketStatus): string {
  if (to === "PENDENTE") return "o motivo da pendência";
  if (to === "CONCLUIDO") return "a solução aplicada";
  return "a justificativa do cancelamento";
}

async function loadActor(tx: Tx, actorId: number): Promise<User> {
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor?.active) throw new TicketError("USUARIO_INVALIDO", "Usuário atual não encontrado ou inativo. Selecione outro usuário.");
  return actor;
}

async function loadStaffActor(tx: Tx, actorId: number): Promise<User> {
  const actor = await loadActor(tx, actorId);
  if (!isStaff(actor.role)) throw new TicketError("SEM_PERMISSAO", "Esta ação é exclusiva de técnicos e administradores.");
  return actor;
}

async function loadAssignee(tx: Tx, userId: number): Promise<User> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || !canBeAssignee(user)) {
    throw new TicketError("DADOS_INVALIDOS", "O responsável precisa ser um técnico ou administrador ativo.", "assigneeId");
  }
  return user;
}

/** Trava o PR até o fim da transação e confere a versão esperada. */
async function lockTicket(tx: Tx, ticketId: number, expectedUpdatedAt?: Date): Promise<Ticket> {
  const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM prs WHERE id = ${ticketId} FOR UPDATE`;
  if (locked.length === 0) throw new TicketError("NAO_ENCONTRADO", "PR não encontrado.");
  const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  if (expectedUpdatedAt && ticket.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw new TicketError("CONFLITO", "Este PR foi alterado por outra pessoa. Recarregue a página e tente novamente.");
  }
  return ticket;
}

function assertOpen(ticket: Ticket) {
  if (isClosed(ticket.status)) {
    throw new TicketError("PR_ENCERRADO", `Este PR está "${STATUS_LABEL[ticket.status]}" e não pode ser alterado.`);
  }
}

function firstResponsePatch(ticket: Ticket, actorId: number, now: Date): { firstResponseAt?: Date } {
  return isFirstResponse(ticket, actorId) ? { firstResponseAt: now } : {};
}
