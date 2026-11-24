// Testes de integração das consultas do Dashboard, no banco de TESTES.
//
// CENÁRIO (março/2026, horário de Brasília). "Agora" = qua 18/03 12:00.
// Filtro "últimos 7 dias": atual = 12/03 00:00 → 18/03 12:00
//                          anterior = 05/03 00:00 → 11/03 12:00
// Prioridades: Crítica (prazo de resolução 4h) e Média (24h).
// Setores: Financeiro (solicitante Rita) e Comercial (solicitante Rui).
// Técnicos: Ana, Bruno e Carla (Carla não tem PRs).
//
//  PR  aberto      prio     cat       setor       histórico
//  T1  06 09:00    Média    Hardware  Financeiro  Ana assume 10:00 → andamento → concluído 06 15:00 (no prazo)
//  T2  09 10:00    Crítica  Rede      Comercial   Bruno assume 10:30 → andamento → concluído 13 10:00 (atrasado)
//  T8  10 08:00    Média    Hardware  Comercial   Ana assume 12 08:00 → andamento → concluído 14 08:00 (atrasado)
//  T3  12 09:00    Média    Hardware  Financeiro  Ana assume 09:20 → andamento → concluído 12 17:00 (no prazo)
//  T4  16 14:00    Média    Rede      Financeiro  Bruno assume 14:40 → andamento → pendente (prazo 17 14:00: ATRASADO)
//  T6  17 10:00    Média    Rede      Comercial   Ana assume 10:15 → cancelado 11:00
//  T5  18 07:00    Crítica  Hardware  Comercial   ninguém atendeu (prazo 18 11:00: ATRASADO, CRÍTICO)
//  T7  18 09:00    Média    Hardware  Comercial   Ana assume 09:30 → andamento 09:40 → comentário 10:00
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  elapsedTime,
  getAssigneeReport,
  getIndicatorCards,
  getOverdueAlerts,
  getPerformance,
  getRecentActivity,
  getResolutionTimes,
  getSectorReport,
  getStatusSnapshot,
  getVolumeSeries,
  resolvePeriod,
} from "@/modules/dashboard";
import { createTestDb, createTicket, mar, resetDatabase } from "../helpers/scenario";

const NOW = mar(18, 12);
const range7d = resolvePeriod({ periodo: "7d" }, NOW);
let db: PrismaClient;

