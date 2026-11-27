// Testes das operações de PR contra o banco de TESTES (gestao_ti_test).
// Cada teste começa com o banco limpo e os mesmos cadastros de apoio.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { getRecentActivity, getStatusSnapshot } from "@/modules/dashboard";
import type { TicketListFilters } from "@/modules/tickets/domain/list-filters";
import { TicketError } from "@/modules/tickets/domain/rules";
import { getTicketSummary, listTickets } from "@/modules/tickets/queries/list";
import {
  addComment,
  assignTicket,
  cancelTicket,
  changeTicketPriority,
  changeTicketStatus,
  concludeTicket,
  createTicket,
  editTicket,
  reopenTicket,
} from "@/modules/tickets/service/ticket-service";
import { createTestDb, mar, resetDatabase } from "../helpers/scenario";

const db: PrismaClient = createTestDb();
afterAll(() => db.$disconnect());

const H = 60 * 60_000;
const T0 = mar(10, 9); // 10/03/2026 09:00 em Brasília
const at = (hours: number) => new Date(T0.getTime() + hours * H);

let ids: {
  admin: number;
  tech: number;
  tech2: number;
  techInactive: number;
  requester: number;
  requester2: number;
  noSector: number;
  sectorTi: number;
  sectorFin: number;
  critica: number;
  alta: number;
  media: number;
  baixa: number;
  hardware: number;
  software: number;
};

beforeEach(async () => {
  await resetDatabase(db);
  const ti = await db.sector.create({ data: { name: "TI" } });
  const fin = await db.sector.create({ data: { name: "Financeiro" } });
  const user = (name: string, role: "ADMIN" | "TECNICO" | "SOLICITANTE", sectorId: number | null, active = true) =>
    db.user.create({ data: { name, email: `${name.toLowerCase().replace(/\s/g, ".")}@teste.local`, role, sectorId, active } });
  const prio = (name: string, level: number, resp: number, res: number) =>
    db.priority.create({ data: { name, level, color: "#888888", responseSlaMinutes: resp, resolutionSlaMinutes: res } });
  const [admin, tech, tech2, techInactive, requester, requester2, noSector, critica, alta, media, baixa, hardware, software] =
    await Promise.all([
      user("Admin", "ADMIN", ti.id),
      user("Tecnico Um", "TECNICO", ti.id),
      user("Tecnico Dois", "TECNICO", ti.id),
      user("Tecnico Inativo", "TECNICO", ti.id, false),
      user("Ana", "SOLICITANTE", fin.id),
      user("Bruno", "SOLICITANTE", fin.id),
      user("Sem Setor", "SOLICITANTE", null),
      prio("Crítica", 1, 60, 240),
      prio("Alta", 2, 120, 480),
      prio("Média", 3, 240, 1440),
      prio("Baixa", 4, 480, 4320),
      db.category.create({ data: { name: "Hardware" } }),
      db.category.create({ data: { name: "Software" } }),
    ]);
  ids = {
    admin: admin.id,
    tech: tech.id,
    tech2: tech2.id,
    techInactive: techInactive.id,
    requester: requester.id,
    requester2: requester2.id,
    noSector: noSector.id,
    sectorTi: ti.id,
    sectorFin: fin.id,
    critica: critica.id,
    alta: alta.id,
    media: media.id,
    baixa: baixa.id,
    hardware: hardware.id,
    software: software.id,
  };
});

function open(over: Partial<Parameters<typeof createTicket>[2]> = {}, actor = ids.requester, now = T0) {
  return createTicket(
    db,
    actor,
    {
      title: "Computador não liga",
      description: "O computador da recepção não liga desde cedo.",
      requesterId: ids.requester,
      categoryId: ids.hardware,
      priorityId: ids.alta,
      ...over,
    },
    { now },
  );
}

