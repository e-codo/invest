import { describe, expect, it } from "vitest";
import { setupSchema } from "./setup-schema";

const valid = {
  strategy: { preset: "conservative", stocks: 20, bonds: 60, cash: 20 },
  goal: "3000000",
  milestones: ["100000", "300000", "500000"],
  instruments: [
    { ticker: "tmos", name: "Индекс МосБиржи", assetClass: "stocks" },
    { ticker: "SBGB", name: "ОФЗ", assetClass: "bonds" },
  ],
};

const messages = (input: unknown) => {
  const r = setupSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("setupSchema", () => {
  it("принимает корректные данные и приводит тикеры к верхнему регистру", () => {
    const r = setupSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.instruments[0].ticker).toBe("TMOS");
  });

  it("требует сумму долей 100", () => {
    const bad = { ...valid, strategy: { preset: "custom", stocks: 50, bonds: 40, cash: 20 } };
    expect(messages(bad)).toContain("Доли стратегии должны в сумме давать 100%");
  });

  it("не даёт выдать чужие доли за готовую стратегию", () => {
    const bad = { ...valid, strategy: { preset: "conservative", stocks: 30, bonds: 50, cash: 20 } };
    expect(messages(bad)).toContain("Доли не совпадают с выбранной стратегией");
  });

  it("отклоняет повторяющиеся вехи, даже если записаны по-разному", () => {
    expect(messages({ ...valid, milestones: ["100000", "100000.00"] })).toContain("Вехи не должны повторяться");
  });

  it("отклоняет повторяющиеся тикеры", () => {
    const bad = {
      ...valid,
      instruments: [
        { ticker: "TMOS", name: "A", assetClass: "stocks" },
        { ticker: "tmos", name: "B", assetClass: "bonds" },
      ],
    };
    expect(messages(bad)).toContain("Тикеры фондов не должны повторяться");
  });

  it("отклоняет нулевую и отрицательную цель", () => {
    expect(messages({ ...valid, goal: "0" })).toContain("Сумма должна быть больше нуля");
    expect(messages({ ...valid, goal: "-5" })).toContain("Сумма указана неверно");
  });

  it("начальное состояние: позиция должна быть из списка фондов и дата не в будущем", () => {
    const opening = { date: "2026-01-15", positions: [{ ticker: "ZZZZ", quantity: "10", price: "100.5" }] };
    expect(messages({ ...valid, opening })).toContain("Позиция ZZZZ не входит в список фондов");
    const future = { date: "2999-01-01", positions: [{ ticker: "TMOS", quantity: "10", price: "100" }] };
    expect(messages({ ...valid, opening: future })).toContain("Дата начального состояния не может быть в будущем");
  });

  it("начальное состояние: позиция дешевле копейки отклоняется", () => {
    const opening = { date: "2026-01-15", positions: [{ ticker: "TMOS", quantity: "1", price: "0.0001" }] };
    expect(messages({ ...valid, opening })).toContain("Позиция TMOS стоит меньше копейки");
  });

  it("начальное состояние: корректные данные проходят", () => {
    const opening = { date: "2026-01-15", positions: [{ ticker: "tmos", quantity: "10", price: "6.2145" }] };
    expect(setupSchema.safeParse({ ...valid, opening }).success).toBe(true);
  });
});
