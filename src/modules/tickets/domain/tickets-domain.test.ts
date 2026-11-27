import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canBeAssignee,
  canReopen,
  canTransition,
  formatTicketNumber,
  isFirstResponse,
  requiresAssignee,
  requiresDetail,
  ticketNumberYear,
} from "./rules";
import { createTicketSchema } from "./schemas";
import { deadlinesAtOpening, deadlinesOnPriorityChange, isOverdue, resolutionSlaState, responseSlaState } from "./sla";

const H = 60 * 60_000;
const CRITICA = { level: 1, responseSlaMinutes: 60, resolutionSlaMinutes: 240 };
const ALTA = { level: 2, responseSlaMinutes: 120, resolutionSlaMinutes: 480 };
const BAIXA = { level: 4, responseSlaMinutes: 480, resolutionSlaMinutes: 4320 };
const T0 = new Date("2026-03-10T12:00:00Z");
const at = (hours: number) => new Date(T0.getTime() + hours * H);

describe("número do PR", () => {
  it("formato PR-AAAA-NNNN", () => {
    expect(formatTicketNumber(2026, 7)).toBe("PR-2026-0007");
    expect(formatTicketNumber(2026, 12345)).toBe("PR-2026-12345");
  });

  it("o ano segue o horário de Brasília (31/12 às 22h ainda é o ano anterior)", () => {
    expect(ticketNumberYear(new Date("2027-01-01T01:00:00Z"))).toBe(2026);
    expect(ticketNumberYear(new Date("2027-01-01T03:00:00Z"))).toBe(2027);
  });
});

describe("prazos (SLA)", () => {
  it("na abertura: abertura + SLA da prioridade", () => {
    expect(deadlinesAtOpening(T0, ALTA)).toEqual({ responseDueAt: at(2), dueAt: at(8) });
  });

  it("ficando mais urgente: o menor entre o prazo atual e agora + novo SLA", () => {
    const ticket = { openedAt: T0, ...deadlinesAtOpening(T0, BAIXA) }; // resp +8h, resolução +72h
    // Muda para Crítica 2h depois: resposta = min(+8h, +2h+1h) = +3h; resolução = min(+72h, +2h+4h) = +6h
    expect(deadlinesOnPriorityChange(ticket, BAIXA, CRITICA, at(2))).toEqual({ responseDueAt: at(3), dueAt: at(6) });
    // Muda para Crítica 70h depois: o prazo atual (+72h) já é menor que +74h; nunca estende
    expect(deadlinesOnPriorityChange(ticket, BAIXA, CRITICA, at(70)).dueAt).toEqual(at(72));
  });

  it("ficando menos urgente: abertura + novo SLA (o tempo gasto continua contando)", () => {
    const ticket = { openedAt: T0, ...deadlinesAtOpening(T0, CRITICA) };
    expect(deadlinesOnPriorityChange(ticket, CRITICA, BAIXA, at(30))).toEqual({ responseDueAt: at(8), dueAt: at(72) });
  });

  it("atrasado só vale para PRs em atendimento", () => {
    expect(isOverdue("EM_ANDAMENTO", at(1), at(2))).toBe(true);
    expect(isOverdue("PENDENTE", at(3), at(2))).toBe(false);
    expect(isOverdue("CONCLUIDO", at(1), at(2))).toBe(false);
    expect(isOverdue("CANCELADO", at(1), at(2))).toBe(false);
  });

  it("situação: no prazo, próximo (últimos 25%), atrasado, concluído", () => {
    const t = { status: "EM_ANDAMENTO" as const, openedAt: T0, dueAt: at(4), closedAt: null };
    expect(resolutionSlaState(t, at(2))).toEqual({ kind: "no_prazo", remainingMinutes: 120 });
    expect(resolutionSlaState(t, at(3))).toEqual({ kind: "proximo", remainingMinutes: 60 });
    expect(resolutionSlaState(t, at(5))).toEqual({ kind: "atrasado", overdueMinutes: 60 });
    expect(resolutionSlaState({ ...t, status: "CONCLUIDO", closedAt: at(3) }, at(9))).toEqual({ kind: "concluido_no_prazo" });
    expect(resolutionSlaState({ ...t, status: "CONCLUIDO", closedAt: at(6) }, at(9))).toEqual({
      kind: "concluido_com_atraso",
      overdueMinutes: 120,
    });
    expect(resolutionSlaState({ ...t, status: "CANCELADO", closedAt: at(6) }, at(9))).toEqual({ kind: "cancelado" });
  });

  it("primeira resposta: aguardando, vencida, respondida no prazo ou com atraso", () => {
    const t = { openedAt: T0, responseDueAt: at(1), firstResponseAt: null };
    expect(responseSlaState(t, at(0.5))).toEqual({ kind: "aguardando", remainingMinutes: 30 });
    expect(responseSlaState(t, at(2))).toEqual({ kind: "vencido", overdueMinutes: 60 });
    expect(responseSlaState({ ...t, firstResponseAt: at(0.25) }, at(9))).toEqual({ kind: "respondido_no_prazo", minutes: 15 });
    expect(responseSlaState({ ...t, firstResponseAt: at(1.5) }, at(9))).toEqual({
      kind: "respondido_com_atraso",
      minutes: 90,
      overdueMinutes: 30,
    });
  });
});

