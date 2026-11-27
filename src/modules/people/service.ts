// Operações dos cadastros mínimos (usuários e setores).
//
// Quem pode alterar: um administrador ativo. Enquanto não existir nenhum
// administrador ativo (primeira configuração do sistema), os cadastros ficam
// liberados para que seja possível criar o primeiro.
//
// Nada é excluído: registros fora de uso são desativados, preservando o
// histórico dos PRs.
import { Prisma, type PrismaClient, type Sector, type User } from "@/generated/prisma/client";
import type { z } from "zod";
import { PeopleError, sectorSchema, userSchema, type SectorInput, type UserInput } from "./domain";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

/** Primeira configuração: ainda não há administrador ativo. */
export async function isSetupMode(db: Db | Tx): Promise<boolean> {
  return (await db.user.count({ where: { role: "ADMIN", active: true } })) === 0;
}

async function assertCanManage(tx: Tx, actorId: number | null) {
  if (await isSetupMode(tx)) return;
  const actor = actorId === null ? null : await tx.user.findUnique({ where: { id: actorId } });
  if (!actor?.active || actor.role !== "ADMIN") {
    throw new PeopleError("SEM_PERMISSAO", "Somente administradores podem alterar os cadastros.");
  }
}

// ---------------------------------------------------------------------------
// Setores
// ---------------------------------------------------------------------------

export async function createSector(db: Db, actorId: number | null, input: SectorInput): Promise<Sector> {
  const data = parse(sectorSchema, input);
  return db.$transaction(async (tx) => {
    await assertCanManage(tx, actorId);
    await assertUniqueSectorName(tx, data.name);
    return tx.sector.create({ data: { name: data.name } });
  });
}

export async function updateSector(
  db: Db,
  actorId: number | null,
  input: SectorInput & { id: number; active: boolean },
): Promise<Sector> {
  const data = parse(sectorSchema, input);
  return db.$transaction(async (tx) => {
    await assertCanManage(tx, actorId);
    const sector = await tx.sector.findUnique({ where: { id: input.id } });
    if (!sector) throw new PeopleError("NAO_ENCONTRADO", "Setor não encontrado.");
    await assertUniqueSectorName(tx, data.name, sector.id);
    return tx.sector.update({ where: { id: sector.id }, data: { name: data.name, active: input.active } });
  });
}

async function assertUniqueSectorName(tx: Tx, name: string, exceptId?: number) {
  const existing = await tx.sector.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId && { id: { not: exceptId } }) },
  });
  if (existing) throw new PeopleError("DUPLICADO", `Já existe o setor "${existing.name}".`, "name");
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

export async function createUser(db: Db, actorId: number | null, input: UserInput): Promise<User> {
  const data = parse(userSchema, input);
  return db.$transaction(async (tx) => {
    await assertCanManage(tx, actorId);
    await assertActiveSector(tx, data.sectorId);
    try {
      return await tx.user.create({ data });
    } catch (e) {
      throw duplicateEmail(e) ?? e;
    }
  });
}

export async function updateUser(
  db: Db,
  actorId: number | null,
  input: UserInput & { id: number; active: boolean },
): Promise<User> {
  const data = parse(userSchema, input);
  return db.$transaction(async (tx) => {
    await assertCanManage(tx, actorId);
    const user = await tx.user.findUnique({ where: { id: input.id } });
    if (!user) throw new PeopleError("NAO_ENCONTRADO", "Usuário não encontrado.");
    if (data.sectorId !== user.sectorId) await assertActiveSector(tx, data.sectorId);

    // Deixar de atender (desativar ou virar solicitante) exige não ter PRs em atendimento.
    const stopsAttending = (user.role !== "SOLICITANTE" && data.role === "SOLICITANTE") || (user.active && !input.active);
    if (stopsAttending) {
      const assigned = await tx.ticket.count({
        where: { assigneeId: user.id, status: { in: ["ABERTO", "EM_ANDAMENTO", "PENDENTE"] } },
      });
      if (assigned > 0) {
        throw new PeopleError(
          "BLOQUEADO",
          `${user.name} é responsável por ${assigned} PR${assigned > 1 ? "s" : ""} em atendimento. Reatribua antes de continuar.`,
        );
      }
    }

    // O sistema precisa manter ao menos um administrador ativo (exceto na primeira configuração).
    const losesAdmin = user.role === "ADMIN" && user.active && (data.role !== "ADMIN" || !input.active);
    if (losesAdmin) {
      const otherAdmins = await tx.user.count({ where: { role: "ADMIN", active: true, id: { not: user.id } } });
      if (otherAdmins === 0) {
        throw new PeopleError("BLOQUEADO", "É preciso manter ao menos um administrador ativo.");
      }
    }

    try {
      return await tx.user.update({ where: { id: user.id }, data: { ...data, active: input.active } });
    } catch (e) {
      throw duplicateEmail(e) ?? e;
    }
  });
}

async function assertActiveSector(tx: Tx, sectorId: number | null) {
  if (sectorId === null) return;
  const sector = await tx.sector.findUnique({ where: { id: sectorId } });
  if (!sector?.active) throw new PeopleError("DADOS_INVALIDOS", "Setor inválido ou inativo.", "sectorId");
}

function duplicateEmail(e: unknown): PeopleError | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return new PeopleError("DUPLICADO", "Já existe um usuário com este e-mail.", "email");
  }
  return null;
}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new PeopleError("DADOS_INVALIDOS", issue?.message ?? "Dados inválidos.", issue?.path[0]?.toString());
  }
  return result.data;
}
