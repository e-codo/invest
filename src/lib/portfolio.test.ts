import { describe, expect, it } from "vitest";
import {
  addMonths,
  allocation,
  averageMonthlyDeposit,
  buildHistory,
  depositStreak,
  forecast,
  milestoneStates,
  monthsBetween,
  xirr,
  type InstrumentRef,
  type PricePoint,
  type Tx,
} from "./portfolio";

const instruments: InstrumentRef[] = [
  { id: 1, assetClass: "stocks" },
  { id: 2, assetClass: "bonds" },
];

const dep = (date: string, amount: number): Tx => ({ date, kind: "deposit", instrumentId: null, quantity: null, price: null, amount });
const buy = (date: string, id: number, quantity: number, price: number): Tx => ({
  date,
  kind: "buy",
  instrumentId: id,
  quantity,
  price,
  amount: quantity * price,
});
const inc = (date: string, id: number, amount: number): Tx => ({ date, kind: "income", instrumentId: id, quantity: null, price: null, amount });

describe("месяцы", () => {
  it("сдвиг и разница", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthsBetween("2025-07", "2026-09")).toBe(14);
  });
});

describe("buildHistory", () => {
  const txs = [
    dep("2026-01-10", 1000),
    buy("2026-01-10", 1, 10, 50), // 500
    buy("2026-01-10", 2, 4, 100), // 400 -> на счёте 100
    dep("2026-02-10", 1000),
    inc("2026-02-15", 2, 30),
    buy("2026-03-05", 1, 5, 60), // 300
  ];
  const prices: PricePoint[] = [
    { instrumentId: 1, month: "2026-01-01", price: 50 },
    { instrumentId: 2, month: "2026-01-01", price: 100 },
    { instrumentId: 1, month: "2026-02-01", price: 55 },
    { instrumentId: 1, month: "2026-03-01", price: 60 },
  ];
  const h = buildHistory(txs, prices, instruments, "2026-03");

  it("строит помесячный ряд от первой операции до текущего месяца", () => {
    expect(h.map((p) => p.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("считает стоимость, свободные деньги и вложенное", () => {
    expect(h[0]).toMatchObject({ invested: 1000, cash: 100, value: 1000 });
    // фев: акции 10*55, облигации 4*100 (цена перенесена), счёт 100+1000+30
    expect(h[1].byClass).toEqual({ stocks: 550, bonds: 400, cash: 1130 });
    expect(h[1].value).toBe(2080);
    // мар: акции 15*60, счёт 1130-300
    expect(h[2].byClass).toEqual({ stocks: 900, bonds: 400, cash: 830 });
    expect(h[2].invested).toBe(2000);
  });

  it("пустой список операций даёт пустой ряд", () => {
    expect(buildHistory([], [], instruments, "2026-03")).toEqual([]);
  });

  it("без цен использует цену последней покупки", () => {
    const only = buildHistory([dep("2026-01-01", 500), buy("2026-01-01", 1, 10, 40)], [], instruments, "2026-01");
    expect(only[0].byClass.stocks).toBe(400);
  });
});

describe("xirr", () => {
  it("10% за год", () => {
    const r = xirr([
      { date: "2025-01-01", amount: -1000 },
      { date: "2026-01-01", amount: 1100 },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(0.1, 3);
  });

  it("нулевая доходность, если получили ровно вложенное", () => {
    const r = xirr([
      { date: "2025-01-01", amount: -500 },
      { date: "2025-07-01", amount: -500 },
      { date: "2026-01-01", amount: 1000 },
    ]);
    expect(r!).toBeCloseTo(0, 3);
  });

  it("отрицательная доходность", () => {
    const r = xirr([
      { date: "2025-01-01", amount: -1000 },
      { date: "2026-01-01", amount: 900 },
    ]);
    expect(r!).toBeCloseTo(-0.1, 3);
  });

  it("слишком короткий срок и неполные потоки дают null", () => {
    expect(xirr([{ date: "2026-01-01", amount: -1000 }, { date: "2026-02-01", amount: 1100 }])).toBeNull();
    expect(xirr([{ date: "2025-01-01", amount: -1000 }])).toBeNull();
    expect(xirr([{ date: "2025-01-01", amount: 1000 }, { date: "2026-01-01", amount: 1100 }])).toBeNull();
  });
});

describe("averageMonthlyDeposit", () => {
  const txs = [dep("2026-01-05", 100), dep("2026-01-20", 100), dep("2026-02-05", 400), dep("2026-04-05", 300)];
  it("среднее по последним месяцам со взносами", () => {
    expect(averageMonthlyDeposit(txs, "2026-04", 6)).toBeCloseTo((200 + 400 + 300) / 3);
    expect(averageMonthlyDeposit(txs, "2026-04", 2)).toBeCloseTo((400 + 300) / 2);
  });
  it("нет взносов: 0", () => {
    expect(averageMonthlyDeposit([], "2026-04")).toBe(0);
  });
});

describe("forecast", () => {
  it("16% годовых без взносов за 12 месяцев", () => {
    const { fc, only } = forecast(1000, 800, 0, 16, 12);
    expect(fc[0]).toBe(1000);
    expect(fc[12]).toBeCloseTo(1160, 6);
    expect(only[12]).toBe(800);
  });
  it("взносы растут линейно в only и с процентом в fc", () => {
    const { fc, only } = forecast(0, 0, 100, 12, 24);
    expect(only[24]).toBe(2400);
    expect(fc[24]).toBeGreaterThan(2400);
  });
});

describe("depositStreak", () => {
  it("считает подряд идущие месяцы", () => {
    const months = new Set(["2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(depositStreak(months, "2026-09")).toBe(4);
  });
  it("текущий месяц ещё не отмечен: считаем до прошлого", () => {
    expect(depositStreak(new Set(["2026-07", "2026-08"]), "2026-09")).toBe(2);
  });
  it("пропуск обрывает серию", () => {
    expect(depositStreak(new Set(["2026-05", "2026-07", "2026-08"]), "2026-08")).toBe(2);
    expect(depositStreak(new Set(["2026-05"]), "2026-09")).toBe(0);
  });
});

describe("milestoneStates", () => {
  it("отмечает достигнутые и ближайшую", () => {
    const s = milestoneStates([500, 100, 300], 350);
    expect(s).toEqual([
      { amount: 100, done: true, next: false },
      { amount: 300, done: true, next: false },
      { amount: 500, done: false, next: true },
    ]);
  });
  it("все вехи пройдены: ближайшей нет", () => {
    expect(milestoneStates([100], 500).some((m) => m.next)).toBe(false);
  });
});

describe("allocation", () => {
  it("доли и разрыв до цели", () => {
    const a = allocation({ stocks: 175, bonds: 620, cash: 205 }, { stocks: 20, bonds: 60, cash: 20 });
    const stocks = a.find((x) => x.key === "stocks")!;
    expect(stocks.share).toBeCloseTo(17.5);
    expect(stocks.gapRub).toBeCloseTo(25); // 20% от 1000 минус 175
    expect(a.find((x) => x.key === "bonds")!.gapRub).toBeCloseTo(-20);
  });
  it("пустой портфель не делит на ноль", () => {
    const a = allocation({ stocks: 0, bonds: 0, cash: 0 }, { stocks: 20, bonds: 60, cash: 20 });
    expect(a.every((x) => x.share === 0 && x.gapRub === 0)).toBe(true);
  });
});
