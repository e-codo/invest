"use client";

import { inputCls } from "@/app/setup/ui";
import { formatMonth } from "./format";
import { needsPrice, trimDecimal, type InstrumentInfo, type MonthState } from "./state";

type Props = {
  state: MonthState;
  instruments: InstrumentInfo[];
  update: (patch: Partial<MonthState>) => void;
};

export function StepPrices({ state, instruments, update }: Props) {
  const required = needsPrice(state, instruments);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">
        Текущая цена каждого фонда за штуку: по ней оценивается портфель. Возьмите цену закрытия из приложения брокера.
        Подставлена прошлая цена, обновите её.
      </p>
      <ul className="flex flex-col gap-4">
        {instruments.map((i) => (
          <li key={i.id} className="flex flex-col gap-2 rounded-2xl bg-bg p-4">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`pr-${i.id}`} className="font-semibold">
                {i.ticker}
              </label>
              <span className="min-w-0 truncate text-[13px] text-ink-3">{i.name}</span>
            </div>
            <input
              id={`pr-${i.id}`}
              inputMode="decimal"
              value={state.prices[i.id] ?? ""}
              onChange={(e) => update({ prices: { ...state.prices, [i.id]: e.target.value } })}
              placeholder={required.has(i.id) ? "Нужна цена" : "Необязательно"}
              aria-label={`Цена ${i.ticker}, ₽`}
              className={`${inputCls} tabular-nums`}
            />
            <span className="text-[13px] text-ink-3">
              {i.lastPrice
                ? `Прошлая цена: ${trimDecimal(i.lastPrice).replace(".", ",")} ₽ (${formatMonth((i.lastMonth ?? "").slice(0, 7))})`
                : "Цен пока нет."}
              {!required.has(i.id) && " У вас нет этой бумаги, цену можно не указывать."}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
