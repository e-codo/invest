import { todayEkb } from "@/lib/dates";
import { isPositive, parseDecimal, positionKopecks, rubToKopecks } from "@/lib/money";
import type { AssetClassKey } from "@/lib/strategies";

export type InstrumentInfo = {
  id: number;
  ticker: string;
  name: string;
  assetClass: AssetClassKey;
  /** Сколько штук уже куплено. */
  held: string;
  /** Последняя известная цена, без хвоста нулей. */
  lastPrice: string | null;
  /** Первое число месяца, за который эта цена. */
  lastMonth: string | null;
};

export type BuyRow = { key: string; date: string; quantity: string; price: string };
export type IncomeRow = {
  key: string;
  instrumentId: number | null;
  date: string;
  amount: string;
  reinvest: boolean;
  quantity: string;
  price: string;
};

export type MonthState = {
  month: string;
  depositAmount: string;
  depositDate: string;
  buys: Record<number, BuyRow[]>;
  incomes: IncomeRow[];
  prices: Record<number, string>;
};

export const STEPS = ["Взнос", "Покупки", "Купоны и дивиденды", "Цены", "Проверка"] as const;

let counter = 0;
export const newKey = () => `r${++counter}`;

export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/** Сегодня, если месяц текущий, иначе последний день месяца. */
export function defaultDate(month: string, today: string = todayEkb()): string {
  return today.startsWith(month) ? today : lastDayOfMonth(month);
}

