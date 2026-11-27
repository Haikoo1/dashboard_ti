// Testes dos cadastros mínimos (usuários e setores) contra o banco de TESTES.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PeopleError } from "@/modules/people/domain";
import { listActiveUsers, listAvailableTechnicians, listUsers } from "@/modules/people/queries";
import { createSector, createUser, isSetupMode, updateSector, updateUser } from "@/modules/people/service";
import { createTicket } from "@/modules/tickets/service/ticket-service";
import { createTestDb, resetDatabase } from "../helpers/scenario";

const db = createTestDb();
afterAll(() => db.$disconnect());
beforeEach(() => resetDatabase(db));

async function expectError(promise: Promise<unknown>, code: PeopleError["code"], field?: string) {
  await expect(promise).rejects.toSatisfy(
    (e: unknown) => e instanceof PeopleError && e.code === code && (field === undefined || e.field === field),
  );
}

/** Primeira configuração: setor + administrador. Retorna os ids. */
async function bootstrap() {
  const ti = await createSector(db, null, { name: "TI" });
  const admin = await createUser(db, null, { name: "Ana Admin", email: "Ana@Empresa.com ", role: "ADMIN", sectorId: ti.id });
  return { ti, admin };
}

describe("primeira configuração", () => {
  it("sem administrador ativo, os cadastros ficam liberados; depois, só administradores", async () => {
    expect(await isSetupMode(db)).toBe(true);
    const { ti, admin } = await bootstrap();
    expect(admin.email).toBe("ana@empresa.com");
    expect(await isSetupMode(db)).toBe(false);

    await expectError(createSector(db, null, { name: "Financeiro" }), "SEM_PERMISSAO");
    const tech = await createUser(db, admin.id, { name: "Tiago Técnico", email: "tiago@empresa.com", role: "TECNICO", sectorId: ti.id });
    await expectError(createSector(db, tech.id, { name: "Financeiro" }), "SEM_PERMISSAO");
    await expect(createSector(db, admin.id, { name: "Financeiro" })).resolves.toMatchObject({ name: "Financeiro" });
  });
});

describe("setores", () => {
  it("nome único sem diferenciar maiúsculas; edição e desativação", async () => {
    const { admin } = await bootstrap();
    await expectError(createSector(db, admin.id, { name: " ti " }), "DUPLICADO", "name");
    const fin = await createSector(db, admin.id, { name: "Financeiro" });
    await expectError(updateSector(db, admin.id, { id: fin.id, name: "TI", active: true }), "DUPLICADO");
    const updated = await updateSector(db, admin.id, { id: fin.id, name: "Finanças", active: false });
    expect(updated).toMatchObject({ name: "Finanças", active: false });
    await expectError(
      createUser(db, admin.id, { name: "Bia", email: "bia@empresa.com", role: "SOLICITANTE", sectorId: fin.id }),
      "DADOS_INVALIDOS",
      "sectorId",
    );
  });
});

describe("usuários", () => {
  it("validações: e-mail válido e único, solicitante com setor", async () => {
    const { ti, admin } = await bootstrap();
    await expectError(createUser(db, admin.id, { name: "Bia", email: "bia", role: "TECNICO", sectorId: null }), "DADOS_INVALIDOS", "email");
    await expectError(
      createUser(db, admin.id, { name: "Bia", email: "bia@empresa.com", role: "SOLICITANTE", sectorId: null }),
      "DADOS_INVALIDOS",
      "sectorId",
    );
    await expectError(
      createUser(db, admin.id, { name: "Outra Ana", email: "ANA@empresa.com", role: "TECNICO", sectorId: ti.id }),
      "DUPLICADO",
      "email",
    );
    expect(await db.user.count()).toBe(1);
  });

  it("não desativa nem rebaixa quem tem PRs em atendimento; mantém ao menos um administrador", async () => {
    const { ti, admin } = await bootstrap();
    const tech = await createUser(db, admin.id, { name: "Tiago Técnico", email: "tiago@empresa.com", role: "TECNICO", sectorId: ti.id });
    await db.category.create({ data: { name: "Hardware" } });
    const prio = await db.priority.create({
      data: { name: "Alta", level: 2, color: "#F97316", responseSlaMinutes: 120, resolutionSlaMinutes: 480 },
    });
    const cat = await db.category.findFirstOrThrow();
    await createTicket(db, tech.id, {
      title: "Rede lenta",
      description: "A rede do andar está lenta desde cedo.",
      requesterId: admin.id,
      categoryId: cat.id,
      priorityId: prio.id,
      assigneeId: tech.id,
    });

    const base = { name: tech.name, email: tech.email, sectorId: ti.id };
    await expectError(updateUser(db, admin.id, { ...base, id: tech.id, role: "TECNICO", active: false }), "BLOQUEADO");
    await expectError(updateUser(db, admin.id, { ...base, id: tech.id, role: "SOLICITANTE", active: true }), "BLOQUEADO");
    await expectError(
      updateUser(db, admin.id, { name: admin.name, email: admin.email, sectorId: ti.id, id: admin.id, role: "TECNICO", active: true }),
      "BLOQUEADO",
    );
    // Mudanças que não tiram ninguém do atendimento são permitidas.
    await expect(updateUser(db, admin.id, { ...base, name: "Tiago Silva", id: tech.id, role: "ADMIN", active: true })).resolves.toMatchObject({
      name: "Tiago Silva",
      role: "ADMIN",
    });
  });

  it("listas: inativos saem dos seletores; técnicos disponíveis excluem solicitantes", async () => {
    const { ti, admin } = await bootstrap();
    const sol = await createUser(db, admin.id, { name: "Bruno", email: "bruno@empresa.com", role: "SOLICITANTE", sectorId: ti.id });
    const old = await createUser(db, admin.id, { name: "Carla", email: "carla@empresa.com", role: "TECNICO", sectorId: ti.id });
    await updateUser(db, admin.id, { name: old.name, email: old.email, role: "TECNICO", sectorId: ti.id, id: old.id, active: false });

    expect((await listActiveUsers(db)).map((u) => u.name)).toEqual(["Ana Admin", "Bruno"]);
    expect((await listAvailableTechnicians(db)).map((u) => u.name)).toEqual(["Ana Admin"]);
    expect((await listUsers(db)).map((u) => [u.name, u.active])).toEqual([
      ["Ana Admin", true],
      ["Bruno", true],
      ["Carla", false],
    ]);
    expect(sol.sectorId).toBe(ti.id);
  });
});
