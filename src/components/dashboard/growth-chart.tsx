"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Dashboard } from "@/lib/dashboard";
import { formatCompact, formatRubShort, shortMonthLabel } from "@/lib/format";

type Chart = Dashboard["chart"];
type Prefs = { h: 5 | 10 | 15; forecast: boolean; compound: boolean };

const PREFS_KEY = "chart-prefs";
const HORIZONS = [5, 10, 15] as const;
const PT = 12;
const PB = 30;

function niceMax(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

const DEFAULT_PREFS: Prefs = { h: 10, forecast: true, compound: true };

function parsePrefs(raw: string): Prefs {
  try {
    const p = JSON.parse(raw || "{}");
    return {
      h: p.h === 5 || p.h === 10 || p.h === 15 ? p.h : DEFAULT_PREFS.h,
      forecast: p.forecast !== false,
      compound: p.compound !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Настройки графика хранятся в браузере. useSyncExternalStore отдаёт серверу значения по умолчанию,
// а после загрузки подставляет сохранённые без ошибки гидратации.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
// Запасной вариант на случай, когда localStorage недоступен: переключатели всё равно работают до перезагрузки.
let memory = "";
const getSnapshot = () => {
  if (memory) return memory;
  try {
    return localStorage.getItem(PREFS_KEY) ?? "";
  } catch {
    return "";
  }
};
const getServerSnapshot = () => "";

function savePrefs(next: Prefs) {
  memory = JSON.stringify(next);
  try {
    localStorage.setItem(PREFS_KEY, memory);
  } catch {
    // Хранилище недоступно: настройки просто не запомнятся.
  }
  listeners.forEach((cb) => cb());
}

export function GrowthChart({ chart }: { chart: Chart }) {
  const rawPrefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const prefs = useMemo(() => parsePrefs(rawPrefs), [rawPrefs]);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    measure();
    if (!window.ResizeObserver) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const change = (patch: Partial<Prefs>) => savePrefs({ ...prefs, ...patch });

  const { nowIndex } = chart;
  const total = nowIndex + prefs.h * 12;
  const narrow = width < 520;
  const H = narrow ? Math.max(240, Math.round(width * 0.8)) : 320;
  const PL = narrow ? 50 : 56;
  const PR = narrow ? 12 : 14;

  const geo = useMemo(() => {
    const maxV = Math.max(
      ...chart.fact,
      chart.only[total] ?? 0,
      prefs.forecast ? (chart.fc[prefs.h * 12] ?? 0) : 0,
    );
    const top = niceMax(maxV * 1.02);
    const x = (t: number) => PL + (t / total) * (width - PL - PR);
    const y = (v: number) => PT + (1 - v / top) * (H - PT - PB);
    return { top, x, y };
  }, [chart, total, prefs.forecast, prefs.h, width, H, PL, PR]);

  const { top, x, y } = geo;
  const path = (values: number[], from: number, to: number, offset = 0) => {
    let d = "";
    for (let i = from; i <= to; i++) d += `${i === from ? "M" : "L"}${x(i).toFixed(1)} ${y(values[i - offset]).toFixed(1)}`;
    return d;
  };

  const fcAt = (t: number) => (t >= nowIndex ? chart.fc[t - nowIndex] : undefined);
  const factAt = (t: number) => (t <= nowIndex ? chart.fact[t] : undefined);

  const compoundPath = () => {
    let d = path(chart.fc, nowIndex, total, nowIndex);
    for (let i = total; i >= nowIndex; i--) d += `L${x(i).toFixed(1)} ${y(chart.only[i]).toFixed(1)}`;
    return `${d}Z`;
  };

  const pxYear = (width - PL - PR) / (total / 12);
  const step = ([1, 2, 3, 5].find((c) => pxYear * c >= 46) ?? 5) as number;
  const startYear = Number(chart.startMonth.slice(0, 4));
  const startMonthIdx = Number(chart.startMonth.slice(5, 7)) - 1;
  const yearTicks: { t: number; label: number }[] = [];
  for (let k = 0; ; k += step) {
    const t = k * 12;
    if (t > total) break;
    yearTicks.push({ t, label: startYear + Math.floor((startMonthIdx + t) / 12) });
  }

  const t = hover ?? nowIndex;
  const fact = factAt(t);
  const fc = fcAt(t);
  const only = chart.only[t];
  const monthLabel = shortMonthLabel(chart.startMonth, t);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    setHover(Math.max(0, Math.min(total, Math.round(((px - PL) / (width - PL - PR)) * total))));
  }

  const switchCls = (on: boolean) =>
    `relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`;
  const knobCls = (on: boolean) =>
    `absolute top-0.5 size-3 rounded-full bg-surface shadow-[0_0_0_1px_rgb(0_0_0/0.1)] transition-[left] ${on ? "left-[14px]" : "left-0.5"}`;

  return (
    <section
      aria-label="График роста"
      className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-[18px] sm:p-[22px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-3">Рост портфеля</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Горизонт" className="inline-flex rounded-full border border-line bg-bg p-[3px]">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={prefs.h === h}
                onClick={() => change({ h })}
                className={`rounded-full px-3 py-1.5 text-[13px] sm:px-3.5 ${
                  prefs.h === h ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
                }`}
              >
                {h} лет
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={prefs.forecast}
            onClick={() => change({ forecast: !prefs.forecast })}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2 pr-3 text-[13px] text-ink-2"
          >
            <span className={switchCls(prefs.forecast)}>
              <span className={knobCls(prefs.forecast)} />
            </span>
            Прогноз {chart.ratePct.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%
          </button>
          <button
            type="button"
            aria-pressed={prefs.compound}
            onClick={() => change({ compound: !prefs.compound })}
            className={`inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2 pr-3 text-[13px] text-ink-2 ${
              prefs.forecast ? "" : "opacity-50"
            }`}
          >
            <span className={switchCls(prefs.compound)}>
              <span className={knobCls(prefs.compound)} />
            </span>
            Сложный процент
          </button>
        </div>
      </div>

      {/* Значения выстроены в сетку, поэтому строка не меняет высоту при наведении. */}
      <div
        className="grid gap-x-5 gap-y-1.5 pb-2 text-[13px] text-ink-2 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]"
        aria-live="off"
      >
        <span className="col-span-full h-5 text-ink-3 tabular-nums">{monthLabel}</span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <i className="inline-block h-0 w-3.5 rounded border-t-[3px] border-accent" />
          Факт <b className="font-semibold text-ink tabular-nums">{fact === undefined ? "—" : formatRubShort(fact)}</b>
        </span>
        {prefs.forecast && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <i className="inline-block h-0 w-3.5 border-t-2 border-dashed border-[var(--forecast)]" />
            Прогноз <b className="font-semibold text-ink tabular-nums">{fc === undefined ? "—" : formatRubShort(fc)}</b>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <i className="inline-block h-0 w-3.5 rounded border-t-[3px] border-ink-3" />
          Только взносы <b className="font-semibold text-ink tabular-nums">{formatRubShort(only)}</b>
        </span>
        {prefs.compound && prefs.forecast && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <i className="inline-block size-2.5 rounded-[3px] bg-accent opacity-30" />
            Сложный процент{" "}
            <b className="font-semibold text-ink tabular-nums">{fc === undefined ? "—" : formatRubShort(fc - only)}</b>
          </span>
        )}
      </div>

      <div ref={wrap} className="w-full">
        <svg
          viewBox={`0 0 ${width} ${H}`}
          width={width}
          height={H}
          className="block h-auto w-full touch-pan-y"
          role="img"
          aria-label={`График стоимости портфеля. Сейчас ${formatRubShort(chart.fact[nowIndex])}. Через ${prefs.h} лет по прогнозу ${formatRubShort(
            chart.fc[prefs.h * 12],
          )}, если только вносить взносы без дохода ${formatRubShort(chart.only[total])}.`}
        >
          {[0, 1, 2, 3, 4].map((g) => {
            const v = (top * g) / 4;
            return (
              <g key={g}>
                <line x1={PL} x2={width - PR} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
                <text x={PL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
                  {v === 0 ? "0" : formatCompact(v)}
                </text>
              </g>
            );
          })}
          {yearTicks.map(({ t: tick, label }) => (
            <text
              key={tick}
              x={x(tick)}
              y={H - 8}
              textAnchor={tick === 0 ? "start" : x(tick) + 16 > width ? "end" : "middle"}
              fontSize="11"
              fill="var(--ink-3)"
            >
              {label}
            </text>
          ))}

          {prefs.compound && prefs.forecast && (
            <path d={compoundPath()} fill="var(--accent)" fillOpacity="0.13" stroke="none" />
          )}
          <path d={path(chart.only, 0, total)} fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinejoin="round" />
          {prefs.forecast && (
            <path
              d={path(chart.fc, nowIndex, total, nowIndex)}
              fill="none"
              stroke="var(--forecast)"
              strokeWidth="2"
              strokeDasharray="6 5"
              strokeLinejoin="round"
            />
          )}
          <path
            d={path(chart.fact, 0, nowIndex)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <line x1={x(nowIndex)} x2={x(nowIndex)} y1={PT} y2={H - PB} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 4" />
          <circle cx={x(nowIndex)} cy={y(chart.fact[nowIndex])} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />

          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="var(--ink-2)" strokeWidth="1" />
              {fact !== undefined && (
                <circle cx={x(hover)} cy={y(fact)} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
              )}
              {prefs.forecast && fc !== undefined && (
                <circle cx={x(hover)} cy={y(fc)} r="4.5" fill="var(--forecast)" stroke="var(--surface)" strokeWidth="2" />
              )}
            </g>
          )}
          <rect
            x={PL}
            y={PT}
            width={width - PL - PR}
            height={H - PT - PB}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      </div>

      <p className="text-xs text-ink-3">
        Прогноз это сценарий, а не обещание: {chart.ratePct.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}% годовых
        и взнос {formatRubShort(chart.monthly)} в месяц ({chart.monthlyAuto ? "по вашей истории" : "задан вручную"}).{" "}
        <Link href="/settings" className="underline underline-offset-2 hover:text-ink">
          Изменить
        </Link>
      </p>
    </section>
  );
}
