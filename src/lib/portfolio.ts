// Расчёты по портфелю. Чистые функции без базы данных: всё, что нужно, передаётся аргументами.
// Суммы здесь обычные числа в рублях: для показа на экране точности с запасом.

export type AssetClass = "stocks" | "bonds" | "cash";

export type Tx = {
  date: string; // ГГГГ-ММ-ДД
  kind: "deposit" | "buy" | "income";
  instrumentId: number | null;
  quantity: number | null;
  price: number | null;
  amount: number;
};

export type PricePoint = { instrumentId: number; month: string; price: number }; // month: ГГГГ-ММ-01

export type InstrumentRef = { id: number; assetClass: AssetClass };

export type MonthPoint = {
  month: string; // ГГГГ-ММ
  invested: number; // всего внесено взносами
  value: number; // стоимость портфеля, включая свободные деньги
  cash: number; // свободные деньги на счёте
  byClass: Record<AssetClass, number>;
};

export const monthOf = (date: string) => date.slice(0, 7);

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** Стоимость портфеля на конец каждого месяца от первой операции до nowMonth. */
export function buildHistory(
  txs: Tx[],
  prices: PricePoint[],
  instruments: InstrumentRef[],
  nowMonth: string,
): MonthPoint[] {
  if (txs.length === 0) return [];
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const first = monthOf(sorted[0].date);
  const classOf = new Map(instruments.map((i) => [i.id, i.assetClass]));

  const priceBy = new Map<number, PricePoint[]>();
  for (const p of prices) (priceBy.get(p.instrumentId) ?? priceBy.set(p.instrumentId, []).get(p.instrumentId)!).push(p);
  for (const list of priceBy.values()) list.sort((a, b) => a.month.localeCompare(b.month));

  const result: MonthPoint[] = [];
  const qty = new Map<number, number>();
  const lastBuyPrice = new Map<number, number>();
  let invested = 0;
  let cash = 0;
  let cursor = 0;

  const span = monthsBetween(first, nowMonth);
  for (let k = 0; k <= Math.max(span, 0); k++) {
    const month = addMonths(first, k);
    while (cursor < sorted.length && monthOf(sorted[cursor].date) <= month) {
      const t = sorted[cursor++];
      if (t.kind === "deposit") {
        invested += t.amount;
        cash += t.amount;
      } else if (t.kind === "income") {
        cash += t.amount;
      } else if (t.instrumentId !== null && t.quantity !== null) {
        cash -= t.amount;
        qty.set(t.instrumentId, (qty.get(t.instrumentId) ?? 0) + t.quantity);
        if (t.price !== null) lastBuyPrice.set(t.instrumentId, t.price);
      }
    }

    const byClass: Record<AssetClass, number> = { stocks: 0, bonds: 0, cash: 0 };
    for (const [id, q] of qty) {
      if (q <= 0) continue;
      const known = (priceBy.get(id) ?? []).filter((p) => monthOf(p.month) <= month);
      const price = known.length > 0 ? known[known.length - 1].price : (lastBuyPrice.get(id) ?? 0);
      byClass[classOf.get(id) ?? "cash"] += q * price;
    }
    byClass.cash += cash;
    const value = byClass.stocks + byClass.bonds + byClass.cash;
    result.push({ month, invested, value, cash, byClass });
  }
  return result;
}

/** Годовая доходность по датам и суммам потоков (XIRR). null, если посчитать нельзя или рано. */
export function xirr(flows: { date: string; amount: number }[]): number | null {
  if (flows.length < 2) return null;
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
  const t0 = Math.min(...flows.map((f) => day(f.date)));
  const tN = Math.max(...flows.map((f) => day(f.date)));
  if (tN - t0 < 90) return null; // слишком короткий срок: годовая цифра ничего не значит
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

/** Средний месячный взнос за последние n месяцев, в которых были взносы. 0, если взносов нет. */
export function averageMonthlyDeposit(txs: Tx[], nowMonth: string, n = 6): number {
  const perMonth = new Map<string, number>();
  for (const t of txs) if (t.kind === "deposit") perMonth.set(monthOf(t.date), (perMonth.get(monthOf(t.date)) ?? 0) + t.amount);
  const months = [...perMonth.keys()].filter((m) => m <= nowMonth).sort().slice(-n);
  if (months.length === 0) return 0;
  return months.reduce((s, m) => s + perMonth.get(m)!, 0) / months.length;
}

/**
 * Прогноз на months месяцев вперёд. Индекс 0 это сегодня.
 * fc: стоимость при доходности ratePct годовых и ежемесячном взносе. only: те же взносы без дохода.
 */
export function forecast(
  currentValue: number,
  currentInvested: number,
  monthly: number,
  ratePct: number,
  months: number,
): { fc: number[]; only: number[] } {
  const rm = Math.pow(1 + ratePct / 100, 1 / 12) - 1;
  const fc = [currentValue];
  const only = [currentInvested];
  for (let i = 1; i <= months; i++) {
    fc.push((fc[i - 1] + monthly) * (1 + rm));
    only.push(only[i - 1] + monthly);
  }
  return { fc, only };
}

/** Сколько месяцев подряд, заканчивая текущим (или прошлым, если текущий ещё не отмечен), был взнос. */
export function depositStreak(depositMonths: Set<string>, nowMonth: string): number {
  let month = depositMonths.has(nowMonth) ? nowMonth : addMonths(nowMonth, -1);
  let streak = 0;
  while (depositMonths.has(month)) {
    streak++;
    month = addMonths(month, -1);
  }
  return streak;
}

export type MilestoneState = { amount: number; done: boolean; next: boolean };

/** Вехи по возрастанию: достигнутые и ближайшая. */
export function milestoneStates(amounts: number[], value: number): MilestoneState[] {
  const sorted = [...amounts].sort((a, b) => a - b);
  const nextIndex = sorted.findIndex((a) => a > value);
  return sorted.map((amount, i) => ({ amount, done: amount <= value, next: i === nextIndex }));
}

const TARGET_KEYS: AssetClass[] = ["stocks", "bonds", "cash"];

/** Доли по классам в процентах и то, сколько рублей не хватает до цели по каждому классу. */
export function allocation(byClass: Record<AssetClass, number>, target: Record<AssetClass, number>) {
  const total = TARGET_KEYS.reduce((s, k) => s + byClass[k], 0);
  return TARGET_KEYS.map((key) => {
    const share = total > 0 ? (byClass[key] / total) * 100 : 0;
    const gap = (target[key] / 100) * total - byClass[key]; // >0: не хватает, <0: избыток
    return { key, share, target: target[key], gapRub: gap, value: byClass[key] };
  });
}