async function events(ticketId: number) {
  return db.ticketEvent.findMany({ where: { ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

async function expectError(promise: Promise<unknown>, code: TicketError["code"]) {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof TicketError && e.code === code);
}

async function counts() {
  const [prs, evs, comments, counter] = await Promise.all([
    db.ticket.count(),
    db.ticketEvent.count(),
    db.ticketComment.count(),
    db.ticketCounter.findMany(),
  ]);
  return { prs, evs, comments, counter };
}

// ---------------------------------------------------------------------------

describe("abertura de PR", () => {
  it("grava o PR com número, status, prazos, setor do solicitante e o evento de criação", async () => {
    const t = await open();
    expect(t).toMatchObject({
      number: "PR-2026-0001",
      status: "ABERTO",
      requesterId: ids.requester,
      sectorId: ids.sectorFin,
      assigneeId: null,
      firstResponseAt: null,
      closedAt: null,
      openedAt: T0,
      responseDueAt: at(2),
      dueAt: at(8),
    });
    const ev = await events(t.id);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: "CRIADO", toStatus: "ABERTO", actorId: ids.requester, createdAt: T0 });
  });

  it("numeração sequencial por ano, também com aberturas simultâneas", async () => {
    const created = await Promise.all(Array.from({ length: 20 }, () => open()));
    const numbers = created.map((t) => t.number).sort();
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => `PR-2026-${String(i + 1).padStart(4, "0")}`));
    const nextYear = await open({}, ids.requester, new Date("2027-01-02T12:00:00Z"));
    expect(nextYear.number).toBe("PR-2027-0001");
  });

  it("técnico registrando em nome do solicitante: abertura não conta como primeira resposta", async () => {
    const t = await open({}, ids.tech);
    expect(t.firstResponseAt).toBeNull();
    expect((await events(t.id))[0].actorId).toBe(ids.tech);
  });

  it("abertura já com responsável gera o evento de atribuição", async () => {
    const t = await open({ assigneeId: ids.tech }, ids.tech);
    expect(t).toMatchObject({ assigneeId: ids.tech, firstResponseAt: T0 });
    expect((await events(t.id)).map((e) => e.type)).toEqual(["CRIADO", "ATRIBUIDO"]);
  });

  it("rejeita dados inválidos sem gravar nada", async () => {
    await expectError(open({ title: "   " }), "DADOS_INVALIDOS");
    await expectError(open({ description: "curta" }), "DADOS_INVALIDOS");
    await expectError(open({ requesterId: ids.noSector }, ids.tech), "DADOS_INVALIDOS");
    await expectError(open({ assigneeId: ids.techInactive }, ids.tech), "DADOS_INVALIDOS");
    await expectError(open({ assigneeId: ids.requester2 }, ids.tech), "DADOS_INVALIDOS");
    await expectError(open({ priorityId: 9999 }), "DADOS_INVALIDOS");
    expect(await counts()).toEqual({ prs: 0, evs: 0, comments: 0, counter: [] });
  });

  it("solicitante só abre PR em seu nome e sem definir responsável", async () => {
    await expectError(open({ requesterId: ids.requester2 }), "SEM_PERMISSAO");
    await expectError(open({ assigneeId: ids.tech }), "SEM_PERMISSAO");
  });
});

