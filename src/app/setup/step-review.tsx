"use client";

import { formatRub, kopecksToDecimal, parseDecimal } from "@/lib/money";
import { assetClassName, strategyName } from "@/lib/strategies";
import { AllocationBar } from "./allocation-bar";
import { openingTotal } from "./step-opening";
import { percentOf, type WizardState } from "./state";

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-3">{title}</h3>
      {children}
    </div>
  );
}

export function StepReview({ state }: { state: WizardState }) {
  const goal = parseDecimal(state.goal, 2) ?? "0";
  const milestones = state.milestones
    .map((m) => parseDecimal(m, 2))
    .filter((m): m is string => m !== null)
    .sort((a, b) => Number(a) - Number(b));
  const total = openingTotal(state);

  return (
    <div className="flex flex-col gap-4">
      <Row title="Стратегия">
        <p className="font-medium">{strategyName(state.preset)}</p>
        <AllocationBar
          stocks={percentOf(state.stocks) ?? 0}
          bonds={percentOf(state.bonds) ?? 0}
          cash={percentOf(state.cash) ?? 0}
        />
      </Row>
      <Row title="Цель">
        <p className="text-xl font-semibold tabular-nums">{formatRub(goal)}</p>
        <ul className="flex flex-wrap gap-2">
          {milestones.map((m) => (
            <li key={m} className="rounded-full border border-line px-3 py-1 text-[13px] tabular-nums text-ink-2">
              {formatRub(m)}
            </li>
          ))}
        </ul>
      </Row>
      <Row title="Фонды">
        <ul className="flex flex-col gap-1.5">
          {state.instruments.map((i) => (
            <li key={i.key} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span>
                <b className="font-semibold">{i.ticker.trim().toUpperCase()}</b>{" "}
                <span className="text-ink-2">{i.name.trim()}</span>
              </span>
              <span className="text-ink-3">{assetClassName(i.assetClass)}</span>
            </li>
          ))}
        </ul>
      </Row>
      <Row title="Начальное состояние">
        {state.openingEnabled ? (
          <p className="text-sm tabular-nums">
            <b className="font-semibold">{formatRub(kopecksToDecimal(total))}</b> на {state.openingDate.split("-").reverse().join(".")}
          </p>
        ) : (
          <p className="text-sm text-ink-2">Начинаете с нуля.</p>
        )}
      </Row>
    </div>
  );
}
