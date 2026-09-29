const rub0 = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

/** 441144.4 -> "441 144 ₽" */
export const formatRubShort = (n: number) => rub0.format(Math.round(n));

/** 0.109 -> "10,9 %" (неразрывный пробел перед знаком) */
export const formatPercent = (fraction: number) => `${pct1.format(fraction * 100)} %`;

/** 17.53 -> "17,5" */
export const formatShare = (n: number) => pct1.format(n);

/** 1500000 -> "1,5 млн", 300000 -> "300 тыс." (для подписей осей и вех) */
export function formatCompact(n: number): string {
  if (n >= 1e6) return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n / 1e6)} млн`;
  if (n >= 1e3) return `${Math.round(n / 1e3).toLocaleString("ru-RU")} тыс.`;
  return String(Math.round(n));
}

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** "2026-09", 3 -> "дек 2026" (месяц ГГГГ-ММ плюс сдвиг) */
export function shortMonthLabel(startMonth: string, offset: number): string {
  const [y, m] = startMonth.split("-").map(Number);
  const total = y * 12 + (m - 1) + offset;
  return `${MONTHS_SHORT[total % 12]} ${Math.floor(total / 12)}`;
}
