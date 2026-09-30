"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LeftIcon, RightIcon } from "@/components/icons";
import { MONTHS, MONTHS_SHORT, capitalize, compact, rub, signedRub } from "@/lib/format";
import type { SeriesPoint } from "@/lib/portfolio";

const WINDOW = 12;
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const niceTop = (v: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};

const ymLabel = (ym: string) => `${MONTHS_SHORT[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** Столбцы по месяцам: «Вложено своих» и «Стоимость портфеля». Только введённые данные, без прогноза. */
export function GrowthChart({ series }: { series: SeriesPoint[] }) {
  const n = series.length;
  const [startRaw, setStartRaw] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(600);
  const [doneSig, setDoneSig] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const maxStart = Math.max(0, n - WINDOW);
  const start = startRaw === null ? maxStart : Math.max(0, Math.min(startRaw, maxStart));
  const win = series.slice(start, start + WINDOW);

  // Ширина по контейнеру: график перестраивается под экран, а не масштабируется.
  useIsoLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Столбцы растут при появлении и при смене данных. Наведение анимацию не перезапускает.
  const sig = series.map((p) => `${p.ym}:${p.invested}:${p.value}`).join("|");
  const animating = doneSig !== sig;
  useEffect(() => {
    const t = setTimeout(() => setDoneSig(sig), 1800);
    return () => clearTimeout(t);
  }, [sig]);

  const narrow = width < 520;
  const H = narrow ? 250 : 320;
  const PL = narrow ? 56 : 66;
  const PR = 6;
  const PT = 26;
  const PB = 34;
  let max = 0;
  for (const p of win) max = Math.max(max, p.invested, p.value ?? 0);
  const top = niceTop(max * 1.08);
  const y = (v: number) => PT + (1 - v / top) * (H - PT - PB);
  const gw = (width - PL - PR) / Math.max(win.length, 1);
  const bw = Math.min(narrow ? 10 : 18, gw * 0.32);
  const sel = hover !== null && hover < win.length ? hover : win.length - 1;
  const selected = win[sel];

  const pointAt = (clientX: number, target: SVGRectElement) => {
    const r = target.ownerSVGElement?.getBoundingClientRect();
    if (!r) return;
    const px = ((clientX - r.left) / r.width) * width;
    setHover(Math.max(0, Math.min(win.length - 1, Math.floor((px - PL) / gw))));
  };

  const head = win.length ? `${ymLabel(win[0].ym)} – ${ymLabel(win[win.length - 1].ym)}` : "";
  const last = win[win.length - 1];

  return (
    <section className="sec">
      <div className="sec-h">
        <span className="lbl">Рост портфеля</span>
        {n > WINDOW ? (
          <div className="nav">
            <button type="button" onClick={() => { setStartRaw(Math.max(0, start - WINDOW)); setHover(null); }} disabled={start === 0} aria-label="Раньше" title="Раньше">
              <LeftIcon />
            </button>
            <span className="num">{head}</span>
            <button type="button" onClick={() => { setStartRaw(start + WINDOW); setHover(null); }} disabled={start + WINDOW >= n} aria-label="Позже" title="Позже">
              <RightIcon />
            </button>
          </div>
        ) : (
          <span className="lbl num">{head}</span>
        )}
      </div>
      <div className="legend">
        <span>
          <i style={{ background: "var(--mid)" }} />
          Вложено своих
        </span>
        <span>
          <i style={{ background: "var(--accent)" }} />
          Стоимость портфеля
        </span>
      </div>
      <div style={{ height: 18 }} />
      <div className="readout">
        {selected ? (
          <>
            <span className="d num">
              {capitalize(MONTHS[Number(selected.ym.slice(5, 7)) - 1])} {selected.ym.slice(0, 4)}
            </span>
            <div>
              Вложено своих<b className="num">{rub(selected.invested)}</b>
            </div>
            <div>
              Стоимость портфеля<b className="num">{selected.value === null ? "—" : rub(selected.value)}</b>
            </div>
            <div>
              Прибыль рынка<b className="num">{selected.value === null ? "—" : signedRub(selected.value - selected.invested)}</b>
            </div>
          </>
        ) : (
          <span className="d">Пока нет данных</span>
        )}
      </div>
      <div ref={wrapRef}>
        <svg className="chart" viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img" aria-label="Столбчатая диаграмма по месяцам: вложено своих и стоимость портфеля">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PL} x2={width - PR} y1={y(top * f)} y2={y(top * f)} stroke="rgba(34,34,34,.14)" />
              <text x={PL - 8} y={y(top * f) + 4} textAnchor="end" fontSize={11} fill="#6A665E">
                {f === 0 ? "0" : compact(top * f)}
              </text>
            </g>
          ))}
          {win.map((p, i) => {
            const cx = PL + gw * i + gw / 2;
            const on = i === sel;
            const mi = Number(p.ym.slice(5, 7)) - 1;
            const showLabel = gw >= 30 || i % 2 === (win.length - 1) % 2;
            return (
              <g key={p.ym}>
                <rect
                  className={animating ? "bar-grow" : undefined}
                  style={animating ? ({ "--d": `${i * 45}ms` } as React.CSSProperties) : undefined}
                  x={cx - bw - 1.5}
                  y={y(p.invested)}
                  width={bw}
                  height={H - PB - y(p.invested)}
                  rx={2}
                  fill="#B3ADA1"
                  opacity={on ? 1 : 0.85}
                />
                {p.value !== null && (
                  <rect
                    className={animating ? "bar-grow" : undefined}
                    style={animating ? ({ "--d": `${i * 45 + 90}ms` } as React.CSSProperties) : undefined}
                    x={cx + 1.5}
                    y={y(p.value)}
                    width={bw}
                    height={H - PB - y(p.value)}
                    rx={2}
                    fill="#E06238"
                  />
                )}
                {showLabel && (
                  <>
                    <text x={cx} y={H - PB + 16} textAnchor="middle" fontSize={11} fill={on ? "#222222" : "#6A665E"} fontWeight={on ? 600 : 400}>
                      {MONTHS_SHORT[mi]}
                    </text>
                    {(i === 0 || mi === 0) && (
                      <text x={cx} y={H - PB + 29} textAnchor="middle" fontSize={10} fill="#6A665E">
                        {p.ym.slice(0, 4)}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
          {last && last.value !== null && (
            <text
              className={animating ? "bar-fade" : undefined}
              style={animating ? ({ "--d": `${win.length * 45 + 350}ms` } as React.CSSProperties) : undefined}
              x={Math.min(PL + gw * (win.length - 1) + gw / 2 + 1.5 + bw / 2, width - 30)}
              y={y(last.value) - 8}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              fill="#222222"
            >
              {compact(last.value)}
            </text>
          )}
          <rect
            x={PL}
            y={0}
            width={width - PL - PR}
            height={H - PB}
            fill="transparent"
            onPointerMove={(e) => pointAt(e.clientX, e.currentTarget)}
            onPointerDown={(e) => pointAt(e.clientX, e.currentTarget)}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      </div>
    </section>
  );
}
