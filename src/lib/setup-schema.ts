import * as z from "zod";
import { todayEkb } from "./dates";
import { positionKopecks, rubToKopecks } from "./money";
import { PRESETS, STRATEGY_KEYS } from "./strategies";

const positive = (v: string) => /[1-9]/.test(v);

const amount = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, { error: "Сумма указана неверно" })
  .refine(positive, { error: "Сумма должна быть больше нуля" });

const percent = z.number().int().min(0).max(100);

const ticker = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9._-]{2,12}$/, { error: "Тикер: 2–12 латинских букв или цифр" });

export const setupSchema = z
  .object({
    strategy: z
      .object({
        preset: z.enum(STRATEGY_KEYS),
        stocks: percent,
        bonds: percent,
        cash: percent,
      })
      .refine((s) => s.stocks + s.bonds + s.cash === 100, {
        error: "Доли стратегии должны в сумме давать 100%",
      })
      .refine(
        (s) => {
          const preset = PRESETS.find((p) => p.key === s.preset);
          return !preset || (preset.stocks === s.stocks && preset.bonds === s.bonds && preset.cash === s.cash);
        },
        { error: "Доли не совпадают с выбранной стратегией" },
      ),
    goal: amount,
    milestones: z
      .array(amount)
      .min(1, { error: "Добавьте хотя бы одну веху" })
      .max(30, { error: "Слишком много вех, максимум 30" })
      .refine((list) => new Set(list.map((v) => rubToKopecks(v))).size === list.length, {
        error: "Вехи не должны повторяться",
      }),
    instruments: z
      .array(
        z.object({
          ticker,
          name: z.string().trim().min(1, { error: "Укажите название фонда" }).max(80),
          assetClass: z.enum(["stocks", "bonds", "cash"]),
        }),
      )
      .min(1, { error: "Добавьте хотя бы один фонд" })
      .max(30, { error: "Слишком много фондов, максимум 30" })
      .refine((list) => new Set(list.map((i) => i.ticker)).size === list.length, {
        error: "Тикеры фондов не должны повторяться",
      }),
    opening: z
      .object({
        date: z.iso
          .date({ error: "Дата указана неверно" })
          .refine((d) => d <= todayEkb(), { error: "Дата начального состояния не может быть в будущем" }),
        positions: z
          .array(
            z.object({
              ticker,
              quantity: z
                .string()
                .regex(/^\d{1,9}$/, { error: "Количество: целое число" })
                .refine(positive, { error: "Количество должно быть больше нуля" }),
              price: z
                .string()
                .regex(/^\d{1,9}(\.\d{1,4})?$/, { error: "Цена указана неверно" })
                .refine(positive, { error: "Цена должна быть больше нуля" }),
            }),
          )
          .min(1),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.opening) return;
    const known = new Set(value.instruments.map((i) => i.ticker));
    const seen = new Set<string>();
    for (const p of value.opening.positions) {
      if (!known.has(p.ticker)) {
        ctx.addIssue({ code: "custom", message: `Позиция ${p.ticker} не входит в список фондов` });
      }
      if (seen.has(p.ticker)) {
        ctx.addIssue({ code: "custom", message: `Позиция ${p.ticker} указана дважды` });
      }
      if (/^\d{1,9}$/.test(p.quantity) && /^\d{1,9}(\.\d{1,4})?$/.test(p.price) && positionKopecks(p.quantity, p.price) === 0n) {
        ctx.addIssue({ code: "custom", message: `Позиция ${p.ticker} стоит меньше копейки` });
      }
      seen.add(p.ticker);
    }
  });

export type SetupInput = z.output<typeof setupSchema>;
