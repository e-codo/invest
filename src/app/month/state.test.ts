import { describe, expect, it } from "vitest";
import {
  defaultDate,
  emptyIncome,
  initialState,
  lastDayOfMonth,
  suggestPrices,
  summarize,
  toPayload,
  trimDecimal,
  validateStep,
  withMonth,
  type InstrumentInfo,
} from "./state";
import { monthSchema } from "@/lib/month-schema";

const TODAY = "2026-09-29";

const instruments: InstrumentInfo[] = [
  { id: 1, ticker: "TMOS", name: "Индекс", assetClass: "stocks", held: "100", lastPrice: "6.2145", lastMonth: "2026-08-01" },
  { id: 2, ticker: "SBGB", name: "ОФЗ", assetClass: "bonds", held: "0", lastPrice: null, lastMonth: null },
];

const fresh = () => initialState(instruments, TODAY);

describe("даты", () => {
  it("последний день месяца", () => {
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
    expect(lastDayOfMonth("2026-09")).toBe("2026-09-30");
  });

  it("дата по умолчанию: сегодня для текущего месяца, иначе конец месяца", () => {
    expect(defaultDate("2026-09", TODAY)).toBe(TODAY);
    expect(defaultDate("2026-07", TODAY)).toBe("2026-07-31");
  });

  it("смена месяца переносит даты", () => {
    const s = withMonth(fresh(), "2026-07", TODAY);
    expect(s.depositDate).toBe("2026-07-31");
    expect(s.buys[1][0].date).toBe("2026-07-31");
  });
});

describe("trimDecimal", () => {
  it("убирает хвост нулей", () => {
    expect(trimDecimal("1481.250000")).toBe("1481.25");
    expect(trimDecimal("100.000000")).toBe("100");
    expect(trimDecimal("100")).toBe("100");
  });
});

describe("validateStep", () => {
  it("пустой взнос допустим, неверный нет", () => {
    const s = fresh();
    expect(validateStep(0, s, instruments, TODAY)).toBeNull();
    expect(validateStep(0, { ...s, depositAmount: "abc" }, instruments, TODAY)).toMatch(/Взнос/);
    expect(validateStep(0, { ...s, depositAmount: "25 000" }, instruments, TODAY)).toBeNull();
  });

  it("частично заполненная покупка отклоняется, пустая строка игнорируется", () => {
    const s = fresh();
    expect(validateStep(1, s, instruments, TODAY)).toBeNull();
    s.buys[1][0].quantity = "10";
    expect(validateStep(1, s, instruments, TODAY)).toMatch(/Покупка TMOS: цена/);
    s.buys[1][0].price = "6,3";
    expect(validateStep(1, s, instruments, TODAY)).toBeNull();
  });

  it("доход требует фонд и сумму, реинвест требует количество и цену", () => {
    const s = fresh();
    s.incomes = [emptyIncome(TODAY, null)];
    expect(validateStep(2, s, instruments, TODAY)).toMatch(/выберите фонд/);
    s.incomes[0].instrumentId = 2;
    expect(validateStep(2, s, instruments, TODAY)).toMatch(/укажите сумму/);
    s.incomes[0].amount = "1940";
    expect(validateStep(2, s, instruments, TODAY)).toBeNull();
    s.incomes[0].reinvest = true;
    expect(validateStep(2, s, instruments, TODAY)).toMatch(/Реинвест SBGB/);
  });

  it("цена обязательна для бумаг в портфеле и для только что купленных", () => {
    const s = fresh();
    s.prices[1] = "";
    expect(validateStep(3, s, instruments, TODAY)).toMatch(/Укажите цену TMOS/);
    s.prices[1] = "6,3";
    expect(validateStep(3, s, instruments, TODAY)).toBeNull();
    s.buys[2][0].quantity = "5";
    s.buys[2][0].price = "1500";
    expect(validateStep(3, s, instruments, TODAY)).toMatch(/Укажите цену SBGB/);
    s.prices[2] = "1500";
    expect(validateStep(3, s, instruments, TODAY)).toBeNull();
  });
});

describe("suggestPrices", () => {
  it("подставляет цену покупки, если цену не меняли", () => {
    const s = fresh();
    s.buys[1][0].quantity = "10";
    s.buys[1][0].price = "6,5";
    expect(suggestPrices(s, instruments)[1]).toBe("6.5");
  });

  it("не трогает цену, которую пользователь уже поменял", () => {
    const s = fresh();
    s.prices[1] = "7";
    s.buys[1][0].quantity = "10";
    s.buys[1][0].price = "6,5";
    expect(suggestPrices(s, instruments)[1]).toBe("7");
  });
});

describe("toPayload и схема на сервере", () => {
  it("собранные данные проходят серверную проверку", () => {
    const s = fresh();
    s.depositAmount = "25 000";
    s.buys[1][0].quantity = "10";
    s.buys[1][0].price = "6,3";
    s.incomes = [{ ...emptyIncome(TODAY, 2), amount: "1 940,5", reinvest: true, quantity: "1", price: "1481,25" }];
    s.prices = { 1: "6,3", 2: "1481,25" };
    const payload = toPayload(s, instruments);
    const parsed = monthSchema.safeParse(payload);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(payload).toMatchObject({
      month: "2026-09",
      deposit: { amount: "25000" },
      buys: [{ instrumentId: 1, quantity: "10", price: "6.3" }],
      incomes: [{ instrumentId: 2, amount: "1940.5", reinvest: { quantity: "1", price: "1481.25" } }],
    });
  });
});

describe("summarize", () => {
  it("считает взнос, покупки, доход и реинвест в копейках", () => {
    const s = fresh();
    s.depositAmount = "25000";
    s.buys[2][0].quantity = "10";
    s.buys[2][0].price = "1481,25";
    s.incomes = [{ ...emptyIncome(TODAY, 2), amount: "1940", reinvest: true, quantity: "1", price: "1481,25" }];
    expect(summarize(s, instruments)).toEqual({
      deposit: 2500000n,
      bought: 1481250n,
      income: 194000n,
      reinvested: 148125n,
    });
  });
});
