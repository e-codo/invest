import { formatPercent, formatRubShort } from "@/lib/format";
import type { Dashboard } from "@/lib/dashboard";

type Props = { d: Dashboard };

export function StatsCard({ d }: Props) {
  const positive = d.profit >= 0;
  return (
    <section
      aria-label="Итоги"
      className="grid grid-cols-2 items-end gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-[18px] sm:p-[22px] md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]"
    >
      <div className="col-span-2 flex flex-col md:col-span-1">
        <span className="text-[13px] text-ink-3">Стоимость портфеля</span>
        <span className="text-[clamp(30px,8vw,52px)] font-bold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere]">
          {formatRubShort(d.value)}
        </span>
        <span className="text-[13px] text-ink-2 tabular-nums">
          <span className={positive ? "text-good" : "text-danger"}>
            {positive ? "+" : "−"}
            {formatRubShort(Math.abs(d.profit))}
          </span>{" "}
          к вложенному
          {d.cash > 0.5 && <> · свободных {formatRubShort(d.cash)}</>}
        </span>
      </div>
      <Stat label="Вложено" value={formatRubShort(d.invested)} sub={`взносов: ${d.depositCount}`} />
      <Stat
        label="Доходность (XIRR)"
        value={d.irr === null ? "—" : formatPercent(d.irr)}
        sub={d.irr === null ? "нужно от 3 месяцев" : "годовых"}
      />
      <Stat label="Купоны и дивиденды" value={formatRubShort(d.income)} sub="получено" />
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs text-ink-3 sm:text-[13px]">{label}</span>
      <span className="text-[clamp(19px,5.6vw,28px)] font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere]">
        {value}
      </span>
      <span className="text-xs text-ink-2 sm:text-[13px]">{sub}</span>
    </div>
  );
}
