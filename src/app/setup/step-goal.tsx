"use client";

import { isPositive, parseDecimal } from "@/lib/money";
import { DEFAULT_MILESTONES, type WizardState } from "./state";
import { btnSmall, inputCls, labelCls } from "./ui";

type Props = { state: WizardState; update: (patch: Partial<WizardState>) => void };

export function StepGoal({ state, update }: Props) {
  const goal = parseDecimal(state.goal, 2);
  const aboveGoal =
    goal && isPositive(goal)
      ? state.milestones.some((m) => {
          const v = parseDecimal(m, 2);
          return v !== null && Number(v) > Number(goal);
        })
      : false;

  const setMilestone = (index: number, value: string) =>
    update({ milestones: state.milestones.map((m, i) => (i === index ? value : m)) });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="goal" className={labelCls}>
          Цель, ₽
        </label>
        <input
          id="goal"
          inputMode="decimal"
          value={state.goal}
          onChange={(e) => update({ goal: e.target.value })}
          placeholder="3 000 000"
          className={`${inputCls} tabular-nums`}
        />
        <p className="text-[13px] text-ink-3">Итоговая сумма, к которой вы идёте. Её можно будет изменить позже.</p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${labelCls} mb-1`}>Вехи, ₽</legend>
        {state.milestones.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              aria-label={`Веха ${i + 1}`}
              inputMode="decimal"
              value={m}
              onChange={(e) => setMilestone(i, e.target.value)}
              className={`${inputCls} tabular-nums`}
            />
            <button
              type="button"
              onClick={() => update({ milestones: state.milestones.filter((_, j) => j !== i) })}
              aria-label={`Удалить веху ${i + 1}`}
              title="Удалить"
              className="icon-btn grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-3 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSmall} onClick={() => update({ milestones: [...state.milestones, ""] })}>
            Добавить веху
          </button>
          <button type="button" className={btnSmall} onClick={() => update({ milestones: [...DEFAULT_MILESTONES] })}>
            Стандартные вехи
          </button>
        </div>
        {aboveGoal && (
          <p className="text-[13px] text-ink-3">Одна из вех выше цели. Это допустимо, но цель придётся поднять.</p>
        )}
      </fieldset>
    </div>
  );
}
