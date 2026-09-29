import { describe, expect, it } from "vitest";
import { buildDashboard, type DashboardInput } from "./dashboard";
import type { Tx } from "./portfolio";

const dep = (date: string, amount: number): Tx => ({ date, kind: "deposit", instrumentId: null, quantity: null, price: null, amount });
const buy = (date: string, id: number, quantity: number, price: number): Tx => ({
  date,
  kind: "buy",
  instrumentId: id,
  quantity,
  price,
  amount: quantity * price,
});

const base: Omit<DashboardInput, "txs" | "prices"> = {
  instruments: [
    { id: 1, assetClass: "stocks" },
    { id: 2, assetClass: "bonds" },
  ],
  targets: { stocks: 20, bonds: 60, cash: 20 },
  milestones: [100, 300, 500],
  goal: 1000,
  forecastRate: 12,
  forecastMonthly: null,
  today: "2026-09-29",
};

describe("buildDashboard", () => {
  it("без операций: пустая панель без ошибок", () => {
    const d = buildDashboard({ ...base, txs: [], prices: [] });
    expect(d.hasData).toBe(false);
    expect(d.value).toBe(0);
    expect(d.irr).toBeNull();
    expect(d.chart.fact).toEqual([0]);
    expect(d.chart.only.length).toBe(181);
    expect(d.nextMilestone?.amount).toBe(100);
  });

  const txs: Tx[] = [
    dep("2026-07-10", 200),
    buy("2026-07-10", 1, 10, 10), // 100
    buy("2026-07-10", 2, 10, 10), // 100
    dep("2026-08-10", 200),
    dep("2026-09-10", 200),
    buy("2026-09-10", 2, 10, 20), // 200
  ];
  const prices = [
    { instrumentId: 1, month: "2026-07-01", price: 10 },
    { instrumentId: 2, month: "2026-07-01", price: 10 },
    { instrumentId: 1, month: "2026-09-01", price: 30 },
    { instrumentId: 2, month: "2026-09-01", price: 21 },
  ];
  const d = buildDashboard({ ...base, txs, prices });

  it("стоимость, вложенное и прибыль", () => {
    // акции 10*30 = 300, облигации 20*21 = 420, счёт 600-400 = 200 -> 920
    expect(d.value).toBe(920);
    expect(d.invested).toBe(600);
    expect(d.profit).toBe(320);
    expect(d.cash).toBe(200);
  });

  it("вехи: все пройдены, ближайшей нет", () => {
    expect(d.milestones.filter((m) => m.done).length).toBe(3);
    expect(d.nextMilestone).toBeNull();
    expect(d.goalProgress).toBeCloseTo(0.92);
    expect(d.goalLeft).toBe(80);
  });

  it("вехи: прогресс к ближайшей считается от предыдущей", () => {
    const partial = buildDashboard({ ...base, txs, prices, milestones: [300, 1000] });
    expect(partial.nextMilestone).toMatchObject({ amount: 1000, from: 300 });
    expect(partial.nextMilestone!.progress).toBeCloseTo((920 - 300) / (1000 - 300));
    expect(partial.nextMilestone!.left).toBe(80);
  });

  it("серия для графика согласована по длине", () => {
    expect(d.chart.startMonth).toBe("2026-07");
    expect(d.chart.nowIndex).toBe(2);
    expect(d.chart.fact.length).toBe(3);
    expect(d.chart.fc.length).toBe(181);
    expect(d.chart.only.length).toBe(d.chart.nowIndex + 181);
    // «только взносы» в прошлом равно вложенному, а в точке «сейчас» совпадает с ним
    expect(d.chart.only[d.chart.nowIndex]).toBe(600);
    expect(d.chart.fc[0]).toBe(920);
  });

  it("взнос в прогнозе: по истории или задан вручную", () => {
    expect(d.chart.monthly).toBe(200);
    expect(d.chart.monthlyAuto).toBe(true);
    const manual = buildDashboard({ ...base, txs, prices, forecastMonthly: 500 });
    expect(manual.chart.monthly).toBe(500);
    expect(manual.chart.monthlyAuto).toBe(false);
  });

  it("календарь: месяц закрашен при взносе, есть подписи", () => {
    expect(d.calendar["2026-08"].paid).toBe(true);
    expect(d.calendar["2026-08"].notes[0]).toContain("Взнос");
    expect(d.calendar["2026-06"]).toBeUndefined();
    expect(d.streak).toBe(3);
  });

  it("аллокация складывает свободные деньги в ликвидность", () => {
    const cash = d.allocation.find((a) => a.key === "cash")!;
    expect(cash.value).toBe(200);
  });
});
