import { formatCompact, formatRubShort } from "@/lib/format";
import type { Dashboard } from "@/lib/dashboard";

function Bar({ value, thin = false }: { value: number; thin?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-full bg-line ${thin ? "h-2" : "h-3"}`}>
      <i className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(value * 1000) / 10}%` }} />
    </div>
  );
}

export function ProgressCard({ d }: { d: Dashboard }) {
  const next = d.nextMilestone;
  return (
    <section
      aria-label="Прогресс к цели"
      className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-[18px] sm:p-[22px]"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <b className="font-semibold">
            {next ? `Ближайшая веха: ${formatRubShort(next.amount)}` : "Все вехи пройдены"}
          </b>
          {next && (
            <span className="text-[13px] text-ink-2 tabular-nums">
              {Math.round(next.progress * 100)}% · осталось {formatRubShort(next.left)}
            </span>
          )}
        </div>
        <Bar value={next ? next.progress : 1} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <b className="font-semibold">Цель: {formatRubShort(d.goal)}</b>
          <span className="text-[13px] text-ink-2 tabular-nums">
            {(d.goalProgress * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%
            {d.goalLeft > 0 ? ` · осталось ${formatRubShort(d.goalLeft)}` : " · цель достигнута"}
          </span>
        </div>
        <Bar value={d.goalProgress} thin />
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Вехи">
        {d.milestones.map((m) => (
          <li
            key={m.amount}
            className={`rounded-full border px-3 py-1.5 text-[13px] tabular-nums ${
              m.done
                ? "border-transparent bg-accent-soft font-medium text-accent"
                : m.next
                  ? "border-accent font-medium text-ink"
                  : "border-line text-ink-3"
            }`}
          >
            {m.done && <span aria-hidden="true">✓ </span>}
            {formatCompact(m.amount)}
            <span className="sr-only">{m.done ? ", достигнута" : m.next ? ", ближайшая" : ""}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
