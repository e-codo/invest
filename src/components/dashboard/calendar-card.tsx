"use client";

import { useState } from "react";
import type { CalendarMonth } from "@/lib/dashboard";

const NAMES = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const LETTERS = ["Я", "Ф", "М", "А", "М", "И", "И", "А", "С", "О", "Н", "Д"];

type Props = { nowMonth: string; calendar: Record<string, CalendarMonth>; streak: number };

/** Сетка из трёх лет: месяц закрашен, если в нём был взнос. */
export function CalendarCard({ nowMonth, calendar, streak }: Props) {
  const nowYear = Number(nowMonth.slice(0, 4));
  const nowM = Number(nowMonth.slice(5, 7)) - 1;
  const [endYear, setEndYear] = useState(nowYear);
  const [selected, setSelected] = useState<string | null>(null);
  const years = [endYear - 2, endYear - 1, endYear];
  const chosen = selected ? calendar[selected] : undefined;

  const cellBase = "aspect-auto h-[26px] w-full rounded-[5px] sm:h-10 sm:rounded-[10px]";

  return (
    <section
      aria-label="Календарь взносов"
      className="flex min-w-0 flex-col gap-3.5 rounded-[var(--radius-card)] border border-line bg-surface p-[18px] sm:p-[22px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-3">Календарь взносов</h2>
        <div className="-ml-2 flex items-center gap-1 sm:ml-0">
          <button
            type="button"
            onClick={() => setEndYear((y) => y - 1)}
            aria-label="Раньше"
            title="Раньше"
            className="icon-btn grid size-8 place-items-center rounded-full text-ink-2 hover:bg-bg"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="whitespace-nowrap px-1 text-[13px] font-semibold tabular-nums text-ink-2">
            {years[0]} – {years[2]}
          </span>
          <button
            type="button"
            onClick={() => setEndYear((y) => y + 1)}
            aria-label="Позже"
            title="Позже"
            className="icon-btn grid size-8 place-items-center rounded-full text-ink-2 hover:bg-bg"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[34px_repeat(12,minmax(0,1fr))] items-center gap-1 sm:grid-cols-[44px_repeat(12,minmax(0,1fr))] sm:gap-2">
        <span />
        {LETTERS.map((l, i) => (
          <span key={i} className="text-center text-[11px] uppercase text-ink-3">
            {l}
          </span>
        ))}
        {years.map((y) => (
          <Row key={y} year={y}>
            {NAMES.map((name, m) => {
              const key = `${y}-${String(m + 1).padStart(2, "0")}`;
              const entry = calendar[key];
              const future = y * 12 + m > nowYear * 12 + nowM;
              const isNow = y === nowYear && m === nowM;
              const label = `${name} ${y}`;
              if (entry?.paid) {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(selected === key ? null : key)}
                    aria-label={`${label}, взнос внесён`}
                    aria-pressed={selected === key}
                    className={`${cellBase} bg-accent hover:brightness-110 ${
                      selected === key ? "shadow-[0_0_0_2px_var(--surface),0_0_0_3.5px_var(--accent)]" : ""
                    }`}
                  />
                );
              }
              return (
                <span
                  key={key}
                  role="img"
                  aria-label={`${label}, ${future ? "впереди" : "взноса нет"}`}
                  className={`${cellBase} ${
                    future || isNow
                      ? `bg-transparent ${isNow ? "shadow-[inset_0_0_0_1.5px_var(--ink-3)]" : "shadow-[inset_0_0_0_1px_var(--line)]"}`
                      : "bg-line"
                  }`}
                />
              );
            })}
          </Row>
        ))}
      </div>

      <p className="min-h-5 text-[13px] text-ink-3" aria-live="polite">
        {selected && chosen ? (
          <>
            <b className="font-semibold text-ink">
              {NAMES[Number(selected.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase())} {selected.slice(0, 4)}.
            </b>{" "}
            {chosen.notes.join(" · ")}
          </>
        ) : streak > 0 ? (
          <>
            <b className="font-semibold text-ink">{streak} мес. подряд</b> без пропусков. Нажмите на месяц, чтобы посмотреть детали.
          </>
        ) : (
          "Отметьте месяц с взносом, и он закрасится здесь."
        )}
      </p>
    </section>
  );
}

function Row({ year, children }: { year: number; children: React.ReactNode }) {
  return (
    <>
      <span className="text-xs tabular-nums text-ink-3">{year}</span>
      {children}
    </>
  );
}
