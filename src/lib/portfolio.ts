import type { AppState } from "./types";

// Расчёты по правилам брифа (разделы 3.2, 3.3, 3.7). Чистые функции без доступа к базе.

/**
 * Раскладывает плановый взнос по активам так, чтобы доли приблизились к стратегии без продаж.
 * current: сколько денег уже направлено в каждый актив, weights: доли стратегии (могут быть 0),
 * P: плановый взнос в рублях (целое). Сумма результата равна P ровно, отрицательных нет.
 */
export function splitContribution(P: number, current: number[], weights: number[]): number[] {
  const n = current.length;
  const out = new Array<number>(n).fill(0);
  const idx: number[] = [];
  for (let i = 0; i < n; i++) if (weights[i] > 0) idx.push(i);
  if (P <= 0 || idx.length === 0) return out;

  // Активы по возрастанию «уровня» c/w: сначала те, кому больше всего не хватает.
  idx.sort((a, b) => current[a] / weights[a] - current[b] / weights[b]);
  let sumC = 0;
  let sumW = 0;
  let level = 0;
  let k = 0;
  for (; k < idx.length; k++) {
    sumC += current[idx[k]];
    sumW += weights[idx[k]];
    level = (P + sumC) / sumW;
    const next = k + 1 < idx.length ? current[idx[k + 1]] / weights[idx[k + 1]] : Infinity;
    if (level <= next) break;
  }
  const active = idx.slice(0, Math.min(k + 1, idx.length));
  const raw = active.map((i) => Math.max(0, level * weights[i] - current[i]));

  // Округление до рубля методом наибольшего остатка, чтобы сумма была ровно P.
  const floors = raw.map(Math.floor);
  let rest = P - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((v, j) => ({ j, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (let t = 0; rest > 0 && t < order.length * 2; t++) {
    floors[order[t % order.length].j] += 1;
    rest -= 1;
  }
  active.forEach((i, j) => (out[i] = floors[j]));
  return out;
}

export type Flow = { date: string; amount: number };

/** Годовая доходность (XIRR). null, если посчитать нельзя или история короче 90 дней. */
export function xirr(flows: Flow[]): number | null {
  if (flows.length < 2) return null;
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000;
  const t0 = Math.min(...flows.map((f) => day(f.date)));
  const tN = Math.max(...flows.map((f) => day(f.date)));
  if (tN - t0 < 90) return null;
  if (!flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const npv = (r: number) => flows.reduce((s, f) => s + f.amount / Math.pow(1 + r, (day(f.date) - t0) / 365), 0);
  let lo = -0.99;
  let hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

const shiftMonth = (ym: string, d: number) => {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

/** Сколько месяцев подряд (считая с текущего или прошлого) был взнос. */
export function streak(paidMonths: Set<string>, nowYm: string): number {
  let ym = paidMonths.has(nowYm) ? nowYm : shiftMonth(nowYm, -1);
  let n = 0;
  while (paidMonths.has(ym)) {
    n++;
    ym = shiftMonth(ym, -1);
  }
  return n;
}

export type SeriesPoint = { ym: string; invested: number; value: number | null };

export type Summary = {
  yms: string[];
  invested: number;
  value: number;
  profit: number;
  /** Доходность за всё время (доля, 0.1 = 10 %). null, если ничего не вложено. */
  pct: number | null;
  irr: number | null;
  /** Получено купонов. */
  income: number;
  /** Купонов на счёте: получено минус реинвестировано. */
  onAccount: number;
  /** Деньги, направленные в актив: взносы плюс реинвест. */
  base: Record<string, number>;
  paid: Set<string>;
  series: SeriesPoint[];
  streak: number;
};

export function summarize(state: AppState, nowYm: string): Summary {
  const yms = Object.keys(state.months).sort();
  const base: Record<string, number> = {};
  for (const a of state.assets) base[a.id] = 0;

  let invested = 0;
  let income = 0;
  let reinvested = 0;
  const flows: Flow[] = [];
  const paid = new Set<string>();
  const series: SeriesPoint[] = [];

  for (const ym of yms) {
    const m = state.months[ym];
    for (const d of m.deposits) {
      let sum = 0;
      for (const [assetId, v] of Object.entries(d.amounts)) {
        sum += v;
        if (assetId in base) base[assetId] += v;
      }
      invested += sum;
      if (sum > 0) {
        paid.add(ym);
        flows.push({ date: d.date, amount: -sum });
      }
    }
    for (const c of m.coupons) income += c.amount;
    for (const r of m.reinvests) {
      reinvested += r.amount;
      if (r.assetId in base) base[r.assetId] += r.amount;
    }
    series.push({ ym, invested, value: m.value });
  }

  let last: { value: number; date: string } | null = null;
  for (let i = yms.length - 1; i >= 0; i--) {
    const m = state.months[yms[i]];
    if (m.value !== null && m.valueDate) {
      last = { value: m.value, date: m.valueDate };
      break;
    }
  }
  const value = last ? last.value : 0;
  if (last) flows.push({ date: last.date, amount: value });
  const profit = value - invested;

  return {
    yms,
    invested,
    value,
    profit,
    pct: invested > 0 ? profit / invested : null,
    irr: last ? xirr(flows) : null,
    income,
    onAccount: income - reinvested,
    base,
    paid,
    series,
    streak: streak(paid, nowYm),
  };
}

/** Имя стратегии из долей: «Стратегия 20/60/20». Активы с долей 0 в имя не входят. */
export function autoStrategyName(weights: number[]): string {
  return `Стратегия ${weights.filter((w) => w > 0).join("/")}`;
}

export function strategyName(state: AppState): string {
  return state.strategy.name ?? autoStrategyName(state.assets.map((a) => a.weight));
}
