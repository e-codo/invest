"use server";

import { redirect } from "next/navigation";
import { getDb, tables } from "@/db";
import { firstOfMonth } from "@/lib/dates";
import { kopecksToDecimal, positionKopecks } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { setupSchema } from "@/lib/setup-schema";

export type SetupResult = { error: string } | undefined;

class AlreadySetUp extends Error {}

/** Сохраняет ответы мастера первого запуска одной транзакцией. Повторно выполниться не может. */
export async function completeSetup(input: unknown): Promise<SetupResult> {
  await requireSession();

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Данные заполнены неверно" };
  }
  const data = parsed.data;
  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const created = await tx
        .insert(tables.portfolio)
        .values({
          strategyPreset: data.strategy.preset,
          targetStocks: data.strategy.stocks,
          targetBonds: data.strategy.bonds,
          targetCash: data.strategy.cash,
          goalAmount: data.goal,
          onboardedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: tables.portfolio.id });
      if (created.length === 0) throw new AlreadySetUp();

      await tx.insert(tables.milestones).values(data.milestones.map((amount) => ({ amount })));

      const inserted = await tx
        .insert(tables.instruments)
        .values(data.instruments)
        .returning({ id: tables.instruments.id, ticker: tables.instruments.ticker });
      const idByTicker = new Map(inserted.map((r) => [r.ticker, r.id]));

      if (data.opening) {
        const { date, positions } = data.opening;
        let total = 0n;
        const buys = positions.map((p) => {
          const kopecks = positionKopecks(p.quantity, p.price);
          total += kopecks;
          return {
            date,
            kind: "buy" as const,
            instrumentId: idByTicker.get(p.ticker)!,
            quantity: p.quantity,
            price: p.price,
            amount: kopecksToDecimal(kopecks),
            note: "Начальное состояние",
          };
        });
        await tx.insert(tables.transactions).values({
          date,
          kind: "deposit",
          amount: kopecksToDecimal(total),
          note: "Начальное состояние",
        });
        await tx.insert(tables.transactions).values(buys);
        await tx.insert(tables.prices).values(
          positions.map((p) => ({
            instrumentId: idByTicker.get(p.ticker)!,
            month: firstOfMonth(date),
            price: p.price,
          })),
        );
      }
    });
  } catch (error) {
    if (error instanceof AlreadySetUp) redirect("/");
    console.error("completeSetup failed", error);
    return { error: "Не удалось сохранить. Попробуйте ещё раз." };
  }

  redirect("/");
}
