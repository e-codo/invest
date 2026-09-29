"use client";

import { formatRub, kopecksToDecimal } from "@/lib/money";
import { todayEkb } from "@/lib/dates";
import { btnSmall, inputCls, labelCls } from "@/app/setup/ui";
import { rowCost } from "./cost";
import { emptyBuy, lastDayOfMonth, trimDecimal, type BuyRow, type InstrumentInfo, type MonthState } from "./state";

type Props = {
  state: MonthState;
  instruments: InstrumentInfo[];
  update: (patch: Partial<MonthState>) => void;
};

export function StepBuys({ state, instruments, update }: Props) {
  const max = [lastDayOfMonth(state.month), todayEkb()].sort()[0];

  const setRows = (id: number, rows: BuyRow[]) => update({ buys: { ...state.buys, [id]: rows } });
  const change = (id: number, key: string, patch: Partial<BuyRow>) =>
    setRows(
      id,
      (state.buys[id] ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">
        Что вы купили. Заполните только те фонды, где были покупки. Пустые строки можно не трогать.
      </p>
      <ul className="flex flex-col gap-4">
        {instruments.map((i) => {
          const rows = state.buys[i.id] ?? [];
          return (
            <li key={i.id} className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{i.ticker}</span>
                <span className="min-w-0 truncate text-[13px] text-ink-3">
                  {i.name}
                  {Number(i.held) > 0 ? ` · сейчас ${trimDecimal(i.held)} шт.` : ""}
                </span>
              </div>
              {rows.map((r, n) => {
                const cost = rowCost(r.quantity, r.price);
                return (
                  <div key={r.key} className="flex flex-col gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`bq-${r.key}`} className={labelCls}>
                          Количество, шт.
                        </label>
                        <input
                          id={`bq-${r.key}`}
                          inputMode="numeric"
                          value={r.quantity}
                          onChange={(e) => change(i.id, r.key, { quantity: e.target.value })}
                          placeholder="0"
                          className={`${inputCls} tabular-nums`}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`bp-${r.key}`} className={labelCls}>
                          Цена за штуку, ₽
                        </label>
                        <input
                          id={`bp-${r.key}`}
                          inputMode="decimal"
                          value={r.price}
                          onChange={(e) => change(i.id, r.key, { price: e.target.value })}
                          placeholder="0,00"
                          className={`${inputCls} tabular-nums`}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`bd-${r.key}`} className={labelCls}>
                          Дата
                        </label>
                        <input
                          id={`bd-${r.key}`}
                          type="date"
                          min={`${state.month}-01`}
                          max={max}
                          value={r.date}
                          onChange={(e) => change(i.id, r.key, { date: e.target.value })}
                          className={`${inputCls} w-auto`}
                        />
                      </div>
                      <div className="flex items-center gap-3 pb-1">
                        {cost !== null && (
                          <span className="text-[13px] tabular-nums text-ink-2">
                            <b className="font-semibold text-ink">{formatRub(kopecksToDecimal(cost))}</b>
                          </span>
                        )}
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setRows(i.id, rows.filter((x) => x.key !== r.key))}
                            aria-label={`Убрать покупку ${n + 1} ${i.ticker}`}
                            className="text-[13px] text-ink-3 underline-offset-2 hover:text-danger hover:underline"
                          >
                            Убрать
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div>
                <button
                  type="button"
                  className={btnSmall}
                  onClick={() => setRows(i.id, [...rows, emptyBuy(rows[rows.length - 1]?.date ?? state.depositDate)])}
                >
                  Ещё покупка {i.ticker}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
