import { describe, expect, it } from "vitest";
import { addZonedDays, parseIsoDate, startOfZonedDay, zonedDateParts, zonedMidnight } from "./time-zone";

describe("fuso horário (Brasília)", () => {
  it("23h de Brasília ainda pertence ao mesmo dia local, embora já seja o dia seguinte em UTC", () => {
    const instant = new Date("2026-03-18T02:00:00Z"); // 17/03 23:00 em Brasília
    expect(zonedDateParts(instant)).toEqual({ year: 2026, month: 3, day: 17 });
    expect(startOfZonedDay(instant).toISOString()).toBe("2026-03-17T03:00:00.000Z");
  });

  it("meia-noite local corresponde a 03:00 UTC", () => {
    expect(zonedMidnight({ year: 2026, month: 1, day: 1 }).toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("soma e subtrai dias de calendário, inclusive atravessando meses e anos", () => {
    const d = zonedMidnight({ year: 2026, month: 3, day: 1 });
    expect(addZonedDays(d, -1).toISOString()).toBe("2026-02-28T03:00:00.000Z");
    expect(addZonedDays(d, 31).toISOString()).toBe("2026-04-01T03:00:00.000Z");
    expect(addZonedDays(zonedMidnight({ year: 2026, month: 1, day: 1 }), -1).toISOString()).toBe(
      "2025-12-31T03:00:00.000Z",
    );
  });

  it("valida datas AAAA-MM-DD", () => {
    expect(parseIsoDate("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("28/02/2026")).toBeNull();
    expect(parseIsoDate("2026-2-8")).toBeNull();
  });
});
