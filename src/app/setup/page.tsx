import { redirect } from "next/navigation";
import { getPortfolio } from "@/lib/data";
import { requireSession } from "@/lib/session";
import { Wizard } from "./wizard";

export const metadata = { title: "Первый запуск" };

export default async function SetupPage() {
  await requireSession();
  const portfolio = await getPortfolio();
  if (portfolio?.onboardedAt) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 pb-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-[clamp(28px,5vw,40px)] font-bold leading-tight tracking-tight">
          Моя стройка фундамента
        </h1>
        <p className="text-ink-2">Пять коротких шагов, чтобы настроить портфель. Всё можно будет поменять позже.</p>
      </header>
      <Wizard />
    </main>
  );
}
