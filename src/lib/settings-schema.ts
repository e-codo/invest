import * as z from "zod";
import { setupSchema } from "./setup-schema";
import { amount } from "./validators";

/** Настройки, которые можно менять после первого запуска. Правила те же, что в мастере. */
export const settingsSchema = z.object({
  strategy: setupSchema.shape.strategy,
  goal: setupSchema.shape.goal,
  milestones: setupSchema.shape.milestones,
  /** Ожидаемая доходность в % годовых, от 0 до 50. */
  forecastRate: z
    .string()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, { error: "Ставка прогноза указана неверно" })
    .refine((v) => Number(v) <= 50, { error: "Ставка прогноза не может быть больше 50%" }),
  /** Ежемесячный взнос в прогнозе. null: считать по вашей истории. */
  forecastMonthly: amount.nullable(),
});

export type SettingsInput = z.output<typeof settingsSchema>;

export const TEXT_LIMITS = { title: 80, subtitle: 140, quote: 240 } as const;
export type TextField = keyof typeof TEXT_LIMITS;
