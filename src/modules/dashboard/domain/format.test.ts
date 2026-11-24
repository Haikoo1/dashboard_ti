import { describe, expect, it } from "vitest";
import { compare } from "./comparison";
import { describeComparison, formatSignedPercent, formatWindow, toIsoDate } from "./format";

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
