"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession, passwordMatches } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Введите пароль." };
  }
  if (!passwordMatches(password)) {
    // Небольшая задержка замедляет перебор пароля.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { error: "Пароль не подошёл. Попробуйте ещё раз." };
  }
  await createSession();
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
