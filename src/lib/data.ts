import { eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { fromKopecks } from "./schemas";
import type { AppState, MonthRecord } from "./types";

const emptyMonth = (): MonthRecord => ({ deposits: [], value: null, valueDate: null, coupons: [], reinvests: [] });

/** Всё состояние одного пользователя. Каждый запрос фильтруется по userId. */
export async function loadState(userId: string): Promise<AppState> {
  const db = getDb();
  const [settingsRows, assetRows, milestoneRows, contribRows, itemRows, valueRows, couponRows, reinvestRows] =
    await Promise.all([
      db.select().from(tables.settings).where(eq(tables.settings.userId, userId)),
      db.select().from(tables.assets).where(eq(tables.assets.userId, userId)).orderBy(tables.assets.position, tables.assets.id),
      db.select().from(tables.milestones).where(eq(tables.milestones.userId, userId)),
      db.select().from(tables.contributions).where(eq(tables.contributions.userId, userId)),
      db
        .select({ item: tables.contributionItems })
        .from(tables.contributionItems)
        .innerJoin(tables.contributions, eq(tables.contributions.id, tables.contributionItems.contributionId))
        .where(eq(tables.contributions.userId, userId)),
      db.select().from(tables.portfolioValues).where(eq(tables.portfolioValues.userId, userId)),
      db.select().from(tables.coupons).where(eq(tables.coupons.userId, userId)),
      db.select().from(tables.reinvests).where(eq(tables.reinvests.userId, userId)),
    ]);

  const s = settingsRows[0];
  if (!s) throw new Error("Нет настроек пользователя");

  const months: Record<string, MonthRecord> = {};
  const month = (ym: string) => (months[ym] ??= emptyMonth());

  const deposits = new Map<number, { id: string; date: string; amounts: Record<string, number> }>();
  for (const c of contribRows) {
    const d = { id: String(c.id), date: c.date, amounts: {} as Record<string, number> };
    deposits.set(c.id, d);
    month(c.date.slice(0, 7)).deposits.push(d);
  }
  for (const { item } of itemRows) {
    const d = deposits.get(item.contributionId);
    if (d) d.amounts[String(item.assetId)] = fromKopecks(item.amountKopecks);
  }
  for (const v of valueRows) {
    const m = month(v.month);
    m.value = fromKopecks(v.amountKopecks);
    m.valueDate = v.date;
  }
  for (const c of couponRows) {
    month(c.date.slice(0, 7)).coupons.push({ id: String(c.id), date: c.date, amount: fromKopecks(c.amountKopecks) });
  }
  for (const r of reinvestRows) {
    month(r.date.slice(0, 7)).reinvests.push({
      id: String(r.id),
      date: r.date,
      amount: fromKopecks(r.amountKopecks),
      assetId: String(r.assetId),
    });
  }
  for (const m of Object.values(months)) {
    m.deposits.sort((a, b) => a.date.localeCompare(b.date));
    m.coupons.sort((a, b) => a.date.localeCompare(b.date));
    m.reinvests.sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    texts: { title: s.title, subtitle: s.subtitle, quote: s.quote },
    plan: fromKopecks(s.planKopecks),
    goal: fromKopecks(s.goalKopecks),
    milestones: milestoneRows.map((m) => fromKopecks(m.amountKopecks)).sort((a, b) => a - b),
    strategy: { enabled: s.strategyEnabled, name: s.strategyName },
    assets: assetRows.map((a) => ({ id: String(a.id), name: a.name, weight: a.weight })),
    months,
  };
}
