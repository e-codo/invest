import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, tables } from "@/db";

/** Настройки портфеля или undefined, если мастер первого запуска ещё не пройден. */
export async function getPortfolio() {
  const db = getDb();
  const [row] = await db.select().from(tables.portfolio).where(eq(tables.portfolio.id, 1));
  return row;
}

export async function getMilestones() {
  const db = getDb();
  return db.select().from(tables.milestones).orderBy(asc(tables.milestones.amount));
}

export async function getInstruments() {
  const db = getDb();
  return db
    .select()
    .from(tables.instruments)
    .orderBy(asc(tables.instruments.assetClass), asc(tables.instruments.ticker));
}

/** Сколько штук каждой бумаги куплено за всё время. Ключ: id бумаги. */
export async function getHoldings(): Promise<Map<number, string>> {
  const db = getDb();
  const rows = await db
    .select({
      instrumentId: tables.transactions.instrumentId,
      quantity: sql<string>`sum(${tables.transactions.quantity})`,
    })
    .from(tables.transactions)
    .where(eq(tables.transactions.kind, "buy"))
    .groupBy(tables.transactions.instrumentId);
  return new Map(rows.filter((r) => r.instrumentId !== null).map((r) => [r.instrumentId as number, r.quantity]));
}

/** Последняя известная цена каждой бумаги. Ключ: id бумаги. */
export async function getLatestPrices(): Promise<Map<number, { month: string; price: string }>> {
  const db = getDb();
  const rows = await db.execute<{ instrument_id: number; month: string; price: string }>(
    sql`select distinct on (instrument_id) instrument_id, month::text as month, price::text as price
        from prices order by instrument_id, month desc`,
  );
  return new Map(Array.from(rows).map((r) => [r.instrument_id, { month: r.month, price: r.price }]));
}

/** Месяцы (первые числа), за которые уже есть отметка цен. */
export async function getMarkedMonths(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ month: tables.prices.month })
    .from(tables.prices)
    .orderBy(desc(tables.prices.month));
  return rows.map((r) => r.month);
}

export async function getRecentTransactions(limit = 10) {
  const db = getDb();
  return db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      kind: tables.transactions.kind,
      quantity: tables.transactions.quantity,
      price: tables.transactions.price,
      amount: tables.transactions.amount,
      note: tables.transactions.note,
      ticker: tables.instruments.ticker,
    })
    .from(tables.transactions)
    .leftJoin(tables.instruments, eq(tables.transactions.instrumentId, tables.instruments.id))
    .orderBy(desc(tables.transactions.date), desc(tables.transactions.id))
    .limit(limit);
}
