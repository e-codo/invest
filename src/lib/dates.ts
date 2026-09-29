const ekbDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Yekaterinburg",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Сегодняшняя дата в Екатеринбурге, формат ГГГГ-ММ-ДД. */
export function todayEkb(now: Date = new Date()): string {
  return ekbDate.format(now);
}

/** "2026-09-25" -> "2026-09-01" */
export function firstOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}