describe("status", () => {
  it("fluxo completo: iniciar (assume automaticamente), pendência, retomada e conclusão", async () => {
    const t = await open();
    await changeTicketStatus(db, ids.tech, { ticketId: t.id, to: "EM_ANDAMENTO" }, { now: at(1) });
    let row = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(row).toMatchObject({ status: "EM_ANDAMENTO", assigneeId: ids.tech, firstResponseAt: at(1) });

    await expectError(changeTicketStatus(db, ids.tech, { ticketId: t.id, to: "PENDENTE", detail: "  " }, { now: at(2) }), "DADOS_INVALIDOS");
    await changeTicketStatus(db, ids.tech, { ticketId: t.id, to: "PENDENTE", detail: "Aguardando peça" }, { now: at(2) });
    await changeTicketStatus(db, ids.tech, { ticketId: t.id, to: "EM_ANDAMENTO" }, { now: at(3) });
    await expectError(concludeTicket(db, ids.tech, { ticketId: t.id, solution: "" }, { now: at(4) }), "DADOS_INVALIDOS");
    await concludeTicket(db, ids.tech, { ticketId: t.id, solution: "Fonte trocada", notes: "Garantia acionada" }, { now: at(4) });

    row = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(row).toMatchObject({ status: "CONCLUIDO", closedAt: at(4), firstResponseAt: at(1) });
    const ev = await events(t.id);
    expect(ev.map((e) => [e.type, e.fromStatus, e.toStatus, e.detail])).toEqual([
      ["CRIADO", null, "ABERTO", null],
      ["ATRIBUIDO", null, null, null],
      ["STATUS_ALTERADO", "ABERTO", "EM_ANDAMENTO", null],
      ["STATUS_ALTERADO", "EM_ANDAMENTO", "PENDENTE", "Aguardando peça"],
      ["STATUS_ALTERADO", "PENDENTE", "EM_ANDAMENTO", null],
      ["STATUS_ALTERADO", "EM_ANDAMENTO", "CONCLUIDO", "Fonte trocada"],
    ]);
    expect(ev.at(-1)).toMatchObject({ actorId: ids.tech, notes: "Garantia acionada", createdAt: at(4) });
  });

  it("transições inválidas e PR encerrado travado (comentário continua permitido)", async () => {
    const t = await open();
    await expectError(concludeTicket(db, ids.tech, { ticketId: t.id, solution: "Resolvido" }, { now: at(1) }), "DADOS_INVALIDOS");
    await cancelTicket(db, ids.tech, { ticketId: t.id, reason: "Duplicado do PR-2026-0001" }, { now: at(1) });
    const before = await counts();
    await expectError(changeTicketStatus(db, ids.tech, { ticketId: t.id, to: "EM_ANDAMENTO" }, { now: at(2) }), "PR_ENCERRADO");
    await expectError(assignTicket(db, ids.tech, { ticketId: t.id, assigneeId: ids.tech }, { now: at(2) }), "PR_ENCERRADO");
    await expectError(changeTicketPriority(db, ids.tech, { ticketId: t.id, priorityId: ids.baixa }, { now: at(2) }), "PR_ENCERRADO");
    await expectError(editTicket(db, ids.tech, { ticketId: t.id, title: "Outro título" }, { now: at(2) }), "PR_ENCERRADO");
    expect(await counts()).toEqual(before);
    await addComment(db, ids.requester, { ticketId: t.id, body: "Ok, obrigado." }, { now: at(3) });
    expect((await counts()).comments).toBe(before.comments + 1);
  });

  it("cancelamento exige justificativa e registra o encerramento", async () => {
    const t = await open();
    await expectError(cancelTicket(db, ids.tech, { ticketId: t.id, reason: "" }, { now: at(1) }), "DADOS_INVALIDOS");
    await cancelTicket(db, ids.tech, { ticketId: t.id, reason: "Solicitante desistiu" }, { now: at(1) });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ status: "CANCELADO", closedAt: at(1) });
  });

  it("solicitante não altera status", async () => {
    const t = await open();
    await expectError(changeTicketStatus(db, ids.requester, { ticketId: t.id, to: "EM_ANDAMENTO" }), "SEM_PERMISSAO");
  });
});

describe("reabertura", () => {
  it("concluído volta para Em andamento, mantendo responsável e prazo", async () => {
    const t = await open({ assigneeId: ids.tech }, ids.tech);
    await changeTicketStatus(db, ids.tech, { ticketId: t.id, to: "EM_ANDAMENTO" }, { now: at(1) });
    await concludeTicket(db, ids.tech, { ticketId: t.id, solution: "Reiniciado" }, { now: at(2) });
    await expectError(reopenTicket(db, ids.tech, { ticketId: t.id, reason: " " }, { now: at(3) }), "DADOS_INVALIDOS");
    await reopenTicket(db, ids.tech, { ticketId: t.id, reason: "Problema voltou" }, { now: at(3) });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({
      status: "EM_ANDAMENTO",
      closedAt: null,
      assigneeId: ids.tech,
      dueAt: at(8),
    });
    expect((await events(t.id)).at(-1)).toMatchObject({ fromStatus: "CONCLUIDO", toStatus: "EM_ANDAMENTO", detail: "Problema voltou" });
  });

  it("não reabre após 30 dias nem PRs cancelados", async () => {
    const a = await open({ assigneeId: ids.tech }, ids.tech);
    await concludeTicket(db, ids.tech, { ticketId: a.id, solution: "Feito" }, { now: at(1) });
    await expectError(reopenTicket(db, ids.tech, { ticketId: a.id, reason: "Voltou" }, { now: at(1 + 24 * 31) }), "TRANSICAO_INVALIDA");
    const b = await open();
    await cancelTicket(db, ids.tech, { ticketId: b.id, reason: "Duplicado" }, { now: at(1) });
    await expectError(reopenTicket(db, ids.tech, { ticketId: b.id, reason: "Voltou" }, { now: at(2) }), "TRANSICAO_INVALIDA");
  });
});

