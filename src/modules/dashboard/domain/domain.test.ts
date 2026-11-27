import { describe, expect, it } from "vitest";
import { describeActivity, type ActivityEvent } from "./activity";
import { sortAssignees, type AssigneeStats } from "./assignees";
import { compare } from "./comparison";
import { elapsedTime, getDurationCalculator } from "./duration";
import { summarizeFirstResponse, summarizeResolution, type ConclusionRow } from "./summaries";

const t = (iso: string) => new Date(iso);

describe("compare", () => {
  it("calcula diferença e variação percentual", () => {
    expect(compare(15, 10)).toEqual({ current: 15, previous: 10, delta: 5, deltaPercent: 50 });
    expect(compare(5, 10)).toEqual({ current: 5, previous: 10, delta: -5, deltaPercent: -50 });
  });
  it("sem período anterior com dados, não compara", () => {
    expect(compare(7, null)).toEqual({ current: 7, previous: null, delta: null, deltaPercent: null });
  });
  it("anterior zero: diferença existe, percentual é indefinido", () => {
    expect(compare(3, 0)).toEqual({ current: 3, previous: 0, delta: 3, deltaPercent: null });
  });
});

describe("duração", () => {
  it("tempo corrido em minutos, nunca negativo", () => {
    expect(elapsedTime.minutesBetween(t("2026-03-01T10:00:00Z"), t("2026-03-01T12:30:00Z"))).toBe(150);
    expect(elapsedTime.minutesBetween(t("2026-03-01T12:00:00Z"), t("2026-03-01T10:00:00Z"))).toBe(0);
  });
  it("tempo útil ainda não está disponível", () => {
    expect(getDurationCalculator("corrido")).toBe(elapsedTime);
    expect(getDurationCalculator("util")).toBeNull();
  });
});

describe("summarizeResolution", () => {
  const row = (over: Partial<ConclusionRow>): ConclusionRow => ({
    ticketId: 1,
    openedAt: t("2026-03-01T10:00:00Z"),
    firstResponseAt: null,
    concludedAt: t("2026-03-01T12:00:00Z"),
    dueAt: t("2026-03-01T14:00:00Z"),
    categoryId: 1,
    categoryName: "Hardware",
    assigneeId: 10,
    assigneeName: "Ana",
    ...over,
  });

  it("média, prazo e agrupamentos", () => {
    const rows = [
      row({ ticketId: 1 }), // 120 min, no prazo
      row({ ticketId: 2, concludedAt: t("2026-03-01T14:00:00Z") }), // 240 min, exatamente no prazo
      row({ ticketId: 3, concludedAt: t("2026-03-01T16:00:00Z"), categoryId: 2, categoryName: "Rede", assigneeId: null, assigneeName: null }), // 360, atrasado
    ];
    const s = summarizeResolution(rows, elapsedTime);
    expect(s.count).toBe(3);
    expect(s.avgResolutionMinutes).toBe(240);
    expect(s.onTime).toBe(2);
    expect(s.late).toBe(1);
    expect(s.onTimePercent).toBeCloseTo(66.667, 2);
    expect(s.byCategory).toEqual([
      { id: 1, name: "Hardware", count: 2, avgMinutes: 180, onTime: 2, late: 0 },
      { id: 2, name: "Rede", count: 1, avgMinutes: 360, onTime: 0, late: 1 },
    ]);
    expect(s.byAssignee.map((g) => [g.name, g.count])).toEqual([
      ["Ana", 2],
      ["Sem responsável", 1],
    ]);
  });

  it("sem conclusões: valores vazios, não zero", () => {
    const s = summarizeResolution([], elapsedTime);
    expect(s).toMatchObject({ count: 0, avgResolutionMinutes: null, onTimePercent: null, byCategory: [] });
  });
});

describe("summarizeFirstResponse", () => {
  it("ignora respostas posteriores ao fim do período e conta quem aguarda", () => {
    const until = t("2026-03-02T00:00:00Z");
    const s = summarizeFirstResponse(
      [
        { openedAt: t("2026-03-01T10:00:00Z"), firstResponseAt: t("2026-03-01T10:30:00Z") }, // 30
        { openedAt: t("2026-03-01T11:00:00Z"), firstResponseAt: t("2026-03-01T12:30:00Z") }, // 90
        { openedAt: t("2026-03-01T20:00:00Z"), firstResponseAt: t("2026-03-02T09:00:00Z") }, // depois do fim
        { openedAt: t("2026-03-01T21:00:00Z"), firstResponseAt: null },
      ],
      until,
      elapsedTime,
    );
    expect(s).toEqual({ mode: "corrido", responded: 2, waiting: 2, avgMinutes: 60 });
  });
});

