"use server";

import { redirect } from "next/navigation";
import { clearFailures, clientIp, countRecentFailures, isLocked, recordFailure, WINDOW_MINUTES } from "@/lib/login-throttle";
import { createSession, deleteSession, passwordMatches } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Введите пароль." };
  }

  try {
    const ip = await clientIp();

    // Сначала проверяем блокировку: во время неё не подходит даже верный пароль.
    if (isLocked(await countRecentFailures(ip))) {
      return { error: `Слишком много неудачных попыток. Попробуйте через ${WINDOW_MINUTES} минут.` };
    }

    if (!passwordMatches(password)) {
      // Небольшая задержка дополнительно замедляет перебор.
      await new Promise((resolve) => setTimeout(resolve, 800));
      await recordFailure(ip);
      return { error: "Пароль не подошёл. Попробуйте ещё раз." };
    }

    await clearFailures(ip);
  } catch (error) {
    // Ошибка настройки или базы: пускать без проверки блокировки нельзя.
    console.error("login failed", error);
    return { error: "Вход временно недоступен. Проверьте настройки и попробуйте позже." };
  }

  await createSession();
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
