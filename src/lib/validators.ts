import * as z from "zod";

export const positive = (v: string) => /[1-9]/.test(v);

/** Сумма в рублях: до 12 цифр, до 2 знаков после точки, больше нуля. */
export const amount = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, { error: "Сумма указана неверно" })
  .refine(positive, { error: "Сумма должна быть больше нуля" });

/** Количество бумаг: целое число больше нуля. */
export const quantity = z
  .string()
  .regex(/^\d{1,9}$/, { error: "Количество: целое число" })
  .refine(positive, { error: "Количество должно быть больше нуля" });

/** Цена за штуку: до 4 знаков после точки, больше нуля. */
export const price = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,4})?$/, { error: "Цена указана неверно" })
  .refine(positive, { error: "Цена должна быть больше нуля" });

export const ticker = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9._-]{2,12}$/, { error: "Тикер: 2–12 латинских букв или цифр" });
