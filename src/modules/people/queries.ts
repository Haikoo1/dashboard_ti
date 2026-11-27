// Consultas dos cadastros (somente leitura).
import type { PrismaClient } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";

type Db = PrismaClient;

export type UserListItem = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  sectorId: number | null;
  sectorName: string | null;
  /** PRs em atendimento sob responsabilidade do usuário. */
  activeAssigned: number;
};

export async function listUsers(db: Db): Promise<UserListItem[]> {
  const users = await db.user.findMany({
    include: { sector: { select: { name: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const counts = await db.ticket.groupBy({
    by: ["assigneeId"],
    where: { status: { in: ["ABERTO", "EM_ANDAMENTO", "PENDENTE"] }, assigneeId: { not: null } },
    _count: true,
  });
  const byUser = new Map(counts.map((c) => [c.assigneeId, c._count]));
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    sectorId: u.sectorId,
    sectorName: u.sector?.name ?? null,
    activeAssigned: byUser.get(u.id) ?? 0,
  }));
}

export type SectorListItem = { id: number; name: string; active: boolean; users: number; tickets: number };

export async function listSectors(db: Db): Promise<SectorListItem[]> {
  const sectors = await db.sector.findMany({
    include: { _count: { select: { users: true, tickets: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return sectors.map((s) => ({ id: s.id, name: s.name, active: s.active, users: s._count.users, tickets: s._count.tickets }));
}

export type UserOption = { id: number; name: string; role: UserRole; sectorName: string | null };

/** Usuários ativos, para seletores (usuário atual, solicitante, responsável). */
export async function listActiveUsers(db: Db): Promise<UserOption[]> {
  const users = await db.user.findMany({
    where: { active: true },
    include: { sector: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role, sectorName: u.sector?.name ?? null }));
}

/** Técnicos e administradores ativos: quem pode ser responsável por PRs. */
export async function listAvailableTechnicians(db: Db): Promise<UserOption[]> {
  return (await listActiveUsers(db)).filter((u) => u.role !== "SOLICITANTE");
}
