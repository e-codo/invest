"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveMonth } from "@/app/actions/month";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/app/setup/ui";
import { todayEkb } from "@/lib/dates";
import { formatMonth } from "./format";
import { StepBuys } from "./step-buys";
import { StepDeposit } from "./step-deposit";
import { StepIncome } from "./step-income";
import { StepPrices } from "./step-prices";
import { StepReview } from "./step-review";
import {
  STEPS,
  initialState,
  suggestPrices,
  toPayload,
  validateStep,
  withMonth,
  type InstrumentInfo,
  type MonthState,
} from "./state";

const TITLES = ["Взнос", "Покупки", "Купоны и дивиденды", "Цены на сегодня", "Всё верно?"] as const;

type Props = {
  instruments: InstrumentInfo[];
  /** Месяцы в формате ГГГГ-ММ, за которые цены уже отмечены. */
  markedMonths: string[];
};

export function MonthForm({ instruments, markedMonths }: Props) {
  const [state, setState] = useState<MonthState>(() => initialState(instruments));
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  const update = (patch: Partial<MonthState>) => {
    setError(null);
    setState((s) => ({ ...s, ...patch }));
  };

  const last = step === STEPS.length - 1;
  const alreadyMarked = markedMonths.includes(state.month);

  function next() {
    const problem = validateStep(step, state, instruments);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step === 2) setState((s) => ({ ...s, prices: suggestPrices(s, instruments) }));
    setStep(step + 1);
  }

  function submit() {
    for (let s = 0; s < STEPS.length - 1; s++) {
      const problem = validateStep(s, state, instruments);
      if (problem) {
        setStep(s);
        setError(problem);
        return;
      }
    }
    startTransition(async () => {
      const result = await saveMonth(toPayload(state, instruments));
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 text-[13px] text-ink-3">
          <span>
            Шаг {step + 1} из {STEPS.length}
          </span>
          <span className="capitalize">{formatMonth(state.month)}</span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <i key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
          {TITLES[step]}
        </h2>

        {step === 0 && (
          <div className="flex flex-col gap-2 sm:max-w-xs">
            <label htmlFor="month" className={labelCls}>
              За какой месяц
            </label>
            <input
              id="month"
              type="month"
              max={todayEkb().slice(0, 7)}
              value={state.month}
              onChange={(e) => {
                if (/^\d{4}-\d{2}$/.test(e.target.value)) {
                  setError(null);
                  setState((s) => withMonth(s, e.target.value));
                }
              }}
              className={inputCls}
            />
            {alreadyMarked && (
              <p className="text-[13px] text-ink-3">
                Этот месяц уже отмечен. Новые операции добавятся к прежним, а цены обновятся.
              </p>
            )}
          </div>
        )}

        {step === 0 && <StepDeposit state={state} update={update} />}
        {step === 1 && <StepBuys state={state} instruments={instruments} update={update} />}
        {step === 2 && <StepIncome state={state} instruments={instruments} update={update} />}
        {step === 3 && <StepPrices state={state} instruments={instruments} update={update} />}
        {step === 4 && <StepReview state={state} instruments={instruments} />}

        {error && (
          <p role="alert" className="rounded-xl bg-bg px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={btnGhost}
            disabled={step === 0 || pending}
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
          >
            Назад
          </button>
          {last ? (
            <button type="button" className={btnPrimary} disabled={pending} onClick={submit}>
              {pending ? "Сохраняю…" : "Сохранить"}
            </button>
          ) : (
            <button type="button" className={btnPrimary} onClick={next}>
              Дальше
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
