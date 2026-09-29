import { parseDecimal, isPositive } from "@/lib/money";
import { todayEkb } from "@/lib/dates";
import { PRESETS, type AssetClassKey, type StrategyKey } from "@/lib/strategies";

export type InstrumentDraft = {
  key: string;
  ticker: string;
  name: string;
  assetClass: AssetClassKey;
};

export type WizardState = {
  preset: StrategyKey;
  stocks: string;
  bonds: string;
  cash: string;
  goal: string;
  milestones: string[];
  instruments: InstrumentDraft[];
  openingEnabled: boolean;
  openingDate: string;
  positions: Record<string, { quantity: string; price: string }>;
};

export const DEFAULT_MILESTONES = ["100000", "300000", "500000", "1000000", "1500000"];

export function initialState(): WizardState {
  const p = PRESETS[0];
  return {
    preset: p.key,
    stocks: String(p.stocks),
    bonds: String(p.bonds),
    cash: String(p.cash),
    goal: "3000000",
    milestones: [...DEFAULT_MILESTONES],
    instruments: [],
    openingEnabled: false,
    openingDate: todayEkb(),
    positions: {},
  };
}

export const STEPS = ["Стратегия", "Цель и вехи", "Фонды", "Начальное состояние", "Проверка"] as const;

export function percentOf(value: string): number | null {
  return /^\d{1,3}$/.test(value.trim()) ? Number(value) : null;
}

/** Ошибка шага или null, если шаг заполнен верно. */
export function validateStep(step: number, s: WizardState): string | null {
  switch (step) {
    case 0: {
      const parts = [percentOf(s.stocks), percentOf(s.bonds), percentOf(s.cash)];
      if (parts.some((p) => p === null || p > 100)) return "Доли должны быть целыми числами от 0 до 100.";
      const sum = parts.reduce<number>((a, b) => a + (b ?? 0), 0);
      return sum === 100 ? null : `Сейчас в сумме ${sum}%. Нужно ровно 100%.`;
    }
    case 1: {
      const goal = parseDecimal(s.goal, 2);
      if (!goal || !isPositive(goal)) return "Укажите цель числом больше нуля, например 3 000 000.";
      if (s.milestones.length === 0) return "Добавьте хотя бы одну веху.";
      const seen = new Set<string>();
      for (const m of s.milestones) {
        const v = parseDecimal(m, 2);
        if (!v || !isPositive(v)) return "Каждая веха должна быть числом больше нуля.";
        const norm = Number(v);
        if (seen.has(String(norm))) return "Вехи не должны повторяться.";
        seen.add(String(norm));
      }
      return null;
    }
    case 2: {
      if (s.instruments.length === 0) return "Добавьте хотя бы один фонд.";
      const tickers = new Set<string>();
      for (const i of s.instruments) {
        const t = i.ticker.trim().toUpperCase();
        if (!/^[A-Z0-9._-]{2,12}$/.test(t)) return "Тикер: 2–12 латинских букв или цифр.";
        if (!i.name.trim()) return `Укажите название для ${t}.`;
        if (tickers.has(t)) return `Тикер ${t} указан дважды.`;
        tickers.add(t);
      }
      return null;
    }
    case 3: {
      if (!s.openingEnabled) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.openingDate)) return "Укажите дату начального состояния.";
      if (s.openingDate > todayEkb()) return "Дата не может быть в будущем.";
      let filled = 0;
      for (const i of s.instruments) {
        const p = s.positions[i.key];
        const q = p?.quantity.trim() ?? "";
        const pr = p?.price.trim() ?? "";
        if (!q && !pr) continue;
        const t = i.ticker.trim().toUpperCase();
        const qty = parseDecimal(q, 0);
        const price = parseDecimal(pr, 4);
        if (!qty || !isPositive(qty)) return `${t}: количество должно быть целым числом больше нуля.`;
        if (!price || !isPositive(price)) return `${t}: цена указана неверно (не больше 4 знаков после запятой).`;
        filled++;
      }
      return filled > 0 ? null : "Заполните хотя бы одну позицию или выключите этот шаг.";
    }
    default:
      return null;
  }
}

/** Превращает ответы пользователя в данные для сервера. Вызывать после validateStep для шагов 0–3. */
export function toPayload(s: WizardState): unknown {
  const milestones = s.milestones.map((m) => parseDecimal(m, 2));
  const payload: Record<string, unknown> = {
    strategy: {
      preset: s.preset,
      stocks: percentOf(s.stocks),
      bonds: percentOf(s.bonds),
      cash: percentOf(s.cash),
    },
    goal: parseDecimal(s.goal, 2),
    milestones: milestones.sort((a, b) => Number(a) - Number(b)),
    instruments: s.instruments.map((i) => ({
      ticker: i.ticker.trim().toUpperCase(),
      name: i.name.trim(),
      assetClass: i.assetClass,
    })),
  };
  if (s.openingEnabled) {
    payload.opening = {
      date: s.openingDate,
      positions: s.instruments.flatMap((i) => {
        const p = s.positions[i.key];
        if (!p || (!p.quantity.trim() && !p.price.trim())) return [];
        return [
          {
            ticker: i.ticker.trim().toUpperCase(),
            quantity: parseDecimal(p.quantity, 0),
            price: parseDecimal(p.price, 4),
          },
        ];
      }),
    };
  }
  return payload;
}
