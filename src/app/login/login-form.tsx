"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [visible, setVisible] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm text-ink-2">
          Пароль
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            required
            aria-invalid={state?.error ? true : undefined}
            aria-describedby={state?.error ? "login-error" : undefined}
            className="h-12 w-full rounded-xl border border-line bg-bg px-4 pr-12 text-base text-ink outline-none transition-colors focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
            className="absolute right-1 top-1 grid size-10 place-items-center rounded-lg text-ink-3 hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {visible ? (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3.2 3.7M6.4 7.6A15 15 0 0 0 3 12s4 6 9 6a9.6 9.6 0 0 0 3.6-.7" />
                  <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
                </>
              ) : (
                <>
                  <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        {state?.error && (
          <p id="login-error" role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-accent text-base font-semibold text-accent-ink transition-[filter] hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Проверяю…" : "Войти"}
      </button>
    </form>
  );
}
