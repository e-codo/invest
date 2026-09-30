"use server";

import { and, eq, gte, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, tables } from "@/db";
import { todayEkb } from "@/lib/dates";
import { monthInputSchema, nextMonth, toKopecks, ymSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const DATA_ERROR = "Проверьте введённые данные.";

/** Диапазон дат месяца ГГГГ-ММ для запросов: [с первого числа, с первого числа следующего). */
const range = (ym: string) => ({ from: `${ym}-01`, to: `${nextMonth(ym)}-01` });

/** Сохраняет месяц целиком: всё, что было в нём, заменяется присланным. */
export async function saveMonth(input: unknown): Promise<ActionResult> {
  const userId = await requireUser();
  const parsed = monthInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? DATA_ERROR };
  const m = parsed.data;
  const today = todayEkb();
  const { from, to } = range(m.ym);
  const inMonth = (d: string) => d >= from && d < to;

  for (const d of m.deposits) {
    if (!inMonth(d.date)) return { ok: false, error: "Дата взноса должна быть в выбранном месяце." };
    if (d.date > today) return { ok: false, error: "Дата взноса не может быть в будущем." };
    if (Object.keys(d.amounts).length === 0) return { ok: false, error: "В взносе нет ни одной суммы." };
  }
  if (m.value !== null) {
    if (!m.valueDate || !inMonth(m.valueDate)) return { ok: false, error: "Дата стоимости должна быть в выбранном месяце." };
  } else if (m.deposits.length > 0) {
    return { ok: false, error: "Укажите стоимость портфеля: без неё нельзя посчитать прибыль." };
  }
  for (const c of m.coupons) if (!inMonth(c.date)) return { ok: false, error: "Дата купона должна быть в выбранном месяце." };
  for (const r of m.reinvests) if (!inMonth(r.date)) return { ok: false, error: "Дата реинвеста должна быть в выбранном месяце." };
  if (m.deposits.length === 0 && m.value === null && m.coupons.length === 0 && m.reinvests.length === 0) {
    return { ok: false, error: "Нечего сохранять: добавьте взнос и стоимость портфеля." };
  }

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      // Активы из формы должны принадлежать этому пользователю.
      const mine = await tx.select({ id: tables.assets.id }).from(tables.assets).where(eq(tables.assets.userId, userId));
      const own = new Set(mine.map((a) => String(a.id)));
      const used = [...m.deposits.flatMap((d) => Object.keys(d.amounts)), ...m.reinvests.map((r) => r.assetId)];
      if (used.some((id) => !own.has(id))) throw new Error("foreign-asset");

      // Старое содержимое месяца удаляем (позиции взносов уходят каскадом).
      await tx
        .delete(tables.contributions)
        .where(and(eq(tables.contributions.userId, userId), gte(tables.contributions.date, from), lt(tables.contributions.date, to)));
      await tx.delete(tables.portfolioValues).where(and(eq(tables.portfolioValues.userId, userId), eq(tables.portfolioValues.month, m.ym)));
      await tx
        .delete(tables.coupons)
        .where(and(eq(tables.coupons.userId, userId), gte(tables.coupons.date, from), lt(tables.coupons.date, to)));
      await tx
        .delete(tables.reinvests)
        .where(and(eq(tables.reinvests.userId, userId), gte(tables.reinvests.date, from), lt(tables.reinvests.date, to)));

      for (const d of m.deposits) {
        const [c] = await tx.insert(tables.contributions).values({ userId, date: d.date }).returning({ id: tables.contributions.id });
        await tx.insert(tables.contributionItems).values(
          Object.entries(d.amounts).map(([assetId, amount]) => ({
            contributionId: c.id,
            assetId: Number(assetId),
            amountKopecks: toKopecks(amount),
          })),
        );
      }
      if (m.value !== null && m.valueDate) {
        await tx.insert(tables.portfolioValues).values({ userId, month: m.ym, date: m.valueDate, amountKopecks: toKopecks(m.value) });
      }
      if (m.coupons.length) {
        await tx.insert(tables.coupons).values(m.coupons.map((c) => ({ userId, date: c.date, amountKopecks: toKopecks(c.amount) })));
      }
      if (m.reinvests.length) {
        await tx
          .insert(tables.reinvests)
          .values(m.reinvests.map((r) => ({ userId, date: r.date, amountKopecks: toKopecks(r.amount), assetId: Number(r.assetId) })));
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "foreign-asset") return { ok: false, error: DATA_ERROR };
    console.error("saveMonth failed", error);
    return { ok: false, error: "Не удалось сохранить. Попробуйте ещё раз." };
  }
  revalidatePath("/");
  return { ok: true };
}

/** Удаляет месяц целиком: взносы, стоимость, купоны и реинвесты. */
export async function deleteMonth(ym: unknown): Promise<ActionResult> {
  const userId = await requireUser();
  const parsed = ymSchema.safeParse(ym);
  if (!parsed.success) return { ok: false, error: DATA_ERROR };
  const { from, to } = range(parsed.data);
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(tables.contributions)
        .where(and(eq(tables.contributions.userId, userId), gte(tables.contributions.date, from), lt(tables.contributions.date, to)));
      await tx.delete(tables.portfolioValues).where(and(eq(tables.portfolioValues.userId, userId), eq(tables.portfolioValues.month, parsed.data)));
      await tx
        .delete(tables.coupons)
        .where(and(eq(tables.coupons.userId, userId), gte(tables.coupons.date, from), lt(tables.coupons.date, to)));
      await tx
        .delete(tables.reinvests)
        .where(and(eq(tables.reinvests.userId, userId), gte(tables.reinvests.date, from), lt(tables.reinvests.date, to)));
    });
  } catch (error) {
    console.error("deleteMonth failed", error);
    return { ok: false, error: "Не удалось удалить. Попробуйте ещё раз." };
  }
  revalidatePath("/");
  return { ok: true };
}
