import { TopBar } from "@/components/top-bar";
import { requireSession } from "@/lib/session";

export default async function Home() {
  await requireSession();

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-6 pb-12">
      <TopBar />
      <header className="flex flex-col gap-2.5 pt-5">
        <h1 className="text-balance text-[clamp(32px,6vw,52px)] font-bold leading-[1.05] tracking-tight [overflow-wrap:anywhere]">
          Моя стройка фундамента
        </h1>
        <p className="text-balance text-[clamp(16px,2.4vw,20px)] text-ink-2">
          Строю надёжно. Строю по плану. Без спешки.
        </p>
      </header>
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-[22px]">
        <p className="text-ink-2">
          Каркас готов: вход по паролю, тема и шрифт работают. Дашборд появится на следующих шагах.
        </p>
      </section>
    </main>
  );
}
