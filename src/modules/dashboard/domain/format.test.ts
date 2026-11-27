import { describe, expect, it } from "vitest";
import { compare } from "./comparison";
import {
  bucketEnd,
  bucketTick,
  bucketTitle,
  describeComparison,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatRelative,
  formatSignedPercent,
  formatWindow,
  toIsoDate,
} from "./format";

describe("formatSignedPercent", () => {
  it("usa sinal e uma casa decimal abaixo de 10%", () => {
    expect(formatSignedPercent(12.4)).toBe("+12%");
    expect(formatSignedPercent(-3.46)).toBe("−3,5%");
    expect(formatSignedPercent(5)).toBe("+5%");
    expect(formatSignedPercent(0.01)).toBe("0%");
  });
});

describe("datas no horário de Brasília", () => {
  it("23:30 de Brasília ainda é o mesmo dia (02:30 UTC do dia seguinte)", () => {
    expect(toIsoDate(new Date("2026-03-11T02:30:00Z"))).toBe("2026-03-10");
  });

  it("descreve a janela pelo primeiro e último dia (fim exclusivo)", () => {
    const window = { start: new Date("2026-03-01T03:00:00Z"), end: new Date("2026-03-08T03:00:00Z") };
    expect(formatWindow(window)).toBe("01/03/2026 a 07/03/2026");
  });
});

describe("describeComparison", () => {
  it("sem período anterior", () => {
    expect(describeComparison(compare(5, null), "neutral")).toMatchObject({ direction: "none", change: "" });
  });

  it("alta em indicador onde menos é melhor fica negativa", () => {
    expect(describeComparison(compare(12, 10), "lower-is-better")).toMatchObject({
      direction: "up",
      tone: "bad",
      change: "+20%",
      detail: "antes: 10",
    });
  });

  it("anterior zero mostra a diferença absoluta", () => {
    expect(describeComparison(compare(3, 0), "higher-is-better")).toMatchObject({ change: "+3", tone: "good" });
  });

  it("sem variação", () => {
    expect(describeComparison(compare(4, 4), "higher-is-better")).toMatchObject({ direction: "flat", tone: "neutral" });
  });
});

describe("rótulos do gráfico de volume", () => {
  const period = { first: "2026-03-05", last: "2026-03-18" };

  it("fim de semana e de mês (inclui fevereiro)", () => {
    expect(bucketEnd("2026-03-02", "semana")).toBe("2026-03-08");
    expect(bucketEnd("2026-02-01", "mes")).toBe("2026-02-28");
  });

  it("rótulos curtos", () => {
    expect(bucketTick("2026-03-02", "semana")).toBe("02/03");
    expect(bucketTick("2026-11-01", "mes")).toBe("nov/26");
  });

  it("dia com dia da semana", () => {
    expect(bucketTitle("2026-03-18", "dia", period)).toEqual({ title: "qua. 18/03/2026", partial: false });
  });

  it("semana cortada pelo início e pelo fim do período", () => {
    expect(bucketTitle("2026-03-02", "semana", period)).toEqual({ title: "Semana de 05/03 a 08/03/2026", partial: true });
    expect(bucketTitle("2026-03-09", "semana", period)).toEqual({ title: "Semana de 09/03 a 15/03/2026", partial: false });
    expect(bucketTitle("2026-03-16", "semana", period)).toEqual({ title: "Semana de 16/03 a 18/03/2026", partial: true });
  });

  it("mês parcial informa os dias", () => {
    expect(bucketTitle("2026-03-01", "mes", period)).toEqual({ title: "março de 2026 (05/03 a 18/03)", partial: true });
    expect(bucketTitle("2026-03-01", "mes", { first: "2026-01-01", last: "2026-12-31" }).title).toBe("março de 2026");
  });
});

describe("durações e percentuais", () => {
  it("formatDuration", () => {
    expect(formatDuration(0.4)).toBe("< 1 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(125)).toBe("2h 05min");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(26.25)).toBe("26 min");
    expect(formatDuration(24 * 60)).toBe("1d");
    expect(formatDuration(3 * 24 * 60 + 4 * 60 + 10)).toBe("3d 4h");
  });

  it("formatPercent", () => {
    expect(formatPercent(87.4)).toBe("87%");
    expect(formatPercent(8.46)).toBe("8,5%");
    expect(formatPercent(100)).toBe("100%");
  });

  it("comparação de tempos usa o formato informado", () => {
    expect(describeComparison(compare(90, 120), "lower-is-better", formatDuration)).toMatchObject({
      change: "−25%",
      tone: "good",
      detail: "antes: 2h",
    });
  });
});

describe("data e hora", () => {
  it("formatDateTime no horário de Brasília", () => {
    expect(formatDateTime(new Date("2026-11-24T17:05:00Z"))).toBe("24/11/2026 14:05");
    expect(formatDateTime(new Date("2026-11-25T02:30:00Z"))).toBe("24/11/2026 23:30");
  });

  it("formatRelative", () => {
    const now = new Date("2026-11-24T15:00:00Z");
    const ago = (min: number) => new Date(now.getTime() - min * 60_000);
    expect(formatRelative(ago(0.5), now)).toBe("agora");
    expect(formatRelative(ago(5), now)).toBe("há 5 min");
    expect(formatRelative(ago(3 * 60 + 20), now)).toBe("há 3h");
    expect(formatRelative(ago(26 * 60), now)).toBe("há 1 dia");
    expect(formatRelative(ago(3 * 24 * 60), now)).toBe("há 3 dias");
    expect(formatRelative(ago(10 * 24 * 60), now)).toBe("14/11/2026");
  });
});
