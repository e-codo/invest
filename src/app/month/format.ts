const monthName = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

/** "2026-09" -> "сентябрь 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return monthName.format(new Date(Date.UTC(y, m - 1, 1))).replace(/\s?г\.$/, "");
}

/** "2026-09-25" -> "25 сентября" */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return dayMonth.format(new Date(Date.UTC(y, m - 1, d)));
}
