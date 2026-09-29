import { formatCompact, formatShare } from "@/lib/format";
import type { Dashboard } from "@/lib/dashboard";
import { ASSET_CLASSES, strategyName } from "@/lib/strategies";

export function AllocationCard({ d, strategyKey }: { d: Dashboard; strategyKey: string }) {
  const rows = d.allocation.map((a) => ({ ...a, meta: ASSET_CLASSES.find((c) => c.key === a.key)! }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  // Самый недобранный класс: туда стоит направить следующий взнос.
  const lacking = [...rows].sort((a, b) => b.gapRub - a.gapRub)[0];
  const showTip = total > 0 && lacking && lacking.gapRub >= Math.max(1000, total * 0.01);

  // Позиции чёрточек целей: накопленная сумма долей без последнего класса.
  const tickPositions = rows.slice(0, -1).map((_, i) => rows.slice(0, i + 1).reduce((s, r) => s + r.target, 0));

  return (
    <section
      aria-label="Аллокация"
      className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[18px] sm:p-[22px]"
    >
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-3">
        Аллокация · {strategyName(strategyKey).toLowerCase()} {rows.map((r) => r.target).join("/")}
      </h2>

      <div>
        <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-line" role="img" aria-label="Текущие доли по классам">
          {rows.map((r) => (
            <i key={r.key} className="block h-full" style={{ width: `${r.share}%`, background: r.meta.color }} />
          ))}
        </div>
        <div className="relative mt-1 h-2.5" aria-hidden="true">
          {tickPositions.map((pos) => (
            <i key={pos} className="absolute top-0 h-2.5 w-0.5 bg-ink-3" style={{ left: `calc(${pos}% - 1px)` }} />
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-3">Чёрточки показывают цель стратегии</p>
      </div>

      <ul className="flex flex-col">
        {rows.map((r) => {
          const off = Math.abs(r.share - r.target) < 1;
          const text = off ? "в норме" : r.gapRub > 0 ? `нужно +${formatCompact(r.gapRub)} ₽` : `выше на ${formatShare(r.share - r.target)}%`;
          return (
            <li
              key={r.key}
              className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 border-t border-line py-2.5 text-sm first:border-t-0 sm:grid-cols-[10px_minmax(0,1fr)_auto_auto]"
            >
              <i className="size-2.5 rounded-[3px]" style={{ background: r.meta.color }} />
              <span>{r.meta.name}</span>
              <span className="tabular-nums">
                {formatShare(r.share)}% <span className="hidden text-[13px] text-ink-3 sm:inline">/ {r.target}%</span>
              </span>
              <span
                className={`col-start-2 col-end-4 text-[13px] sm:col-start-auto sm:col-end-auto sm:min-w-24 sm:text-right ${
                  !off && r.gapRub > 0 ? "font-medium text-warn" : "text-ink-2"
                }`}
              >
                {text}
              </span>
            </li>
          );
        })}
      </ul>

      {showTip && (
        <p className="rounded-xl bg-bg px-3.5 py-2.5 text-[13px] text-ink-2">
          В следующем взносе докупите: <b className="font-semibold text-ink">{lacking.meta.name.toLowerCase()}</b> примерно на{" "}
          <span className="tabular-nums">{Math.round(lacking.gapRub).toLocaleString("ru-RU")} ₽</span>, чтобы вернуться к стратегии.
        </p>
      )}
    </section>
  );
}
