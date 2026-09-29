// Деньги хранятся строками без плавающей точки. Суммы считаются в копейках (BigInt).

/** Разбирает ввод пользователя ("1 500 000,5") в строку с точкой. null, если это не число. */
export function parseDecimal(input: string, maxScale: number): string | null {
  const s = input.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d{1,12}(\.\d+)?$/.test(s)) return null;
  const [int, frac = ""] = s.split(".");
  if (frac.length > maxScale) return null;
  return frac ? `${int}.${frac}` : int;
}

export function isPositive(decimal: string): boolean {
  return /[1-9]/.test(decimal);
}

/** "1500000.5" -> 150000050n */
export function rubToKopecks(decimal: string): bigint {
  const [int, frac = ""] = decimal.split(".");
  return BigInt(int) * 100n + BigInt(frac.padEnd(2, "0").slice(0, 2));
}

/** 150000050n -> "1500000.50" */
export function kopecksToDecimal(kopecks: bigint): string {
  return `${kopecks / 100n}.${(kopecks % 100n).toString().padStart(2, "0")}`;
}

/** Стоимость позиции: целое количество * цена (до 4 знаков), округление до копеек вверх от половины. */
export function positionKopecks(quantity: string, price: string): bigint {
  const [int, frac = ""] = price.split(".");
  const priceScaled = BigInt(int) * 10000n + BigInt(frac.padEnd(4, "0").slice(0, 4));
  return (BigInt(quantity) * priceScaled + 50n) / 100n;
}

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

/** "1500000.00" -> "1 500 000 ₽" */
export function formatRub(decimal: string): string {
  return rub.format(Number(decimal));
}
