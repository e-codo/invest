import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-3xl font-bold tracking-tight">Моя стройка фундамента</h1>
        <p className="text-ink-2">Личный кабинет. Введите пароль, чтобы продолжить.</p>
      </div>
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <LoginForm />
      </div>
    </main>
  );
}