describe("responsável", () => {
  it("atribuir, reatribuir e remover registram anterior, novo, quem fez e quando", async () => {
    const t = await open();
    await assignTicket(db, ids.admin, { ticketId: t.id, assigneeId: ids.tech }, { now: at(1) });
    await assignTicket(db, ids.admin, { ticketId: t.id, assigneeId: ids.tech2 }, { now: at(2) });
    await assignTicket(db, ids.tech2, { ticketId: t.id, assigneeId: null }, { now: at(3) });
    const ev = (await events(t.id)).filter((e) => e.type === "ATRIBUIDO");
    expect(ev.map((e) => [e.fromAssigneeId, e.toAssigneeId, e.actorId, e.createdAt])).toEqual([
      [null, ids.tech, ids.admin, at(1)],
      [ids.tech, ids.tech2, ids.admin, at(2)],
      [ids.tech2, null, ids.tech2, at(3)],
    ]);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ assigneeId: null, firstResponseAt: at(1) });
  });

  it("regras: mesmo responsável, solicitante como responsável, remover durante o atendimento", async () => {
    const t = await open({ assigneeId: ids.tech }, ids.tech);
    await expectError(assignTicket(db, ids.tech, { ticketId: t.id, assigneeId: ids.tech }), "SEM_ALTERACAO");
    await expectError(assignTicket(db, ids.tech, { ticketId: t.id, assigneeId: ids.requester }), "DADOS_INVALIDOS");
    await expectError(assignTicket(db, ids.requester, { ticketId: t.id, assigneeId: ids.tech2 }), "SEM_PERMISSAO");
    await changeTicketStatus(db, ids.tech, { ticketId: t.id, to: "EM_ANDAMENTO" }, { now: at(1) });
    await expectError(assignTicket(db, ids.tech, { ticketId: t.id, assigneeId: null }, { now: at(2) }), "TRANSICAO_INVALIDA");
  });
});

describe("prioridade", () => {
  it("mais urgente: prazos encurtam a partir da mudança, com prazos registrados no evento", async () => {
    const t = await open({ priorityId: ids.baixa }); // resposta +8h, resolução +72h
    await changeTicketPriority(db, ids.tech, { ticketId: t.id, priorityId: ids.critica }, { now: at(2) });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({
      priorityId: ids.critica,
      responseDueAt: at(3),
      dueAt: at(6),
      firstResponseAt: at(2),
    });
    expect((await events(t.id)).at(-1)).toMatchObject({
      type: "PRIORIDADE_ALTERADA",
      fromPriorityId: ids.baixa,
      toPriorityId: ids.critica,
      fromDueAt: at(72),
      toDueAt: at(6),
      fromResponseDueAt: at(8),
      toResponseDueAt: at(3),
    });
  });

  it("menos urgente: abertura + novo SLA; prazo de resposta já cumprido não muda", async () => {
    const t = await open({ priorityId: ids.critica, assigneeId: ids.tech }, ids.tech); // respondido na abertura
    await changeTicketPriority(db, ids.tech, { ticketId: t.id, priorityId: ids.baixa }, { now: at(3) });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ responseDueAt: at(1), dueAt: at(72) });
    await expectError(changeTicketPriority(db, ids.tech, { ticketId: t.id, priorityId: ids.baixa }), "SEM_ALTERACAO");
  });
});

describe("edição", () => {
  it("registra apenas o que mudou, com antes e depois", async () => {
    const t = await open();
    await editTicket(db, ids.tech, { ticketId: t.id, title: "Computador não liga (recepção)", categoryId: ids.software, description: t.description }, { now: at(1) });
    const ev = (await events(t.id)).at(-1)!;
    expect(ev.type).toBe("DADOS_ALTERADOS");
    expect(ev.changes).toEqual({
      titulo: { de: "Computador não liga", para: "Computador não liga (recepção)" },
      categoria: { de: { id: ids.hardware, nome: "Hardware" }, para: { id: ids.software, nome: "Software" } },
    });
    await expectError(editTicket(db, ids.tech, { ticketId: t.id, title: "Computador não liga (recepção)" }), "SEM_ALTERACAO");
  });
});

