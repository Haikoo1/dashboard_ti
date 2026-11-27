// Consulta da listagem de PRs (somente leitura).
// As regras de "atrasado" e "próximo do vencimento" são as mesmas do domínio
// (domain/sla.ts) e das consultas do Dashboard.
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { TicketStatus } from "@/generated/prisma/enums";
import { addZonedDays, parseIsoDate, zonedMidnight } from "@/lib/time-zone";
import { NEAR_DUE_FRACTION, resolutionSlaState, type SlaState } from "../domain/sla";
import { ACTIVE_STATUSES } from "../status";
import { NO_ASSIGNEE, PAGE_SIZE, type TicketListFilters } from "../domain/list-filters";

type Db = PrismaClient;

/** Nível da prioridade crítica (o mesmo usado nos alertas do Dashboard). */
const CRITICAL_LEVEL = 1;

export type TicketListItem = {
  id: number;
  number: string;
  title: string;
  status: TicketStatus;
  requesterName: string;
  sectorName: string;
  categoryName: string;
  priority: { name: string; level: number; color: string };
  assigneeName: string | null;
  openedAt: Date;
  dueAt: Date;
  closedAt: Date | null;
  sla: SlaState;
  critical: boolean;
};

export type TicketListResult = {
  items: TicketListItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

export async function listTickets(db: Db, filters: TicketListFilters, now: Date): Promise<TicketListResult> {
  const where = await buildWhere(db, filters, now);
  const total = await db.ticket.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const rows = await db.ticket.findMany({
    where,
    orderBy: orderBy(filters),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      openedAt: true,
      dueAt: true,
      closedAt: true,
      requester: { select: { name: true } },
      sector: { select: { name: true } },
      category: { select: { name: true } },
      priority: { select: { name: true, level: true, color: true } },
      assignee: { select: { name: true } },
    },
  });

  return {
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
    items: rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      status: r.status,
      requesterName: r.requester.name,
      sectorName: r.sector.name,
      categoryName: r.category.name,
      priority: r.priority,
      assigneeName: r.assignee?.name ?? null,
      openedAt: r.openedAt,
      dueAt: r.dueAt,
      closedAt: r.closedAt,
      sla: resolutionSlaState(r, now),
      critical: r.priority.level === CRITICAL_LEVEL && (ACTIVE_STATUSES as readonly TicketStatus[]).includes(r.status),
    })),
  };
}

function orderBy(f: TicketListFilters): Prisma.TicketOrderByWithRelationInput[] {
  const dir = f.direction;
  switch (f.sort) {
    case "prioridade":
      // Nível 1 = mais urgente; empate: prazo mais próximo.
      return [{ priority: { level: dir } }, { dueAt: "asc" }, { id: "desc" }];
    case "prazo":
      return [{ dueAt: dir }, { id: "desc" }];
    default:
      return [{ openedAt: dir }, { id: dir }];
  }
}

async function buildWhere(db: Db, f: TicketListFilters, now: Date): Promise<Prisma.TicketWhereInput> {
  const and: Prisma.TicketWhereInput[] = [];

  if (f.q) {
    const q = f.q;
    and.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { requester: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.status) and.push({ status: f.status });
  if (f.priorityId) and.push({ priorityId: f.priorityId });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  if (f.sectorId) and.push({ sectorId: f.sectorId });
  if (f.assignee === NO_ASSIGNEE) and.push({ assigneeId: null });
  else if (f.assignee) and.push({ assigneeId: f.assignee });

  const active = { status: { in: [...ACTIVE_STATUSES] } };
  if (f.situation === "atrasado") and.push(active, { dueAt: { lt: now } });
  if (f.situation === "critico") and.push(active, { priority: { level: CRITICAL_LEVEL } });
  if (f.situation === "proximo") {
    // Resta no máximo 25% do prazo total (abertura → prazo), ainda sem vencer.
    const rows = await db.$queryRaw<{ id: number }[]>`
      SELECT id FROM prs
      WHERE status IN ('ABERTO', 'EM_ANDAMENTO', 'PENDENTE')
        AND prazo_em >= ${now}::timestamptz
        AND (prazo_em - ${now}::timestamptz) <= (prazo_em - aberto_em) * ${NEAR_DUE_FRACTION}::float8`;
    and.push({ id: { in: rows.map((r) => r.id) } });
  }

  const opened = dayRange(f.openedFrom, f.openedTo);
  if (opened) and.push({ openedAt: opened });
  const closed = dayRange(f.closedFrom, f.closedTo);
  if (closed) and.push({ closedAt: closed });

  return and.length > 0 ? { AND: and } : {};
}

/** Intervalo de dias inteiros no horário de Brasília: [início do 1º dia, início do dia seguinte ao último). */
function dayRange(from?: string, to?: string): Prisma.DateTimeFilter | null {
  const start = from ? parseIsoDate(from) : null;
  const end = to ? parseIsoDate(to) : null;
  if (!start && !end) return null;
  return {
    ...(start && { gte: zonedMidnight(start) }),
    ...(end && { lt: addZonedDays(zonedMidnight(end), 1) }),
  };
}

// ---------------------------------------------------------------------------
// Indicadores resumidos (situação atual, sem filtros)
// ---------------------------------------------------------------------------

export type TicketSummary = { open: number; inProgress: number; pending: number; overdue: number; critical: number };

export async function getTicketSummary(db: Db, now: Date): Promise<TicketSummary> {
  const active = { status: { in: [...ACTIVE_STATUSES] } };
  const [byStatus, overdue, critical] = await Promise.all([
    db.ticket.groupBy({ by: ["status"], where: active, _count: true }),
    db.ticket.count({ where: { ...active, dueAt: { lt: now } } }),
    db.ticket.count({ where: { ...active, priority: { level: CRITICAL_LEVEL } } }),
  ]);
  const count = (s: TicketStatus) => byStatus.find((r) => r.status === s)?._count ?? 0;
  return { open: count("ABERTO"), inProgress: count("EM_ANDAMENTO"), pending: count("PENDENTE"), overdue, critical };
}

// ---------------------------------------------------------------------------
// Opções dos filtros
// ---------------------------------------------------------------------------

export type FilterOptions = {
  priorities: { id: number; name: string; color: string }[];
  categories: { id: number; name: string }[];
  sectors: { id: number; name: string }[];
  assignees: { id: number; name: string; active: boolean }[];
};

export async function getFilterOptions(db: Db): Promise<FilterOptions> {
  const [priorities, categories, sectors, assignees] = await Promise.all([
    db.priority.findMany({ orderBy: { level: "asc" }, select: { id: true, name: true, color: true } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.sector.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Técnicos e administradores, incluindo inativos que já foram responsáveis (histórico).
    db.user.findMany({
      where: { OR: [{ role: { in: ["TECNICO", "ADMIN"] } }, { assignedTickets: { some: {} } }] },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
  ]);
  return { priorities, categories, sectors, assignees };
}

/** Existe algum PR cadastrado? (estado vazio da listagem) */
export async function countAllTickets(db: Db): Promise<number> {
  return db.ticket.count();
}
