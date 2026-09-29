"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateSettings } from "@/app/actions/settings";
import { StepGoal } from "@/app/setup/step-goal";
import { StepStrategy } from "@/app/setup/step-strategy";
import { initialState, toPayload, validateStep, type WizardState } from "@/app/setup/state";
import { btnGhost, btnPrimary, inputCls, labelCls } from "@/app/setup/ui";
import { isPositive, parseDecimal } from "@/lib/money";
import type { StrategyKey } from "@/lib/strategies";

type Initial = {
  preset: StrategyKey;
  stocks: string;
  bonds: string;
  cash: string;
  goal: string;
  milestones: string[];
  forecastRate: string;
  forecastMonthly: string;
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsForm({ initial }: { initial: Initial }) {
  const [state, setState] = useState<WizardState>(() => ({
    ...initialState(),
    preset: initial.preset,
    stocks: initial.stocks,
    bonds: initial.bonds,
    cash: initial.cash,
    goal: initial.goal,
    milestones: initial.milestones,
  }));
  const [rate, setRate] = useState(initial.forecastRate);
  const [monthly, setMonthly] = useState(initial.forecastMonthly);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<WizardState>) => {
    setError(null);
    setState((s) => ({ ...s, ...patch }));
  };

  function problem(): string | null {
    const strategy = validateStep(0, state);
    if (strategy) return strategy;
    const goal = validateStep(1, state);
    if (goal) return goal;
    const r = parseDecimal(rate, 2);
    if (!r || Number(r) > 50) return "Ставка прогноза: число от 0 до 50, например 16.";
    if (monthly.trim() !== "") {
      const m = parseDecimal(monthly, 2);
      if (!m || !isPositive(m)) return "Взнос в прогнозе: число больше нуля или пустое поле.";
    }
    return null;
  }

  function save() {
    const p = problem();
    if (p) {
      setError(p);
      return;
    }
    const base = toPayload(state) as Record<string, unknown>;
    startTransition(async () => {
      const result = await updateSettings({
        strategy: base.strategy,
        goal: base.goal,
        milestones: base.milestones,
        forecastRate: parseDecimal(rate, 2),
        forecastMonthly: monthly.trim() === "" ? null : parseDecimal(monthly, 2),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card title="Стратегия">
        <StepStrategy state={state} update={update} />
      </Card>
      <Card title="Цель и вехи">
        <StepGoal state={state} update={update} />
      </Card>
      <Card title="Прогноз">
        <p className="text-sm text-ink-2">
          Линия прогноза на графике. Это сценарий, а не обещание: реальная доходность может быть ниже.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="rate" className={labelCls}>
              Ожидаемая доходность, % годовых
            </label>
            <input
              id="rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => {
                setError(null);
                setRate(e.target.value);
              }}
              className={`${inputCls} tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="monthly" className={labelCls}>
              Взнос в месяц, ₽
            </label>
            <input
              id="monthly"
              inputMode="decimal"
              value={monthly}
              onChange={(e) => {
                setError(null);
                setMonthly(e.target.value);
              }}
              placeholder="по вашей истории"
              className={`${inputCls} tabular-nums`}
            />
            <p className="text-[13px] text-ink-3">Пустое поле: берётся средний взнос за последние 6 месяцев.</p>
          </div>
        </div>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-surface px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className={`${btnGhost} grid place-items-center`}>
          Отмена
        </Link>
        <button type="button" className={btnPrimary} disabled={pending} onClick={save}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