describe("comentários e primeira resposta", () => {
  it("comentário do solicitante não é primeira resposta; o do técnico é", async () => {
    const t = await open();
    await addComment(db, ids.requester, { ticketId: t.id, body: "Alguma novidade?" }, { now: at(1) });
    expect((await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).firstResponseAt).toBeNull();
    const c = await addComment(db, ids.tech, { ticketId: t.id, body: "Verificando agora." }, { now: at(2) });
    expect((await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).firstResponseAt).toEqual(at(2));
    expect(c).toMatchObject({ authorId: ids.tech, visibility: "PUBLICO", createdAt: at(2) });
    expect((await events(t.id)).filter((e) => e.type === "COMENTARIO").map((e) => e.commentId)).toContain(c.id);
  });

  it("solicitante não comenta em PR de outra pessoa; comentário vazio é rejeitado", async () => {
    const t = await open();
    await expectError(addComment(db, ids.requester2, { ticketId: t.id, body: "Oi" }), "SEM_PERMISSAO");
    await expectError(addComment(db, ids.tech, { ticketId: t.id, body: "   " }), "DADOS_INVALIDOS");
  });
});

describe("integridade", () => {
  it("alteração simultânea: a versão desatualizada é recusada", async () => {
    const t = await open();
    await assignTicket(db, ids.tech, { ticketId: t.id, assigneeId: ids.tech, expectedUpdatedAt: t.updatedAt });
    await expectError(
      changeTicketPriority(db, ids.tech2, { ticketId: t.id, priorityId: ids.baixa, expectedUpdatedAt: t.updatedAt }),
      "CONFLITO",
    );
  });

  it("falha no meio da operação desfaz tudo (PR, eventos e número)", async () => {
    const t = await open();
    // Simula uma falha do banco ao gravar o evento de status, DEPOIS de já ter
    // gravado a atribuição automática e a alteração do PR.
    await db.$executeRawUnsafe(`
      CREATE FUNCTION falha_teste() RETURNS trigger AS $$
      BEGIN
        IF NEW.tipo IN ('STATUS_ALTERADO', 'CRIADO') THEN RAISE EXCEPTION 'falha simulada'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(`CREATE TRIGGER falha_teste BEFORE INSERT ON pr_eventos FOR EACH ROW EXECUTE FUNCTION falha_teste()`);
    try {
      const before = await counts();
      await expect(changeTicketStatus(db, ids.tech, { ticketId: t.id, to: "EM_ANDAMENTO" }, { now: at(1) })).rejects.toThrow();
      await expect(open()).rejects.toThrow();
      expect(await counts()).toEqual(before);
      expect(await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ status: "ABERTO", assigneeId: null, firstResponseAt: null });
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER falha_teste ON pr_eventos`);
      await db.$executeRawUnsafe(`DROP FUNCTION falha_teste()`);
    }
    expect((await open()).number).toBe("PR-2026-0002");
  });
});

describe("integração com o Dashboard", () => {
  it("as operações aparecem nos indicadores e nas atividades", async () => {
    const a = await open({ priorityId: ids.critica, assigneeId: ids.tech }, ids.tech); // vence em +4h
    const b = await open();
    const c = await open();
    await changeTicketStatus(db, ids.tech, { ticketId: b.id, to: "EM_ANDAMENTO" }, { now: at(1) });
    await changeTicketStatus(db, ids.tech, { ticketId: c.id, to: "PENDENTE", detail: "Aguardando usuário" }, { now: at(1) });

    expect(await getStatusSnapshot(db, at(5))).toEqual({ open: 1, inProgress: 1, pending: 1, overdue: 1 });
    await concludeTicket(db, ids.tech, { ticketId: a.id, solution: "Resolvido" }, { now: at(6) });
    expect(await getStatusSnapshot(db, at(6))).toEqual({ open: 0, inProgress: 1, pending: 1, overdue: 0 });

    const activity = await getRecentActivity(db, 1);
    expect(activity[0]).toMatchObject({ kind: "concluido", actorName: "Tecnico Um", ticketNumber: a.number });
  });

  it("atraso no passado usa o prazo vigente naquela data (mudança de prioridade)", async () => {
    // Crítica (vence +4h); às +10h vira Baixa (novo prazo: +72h).
    const t = await open({ priorityId: ids.critica });
    await changeTicketPriority(db, ids.tech, { ticketId: t.id, priorityId: ids.baixa }, { now: at(10) });
    expect((await getStatusSnapshot(db, at(5))).overdue).toBe(1); // antes da mudança: prazo +4h vencido
    expect((await getStatusSnapshot(db, at(11))).overdue).toBe(0); // depois: prazo +72h
  });
});

