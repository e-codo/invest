import { describe, expect, it } from "vitest";
import { formatDay, formatMonth } from "./format";

describe("форматирование дат", () => {
  it("месяц без «г.»", () => {
    expect(formatMonth("2026-09")).toBe("сентябрь 2026");
    expect(formatMonth("2027-01")).toBe("январь 2027");
  });

  it("день и месяц в родительном падеже", () => {
    expect(formatDay("2026-09-25")).toBe("25 сентября");
    expect(formatDay("2026-03-01")).toBe("1 марта");
  });
});
