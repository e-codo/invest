import { describe, expect, it } from "vitest";
import { todayEkb } from "./dates";
import { monthSchema } from "./month-schema";

const today = todayEkb();
const month = today.slice(0, 7);

const base = {
  month,
  deposit: { date: today, amount: "25000" },
  buys: [{ instrumentId: 1, date: today, quantity: "10", price: "1481.25" }],
  incomes: [{ instrumentId: 1, date: today, amount: "1940", reinvest: { quantity: "1", price: "1481.25" } }],
  prices: [{ instrumentId: 1, price: "1490" }],
};

const messages = (input: unknown) => {
  const r = monthSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("monthSchema", () => {
  it("принимает полную отметку месяца", () => {
    expect(monthSchema.safeParse(base).success).toBe(true);
  });

  it("принимает отметку только с ценами", () => {
    expect(monthSchema.safeParse({ month, buys: [], incomes: [], prices: base.prices }).success).toBe(true);
  });

  it("отклоняет пустую отметку", () => {
    expect(messages({ month, buys: [], incomes: [], prices: [] })).toContain(
      "Нечего сохранять: добавьте взнос, покупку, купон или цены",
    );
  });

  it("отклоняет будущий месяц", () => {
    const future = "2999-01";
    const input = { ...base, month: future, deposit: { date: "2999-01-10", amount: "1" }, buys: [], incomes: [] };
    expect(messages(input)).toContain("Нельзя отметить месяц, который ещё не наступил");
  });

  it("отклоняет дату вне выбранного месяца", () => {
    const input = { ...base, deposit: { date: "2020-01-15", amount: "25000" } };
    expect(messages(input)).toContain("Дата операции должна быть в выбранном месяце");
  });

  it("отклоняет дату в будущем внутри текущего месяца", () => {
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;
    if (end > today) {
      expect(messages({ ...base, deposit: { date: end, amount: "1" } })).toContain(
        "Дата операции не может быть в будущем",
      );
    }
  });

  it("отклоняет две цены для одного фонда", () => {
    const input = { ...base, prices: [...base.prices, { instrumentId: 1, price: "1500" }] };
    expect(messages(input)).toContain("Цена фонда указана дважды");
  });

  it("отклоняет неверные суммы и цены", () => {
    expect(messages({ ...base, deposit: { date: today, amount: "0" } })).toContain("Сумма должна быть больше нуля");
    expect(messages({ ...base, prices: [{ instrumentId: 1, price: "abc" }] })).toContain("Цена указана неверно");
  });

  it("отклоняет покупку дешевле копейки", () => {
    const input = { ...base, buys: [{ instrumentId: 1, date: today, quantity: "1", price: "0.0001" }] };
    expect(messages(input)).toContain("Покупка стоит меньше копейки");
  });
});
