"use client";

import { Count, Fill } from "@/components/anim";
import { LeftIcon, RightIcon } from "@/components/icons";
import { MONTHS, MONTH_LETTERS, capitalize, compact, dayLabel, formatNumber, rub, signedPercent, signedRub } from "@/lib/format";
import { splitContribution, strategyName, type Summary } from "@/lib/portfolio";
import type { AppState } from "@/lib/types";

const fmtNumber = (v: number) => formatNumber(v);
const fmtPct2 = (v: number) => signedPercent(v, 2);
const fmtPct1 = (v: number) => signedPercent(v, 1);
const fmtPct0 = (v: number) => `${Math.round(v * 100)}%`;
const fmtPctGoal = (v: number) => `${(v * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
const fmtShare = (v: number) => `${v.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;

export function ValueBlock({ summary: c }: { summary: Summary }) {
  const n = c.yms.length;
  return (
    <section className="val">
      <div className="lbl">Стоимость портфеля</div>
      <div className="big num">
        <Count value={c.value} format={fmtNumber} slow />
        <small>₽</small>
      </div>
      <dl className="kv">
        <div>
          <dt>Прибыль рынка</dt>
          <dd>
            <b className="num">{c.invested ? <Count value={c.profit} format={signedRub} /> : "—"}</b>
          </dd>
        </div>
        <div>
          <dt>Доходность</dt>
          <dd>
            <b className="num">{c.pct === null ? "—" : <Count value={c.pct} format={fmtPct2} />}</b>
            <i>за всё время</i>
          </dd>
        </div>
        <div>
          <dt>Годовая</dt>
          <dd>
            <b className="num">{c.irr === null ? "—" : <Count value={c.irr} format={fmtPct1} />}</b>
            <i>{c.irr === null ? "нужно от 3 месяцев" : "в год"}</i>
          </dd>
        </div>
        <div>
          <dt>Вложено своих</dt>
          <dd>
            <b className="num">
              <Count value={c.invested} format={rub} />
            </b>
            <i>{n ? `записей: ${n}` : ""}</i>
          </dd>
        </div>
      </dl>
      <p className="coupons num">
        Получено купонов {rub(c.income)}
        {c.income > 0 ? ` · ждут реинвеста ${rub(Math.max(0, c.onAccount))}` : ""}. В прибыль они уже входят, во «вложено своих» нет.
      </p>
    </section>
  );
}

export function ProgressBlock({ state, summary }: { state: AppState; summary: Summary }) {
  const v = summary.value;
  const sorted = [...state.milestones].sort((a, b) => a - b);
  const next = sorted.find((m) => m > v);
  let prev = 0;
  for (const m of sorted) if (m <= v) prev = m;
  const p = next ? Math.max(0, Math.min(1, (v - prev) / (next - prev))) : 1;
  const g = state.goal > 0 ? Math.min(1, v / state.goal) : 0;
  const chipsKey = `${Math.round(v)}|${sorted.join(",")}`;

  return (
    <section className="sec">
      <div className="sec-h">
        <span className="lbl">Путь к цели</span>
      </div>
      <div className="prog">
        <div>
          <div className="prog-h">
            <div>
              <span className="lbl">Ближайшая веха</span>
              <b className="num">{next ? <Count value={next} format={rub} /> : "все пройдены"}</b>
            </div>
            <span className="p num">
              <Count value={p} format={fmtPct0} />
            </span>
          </div>
          <div className="track">
            <Fill percent={p * 100} />
          </div>
          <div className="prog-s num">
            {next ? (
              <>
                Осталось <Count value={next - v} format={rub} />
              </>
            ) : (
              "Вехи закончились, можно добавить новые"
            )}
          </div>
        </div>
        <div>
          <div className="prog-h">
            <div>
              <span className="lbl">Цель</span>
              <b className="num">
                <Count value={state.goal} format={rub} />
              </b>
            </div>
            <span className="p num">
              <Count value={g} format={fmtPctGoal} />
            </span>
          </div>
          <div className="track thin">
            <Fill percent={g * 100} />
          </div>
          <div className="prog-s num">
            Осталось <Count value={Math.max(0, state.goal - v)} format={rub} />
          </div>
        </div>
        {sorted.length > 0 && (
          <ul className="chips pop" aria-label="Вехи" key={chipsKey}>
            {sorted.map((m, i) => (
              <li key={m} className={m <= v ? "done" : m === next ? "next" : ""} style={{ "--d": `${i * 80}ms` } as React.CSSProperties}>
                {m <= v ? "✓ " : ""}
                {compact(m)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type CalendarProps = {
  state: AppState;
  summary: Summary;
  nowYm: string;
  endYear: number;
  onEndYear: (y: number) => void;
  selected: string | null;
  onSelect: (ym: string | null) => void;
  children?: React.ReactNode;
};

export function CalendarBlock({ state, summary, nowYm, endYear, onEndYear, selected, onSelect, children }: CalendarProps) {
  const ny = Number(nowYm.slice(0, 4));
  const nm = Number(nowYm.slice(5, 7)) - 1;
  const years = [endYear - 2, endYear - 1, endYear];
  return (
    <section className="sec">
      <div className="sec-h">
        <span className="lbl">Календарь взносов</span>
        <div className="nav">
          <button type="button" onClick={() => onEndYear(endYear - 1)} aria-label="Раньше" title="Раньше">
            <LeftIcon />
          </button>
          <span className="num">
            {years[0]} – {years[2]}
          </span>
          <button type="button" onClick={() => onEndYear(endYear + 1)} aria-label="Позже" title="Позже">
            <RightIcon />
          </button>
        </div>
      </div>
      <div className="heat">
        <span />
        {MONTH_LETTERS.map((l, i) => (
          <span className="mh" key={i}>
            {l}
          </span>
        ))}
        {years.map((y) => (
          <YearRow key={y} year={y} state={state} summary={summary} ny={ny} nm={nm} selected={selected} onSelect={onSelect} />
        ))}
      </div>
      {children ?? (
        <p className="cap">
          {summary.streak > 0 ? (
            <>
              <b>{summary.streak} мес. подряд</b> без пропусков. Нажмите на месяц, чтобы посмотреть детали.
            </>
          ) : (
            "Отметьте месяц со взносом, и он закрасится здесь."
          )}
        </p>
      )}
    </section>
  );
}

function YearRow({ year, state, summary, ny, nm, selected, onSelect }: { year: number; state: AppState; summary: Summary; ny: number; nm: number; selected: string | null; onSelect: (ym: string | null) => void }) {
  return (
    <>
      <span className="yl num">{year}</span>
      {MONTHS.map((monthName, m) => {
        const ym = `${year}-${String(m + 1).padStart(2, "0")}`;
        const isPaid = summary.paid.has(ym);
        const hasRecord = !!state.months[ym];
        const future = year * 12 + m > ny * 12 + nm;
        const isNow = year === ny && m === nm;
        const label = `${monthName} ${year}`;
        if (isPaid || hasRecord) {
          return (
            <button
              key={ym}
              type="button"
              className={`cell ${isPaid ? "paid" : "val"}${selected === ym ? " sel" : ""}`}
              aria-pressed={selected === ym}
              aria-label={`${label}${isPaid ? ", взнос внесён" : ", только стоимость"}`}
              onClick={() => onSelect(selected === ym ? null : ym)}
            />
          );
        }
        return <span key={ym} className={`cell${future ? " future" : ""}${isNow ? " now" : ""}`} role="img" aria-label={`${label}${future ? ", впереди" : ", взноса нет"}`} />;
      })}
    </>
  );
}

type MonthCardProps = {
  state: AppState;
  ym: string;
  confirming: boolean;
  busy: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
};

export function MonthCard({ state, ym, confirming, busy, onEdit, onAskDelete, onCancelDelete, onDelete }: MonthCardProps) {
  const m = state.months[ym];
  const [y, mo] = ym.split("-").map(Number);
  const assetName = (id: string) => state.assets.find((a) => a.id === id)?.name ?? "удалённый актив";
  return (
    <div className="mcard">
      <h3>
        {capitalize(MONTHS[mo - 1])} {y}
      </h3>
      <ul>
        {m.deposits.map((d) => {
          const sum = Object.values(d.amounts).reduce((s, v) => s + v, 0);
          const parts = Object.entries(d.amounts)
            .filter(([, v]) => v > 0)
            .map(([id, v]) => `${assetName(id)} ${rub(v)}`);
          return (
            <li key={`d${d.id}`}>
              <span>
                {dayLabel(d.date)} · взнос <b className="num">{rub(sum)}</b>
              </span>
              <span>{parts.join(" · ")}</span>
            </li>
          );
        })}
        {m.value !== null && m.valueDate && (
          <li>
            <span>Стоимость портфеля на {dayLabel(m.valueDate)}</span>
            <span className="num">{rub(m.value)}</span>
          </li>
        )}
        {m.coupons.map((c) => (
          <li key={`c${c.id}`}>
            <span>{dayLabel(c.date)} · купон</span>
            <span className="num">{rub(c.amount)}</span>
          </li>
        ))}
        {m.reinvests.map((r) => (
          <li key={`r${r.id}`}>
            <span>
              {dayLabel(r.date)} · реинвест в «{assetName(r.assetId)}»
            </span>
            <span className="num">{rub(r.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="acts">
        <button type="button" className="btn fill" onClick={onEdit}>
          Изменить
        </button>
        {confirming ? (
          <>
            <span className="sum">Удалить месяц целиком?</span>
            <button type="button" className="btn" onClick={onDelete} disabled={busy}>
              Да, удалить
            </button>
            <button type="button" className="btn ghost" onClick={onCancelDelete}>
              Отмена
            </button>
          </>
        ) : (
          <button type="button" className="danger" onClick={onAskDelete}>
            Удалить месяц
          </button>
        )}
      </div>
    </div>
  );
}

export function AllocationBlock({ state, summary }: { state: AppState; summary: Summary }) {
  const { assets } = state;
  const total = assets.reduce((s, a) => s + summary.base[a.id], 0);
  const plan = Math.round(state.plan);
  const split = splitContribution(plan, assets.map((a) => summary.base[a.id]), assets.map((a) => a.weight));
  return (
    <section className="sec">
      <div className="sec-h">
        <span className="lbl">Аллокация · {strategyName(state)}</span>
        <span className="lbl num">Плановый взнос {rub(plan)}</span>
      </div>
      {assets.map((a, i) => {
        const share = total > 0 ? (summary.base[a.id] / total) * 100 : 0;
        const out = a.weight === 0;
        return (
          <div className="arow" key={a.id}>
            <div className="a-top">
              <span className="a-name">{a.name}</span>
              <span className="a-pct num">
                <Count value={share} format={fmtShare} />
                <small>{out ? "вне стратегии" : `цель ${a.weight}%`}</small>
              </span>
            </div>
            <div className="a-track">
              <Fill percent={share} />
              {!out && <u style={{ left: `calc(${a.weight}% - 1px)` }} />}
            </div>
            <div className="a-sub num">
              <span>
                Направлено <Count value={summary.base[a.id]} format={rub} />
              </span>
              <span>
                {split[i] > 0 ? (
                  <>
                    Направить в следующий взнос{" "}
                    <b>
                      <Count value={split[i]} format={rub} />
                    </b>
                  </>
                ) : (
                  "В следующий взнос не нужно"
                )}
              </span>
            </div>
          </div>
        );
      })}
      <p className="anote">
        Доли считаются по деньгам, направленным в актив: ваши взносы и реинвест купонов. Рыночную стоимость по активам вы не вводите, поэтому это не рыночные доли. Подсказка раскладывает ближайший плановый взнос так, чтобы
        сумма равнялась ему до рубля.
      </p>
    </section>
  );
}
