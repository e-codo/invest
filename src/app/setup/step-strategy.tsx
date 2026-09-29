"use client";

import { PRESETS } from "@/lib/strategies";
import { AllocationBar } from "./allocation-bar";
import { percentOf, type WizardState } from "./state";
import { inputCls, labelCls } from "./ui";

type Props = { state: WizardState; update: (patch: Partial<WizardState>) => void };

const FIELDS = [
  { key: "stocks", label: "Акции" },
  { key: "bonds", label: "Облигации" },
  { key: "cash", label: "Ликвидность" },
] as const;

export function StepStrategy({ state, update }: Props) {
  const stocks = percentOf(state.stocks) ?? 0;
  const bonds = percentOf(state.bonds) ?? 0;
  const cash = percentOf(state.cash) ?? 0;
  const sum = stocks + bonds + cash;

  function choosePreset(key: (typeof PRESETS)[number]["key"]) {
    const p = PRESETS.find((x) => x.key === key)!;
    update({ preset: key, stocks: String(p.stocks), bonds: String(p.bonds), cash: String(p.cash) });
  }

  function edit(field: "stocks" | "bonds" | "cash", value: string) {
    const next = { stocks: state.stocks, bonds: state.bonds, cash: state.cash, [field]: value.replace(/\D/g, "").slice(0, 3) };
    const match = PRESETS.find(
      (p) => String(p.stocks) === next.stocks && String(p.bonds) === next.bonds && String(p.cash) === next.cash,
    );
    update({ ...next, preset: match ? match.key : "custom" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Стратегия" className="grid gap-3 sm:grid-cols-3">
        {PRESETS.map((p) => {
          const active = state.preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choosePreset(p.key)}
              className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors ${
                active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink-3"
              }`}
            >
              <span className="font-semibold">{p.name}</span>
              <span className="text-sm tabular-nums text-ink-2">
                {p.stocks} / {p.bonds} / {p.cash}
              </span>
              <span className="text-[13px] text-ink-3">{p.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-bg p-4">
        <p className="text-sm text-ink-2">
          {state.preset === "custom"
            ? "Своя стратегия. Задайте доли сами."
            : "Доли можно поменять. Тогда стратегия станет своей."}
        </p>
        <div className="grid grid-cols-1 items-end gap-3 min-[340px]:grid-cols-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label htmlFor={`pct-${f.key}`} className={labelCls}>
                {f.label}, %
              </label>
              <input
                id={`pct-${f.key}`}
                inputMode="numeric"
                value={state[f.key]}
                onChange={(e) => edit(f.key, e.target.value)}
                className={`${inputCls} tabular-nums`}
              />
            </div>
          ))}
        </div>
        <AllocationBar stocks={stocks} bonds={bonds} cash={cash} />
        <p className={`text-sm tabular-nums ${sum === 100 ? "text-good" : "text-danger"}`} aria-live="polite">
          {sum === 100 ? "Сумма 100%" : `Сумма ${sum}%, нужно ровно 100%`}
        </p>
      </div>
    </div>
  );
}
