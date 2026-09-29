import { asc, eq } from "drizzle-orm";
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
  return db.select().from(tables.instruments).orderBy(asc(tables.instruments.assetClass), asc(tables.instruments.ticker));
}
