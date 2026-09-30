"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, tables } from "@/db";
import { DEFAULT_ASSETS, DEFAULT_GOAL, DEFAULT_MILESTONES, DEFAULT_PLAN, DEFAULT_TEXTS } from "@/lib/defaults";
import { dummyHash, hashPassword, verifyPassword } from "@/lib/password";
import { credentialsSchema, loginSchema, toKopecks } from "@/lib/schemas";
import { createSession, deleteSession } from "@/lib/session";
import {
  LOGIN_WINDOW_MINUTES,
  REGISTER_WINDOW_MINUTES,
  clearEmailFailures,
  clientIp,
  loginLocked,
  recordLoginFailure,
  recordRegistration,
  registerLocked,
} from "@/lib/throttle";

export type AuthState = { error?: string; email?: string } | undefined;

const UNAVAILABLE = "Сервис временно недоступен. Проверьте настройки и попробуйте позже.";

const fields = (formData: FormData) => ({ email: formData.get("email"), password: formData.get("password") });

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const typed = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: "Введите почту и пароль.", email: typed };
  const { email, password } = parsed.data;

  let userId: string | null = null;
  try {
    const ip = await clientIp();
    // Сначала блокировка: во время неё не подходит даже верный пароль.
    if (await loginLocked(ip, email)) {
      return { error: `Слишком много неудачных попыток. Попробуйте через ${LOGIN_WINDOW_MINUTES} минут.`, email };
    }

    const [user] = await getDb().select().from(tables.users).where(eq(tables.users.email, email));
    // Хэш проверяем всегда, даже если почты нет: так по времени ответа не узнать, есть ли такой аккаунт.
    const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !ok) {
      await recordLoginFailure(ip, email);
      return { error: "Почта или пароль не подошли.", email };
    }
    await clearEmailFailures(email);
    userId = user.id;
  } catch (error) {
    // Ошибка настройки или базы: пускать без проверки блокировки нельзя.
    console.error("login failed", error);
    return { error: UNAVAILABLE, email };
  }

  await createSession(userId);
  redirect("/");
}

export async function register(_state: AuthState, formData: FormData): Promise<AuthState> {
  const typed = String(formData.get("email") ?? "");
  const parsed = credentialsSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте почту и пароль.", email: typed };
  const { email, password } = parsed.data;

  let userId: string;
  try {
    const ip = await clientIp();
    if (await registerLocked(ip)) {
      return { error: `Слишком много регистраций с этого адреса. Попробуйте через ${REGISTER_WINDOW_MINUTES} минут.`, email };
    }
    await recordRegistration(ip);

    const db = getDb();
    const [exists] = await db.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, email));
    if (exists) return { error: "Эта почта уже занята. Войдите или возьмите другую.", email };

    const passwordHash = await hashPassword(password);
    userId = await db.transaction(async (tx) => {
      const [user] = await tx.insert(tables.users).values({ email, passwordHash }).returning({ id: tables.users.id });
      await tx.insert(tables.settings).values({
        userId: user.id,
        title: DEFAULT_TEXTS.title,
        subtitle: DEFAULT_TEXTS.subtitle,
        quote: DEFAULT_TEXTS.quote,
        planKopecks: toKopecks(DEFAULT_PLAN),
        goalKopecks: toKopecks(DEFAULT_GOAL),
        strategyEnabled: true,
        strategyName: null,
      });
      await tx
        .insert(tables.assets)
        .values(DEFAULT_ASSETS.map((a, i) => ({ userId: user.id, name: a.name, weight: a.weight, position: i })));
      await tx
        .insert(tables.milestones)
        .values(DEFAULT_MILESTONES.map((m) => ({ userId: user.id, amountKopecks: toKopecks(m) })));
      return user.id;
    });
  } catch (error) {
    // Две одновременные регистрации одной почты: вторая упирается в уникальный индекс.
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return { error: "Эта почта уже занята. Войдите или возьмите другую.", email };
    }
    console.error("register failed", error);
    return { error: UNAVAILABLE, email };
  }

  await createSession(userId);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