beforeAll(async () => {
  db = createTestDb();
  await resetDatabase(db);

  const critica = await db.priority.create({
    data: { name: "Crítica", level: 1, color: "#EF4444", responseSlaMinutes: 60, resolutionSlaMinutes: 240 },
  });
  const media = await db.priority.create({
    data: { name: "Média", level: 3, color: "#3B82F6", responseSlaMinutes: 240, resolutionSlaMinutes: 1440 },
  });
  const hardware = await db.category.create({ data: { name: "Hardware" } });
  const rede = await db.category.create({ data: { name: "Rede" } });
  const financeiro = await db.sector.create({ data: { name: "Financeiro" } });
  const comercial = await db.sector.create({ data: { name: "Comercial" } });
  const ti = await db.sector.create({ data: { name: "TI" } });
  const user = (name: string, role: "TECNICO" | "SOLICITANTE", sectorId: number) =>
    db.user.create({ data: { name, email: `${name.toLowerCase()}@teste.local`, role, sectorId } });
  const ana = await user("Ana", "TECNICO", ti.id);
  const bruno = await user("Bruno", "TECNICO", ti.id);
  await user("Carla", "TECNICO", ti.id);
  const rita = await user("Rita", "SOLICITANTE", financeiro.id);
  const rui = await user("Rui", "SOLICITANTE", comercial.id);

  const M = { priorityId: media.id, resolutionSlaMinutes: 1440 };
  const C = { priorityId: critica.id, resolutionSlaMinutes: 240 };
  const fromRita = { requesterId: rita.id, sectorId: financeiro.id };
  const fromRui = { requesterId: rui.id, sectorId: comercial.id };

  await createTicket(db, { number: "T1", openedAt: mar(6, 9), ...M, categoryId: hardware.id, ...fromRita, events: [
    { at: mar(6, 10), by: ana.id, assign: ana.id },
    { at: mar(6, 10, 10), by: ana.id, status: "EM_ANDAMENTO" },
    { at: mar(6, 15), by: ana.id, status: "CONCLUIDO" },
  ] });
  await createTicket(db, { number: "T2", openedAt: mar(9, 10), ...C, categoryId: rede.id, ...fromRui, events: [
    { at: mar(9, 10, 30), by: bruno.id, assign: bruno.id },
    { at: mar(9, 10, 40), by: bruno.id, status: "EM_ANDAMENTO" },
    { at: mar(13, 10), by: bruno.id, status: "CONCLUIDO" },
  ] });
  await createTicket(db, { number: "T8", openedAt: mar(10, 8), ...M, categoryId: hardware.id, ...fromRui, events: [
    { at: mar(12, 8), by: ana.id, assign: ana.id },
    { at: mar(12, 8, 10), by: ana.id, status: "EM_ANDAMENTO" },
    { at: mar(14, 8), by: ana.id, status: "CONCLUIDO" },
  ] });
  await createTicket(db, { number: "T3", openedAt: mar(12, 9), ...M, categoryId: hardware.id, ...fromRita, events: [
    { at: mar(12, 9, 20), by: ana.id, assign: ana.id },
    { at: mar(12, 9, 30), by: ana.id, status: "EM_ANDAMENTO" },
    { at: mar(12, 17), by: ana.id, status: "CONCLUIDO" },
  ] });
  await createTicket(db, { number: "T4", openedAt: mar(16, 14), ...M, categoryId: rede.id, ...fromRita, events: [
    { at: mar(16, 14, 40), by: bruno.id, assign: bruno.id },
    { at: mar(16, 15), by: bruno.id, status: "EM_ANDAMENTO" },
    { at: mar(16, 16), by: bruno.id, status: "PENDENTE" },
  ] });
  await createTicket(db, { number: "T6", openedAt: mar(17, 10), ...M, categoryId: rede.id, ...fromRui, events: [
    { at: mar(17, 10, 15), by: ana.id, assign: ana.id },
    { at: mar(17, 11), by: ana.id, status: "CANCELADO" },
  ] });
  await createTicket(db, { number: "T5", openedAt: mar(18, 7), ...C, categoryId: hardware.id, ...fromRui, events: [] });
  await createTicket(db, { number: "T7", openedAt: mar(18, 9), ...M, categoryId: hardware.id, ...fromRui, events: [
    { at: mar(18, 9, 30), by: ana.id, assign: ana.id },
    { at: mar(18, 9, 40), by: ana.id, status: "EM_ANDAMENTO" },
    { at: mar(18, 10), by: ana.id, comment: "Cabo de rede substituído, aguardando teste." },
  ] });
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("situação em um instante (reconstruída pelo histórico)", () => {
  it("agora", async () => {
    expect(await getStatusSnapshot(db, NOW)).toEqual({ open: 1, inProgress: 1, pending: 1, overdue: 2 });
  });
  it("no fim do período anterior (11/03 12:00)", async () => {
    // T1 concluído; T2 em andamento e atrasado; T8 aberto (só foi assumido dia 12) e atrasado.
    expect(await getStatusSnapshot(db, mar(11, 12))).toEqual({ open: 1, inProgress: 1, pending: 0, overdue: 2 });
  });
});

describe("indicadores principais", () => {
  it("compara o período atual com o anterior", async () => {
    const cards = await getIndicatorCards(db, range7d);
    expect(cards.hasComparison).toBe(true);
    expect(cards.registered).toMatchObject({ current: 5, previous: 3, delta: 2 });
    expect(cards.registered.deltaPercent).toBeCloseTo(66.667, 2);
    expect(cards.open).toMatchObject({ current: 1, previous: 1, delta: 0 });
    expect(cards.inProgress).toMatchObject({ current: 1, previous: 1 });
    expect(cards.pending).toEqual({ current: 1, previous: 0, delta: 1, deltaPercent: null });
    expect(cards.overdue).toMatchObject({ current: 2, previous: 2 });
    expect(cards.concluded).toEqual({ current: 3, previous: 1, delta: 2, deltaPercent: 200 });
  });

  it("sem PRs antes do período, não há comparação", async () => {
    const r = resolvePeriod({ periodo: "personalizado", de: "2026-03-01", ate: "2026-03-07" }, NOW);
    const cards = await getIndicatorCards(db, r);
    expect(cards.hasComparison).toBe(false);
    expect(cards.registered).toEqual({ current: 1, previous: null, delta: null, deltaPercent: null });
  });

  it("período personalizado no passado usa a situação do fim daquele período", async () => {
    const r = resolvePeriod({ periodo: "personalizado", de: "2026-03-05", ate: "2026-03-11" }, NOW);
    const cards = await getIndicatorCards(db, r);
    // Fim = 12/03 00:00: T2 em andamento e atrasado; T8 aberto e atrasado.
    expect(cards.open.current).toBe(1);
    expect(cards.inProgress.current).toBe(1);
    expect(cards.overdue.current).toBe(2);
    expect(cards.concluded.current).toBe(1); // T1
  });
});

describe("desempenho", () => {
  it("tempos médios, conclusões, prazo e percentual concluído", async () => {
    const p = await getPerformance(db, range7d, elapsedTime);
    // Primeira resposta: T3 20, T4 40, T6 15, T7 30 → média 26,25 min; T5 aguarda.
    expect(p.firstResponse).toMatchObject({ responded: 4, waiting: 1, avgMinutes: 26.25 });
    // Anterior: T1 60, T2 30 → 45 min; T8 só foi atendido depois do fim do período anterior.
    expect(p.firstResponse.previousAvgMinutes).toBe(45);
    // Resolução: T3 480, T2 5760, T8 5760 → média 4000 min; 1 no prazo, 2 atrasados.
    expect(p.resolution).toMatchObject({ count: 3, avgResolutionMinutes: 4000, onTime: 1, late: 2 });
    expect(p.resolution.onTimePercent).toBeCloseTo(33.333, 2);
    expect(p.resolution.previousAvgMinutes).toBe(360); // T1
    expect(p.concluded).toMatchObject({ current: 3, previous: 1 });
    // Abertos no período: T3..T7; T6 cancelado não conta; concluído só T3 → 1 de 4.
    expect(p.completion).toEqual({ concluded: 1, considered: 4, percent: 25 });
  });

  it("tempo médio de resolução por categoria e por responsável", async () => {
    const t = await getResolutionTimes(db, range7d, elapsedTime);
    expect(t.byCategory).toEqual([
      { id: expect.any(Number), name: "Hardware", count: 2, avgMinutes: 3120, onTime: 1, late: 1 },
      { id: expect.any(Number), name: "Rede", count: 1, avgMinutes: 5760, onTime: 0, late: 1 },
    ]);
    expect(t.byAssignee.map((g) => [g.name, g.count, g.avgMinutes])).toEqual([
      ["Ana", 2, 3120],
      ["Bruno", 1, 5760],
    ]);
  });
});

describe("chamados por responsável", () => {
  it("carteira, atribuições, conclusões e técnicos sem PRs", async () => {
    const r = await getAssigneeReport(db, range7d, elapsedTime);
    const byName = Object.fromEntries(r.assignees.map((a) => [a.name, a]));
    expect(byName.Ana).toMatchObject({
      assigned: 4, // T8, T3, T6, T7 (atribuições dentro do período)
      open: 0,
      inProgress: 1, // T7
      pending: 0,
      overdue: 0,
      concluded: 2, // T3, T8
      avgResolutionMinutes: 3120,
      onTimePercent: 50,
    });
    expect(byName.Bruno).toMatchObject({
      assigned: 1, // T4 (T2 foi atribuído no período anterior)
      pending: 1,
      overdue: 1,
      concluded: 1, // T2
      avgResolutionMinutes: 5760,
      onTimePercent: 0,
    });
    expect(byName.Carla).toMatchObject({ assigned: 0, concluded: 0, avgResolutionMinutes: null, onTimePercent: null });
    expect(r.unassigned).toEqual({ open: 1, overdue: 1 }); // T5
  });
});

describe("chamados por setor", () => {
  it("volume, participação e comparação, do maior para o menor", async () => {
    const r = await getSectorReport(db, range7d);
    expect(r.total).toBe(5);
    expect(r.sectors.map((s) => [s.name, s.count.current, s.count.previous, s.percent])).toEqual([
      ["Comercial", 3, 2, 60],
      ["Financeiro", 2, 1, 40],
    ]);
  });
});

describe("alertas de atraso", () => {
  it("lista os atrasados, críticos primeiro, com o tempo de atraso", async () => {
    const a = await getOverdueAlerts(db, NOW);
    expect(a.total).toBe(2);
    expect(a.critical).toBe(1);
    expect(a.items.map((i) => [i.number, i.critical, i.overdueMinutes, i.requesterName, i.assigneeName])).toEqual([
      ["T5", true, 60, "Rui", null],
      ["T4", false, 1320, "Rita", "Bruno"],
    ]);
    expect(a.items[0].priority).toEqual({ name: "Crítica", level: 1, color: "#EF4444" });
  });

  it("respeita o limite, mas informa o total", async () => {
    const a = await getOverdueAlerts(db, NOW, 1);
    expect(a.items).toHaveLength(1);
    expect(a.total).toBe(2);
  });
});

describe("atividades recentes", () => {
  it("mais recentes primeiro, com descrição e trecho do comentário", async () => {
    const list = await getRecentActivity(db, 3);
    expect(list.map((a) => [a.kind, a.actorName, a.action])).toEqual([
      ["comentario", "Ana", "comentou no T7"],
      ["status", "Ana", "alterou o status do T7 de Aberto para Em andamento"],
      ["atribuido", "Ana", "assumiu o T7"],
    ]);
    expect(list[0].excerpt).toBe("Cabo de rede substituído, aguardando teste.");
    expect(list[0].createdAt.toISOString()).toBe(mar(18, 10).toISOString());
  });
});

describe("volume de PRs", () => {
  it("por dia: série contínua com zeros", async () => {
    const s = await getVolumeSeries(db, range7d.current, "dia");
    expect(s).toEqual([
      { bucket: "2026-03-12", opened: 1, concluded: 1 },
      { bucket: "2026-03-13", opened: 0, concluded: 1 },
      { bucket: "2026-03-14", opened: 0, concluded: 1 },
      { bucket: "2026-03-15", opened: 0, concluded: 0 },
      { bucket: "2026-03-16", opened: 1, concluded: 0 },
      { bucket: "2026-03-17", opened: 1, concluded: 0 },
      { bucket: "2026-03-18", opened: 2, concluded: 0 },
    ]);
  });

  it("por semana (segunda a domingo) e por mês", async () => {
    expect(await getVolumeSeries(db, range7d.current, "semana")).toEqual([
      { bucket: "2026-03-09", opened: 1, concluded: 3 },
      { bucket: "2026-03-16", opened: 4, concluded: 0 },
    ]);
    expect(await getVolumeSeries(db, range7d.current, "mes")).toEqual([
      { bucket: "2026-03-01", opened: 5, concluded: 3 },
    ]);
  });
});