describe("sortAssignees", () => {
  const a = (name: string, over: Partial<AssigneeStats>): AssigneeStats => ({
    userId: name.length,
    name,
    assigned: 0,
    open: 0,
    inProgress: 0,
    pending: 0,
    overdue: 0,
    concluded: 0,
    avgResolutionMinutes: null,
    onTimePercent: null,
    ...over,
  });
  const list = [
    a("Carla", { concluded: 5, avgResolutionMinutes: 300, overdue: 1 }),
    a("Bruno", { concluded: 9, avgResolutionMinutes: 120, overdue: 0 }),
    a("Ana", { concluded: 5, avgResolutionMinutes: null, overdue: 3 }),
  ];
  const names = (l: AssigneeStats[]) => l.map((x) => x.name);

  it("quantidade: maior primeiro, empate por nome", () => {
    expect(names(sortAssignees(list, "concluded"))).toEqual(["Bruno", "Ana", "Carla"]);
  });
  it("tempo médio: mais rápido primeiro e sem dado por último", () => {
    expect(names(sortAssignees(list, "avgResolution"))).toEqual(["Bruno", "Carla", "Ana"]);
    expect(names(sortAssignees(list, "avgResolution", "desc"))).toEqual(["Carla", "Bruno", "Ana"]);
  });
  it("não altera a lista original", () => {
    sortAssignees(list, "overdue");
    expect(names(list)).toEqual(["Carla", "Bruno", "Ana"]);
  });
});

describe("describeActivity", () => {
  const ev = (over: Partial<ActivityEvent>): ActivityEvent => ({
    id: 1,
    type: "CRIADO",
    createdAt: t("2026-03-01T10:00:00Z"),
    ticketId: 1,
    ticketNumber: "PR-2026-0001",
    actorId: 5,
    actorName: "Ana",
    fromStatus: null,
    toStatus: "ABERTO",
    fromPriorityName: null,
    toPriorityName: null,
    fromAssigneeName: null,
    toAssigneeId: null,
    toAssigneeName: null,
    commentExcerpt: null,
    ...over,
  });
  const action = (over: Partial<ActivityEvent>) => describeActivity(ev(over)).action;

  it("descreve cada tipo de evento", () => {
    expect(action({})).toBe("abriu o PR-2026-0001");
    expect(action({ type: "ATRIBUIDO", toAssigneeId: 5, toAssigneeName: "Ana" })).toBe("assumiu o PR-2026-0001");
    expect(action({ type: "ATRIBUIDO", toAssigneeId: 7, toAssigneeName: "Bruno" })).toBe("atribuiu o PR-2026-0001 a Bruno");
    expect(action({ type: "ATRIBUIDO", toAssigneeId: null })).toBe("removeu o responsável do PR-2026-0001");
    expect(action({ type: "PRIORIDADE_ALTERADA", fromPriorityName: "Média", toPriorityName: "Alta" })).toBe(
      "alterou a prioridade do PR-2026-0001 de Média para Alta",
    );
    expect(action({ type: "STATUS_ALTERADO", fromStatus: "ABERTO", toStatus: "EM_ANDAMENTO" })).toBe(
      "alterou o status do PR-2026-0001 de Aberto para Em andamento",
    );
    expect(action({ type: "STATUS_ALTERADO", fromStatus: "EM_ANDAMENTO", toStatus: "CONCLUIDO" })).toBe("concluiu o PR-2026-0001");
    expect(action({ type: "STATUS_ALTERADO", fromStatus: "ABERTO", toStatus: "CANCELADO" })).toBe("cancelou o PR-2026-0001");
    expect(action({ type: "STATUS_ALTERADO", fromStatus: "CONCLUIDO", toStatus: "EM_ANDAMENTO" })).toBe("reabriu o PR-2026-0001");
  });

  it("comentário traz o trecho do texto", () => {
    const a = describeActivity(ev({ type: "COMENTARIO", commentExcerpt: "Trocado o cabo." }));
    expect(a).toMatchObject({ kind: "comentario", action: "comentou no PR-2026-0001", excerpt: "Trocado o cabo." });
    expect(describeActivity(ev({ type: "DADOS_ALTERADOS" }))).toMatchObject({
      kind: "editado",
      action: "editou as informações do PR-2026-0001",
    });
  });
});
