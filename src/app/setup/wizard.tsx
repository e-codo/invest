"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { completeSetup } from "@/app/actions/setup";
import { StepGoal } from "./step-goal";
import { StepInstruments } from "./step-instruments";
import { StepOpening } from "./step-opening";
import { StepReview } from "./step-review";
import { StepStrategy } from "./step-strategy";
import { STEPS, initialState, toPayload, validateStep, type WizardState } from "./state";
import { btnGhost, btnPrimary } from "./ui";

const TITLES = [
  "Выберите стратегию",
  "Цель и вехи",
  "Ваши фонды",
  "Начальное состояние",
  "Всё верно?",
] as const;

export function Wizard() {
  const [state, setState] = useState<WizardState>(initialState);
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

  const update = (patch: Partial<WizardState>) => {
    setError(null);
    setState((s) => ({ ...s, ...patch }));
  };

  const last = step === STEPS.length - 1;

  function next() {
    const problem = validateStep(step, state);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep(step + 1);
  }

  function submit() {
    for (let s = 0; s < STEPS.length - 1; s++) {
      const problem = validateStep(s, state);
      if (problem) {
        setStep(s);
        setError(problem);
        return;
      }
    }
    startTransition(async () => {
      const result = await completeSetup(toPayload(state));
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
          <span>{STEPS[step]}</span>
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
        {step === 0 && <StepStrategy state={state} update={update} />}
        {step === 1 && <StepGoal state={state} update={update} />}
        {step === 2 && <StepInstruments state={state} update={update} />}
        {step === 3 && <StepOpening state={state} update={update} />}
        {step === 4 && <StepReview state={state} />}

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
              {pending ? "Сохраняю…" : "Начать"}
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
