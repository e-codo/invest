"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, tables } from "@/db";
import { ASSET_NAME_MAX, settingsInputSchema, toKopecks } from "@/lib/schemas";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./month";

const DATA_ERROR = "Проверьте введённые данные.";
const fail = (error: string): ActionResult => ({ ok: false, error });

/** Сохраняет настройки целиком: активы (с переносом взносов удалённых), стратегия, план, цель, вехи, тексты. */
export async function saveSettings(input: unknown): Promise<ActionResult> {
  const userId = await requireUser();
  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? DATA_ERROR);
  const s = parsed.data;

  const names = new Set<string>();
  for (const a of s.assets) {
    const name = a.name.trim();
    if (!name) return fail("Название актива не может быть пустым.");
    if (name.length > ASSET_NAME_MAX) return fail(`Название актива не длиннее ${ASSET_NAME_MAX} символов.`);
    if (names.has(name.toLowerCase())) return fail(`Названия активов не должны повторяться: «${name}».`);
    names.add(name.toLowerCase());
  }
  if (s.strategyEnabled) {
    const sum = s.assets.reduce((acc, a) => acc + a.weight, 0);
    if (sum !== 100) return fail(`Сумма долей стратегии сейчас ${sum}%, нужно ровно 100%.`);
  }
  if (new Set(s.milestones).size !== s.milestones.length) return fail("Вехи не должны повторяться.");
  const title = s.texts.title.trim();
  const subtitle = s.texts.subtitle.trim();
  const quote = s.texts.quote.trim();
  if (!title || !subtitle || !quote) return fail("Заголовок, подзаголовок и цитата не могут быть пустыми.");
  const customName = s.strategyName?.trim() || null;

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const mine = await tx.select({ id: tables.assets.id }).from(tables.assets).where(eq(tables.assets.userId, userId));
      const own = new Set(mine.map((a) => String(a.id)));

      // Новые активы создаём первыми: на них могут ссылаться переносы.
      const realId = new Map<string, number>();
      for (const a of s.assets) {
        if (a.id.startsWith("new:")) {
          const [row] = await tx
            .insert(tables.assets)
            .values({ userId, name: a.name.trim(), weight: a.weight })
            .returning({ id: tables.assets.id });
          realId.set(a.id, row.id);
        } else if (!own.has(a.id)) {
          throw new Error("foreign-asset");
        } else {
          realId.set(a.id, Number(a.id));
        }
      }
      const keptIds = new Set(s.assets.map((a) => realId.get(a.id) as number));

      // Переносы: взносы и реинвесты удалённого актива переходят в выбранный.
      for (const t of s.transfers) {
        if (!own.has(t.from)) throw new Error("foreign-asset");
        const from = Number(t.from);
        const to = t.to.startsWith("new:") ? realId.get(t.to) : own.has(t.to) ? Number(t.to) : undefined;
        if (to === undefined || to === from) throw new Error("bad-transfer");
        // Если в одном взносе есть оба актива, суммы складываются (пара актив+взнос уникальна).
        await tx.execute(sql`
          update contribution_items t set amount_kopecks = t.amount_kopecks + f.amount_kopecks
          from contribution_items f
          where t.contribution_id = f.contribution_id and t.asset_id = ${to} and f.asset_id = ${from}`);
        await tx.execute(sql`
          delete from contribution_items f using contribution_items t
          where t.contribution_id = f.contribution_id and t.asset_id = ${to} and f.asset_id = ${from}`);
        await tx.update(tables.contributionItems).set({ assetId: to }).where(eq(tables.contributionItems.assetId, from));
        await tx
          .update(tables.reinvests)
          .set({ assetId: to })
          .where(and(eq(tables.reinvests.userId, userId), eq(tables.reinvests.assetId, from)));
      }

      // Удаляем активы, которых нет в итоговом списке. Если на них остались записи, внешний ключ не даст.
      const removed = mine.map((a) => a.id).filter((id) => !keptIds.has(id));
      if (removed.length) await tx.delete(tables.assets).where(and(eq(tables.assets.userId, userId), inArray(tables.assets.id, removed)));

      for (const [i, a] of s.assets.entries()) {
        await tx
          .update(tables.assets)
          .set({ name: a.name.trim(), weight: a.weight, position: i })
          .where(and(eq(tables.assets.userId, userId), eq(tables.assets.id, realId.get(a.id) as number)));
      }

      await tx
        .update(tables.settings)
        .set({
          title,
          subtitle,
          quote,
          planKopecks: toKopecks(s.plan),
          goalKopecks: toKopecks(s.goal),
          strategyEnabled: s.strategyEnabled,
          strategyName: customName,
        })
        .where(eq(tables.settings.userId, userId));

      await tx.delete(tables.milestones).where(eq(tables.milestones.userId, userId));
      if (s.milestones.length) {
        await tx.insert(tables.milestones).values(s.milestones.map((m) => ({ userId, amountKopecks: toKopecks(m) })));
      }
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "foreign-asset" || error.message === "bad-transfer")) return fail(DATA_ERROR);
    console.error("saveSettings failed", error);
    return fail("Не удалось сохранить. Попробуйте ещё раз.");
  }
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

/** Добавляет актив с долей 0% (вне стратегии) прямо из формы месяца. */
export async function addAsset(name: unknown): Promise<ActionResult> {
  const userId = await requireUser();
  if (typeof name !== "string") return fail(DATA_ERROR);
  const trimmed = name.trim();
  if (!trimmed) return fail("Введите название актива.");
  if (trimmed.length > ASSET_NAME_MAX) return fail(`Название не длиннее ${ASSET_NAME_MAX} символов.`);

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const rows = await tx.select().from(tables.assets).where(eq(tables.assets.userId, userId));
      if (rows.length >= 5) return fail("Можно не больше 5 активов.");
      if (rows.some((a) => a.name.trim().toLowerCase() === trimmed.toLowerCase())) return fail("Актив с таким названием уже есть.");
      const position = rows.reduce((max, a) => Math.max(max, a.position), -1) + 1;
      await tx.insert(tables.assets).values({ userId, name: trimmed, weight: 0, position });
      return { ok: true } as const;
    });
    if (result.ok) {
      revalidatePath("/");
      revalidatePath("/settings");
    }
    return result;
  } catch (error) {
    console.error("addAsset failed", error);
    return fail("Не удалось добавить. Попробуйте ещё раз.");
  }
}
