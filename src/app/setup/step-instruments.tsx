"use client";

import { ASSET_CLASSES, type AssetClassKey } from "@/lib/strategies";
import type { InstrumentDraft, WizardState } from "./state";
import { btnSmall, inputCls, labelCls } from "./ui";

type Props = { state: WizardState; update: (patch: Partial<WizardState>) => void };

let counter = 0;
export const newKey = () => `k${++counter}`;

// Примеры распространённых фондов на Мосбирже. Название и класс можно поправить.
const SUGGESTIONS: { ticker: string; name: string; assetClass: AssetClassKey }[] = [
  { ticker: "TMOS", name: "Индекс МосБиржи", assetClass: "stocks" },
  { ticker: "SBMX", name: "Индекс МосБиржи (Сбер)", assetClass: "stocks" },
  { ticker: "SBGB", name: "Государственные облигации", assetClass: "bonds" },
  { ticker: "SBRB", name: "Русские облигации", assetClass: "bonds" },
  { ticker: "LQDT", name: "Ликвидность", assetClass: "cash" },
];

export function StepInstruments({ state, update }: Props) {
  const have = new Set(state.instruments.map((i) => i.ticker.trim().toUpperCase()));
  const suggestions = SUGGESTIONS.filter((s) => !have.has(s.ticker));

  const change = (key: string, patch: Partial<InstrumentDraft>) =>
    update({ instruments: state.instruments.map((i) => (i.key === key ? { ...i, ...patch } : i)) });

  const remove = (key: string) => {
    const { [key]: _removed, ...rest } = state.positions;
    void _removed;
    update({ instruments: state.instruments.filter((i) => i.key !== key), positions: rest });
  };

  const add = (draft: Omit<InstrumentDraft, "key">) =>
    update({ instruments: [...state.instruments, { key: newKey(), ...draft }] });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">
        Добавьте фонды и бумаги, в которые вкладываете. У каждого свой класс: он нужен, чтобы сравнивать портфель со стратегией.
      </p>

      {state.instruments.length > 0 && (
        <ul className="flex flex-col gap-4">
          {state.instruments.map((i, n) => (
            <li key={i.key} className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`t-${i.key}`} className={labelCls}>
                    Тикер
                  </label>
                  <input
                    id={`t-${i.key}`}
                    value={i.ticker}
                    onChange={(e) => change(i.key, { ticker: e.target.value.toUpperCase() })}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="TMOS"
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`n-${i.key}`} className={labelCls}>
                    Название
                  </label>
                  <input
                    id={`n-${i.key}`}
                    value={i.name}
                    onChange={(e) => change(i.key, { name: e.target.value })}
                    autoComplete="off"
                    placeholder="Индекс МосБиржи"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div role="radiogroup" aria-label={`Класс актива, фонд ${n + 1}`} className="flex flex-wrap gap-2">
                  {ASSET_CLASSES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="radio"
                      aria-checked={i.assetClass === c.key}
                      onClick={() => change(i.key, { assetClass: c.key })}
                      className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
                        i.assetClass === c.key
                          ? "border-accent bg-accent-soft text-ink"
                          : "border-line bg-surface text-ink-2 hover:border-ink-3"
                      }`}
                    >
                      <i className="inline-block size-2.5 rounded-[3px]" style={{ background: c.color }} />
                      {c.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => remove(i.key)}
                  className="text-[13px] text-ink-3 underline-offset-2 hover:text-danger hover:underline"
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        {suggestions.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-3">Быстро добавить (проверьте название и класс):</span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.ticker}
                  type="button"
                  className={btnSmall}
                  onClick={() => add({ ticker: s.ticker, name: s.name, assetClass: s.assetClass })}
                >
                  + {s.ticker}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <button type="button" className={btnSmall} onClick={() => add({ ticker: "", name: "", assetClass: "stocks" })}>
            Добавить свой фонд
          </button>
        </div>
      </div>
    </div>
  );
}
