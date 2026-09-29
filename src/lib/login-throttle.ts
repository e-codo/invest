import { and, eq, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb, tables } from "@/db";

// Ограничение перебора пароля: после MAX_FAILURES неудач с одного адреса вход закрыт на WINDOW_MINUTES.
export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;

/** Адрес клиента. На Vercel заголовок x-forwarded-for выставляет платформа. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export function isLocked(failures: number): boolean {
  return failures >= MAX_FAILURES;
}

export async function countRecentFailures(ip: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.loginAttempts)
    .where(
      and(
        eq(tables.loginAttempts.ip, ip),
        sql`${tables.loginAttempts.at} > now() - make_interval(mins => ${WINDOW_MINUTES})`,
      ),
    );
  return row?.n ?? 0;
}

export async function recordFailure(ip: string): Promise<void> {
  const db = getDb();
  await db.insert(tables.loginAttempts).values({ ip });
  // Старые записи не нужны: чистим попутно.
  await db.delete(tables.loginAttempts).where(lt(tables.loginAttempts.at, sql`now() - interval '1 day'`));
}

export async function clearFailures(ip: string): Promise<void> {
  const db = getDb();
  await db.delete(tables.loginAttempts).where(eq(tables.loginAttempts.ip, ip));
}
