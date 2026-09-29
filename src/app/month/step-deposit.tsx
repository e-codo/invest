"use client";

import { todayEkb } from "@/lib/dates";
import { inputCls, labelCls } from "@/app/setup/ui";
import { lastDayOfMonth, type MonthState } from "./state";

type Props = { state: MonthState; update: (patch: Partial<MonthState>) => void };

export function StepDeposit({ state, update }: Props) {
  const max = [lastDayOfMonth(state.month), todayEkb()].sort()[0];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">
        Сколько вы пополнили счёт в этом месяце. Если взноса не было, оставьте поле пустым.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="deposit-amount" className={labelCls}>
            Сумма взноса, ₽
          </label>
          <input
            id="deposit-amount"
            inputMode="decimal"
            value={state.depositAmount}
            onChange={(e) => update({ depositAmount: e.target.value })}
            placeholder="25 000"
            autoFocus
            className={`${inputCls} tabular-nums`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="deposit-date" className={labelCls}>
            Дата
          </label>
          <input
            id="deposit-date"
            type="date"
            min={`${state.month}-01`}
            max={max}
            value={state.depositDate}
            onChange={(e) => update({ depositDate: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
