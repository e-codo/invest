import Link from "next/link";
import { redirect } from "next/navigation";
import { trimDecimal } from "@/app/month/state";
import { getMilestones, getPortfolio } from "@/lib/data";
import { requireSession } from "@/lib/session";
import type { StrategyKey } from "@/lib/strategies";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  await requireSession();
  const portfolio = await getPortfolio();
  if (!portfolio?.onboardedAt) redirect("/setup");
  const milestones = await getMilestones();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 pb-16">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm text-ink-3 underline-offset-2 hover:text-ink hover:underline">
          ← На главную
        </Link>
        <h1 className="text-balance text-[clamp(28px,5vw,40px)] font-bold leading-tight tracking-tight">Настройки</h1>
        <p className="text-ink-2">Стратегия, цель, вехи и прогноз. Заголовок и цитату можно править прямо на главной.</p>
      </header>
      <SettingsForm
        initial={{
          preset: portfolio.strategyPreset as StrategyKey,
          stocks: String(portfolio.targetStocks),
          bonds: String(portfolio.targetBonds),
          cash: String(portfolio.targetCash),
          goal: trimDecimal(portfolio.goalAmount),
          milestones: milestones.map((m) => trimDecimal(m.amount)),
          forecastRate: trimDecimal(portfolio.forecastRate),
          forecastMonthly: portfolio.forecastMonthly === null ? "" : trimDecimal(portfolio.forecastMonthly),
        }}
      />
    </main>
  );
}