describe("ciclo de vida", () => {
  it("transições permitidas", () => {
    expect(allowedTransitions("ABERTO")).toEqual(["EM_ANDAMENTO", "PENDENTE", "CONCLUIDO", "CANCELADO"]);
    expect(canTransition("PENDENTE", "EM_ANDAMENTO")).toBe(true);
    expect(canTransition("EM_ANDAMENTO", "ABERTO")).toBe(false);
    expect(canTransition("CONCLUIDO", "EM_ANDAMENTO")).toBe(false);
    expect(canTransition("CANCELADO", "ABERTO")).toBe(false);
  });

  it("exigências de cada status", () => {
    expect(["PENDENTE", "CONCLUIDO", "CANCELADO"].every((s) => requiresDetail(s as never))).toBe(true);
    expect(requiresDetail("EM_ANDAMENTO")).toBe(false);
    expect(requiresAssignee("EM_ANDAMENTO")).toBe(true);
    expect(requiresAssignee("CONCLUIDO")).toBe(true);
    expect(requiresAssignee("CANCELADO")).toBe(false);
  });

  it("reabertura: só concluídos, até 30 dias", () => {
    const closedAt = T0;
    expect(canReopen({ status: "CONCLUIDO", closedAt }, at(24 * 30))).toBe(true);
    expect(canReopen({ status: "CONCLUIDO", closedAt }, at(24 * 30 + 1))).toBe(false);
    expect(canReopen({ status: "CANCELADO", closedAt }, at(1))).toBe(false);
  });

  it("responsável: só técnico ou admin ativo", () => {
    expect(canBeAssignee({ role: "TECNICO", active: true })).toBe(true);
    expect(canBeAssignee({ role: "ADMIN", active: true })).toBe(true);
    expect(canBeAssignee({ role: "SOLICITANTE", active: true })).toBe(false);
    expect(canBeAssignee({ role: "TECNICO", active: false })).toBe(false);
  });

  it("primeira resposta: a primeira ação de quem não é o solicitante", () => {
    expect(isFirstResponse({ firstResponseAt: null, requesterId: 1 }, 2)).toBe(true);
    expect(isFirstResponse({ firstResponseAt: null, requesterId: 1 }, 1)).toBe(false);
    expect(isFirstResponse({ firstResponseAt: T0, requesterId: 1 }, 2)).toBe(false);
  });
});

describe("validação da abertura", () => {
  const valid = { title: "Impressora sem tinta", description: "A impressora do 2º andar não imprime.", requesterId: 1, categoryId: 2, priorityId: 3 };

  it("aceita dados válidos e remove espaços extras", () => {
    const r = createTicketSchema.safeParse({ ...valid, title: "  Impressora sem tinta  " });
    expect(r.success && r.data.title).toBe("Impressora sem tinta");
  });

  it("rejeita campos obrigatórios ausentes ou curtos", () => {
    expect(createTicketSchema.safeParse({ ...valid, title: "   " }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...valid, description: "curta" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...valid, requesterId: undefined }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...valid, priorityId: 0 }).success).toBe(false);
  });
});
