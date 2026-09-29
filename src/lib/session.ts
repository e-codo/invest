import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, isValidSession, signSession } from "./session-token";

const sha = (value: string) => createHash("sha256").update(value).digest();

/** Сравнение пароля без утечки по времени. */
export function passwordMatches(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error("Не задан APP_PASSWORD. См. .env.example");
  }
  return timingSafeEqual(sha(input), sha(expected));
}

export async function createSession() {
  const { token, expires } = await signSession();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Для страниц и действий: если сессии нет, отправляет на вход. */
export async function requireSession() {
  const store = await cookies();
  if (!(await isValidSession(store.get(SESSION_COOKIE)?.value))) {
    redirect("/login");
  }
}
