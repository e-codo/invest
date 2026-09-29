import { todayEkb } from "./dates";
import {
  allocation,
  averageMonthlyDeposit,
  buildHistory,
  depositStreak,
  forecast,
  milestoneStates,
  monthOf,
  monthsBetween,
  xirr,
  type AssetClass,
  type PricePoint,
  type Tx,
} from "./portfolio";

export const FORECAST_MONTHS = 180; // 15 лет

const rubFmt = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const rub = (n: number) => rubFmt.format(Math.round(n));

export type DashboardInput = {
  txs: Tx[];
  prices: PricePoint[];
  instruments: { id: number; assetClass: AssetClass }[];
  targets: Record<AssetClass, number>;
  milestones: number[];
  goal: number;
  forecastRate: number; // % годовых
  forecastMonthly: number | null; // null: по истории
  today?: string; // ГГГГ-ММ-ДД, для тестов
};

export type CalendarMonth = { paid: boolean; notes: string[] };

/** Всё, что нужно дашборду. Только числа и строки: годится для передачи в клиентские компоненты. */
export function buildDashboard(input: DashboardInput) {
  const today = input.today ?? todayEkb();
  const nowMonth = monthOf(today);
  const history = buildHistory(input.txs, input.prices, input.instruments, nowMonth);
  const hasData = history.length > 0;
  const current = hasData
    ? history[history.length - 1]
    : { month: nowMonth, invested: 0, value: 0, cash: 0, byClass: { stocks: 0, bonds: 0, cash: 0 } };

  const flows = [
    ...input.txs.filter((t) => t.kind === "deposit").map((t) => ({ date: t.date, amount: -t.amount })),
    { date: today, amount: current.value },
  ];
  const irr = hasData ? xirr(flows) : null;
  const income = input.txs.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const depositCount = input.txs.filter((t) => t.kind === "deposit").length;

  const autoMonthly = averageMonthlyDeposit(input.txs, nowMonth);
  const monthly = input.forecastMonthly ?? autoMonthly;
  const fc = forecast(current.value, current.invested, monthly, input.forecastRate, FORECAST_MONTHS);

  const startMonth = hasData ? history[0].month : nowMonth;
  const nowIndex = hasData ? history.length - 1 : 0;

  const chart = {
    startMonth,
    nowIndex,
    fact: hasData ? history.map((p) => p.value) : [0],
    // «Только взносы»: вложенное в прошлом, дальше вложенное плюс будущие взносы без дохода
    only: [...(hasData ? history.map((p) => p.invested) : [0]).slice(0, nowIndex), ...fc.only],
    // Прогноз стартует сегодня: индекс 0 это текущий месяц
    fc: fc.fc,
    ratePct: input.forecastRate,
    monthly,
    monthlyAuto: input.forecastMonthly === null,
  };

  const depositMonths = new Set(input.txs.filter((t) => t.kind === "deposit").map((t) => monthOf(t.date)));
  const perMonth = new Map<string, { deposit: number; buys: number; buySum: number; income: number }>();
  for (const t of input.txs) {
    const m = monthOf(t.date);
    const e = perMonth.get(m) ?? { deposit: 0, buys: 0, buySum: 0, income: 0 };
    if (t.kind === "deposit") e.deposit += t.amount;
    else if (t.kind === "buy") {
      e.buys += 1;
      e.buySum += t.amount;
    } else e.income += t.amount;
    perMonth.set(m, e);
  }
  const calendar: Record<string, CalendarMonth> = {};
  for (const [m, e] of perMonth) {
    const notes: string[] = [];
    if (e.deposit > 0) notes.push(`Взнос ${rub(e.deposit)}`);
    if (e.buys > 0) notes.push(`Покупок: ${e.buys} на ${rub(e.buySum)}`);
    if (e.income > 0) notes.push(`Купоны и дивиденды ${rub(e.income)}`);
    calendar[m] = { paid: e.deposit > 0, notes };
  }

  const alloc = allocation(current.byClass, input.targets);
  const states = milestoneStates(input.milestones, current.value);
  const next = states.find((m) => m.next);
  const previousDone = [...states].reverse().find((m) => m.done);

  return {
    today,
    nowMonth,
    hasData,
    value: current.value,
    invested: current.invested,
    profit: current.value - current.invested,
    cash: current.cash,
    irr,
    income,
    depositCount,
    streak: depositStreak(depositMonths, nowMonth),
    monthsTracked: hasData ? monthsBetween(startMonth, nowMonth) + 1 : 0,
    chart,
    calendar,
    allocation: alloc,
    milestones: states,
    nextMilestone: next
      ? {
          amount: next.amount,
          from: previousDone?.amount ?? 0,
          progress: Math.min(1, Math.max(0, (current.value - (previousDone?.amount ?? 0)) / (next.amount - (previousDone?.amount ?? 0)))),
          left: next.amount - current.value,
        }
      : null,
    goal: input.goal,
    goalProgress: input.goal > 0 ? Math.min(1, current.value / input.goal) : 0,
    goalLeft: Math.max(0, input.goal - current.value),
  };
}

export type Dashboard = ReturnType<typeof buildDashboard>;
