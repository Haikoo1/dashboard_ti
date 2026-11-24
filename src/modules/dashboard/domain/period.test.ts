import { describe, expect, it } from "vitest";
import { PeriodError, allowedGranularities, parsePeriodParams, resolveGranularity, resolvePeriod, resolvePeriodFromParams, suggestGranularity } from "./period";

// Quarta-feira, 18/03/2026, 12:00 em Brasília.
const NOW = new Date("2026-03-18T15:00:00Z");
const iso = (d: Date) => d.toISOString();

describe("resolvePeriod", () => {
  it("últimos 7 dias: de 00:00 de seis dias atrás até agora; anterior com a mesma duração", () => {
    const r = resolvePeriod({ periodo: "7d" }, NOW);
    expect(iso(r.current.start)).toBe("2026-03-12T03:00:00.000Z");
    expect(iso(r.current.end)).toBe(iso(NOW));
    expect(iso(r.previous.start)).toBe("2026-03-05T03:00:00.000Z");
    expect(iso(r.previous.end)).toBe("2026-03-11T15:00:00.000Z");
    expect(r.days).toBe(7);
    expect(r.granularity).toBe("dia");
  });

  it("últimos 30 e 90 dias", () => {
    const r30 = resolvePeriod({ periodo: "30d" }, NOW);
    expect(iso(r30.current.start)).toBe("2026-02-17T03:00:00.000Z");
    expect(iso(r30.previous.start)).toBe("2026-01-18T03:00:00.000Z");
    expect(r30.granularity).toBe("dia");

    const r90 = resolvePeriod({ periodo: "90d" }, NOW);
    expect(iso(r90.current.start)).toBe("2025-12-19T03:00:00.000Z");
    expect(r90.granularity).toBe("semana");
  });

  it("este ano: desde 1º de janeiro; anterior = mesmo trecho do ano passado", () => {
    const r = resolvePeriod({ periodo: "ano" }, NOW);
    expect(iso(r.current.start)).toBe("2026-01-01T03:00:00.000Z");
    expect(iso(r.previous.start)).toBe("2025-01-01T03:00:00.000Z");
    expect(iso(r.previous.end)).toBe("2025-03-18T15:00:00.000Z");
    expect(r.days).toBe(77);
    expect(r.granularity).toBe("semana");
  });

  it("personalizado: dia final incluído por inteiro; anterior imediatamente antes", () => {
    const r = resolvePeriod({ periodo: "personalizado", de: "2026-03-01", ate: "2026-03-10" }, NOW);
    expect(iso(r.current.start)).toBe("2026-03-01T03:00:00.000Z");
    expect(iso(r.current.end)).toBe("2026-03-11T03:00:00.000Z");
    expect(iso(r.previous.start)).toBe("2026-02-19T03:00:00.000Z");
    expect(iso(r.previous.end)).toBe("2026-03-01T03:00:00.000Z");
    expect(r.days).toBe(10);
    expect(r.label).toBe("01/03/2026 a 10/03/2026");
  });

  it("personalizado terminando hoje é limitado a agora", () => {
    const r = resolvePeriod({ periodo: "personalizado", de: "2026-03-18", ate: "2026-03-18" }, NOW);
    expect(iso(r.current.start)).toBe("2026-03-18T03:00:00.000Z");
    expect(iso(r.current.end)).toBe(iso(NOW));
    expect(r.days).toBe(1);
  });

  it("rejeita períodos personalizados inválidos", () => {
    expect(() => resolvePeriod({ periodo: "personalizado", de: "2026-03-10", ate: "2026-03-01" }, NOW)).toThrow(PeriodError);
    expect(() => resolvePeriod({ periodo: "personalizado", de: "2026-03-01", ate: "2026-03-19" }, NOW)).toThrow(
      /futuro/,
    );
    expect(() => resolvePeriod({ periodo: "personalizado", de: "2023-01-01", ate: "2026-03-01" }, NOW)).toThrow(
      /no máximo/,
    );
  });
});

describe("parsePeriodParams", () => {
  it("usa os últimos 30 dias quando nada é informado", () => {
    expect(parsePeriodParams({})).toEqual({ input: { periodo: "30d" }, error: null });
  });

  it("aceita os períodos válidos e o primeiro valor de parâmetros repetidos", () => {
    expect(parsePeriodParams({ periodo: "7d" }).input).toEqual({ periodo: "7d" });
    expect(parsePeriodParams({ periodo: ["ano", "7d"] }).input).toEqual({ periodo: "ano" });
    expect(parsePeriodParams({ periodo: "personalizado", de: "2026-01-01", ate: "2026-01-31" }).input).toEqual({
      periodo: "personalizado",
      de: "2026-01-01",
      ate: "2026-01-31",
    });
  });

  it("volta ao padrão com mensagem de erro para valores inválidos", () => {
    for (const params of [{ periodo: "999d" }, { periodo: "personalizado" }, { periodo: "personalizado", de: "x", ate: "y" }]) {
      const parsed = parsePeriodParams(params);
      expect(parsed.input).toEqual({ periodo: "30d" });
      expect(parsed.error).toMatch(/inválido/);
    }
  });
});

describe("resolvePeriodFromParams", () => {
  it("período válido do endereço", () => {
    const { range, error } = resolvePeriodFromParams({ periodo: "7d" }, NOW);
    expect(range.key).toBe("7d");
    expect(error).toBeNull();
  });

  it("data final no futuro volta ao padrão com o motivo", () => {
    const { range, error } = resolvePeriodFromParams({ periodo: "personalizado", de: "2026-03-01", ate: "2026-03-20" }, NOW);
    expect(range.key).toBe("30d");
    expect(error).toBe("A data final não pode estar no futuro. Exibindo: últimos 30 dias.");
  });
});

describe("agrupamento do gráfico", () => {
  it("o sugerido é sempre permitido, de 1 a 731 dias", () => {
    for (let days = 1; days <= 731; days++) {
      expect(allowedGranularities(days)).toContain(suggestGranularity(days));
    }
  });

  it("aceita o pedido quando permitido; senão usa o sugerido", () => {
    expect(resolveGranularity("semana", 30)).toBe("semana");
    expect(resolveGranularity("mes", 7)).toBe("dia");
    expect(resolveGranularity("dia", 328)).toBe("mes");
    expect(resolveGranularity("hora", 90)).toBe("semana");
    expect(resolveGranularity(undefined, 90)).toBe("semana");
  });
});
