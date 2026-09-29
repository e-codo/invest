import { redirect } from "next/navigation";
import { AllocationBar } from "@/app/setup/allocation-bar";
import { TopBar } from "@/components/top-bar";
import { getInstruments, getMilestones, getPortfolio } from "@/lib/data";
import { formatRub } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { assetClassName, strategyName } from "@/lib/strategies";

export default async function Home() {
  await requireSession();
  const portfolio = await getPortfolio();
  if (!portfolio?.onboardedAt) redirect("/setup");

  const [milestones, instruments] = await Promise.all([getMilestones(), getInstruments()]);

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-6 pb-12">
      <TopBar />
      <header className="flex flex-col gap-2.5 pt-5">
        <h1 className="text-balance text-[clamp(32px,6vw,52px)] font-bold leading-[1.05] tracking-tight [overflow-wrap:anywhere]">
          {portfolio.title}
        </h1>
        <p className="text-balance text-[clamp(16px,2.4vw,20px)] text-ink-2">{portfolio.subtitle}</p>
      </header>

      <section className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-[22px]">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-3">Ваш план</h2>
        <div className="flex flex-col gap-2">
          <p className="font-medium">{strategyName(portfolio.strategyPreset)}</p>
          <AllocationBar stocks={portfolio.targetStocks} bonds={portfolio.targetBonds} cash={portfolio.targetCash} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-2">
            Цель <b className="font-semibold text-ink tabular-nums">{formatRub(portfolio.goalAmount)}</b>
          </p>
          <ul className="flex flex-wrap gap-2">
            {milestones.map((m) => (
              <li key={m.id} className="rounded-full border border-line px-3 py-1 text-[13px] tabular-nums text-ink-2">
                {formatRub(m.amount)}
              </li>
            ))}
          </ul>
        </div>
        <ul className="flex flex-col gap-1.5">
          {instruments.map((i) => (
            <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span>
                <b className="font-semibold">{i.ticker}</b> <span className="text-ink-2">{i.name}</span>
              </span>
              <span className="text-ink-3">{assetClassName(i.assetClass)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-ink-3">Форма «месяц» и дашборд с графиками появятся на следующих шагах.</p>
    </main>
  );
}
