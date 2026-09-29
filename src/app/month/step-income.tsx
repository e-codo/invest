"use client";

import { formatRub, kopecksToDecimal } from "@/lib/money";
import { todayEkb } from "@/lib/dates";
import { btnSmall, inputCls, labelCls } from "@/app/setup/ui";
import { rowCost } from "./cost";
import { emptyIncome, lastDayOfMonth, type IncomeRow, type InstrumentInfo, type MonthState } from "./state";

type Props = {
  state: MonthState;
  instruments: InstrumentInfo[];
  update: (patch: Partial<MonthState>) => void;
};

export function StepIncome({ state, instruments, update }: Props) {
  const max = [lastDayOfMonth(state.month), todayEkb()].sort()[0];

  const change = (key: string, patch: Partial<IncomeRow>) =>
    update({ incomes: state.incomes.map((r) => (r.key === key ? { ...r, ...patch } : r)) });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">
        Купоны по облигациям и дивиденды. Если вы сразу купили на них ещё бумаг, включите «Реинвестировал»: покупка
        запишется сама. Если доходов не было, пропустите шаг.
      </p>

      {state.incomes.length > 0 && (
        <ul className="flex flex-col gap-4">
          {state.incomes.map((r, n) => {
            const cost = rowCost(r.quantity, r.price);
            return (
              <li key={r.key} className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`is-${r.key}`} className={labelCls}>
                    Фонд
                  </label>
                  <select
                    id={`is-${r.key}`}
                    value={r.instrumentId ?? ""}
                    onChange={(e) => change(r.key, { instrumentId: e.target.value ? Number(e.target.value) : null })}
                    className={inputCls}
                  >
                    <option value="">Выберите фонд</option>
                    {instruments.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.ticker} · {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`ia-${r.key}`} className={labelCls}>
                      Сумма, ₽
                    </label>
                    <input
                      id={`ia-${r.key}`}
                      inputMode="decimal"
                      value={r.amount}
                      onChange={(e) => change(r.key, { amount: e.target.value })}
                      placeholder="0,00"
                      className={`${inputCls} tabular-nums`}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`id-${r.key}`} className={labelCls}>
                      Дата
                    </label>
                    <input
                      id={`id-${r.key}`}
                      type="date"
                      min={`${state.month}-01`}
                      max={max}
                      value={r.date}
                      onChange={(e) => change(r.key, { date: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm">Реинвестировал</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.reinvest}
                    aria-label={`Реинвестировал, доход ${n + 1}`}
                    onClick={() => change(r.key, { reinvest: !r.reinvest })}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${r.reinvest ? "bg-accent" : "bg-line"}`}
                  >
                    <span
                      className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-[left] ${
                        r.reinvest ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {r.reinvest && (
                  <div className="flex flex-col gap-3 border-t border-line pt-3">
                    <p className="text-[13px] text-ink-2">Что купили на этот доход (в тот же день):</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`iq-${r.key}`} className={labelCls}>
                          Количество, шт.
                        </label>
                        <input
                          id={`iq-${r.key}`}
                          inputMode="numeric"
                          value={r.quantity}
                          onChange={(e) => change(r.key, { quantity: e.target.value })}
                          placeholder="0"
                          className={`${inputCls} tabular-nums`}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`ip-${r.key}`} className={labelCls}>
                          Цена за штуку, ₽
                        </label>
                        <input
                          id={`ip-${r.key}`}
                          inputMode="decimal"
                          value={r.price}
                          onChange={(e) => change(r.key, { price: e.target.value })}
                          placeholder="0,00"
                          className={`${inputCls} tabular-nums`}
                        />
                      </div>
                    </div>
                    {cost !== null && (
                      <span className="text-[13px] tabular-nums text-ink-2">
                        Стоимость покупки: <b className="font-semibold text-ink">{formatRub(kopecksToDecimal(cost))}</b>
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => update({ incomes: state.incomes.filter((x) => x.key !== r.key) })}
                    className="text-[13px] text-ink-3 underline-offset-2 hover:text-danger hover:underline"
                  >
                    Удалить доход
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <button
          type="button"
          className={btnSmall}
          onClick={() =>
            update({
              incomes: [
                ...state.incomes,
                emptyIncome(state.depositDate, instruments.length === 1 ? instruments[0].id : null),
              ],
            })
          }
        >
          Добавить купон или дивиденды
        </button>
      </div>
    </div>
  );
}