/** "1481.250000" -> "1481.25", "100.000000" -> "100" */
export function trimDecimal(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

export function emptyBuy(date: string): BuyRow {
  return { key: newKey(), date, quantity: "", price: "" };
}

export function emptyIncome(date: string, instrumentId: number | null): IncomeRow {
  return { key: newKey(), instrumentId, date, amount: "", reinvest: false, quantity: "", price: "" };
}

export function initialState(instruments: InstrumentInfo[], today: string = todayEkb()): MonthState {
  const month = today.slice(0, 7);
  const date = defaultDate(month, today);
  return {
    month,
    depositAmount: "",
    depositDate: date,
    buys: Object.fromEntries(instruments.map((i) => [i.id, [emptyBuy(date)]])),
    incomes: [],
    prices: Object.fromEntries(instruments.map((i) => [i.id, i.lastPrice ?? ""])),
  };
}

/** Смена месяца: все даты переезжают на дату по умолчанию для нового месяца. */
export function withMonth(state: MonthState, month: string, today: string = todayEkb()): MonthState {
  const date = defaultDate(month, today);
  return {
    ...state,
    month,
    depositDate: date,
    buys: Object.fromEntries(
      Object.entries(state.buys).map(([id, rows]) => [id, rows.map((r) => ({ ...r, date }))]),
    ),
    incomes: state.incomes.map((i) => ({ ...i, date })),
  };
}

const rowFilled = (r: { quantity: string; price: string }) => r.quantity.trim() !== "" || r.price.trim() !== "";

function dateProblem(date: string, month: string, what: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${what}: укажите дату.`;
  if (!date.startsWith(month)) return `${what}: дата должна быть в выбранном месяце.`;
  if (date > today) return `${what}: дата не может быть в будущем.`;
  return null;
}

function qtyPriceProblem(quantity: string, price: string, what: string): string | null {
  const q = parseDecimal(quantity, 0);
  if (!q || !isPositive(q)) return `${what}: количество должно быть целым числом больше нуля.`;
  const p = parseDecimal(price, 4);
  if (!p || !isPositive(p)) return `${what}: цена указана неверно (не больше 4 знаков после запятой).`;
  return null;
}

/** Фонды, у которых после этой отметки будут штуки в портфеле: для них нужна цена. */
export function needsPrice(state: MonthState, instruments: InstrumentInfo[]): Set<number> {
  const ids = new Set<number>();
  for (const i of instruments) {
    const boughtNow = (state.buys[i.id] ?? []).some((r) => rowFilled(r));
    if (Number(i.held) > 0 || boughtNow) ids.add(i.id);
  }
  for (const inc of state.incomes) if (inc.reinvest && inc.instrumentId !== null) ids.add(inc.instrumentId);
  return ids;
}

export function validateStep(
  step: number,
  state: MonthState,
  instruments: InstrumentInfo[],
  today: string = todayEkb(),
): string | null {
  const ticker = (id: number | null) => instruments.find((i) => i.id === id)?.ticker ?? "Фонд";

  switch (step) {
    case 0: {
      if (state.depositAmount.trim() === "") return null;
      const v = parseDecimal(state.depositAmount, 2);
      if (!v || !isPositive(v)) return "Взнос: укажите сумму числом больше нуля или оставьте поле пустым.";
      return dateProblem(state.depositDate, state.month, "Взнос", today);
    }
    case 1: {
      for (const i of instruments) {
        for (const r of state.buys[i.id] ?? []) {
          if (!rowFilled(r)) continue;
          const what = `Покупка ${i.ticker}`;
          const problem = qtyPriceProblem(r.quantity, r.price, what) ?? dateProblem(r.date, state.month, what, today);
          if (problem) return problem;
        }
      }
      return null;
    }
    case 2: {
      for (const inc of state.incomes) {
        if (inc.instrumentId === null) return "Купон или дивиденды: выберите фонд.";
        const what = `Доход ${ticker(inc.instrumentId)}`;
        const v = parseDecimal(inc.amount, 2);
        if (!v || !isPositive(v)) return `${what}: укажите сумму числом больше нуля.`;
        const dp = dateProblem(inc.date, state.month, what, today);
        if (dp) return dp;
        if (inc.reinvest) {
          const rp = qtyPriceProblem(inc.quantity, inc.price, `Реинвест ${ticker(inc.instrumentId)}`);
          if (rp) return rp;
        }
      }
      return null;
    }
    case 3: {
      const required = needsPrice(state, instruments);
      for (const i of instruments) {
        const raw = (state.prices[i.id] ?? "").trim();
        if (raw === "") {
          if (required.has(i.id)) return `Укажите цену ${i.ticker}: он есть в портфеле.`;
          continue;
        }
        const p = parseDecimal(raw, 4);
        if (!p || !isPositive(p)) return `${i.ticker}: цена указана неверно (не больше 4 знаков после запятой).`;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Подставляет цену последней покупки этого месяца, если цену ещё не меняли вручную. */
export function suggestPrices(state: MonthState, instruments: InstrumentInfo[]): Record<number, string> {
  const next = { ...state.prices };
  for (const i of instruments) {
    const untouched = (state.prices[i.id] ?? "") === (i.lastPrice ?? "");
    if (!untouched) continue;
    const rows = (state.buys[i.id] ?? []).filter((r) => rowFilled(r));
    const bought = rows.length > 0 ? parseDecimal(rows[rows.length - 1].price, 4) : null;
    if (bought && isPositive(bought)) next[i.id] = trimDecimal(bought);
  }
  return next;
}

/** Данные для сервера. Вызывать после успешной проверки шагов 0–3. */
export function toPayload(state: MonthState, instruments: InstrumentInfo[]): unknown {
  const payload: Record<string, unknown> = { month: state.month };
  if (state.depositAmount.trim() !== "") {
    payload.deposit = { date: state.depositDate, amount: parseDecimal(state.depositAmount, 2) };
  }
  payload.buys = instruments.flatMap((i) =>
    (state.buys[i.id] ?? [])
      .filter((r) => rowFilled(r))
      .map((r) => ({
        instrumentId: i.id,
        date: r.date,
        quantity: parseDecimal(r.quantity, 0),
        price: parseDecimal(r.price, 4),
      })),
  );
  payload.incomes = state.incomes.map((inc) => ({
    instrumentId: inc.instrumentId,
    date: inc.date,
    amount: parseDecimal(inc.amount, 2),
    ...(inc.reinvest
      ? { reinvest: { quantity: parseDecimal(inc.quantity, 0), price: parseDecimal(inc.price, 4) } }
      : {}),
  }));
  payload.prices = instruments
    .filter((i) => (state.prices[i.id] ?? "").trim() !== "")
    .map((i) => ({ instrumentId: i.id, price: parseDecimal(state.prices[i.id], 4) }));
  return payload;
}

/** Итоги для проверки: сколько внесено, потрачено на покупки и получено дохода, в копейках. */
export function summarize(state: MonthState, instruments: InstrumentInfo[]) {
  let deposit = 0n;
  const dep = parseDecimal(state.depositAmount, 2);
  if (dep && isPositive(dep)) deposit = rubToKopecks(dep);

  let bought = 0n;
  let reinvested = 0n;
  const addBuy = (quantity: string, price: string) => {
    const q = parseDecimal(quantity, 0);
    const p = parseDecimal(price, 4);
    return q && p && isPositive(q) && isPositive(p) ? positionKopecks(q, p) : 0n;
  };
  for (const i of instruments) for (const r of state.buys[i.id] ?? []) bought += addBuy(r.quantity, r.price);

  let income = 0n;
  for (const inc of state.incomes) {
    const a = parseDecimal(inc.amount, 2);
    if (a && isPositive(a)) income += rubToKopecks(a);
    if (inc.reinvest) reinvested += addBuy(inc.quantity, inc.price);
  }
  return { deposit, bought, income, reinvested };
}
