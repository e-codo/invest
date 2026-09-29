"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, tables } from "@/db";
import { getHoldings, getPortfolio } from "@/lib/data";
import { monthSchema } from "@/lib/month-schema";
import { kopecksToDecimal, positionKopecks } from "@/lib/money";
import { requireSession } from "@/lib/session";

export type MonthResult = { error: string } | undefined;

/** Сохраняет отметку месяца: взнос, покупки, купоны и цены. Всё одной транзакцией. */
export async function saveMonth(input: unknown): Promise<MonthResult> {
  await requireSession();

  const portfolio = await getPortfolio();
  if (!portfolio?.onboardedAt) redirect("/setup");

  const parsed = monthSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Данные заполнены неверно" };
  }
  const data = parsed.data;
  const db = getDb();

  const instruments = await db
    .select({ id: tables.instruments.id, ticker: tables.instruments.ticker, archived: tables.instruments.archived })
    .from(tables.instruments);
  const active = new Map(instruments.filter((i) => !i.archived).map((i) => [i.id, i.ticker]));

  const referenced = [
    ...data.buys.map((b) => b.instrumentId),
    ...data.incomes.map((i) => i.instrumentId),
    ...data.prices.map((p) => p.instrumentId),
  ];
  if (referenced.some((id) => !active.has(id))) {
    return { error: "Один из фондов не найден. Обновите страницу и попробуйте снова." };
  }

  // Для каждой бумаги в портфеле нужна цена на этот месяц: без неё нельзя оценить портфель.
  const holdings = await getHoldings();
  const incoming = new Map<number, bigint>();
  const addQty = (id: number, qty: string) => incoming.set(id, (incoming.get(id) ?? 0n) + BigInt(qty));
  for (const b of data.buys) addQty(b.instrumentId, b.quantity);
  for (const i of data.incomes) if (i.reinvest) addQty(i.instrumentId, i.reinvest.quantity);
  const priced = new Set(data.prices.map((p) => p.instrumentId));
  for (const [id, ticker] of active) {
    const held = Number(holdings.get(id) ?? 0) > 0 || (incoming.get(id) ?? 0n) > 0n;
    if (held && !priced.has(id)) return { error: `Укажите цену для ${ticker}: он есть в портфеле.` };
  }

  const buyRow = (
    instrumentId: number,
    date: string,
    quantity: string,
    price: string,
    note: string | null,
  ) => ({
    date,
    kind: "buy" as const,
    instrumentId,
    quantity,
    price,
    amount: kopecksToDecimal(positionKopecks(quantity, price)),
    note,
  });

  try {
    await db.transaction(async (tx) => {
      if (data.deposit) {
        await tx.insert(tables.transactions).values({
          date: data.deposit.date,
          kind: "deposit",
          amount: data.deposit.amount,
        });
      }
      if (data.buys.length > 0) {
        await tx
          .insert(tables.transactions)
          .values(data.buys.map((b) => buyRow(b.instrumentId, b.date, b.quantity, b.price, null)));
      }
      if (data.incomes.length > 0) {
        await tx.insert(tables.transactions).values(
          data.incomes.map((i) => ({
            date: i.date,
            kind: "income" as const,
            instrumentId: i.instrumentId,
            amount: i.amount,
          })),
        );
        const reinvested = data.incomes.filter((i) => i.reinvest);
        if (reinvested.length > 0) {
          await tx
            .insert(tables.transactions)
            .values(
              reinvested.map((i) => buyRow(i.instrumentId, i.date, i.reinvest!.quantity, i.reinvest!.price, "Реинвест")),
            );
        }
      }
      if (data.prices.length > 0) {
        await tx
          .insert(tables.prices)
          .values(data.prices.map((p) => ({ instrumentId: p.instrumentId, month: `${data.month}-01`, price: p.price })))
          .onConflictDoUpdate({
            target: [tables.prices.instrumentId, tables.prices.month],
            set: { price: sql`excluded.price` },
          });
      }
    });
  } catch (error) {
    console.error("saveMonth failed", error);
    return { error: "Не удалось сохранить. Попробуйте ещё раз." };
  }

  revalidatePath("/");
  redirect("/");
}

/** Удаляет одну операцию. Реинвест купона состоит из двух записей, удалять их нужно по отдельности. */
export async function deleteTransaction(id: number): Promise<void> {
  await requireSession();
  if (!Number.isInteger(id) || id <= 0) return;
  const db = getDb();
  await db.delete(tables.transactions).where(eq(tables.transactions.id, id));
  revalidatePath("/");
}
