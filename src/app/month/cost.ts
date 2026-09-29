import { isPositive, parseDecimal, positionKopecks } from "@/lib/money";

/** Стоимость по введённым количеству и цене или null, пока поля не заполнены верно. */
export function rowCost(quantity: string, price: string): bigint | null {
  const q = parseDecimal(quantity, 0);
  const p = parseDecimal(price, 4);
  if (!q || !p || !isPositive(q) || !isPositive(p)) return null;
  return positionKopecks(q, p);
}
