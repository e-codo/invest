"use client";

import { formatRub, isPositive, kopecksToDecimal, parseDecimal, positionKopecks } from "@/lib/money";
import { todayEkb } from "@/lib/dates";
import type { WizardState } from "./state";
import { inputCls, labelCls } from "./ui";

type Props = { state: WizardState; update: (patch: Partial<WizardState>) => void };

/** Стоимость позиции по тому, что введено, или null, если поля пока не заполнены верно. */
export function rowKopecks(quantity: string, price: string): bigint | null {
  const q = parseDecimal(quantity, 0);
  const p = parseDecimal(price, 4);
  if (!q || !p || !isPositive(q) || !isPositive(p)) return null;
  return positionKopecks(q, p);
}

export function openingTotal(state: WizardState): bigint {
  return state.instruments.reduce((sum, i) => {
    const p = state.positions[i.key];
    return sum + (p ? (rowKopecks(p.quantity, p.price) ?? 0n) : 0n);
  }, 0n);
}

export function StepOpening({ state, update }: Props) {
  const setPosition = (key: string, patch: Partial<{ quantity: string; price: string }>) => {
    const current = state.positions[key] ?? { quantity: "", price: "" };
    update({ positions: { ...state.positions, [key]: { ...current, ...patch } } });
  };

  const total = openingTotal(state);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 rounded-2xl bg-bg p-4">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Указать начальное состояние</span>
          <span className="text-[13px] text-ink-2">
            Что у вас уже есть сейчас. Эта сумма станет стартовым взносом. Историю прошлых месяцев можно добавить позже.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.openingEnabled}
          aria-label="Указать начальное состояние"
          onClick={() => update({ openingEnabled: !state.openingEnabled })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${state.openingEnabled ? "bg-accent" : "bg-line"}`}
        >
          <span
            className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-[left] ${
              state.openingEnabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      {!state.openingEnabled ? (
        <p className="text-sm text-ink-2">Шаг можно пропустить и начать с нуля. Первые взносы вы внесёте в форме «месяц».</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 sm:max-w-xs">
            <label htmlFor="opening-date" className={labelCls}>
              На какую дату
            </label>
            <input
              id="opening-date"
              type="date"
              max={todayEkb()}
              value={state.openingDate}
              onChange={(e) => update({ openingDate: e.target.value })}
              className={inputCls}
            />
          </div>

          <ul className="flex flex-col gap-4">
            {state.instruments.map((i) => {
              const p = state.positions[i.key] ?? { quantity: "", price: "" };
              const cost = rowKopecks(p.quantity, p.price);
              const t = i.ticker.trim().toUpperCase() || "Фонд";
              return (
                <li key={i.key} className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{t}</span>
                    <span className="min-w-0 truncate text-[13px] text-ink-3">{i.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`q-${i.key}`} className={labelCls}>
                        Количество, шт.
                      </label>
                      <input
                        id={`q-${i.key}`}
                        inputMode="numeric"
                        value={p.quantity}
                        onChange={(e) => setPosition(i.key, { quantity: e.target.value })}
                        placeholder="0"
                        className={`${inputCls} tabular-nums`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`p-${i.key}`} className={labelCls}>
                        Цена за штуку, ₽
                      </label>
                      <input
                        id={`p-${i.key}`}
                        inputMode="decimal"
                        value={p.price}
                        onChange={(e) => setPosition(i.key, { price: e.target.value })}
                        placeholder="0,00"
                        className={`${inputCls} tabular-nums`}
                      />
                    </div>
                  </div>
                  {cost !== null && (
                    <span className="text-[13px] text-ink-2 tabular-nums">
                      Стоимость позиции: <b className="font-semibold text-ink">{formatRub(kopecksToDecimal(cost))}</b>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="text-sm text-ink-2 tabular-nums" aria-live="polite">
            Всего на дату: <b className="font-semibold text-ink">{formatRub(kopecksToDecimal(total))}</b>
          </p>
        </div>
      )}
    </div>
  );
}
