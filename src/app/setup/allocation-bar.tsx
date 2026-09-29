import { ASSET_CLASSES } from "@/lib/strategies";

type Props = { stocks: number; bonds: number; cash: number; label?: string };

/** Полоса из трёх цветов: доли акций, облигаций и ликвидности. */
export function AllocationBar({ stocks, bonds, cash, label = "Доли по классам" }: Props) {
  const values = { stocks, bonds, cash };
  const total = stocks + bonds + cash || 1;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-line" role="img" aria-label={label}>
        {ASSET_CLASSES.map((c) => (
          <i
            key={c.key}
            className="block h-full"
            style={{ width: `${(Math.max(values[c.key], 0) / total) * 100}%`, background: c.color }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {ASSET_CLASSES.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-[3px]" style={{ background: c.color }} />
            {c.name} <b className="font-semibold text-ink tabular-nums">{values[c.key]}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