describe("listagem de PRs", () => {
  const filters = (over: Partial<TicketListFilters> = {}): TicketListFilters => ({ sort: "abertura", direction: "desc", page: 1, ...over });

  async function scenario() {
    const a = await open({ title: "Impressora do RH sem tinta", priorityId: ids.critica, assigneeId: ids.tech }, ids.tech); // vence +4h
    const b = await open({ title: "Senha do e-mail expirada", priorityId: ids.baixa }, ids.requester, at(1)); // vence +73h
    const c = await createTicket(
      db,
      ids.tech,
      { title: "Monitor piscando", description: "O monitor pisca a cada minuto.", requesterId: ids.requester2, categoryId: ids.software, priorityId: ids.alta },
      { now: at(2) },
    ); // vence +10h
    await changeTicketStatus(db, ids.tech, { ticketId: c.id, to: "PENDENTE", detail: "Aguardando o usuário" }, { now: at(3) });
    return { a, b, c };
  }

  it("pesquisa por número, título e solicitante (sem diferenciar maiúsculas)", async () => {
    const { a, c } = await scenario();
    const now = at(3);
    expect((await listTickets(db, filters({ q: a.number }), now)).items.map((t) => t.id)).toEqual([a.id]);
    expect((await listTickets(db, filters({ q: "monitor" }), now)).items.map((t) => t.id)).toEqual([c.id]);
    expect((await listTickets(db, filters({ q: "BRUNO" }), now)).items.map((t) => t.id)).toEqual([c.id]);
  });

  it("filtros por status, responsável, categoria, setor e situação", async () => {
    const { a, b, c } = await scenario();
    const ids_ = async (f: Partial<TicketListFilters>, now = at(3)) => (await listTickets(db, filters(f), now)).items.map((t) => t.id).sort();
    expect(await ids_({ status: "PENDENTE" })).toEqual([c.id]);
    expect(await ids_({ assignee: ids.tech })).toEqual([a.id]);
    // Colocar como pendente não exige responsável: "c" continua sem ninguém.
    expect(await ids_({ assignee: "nenhum" })).toEqual([b.id, c.id].sort());
    expect(await ids_({ categoryId: ids.software })).toEqual([c.id]);
    expect(await ids_({ sectorId: ids.sectorFin })).toEqual([a.id, b.id, c.id].sort());
    expect(await ids_({ situation: "critico" })).toEqual([a.id]);
    expect(await ids_({ situation: "atrasado" }, at(5))).toEqual([a.id]);
    // Às 3h30: "a" (prazo 4h, total 4h) tem 30 min restantes = 12,5% → próximo; "c" (prazo 10h) não.
    expect(await ids_({ situation: "proximo" }, at(3.5))).toEqual([a.id]);
  });

  it("período de abertura em dias inteiros (horário de Brasília) e ordenação", async () => {
    await scenario();
    const late = await open({ title: "Aberto no dia seguinte" }, ids.requester, mar(11, 23, 30));
    const day10 = await listTickets(db, filters({ openedFrom: "2026-03-10", openedTo: "2026-03-10" }), at(48));
    expect(day10.total).toBe(3);
    const day11 = await listTickets(db, filters({ openedFrom: "2026-03-11" }), at(48));
    expect(day11.items.map((t) => t.id)).toEqual([late.id]);

    const byDue = await listTickets(db, filters({ sort: "prazo", direction: "asc" }), at(3));
    const dues = byDue.items.map((t) => t.dueAt.getTime());
    expect(dues).toEqual([...dues].sort((x, y) => x - y));
    const byPriority = await listTickets(db, filters({ sort: "prioridade", direction: "asc" }), at(3));
    expect(byPriority.items[0].priority.name).toBe("Crítica");
  });

  it("paginação: 20 por página e página além do fim volta para a última", async () => {
    await Promise.all(Array.from({ length: 23 }, () => open()));
    const p1 = await listTickets(db, filters(), at(1));
    expect(p1).toMatchObject({ total: 23, pageCount: 2, page: 1 });
    expect(p1.items).toHaveLength(20);
    const p9 = await listTickets(db, filters({ page: 9 }), at(1));
    expect(p9).toMatchObject({ page: 2 });
    expect(p9.items).toHaveLength(3);
  });

  it("indicadores da listagem batem com o Dashboard", async () => {
    await scenario();
    for (const now of [at(3), at(5), at(80)]) {
      const summary = await getTicketSummary(db, now);
      const dash = await getStatusSnapshot(db, now);
      expect({ open: summary.open, inProgress: summary.inProgress, pending: summary.pending, overdue: summary.overdue }).toEqual(dash);
      expect((await listTickets(db, filters({ situation: "atrasado" }), now)).total).toBe(dash.overdue);
    }
  });
});
