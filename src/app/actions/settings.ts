"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, tables } from "@/db";
import { requireSession } from "@/lib/session";
import { TEXT_LIMITS, settingsSchema, type TextField } from "@/lib/settings-schema";

export type SettingsResult = { error: string } | undefined;

/** Сохраняет заголовок, подзаголовок или цитату, которые правятся прямо на главной. */
export async function updateText(field: TextField, value: string): Promise<{ ok: boolean }> {
  await requireSession();
  if (!(field in TEXT_LIMITS)) return { ok: false };
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length === 0 || text.length > TEXT_LIMITS[field]) return { ok: false };
  const db = getDb();
  await db.update(tables.portfolio).set({ [field]: text }).where(eq(tables.portfolio.id, 1));
  revalidatePath("/");
  return { ok: true };
}

/** Меняет стратегию, цель, вехи и настройки прогноза. Вехи заменяются целиком. */
export async function updateSettings(input: unknown): Promise<SettingsResult> {
  await requireSession();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Данные заполнены неверно" };
  }
  const data = parsed.data;
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(tables.portfolio)
        .set({
          strategyPreset: data.strategy.preset,
          targetStocks: data.strategy.stocks,
          targetBonds: data.strategy.bonds,
          targetCash: data.strategy.cash,
          goalAmount: data.goal,
          forecastRate: data.forecastRate,
          forecastMonthly: data.forecastMonthly,
        })
        .where(eq(tables.portfolio.id, 1))
        .returning({ id: tables.portfolio.id });
      if (updated.length === 0) throw new Error("portfolio not set up");
      await tx.delete(tables.milestones);
      await tx.insert(tables.milestones).values(data.milestones.map((amount) => ({ amount })));
    });
  } catch (error) {
    console.error("updateSettings failed", error);
    return { error: "Не удалось сохранить. Попробуйте ещё раз." };
  }
  revalidatePath("/");
  redirect("/");
}
