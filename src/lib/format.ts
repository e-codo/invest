const NBSP = " ";
const nf = new Intl.NumberFormat("ru-RU");

/** 36406 -> "36 406" (неразрывные пробелы, без знака). */
export const formatNumber = (n: number) => nf.format(Math.round(n)).replace(/ /g, NBSP);

/** 36406 -> "36 406 ₽" */
export const rub = (n: number) => `${formatNumber(Math.abs(n))}${NBSP}₽`;

/** 406 -> "+406 ₽", -5 -> "−5 ₽" */
export const signedRub = (n: number) => `${n < 0 ? "−" : "+"}${rub(n)}`;

/** 0.0113 -> "+1,13 %" */
export const signedPercent = (fraction: number, digits: number) =>
  `${fraction < 0 ? "−" : "+"}${Math.abs(fraction * 100).toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${NBSP}%`;

/** 1500000 -> "1,5 млн", 300000 -> "300 тыс." (подписи осей и вех) */
export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн`;
  if (n >= 1e3) return `${Math.round(n / 1e3).toLocaleString("ru-RU")} тыс.`;
  return String(Math.round(n));
}

export const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
export const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const MONTH_LETTERS = ["Я", "Ф", "М", "А", "М", "И", "И", "А", "С", "О", "Н", "Д"];

/** "2026-09-22" -> "22 сентября" */
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_GEN[m - 1]}`;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Разбор ввода пользователя ("1 500 000,5") в число. NaN, если это не число. */
export function parseAmount(input: string): number {
  const v = input.replace(/[\s  ]/g, "").replace(",", ".");
  return v === "" ? NaN : Number(v);
}
