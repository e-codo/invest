import { describe, expect, it } from "vitest";
import { splitContribution, streak, summarize, xirr } from "./portfolio";
import type { AppState, MonthRecord } from "./types";

const expect_eq = (a: unknown, b: unknown, msg?: string) => expect(a, msg).toBe(b);
const expect_deq = (a: unknown, b: unknown) => expect(a).toEqual(b);
const assertOk = (cond: unknown, msg?: string) => expect(Boolean(cond), msg).toBe(true);

describe("расчёты", () => {

it("при идеальных долях взнос делится по стратегии", () => {
  expect_deq(splitContribution(18000, [7200, 21600, 7200], [20, 60, 20]), [3600, 10800, 3600]);
});
it("без истории делится по долям", () => {
  expect_deq(splitContribution(18000, [0, 0, 0], [20, 60, 20]), [3600, 10800, 3600]);
});
it("актив выше своей доли получает 0", () => {
  const r = splitContribution(10000, [50000, 10000, 5000], [20, 60, 20]);
  expect_eq(r[0], 0);
  expect_eq(r.reduce((a: number, b: number) => a + b, 0), 10000);
});
it("актив вне стратегии получает 0", () => {
  const r = splitContribution(18000, [1000, 1000, 1000, 9000], [20, 60, 20, 0]);
  expect_eq(r[3], 0);
  expect_eq(r.reduce((a: number, b: number) => a + b, 0), 18000);
});
it("нет стратегии или нулевой взнос: всё по нулям", () => {
  expect_deq(splitContribution(18000, [1, 2, 3], [0, 0, 0]), [0, 0, 0]);
  expect_deq(splitContribution(0, [1, 2, 3], [20, 60, 20]), [0, 0, 0]);
});
it("округление: сумма равна взносу ровно, даже когда не делится на доли", () => {
  const r = splitContribution(10001, [0, 0, 0], [20, 60, 20]);
  expect_eq(r.reduce((a: number, b: number) => a + b, 0), 10001);
  r.forEach((v) => assertOk(Number.isInteger(v) && v >= 0));
});
it("случайные проверки: сумма = взнос, все неотрицательные целые, вне стратегии 0", () => {
  let seed = 12345;
  const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let t = 0; t < 20000; t++) {
    const cnt = 2 + Math.floor(rnd() * 4);
    const w = Array.from({ length: cnt }, () => (rnd() < 0.2 ? 0 : 1 + Math.floor(rnd() * 70)));
    if (w.every((x) => x === 0)) continue;
    const c = Array.from({ length: cnt }, () => Math.round(rnd() * 500000));
    const P = 1 + Math.floor(rnd() * 100000);
    const r = splitContribution(P, c, w);
    expect_eq(r.reduce((a: number, b: number) => a + b, 0), P, JSON.stringify({ P, c, w, r }));
    r.forEach((v, i) => {
      assertOk(Number.isInteger(v) && v >= 0, JSON.stringify({ P, c, w, r }));
      if (w[i] === 0) expect_eq(v, 0);
    });
  }
});
it("после взноса получившие выровнены по уровню c/w (с допуском на рубль)", () => {
  const c = [3000, 20000, 8000];
  const w = [20, 60, 20];
  const r = splitContribution(12000, c, w);
  const lv = r.map((v, i) => (c[i] + v) / w[i]).filter((_, i) => r[i] > 0);
  lv.forEach((x) => assertOk(Math.abs(x - lv[0]) < 1.5 / 20, JSON.stringify({ r, lv })));
});

it("XIRR: 10% за год", () => {
  const r = xirr([{ date: '2025-01-01', amount: -1000 }, { date: '2026-01-01', amount: 1100 }]);
  assertOk(Math.abs((r as number) - 0.1) < 0.001);
});
it("XIRR: меньше 90 дней даёт null (ваши две записи)", () => {
  expect_eq(xirr([{ date: '2026-08-22', amount: -18000 }, { date: '2026-09-22', amount: -18000 }, { date: '2026-09-22', amount: 36406 }]), null);
});
it("серия месяцев", () => {
  expect_eq(streak(new Set(['2026-08', '2026-09']), '2026-09'), 2);
  expect_eq(streak(new Set(['2026-08', '2026-09']), '2026-10'), 2);
  expect_eq(streak(new Set(['2026-06', '2026-09']), '2026-09'), 1);
  expect_eq(streak(new Set(), '2026-09'), 0);
});

});

const month = (partial: Partial<MonthRecord>): MonthRecord => ({
  deposits: [],
  value: null,
  valueDate: null,
  coupons: [],
  reinvests: [],
  ...partial,
});

const base = (months: Record<string, MonthRecord>): AppState => ({
  texts: { title: "", subtitle: "", quote: "" },
  plan: 18000,
  goal: 3000000,
  milestones: [],
  strategy: { enabled: true, name: null },
  assets: [
    { id: "1", name: "Акции", weight: 20 },
    { id: "2", name: "Облигации", weight: 60 },
    { id: "3", name: "Фонды", weight: 20 },
  ],
  months,
});

describe("сводка", () => {
  it("ваши два месяца: вложено, прибыль, доходность", () => {
    const s = summarize(
      base({
        "2026-08": month({ deposits: [{ id: "a", date: "2026-08-22", amounts: { "1": 3600, "2": 10800, "3": 3600 } }], value: 17833, valueDate: "2026-08-22" }),
        "2026-09": month({ deposits: [{ id: "b", date: "2026-09-22", amounts: { "1": 3600, "2": 10800, "3": 3600 } }], value: 36406, valueDate: "2026-09-22" }),
      }),
      "2026-09",
    );
    expect(s.invested).toBe(36000);
    expect(s.value).toBe(36406);
    expect(s.profit).toBe(406);
    expect(s.pct).toBeCloseTo(406 / 36000, 10);
    expect(s.irr).toBeNull();
    expect(s.streak).toBe(2);
  });

  it("купон не входит во «вложено», реинвест меняет только аллокацию", () => {
    const s = summarize(
      base({
        "2026-08": month({
          deposits: [{ id: "a", date: "2026-08-22", amounts: { "1": 1000, "2": 2000 } }],
          value: 3600,
          valueDate: "2026-08-30",
          coupons: [{ id: "c", date: "2026-08-10", amount: 500 }],
          reinvests: [{ id: "r", date: "2026-08-12", amount: 300, assetId: "2" }],
        }),
      }),
      "2026-08",
    );
    expect(s.invested).toBe(3000);
    expect(s.profit).toBe(600);
    expect(s.income).toBe(500);
    expect(s.onAccount).toBe(200);
    expect(s.base).toEqual({ "1": 1000, "2": 2300, "3": 0 });
  });

  it("месяц только со стоимостью: взноса нет, календарь его не красит", () => {
    const s = summarize(base({ "2026-09": month({ value: 5000, valueDate: "2026-09-01" }) }), "2026-09");
    expect(s.paid.size).toBe(0);
    expect(s.pct).toBeNull();
    expect(s.value).toBe(5000);
  });

  it("пустая история", () => {
    const s = summarize(base({}), "2026-09");
    expect(s.value).toBe(0);
    expect(s.profit).toBe(0);
    expect(s.pct).toBeNull();
    expect(s.streak).toBe(0);
  });
});
