import { z } from "zod";

// Правила ввода, общие для форм (проверка на месте) и серверных действий (настоящая проверка).

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const ymSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Неверный месяц.");
export const dateSchema = z.string().refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isRealDate(s), "Неверная дата.");
export const rublesSchema = z
  .number()
  .finite()
  .positive("Сумма должна быть больше нуля.")
  .max(100_000_000_000, "Слишком большая сумма.")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Не больше двух знаков после запятой.");

export const monthInputSchema = z.object({
  ym: ymSchema,
  deposits: z
    .array(z.object({ date: dateSchema, amounts: z.record(z.string(), rublesSchema) }))
    .max(31),
  value: rublesSchema.nullable(),
  valueDate: dateSchema.nullable(),
  coupons: z.array(z.object({ date: dateSchema, amount: rublesSchema })).max(62),
  reinvests: z.array(z.object({ date: dateSchema, amount: rublesSchema, assetId: z.string() })).max(62),
});
export type MonthInput = z.infer<typeof monthInputSchema>;

export const ASSET_NAME_MAX = 30;

export const settingsInputSchema = z.object({
  assets: z
    .array(
      z.object({
        /** Число строкой для существующего актива, «new:…» для добавленного в этой сессии. */
        id: z.string().min(1).max(40),
        name: z.string().max(200),
        weight: z.number().int().min(0).max(100),
      }),
    )
    .min(1)
    .max(5),
  /** Куда переносить взносы удалённых активов. from: существующий актив, to: существующий или «new:…». */
  transfers: z.array(z.object({ from: z.string(), to: z.string() })).max(20),
  strategyEnabled: z.boolean(),
  strategyName: z.string().max(40).nullable(),
  plan: rublesSchema,
  goal: rublesSchema,
  milestones: z.array(rublesSchema).max(30),
  texts: z.object({
    title: z.string().max(80),
    subtitle: z.string().max(140),
    quote: z.string().max(240),
  }),
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Введите почту в виде name@mail.ru.")),
  password: z.string().min(8, "Пароль не короче 8 символов.").max(128, "Пароль не длиннее 128 символов."),
});

export const toKopecks = (rub: number) => Math.round(rub * 100);
export const fromKopecks = (k: number) => k / 100;

/** Месяц, следующий за ГГГГ-ММ. */
export function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
