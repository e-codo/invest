import * as z from "zod";
import { todayEkb } from "./dates";
import { positionKopecks } from "./money";
import { amount, price, quantity } from "./validators";

const isoDate = z.iso.date({ error: "Дата указана неверно" });
const instrumentId = z.number().int().positive();

export const monthSchema = z
  .object({
    /** Месяц отметки, ГГГГ-ММ. */
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Месяц указан неверно" }),
    deposit: z.object({ date: isoDate, amount }).optional(),
    buys: z.array(z.object({ instrumentId, date: isoDate, quantity, price })).max(60),
    incomes: z
      .array(
        z.object({
          instrumentId,
          date: isoDate,
          amount,
          /** Если задано, доход сразу реинвестирован: создаётся покупка в тот же день. */
          reinvest: z.object({ quantity, price }).optional(),
        }),
      )
      .max(60),
    prices: z.array(z.object({ instrumentId, price })).max(60),
  })
  .superRefine((v, ctx) => {
    const today = todayEkb();
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });

    if (v.month > today.slice(0, 7)) issue("Нельзя отметить месяц, который ещё не наступил");

    const dates = [
      ...(v.deposit ? [v.deposit.date] : []),
      ...v.buys.map((b) => b.date),
      ...v.incomes.map((i) => i.date),
    ];
    for (const d of dates) {
      if (!d.startsWith(v.month)) issue("Дата операции должна быть в выбранном месяце");
      if (d > today) issue("Дата операции не может быть в будущем");
    }

    const priced = new Set<number>();
    for (const p of v.prices) {
      if (priced.has(p.instrumentId)) issue("Цена фонда указана дважды");
      priced.add(p.instrumentId);
    }

    const tooSmall =
      v.buys.some((b) => positionKopecks(b.quantity, b.price) === 0n) ||
      v.incomes.some((i) => i.reinvest && positionKopecks(i.reinvest.quantity, i.reinvest.price) === 0n);
    if (tooSmall) issue("Покупка стоит меньше копейки");

    if (!v.deposit && v.buys.length === 0 && v.incomes.length === 0 && v.prices.length === 0) {
      issue("Нечего сохранять: добавьте взнос, покупку, купон или цены");
    }
  });

export type MonthInput = z.output<typeof monthSchema>;
