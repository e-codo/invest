import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDay } from "@/app/month/format";
import { trimDecimal } from "@/app/month/state";
import { AllocationCard } from "@/components/dashboard/allocation-card";
import { CalendarCard } from "@/components/dashboard/calendar-card";
import { EditableText } from "@/components/dashboard/editable-text";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { ProgressCard } from "@/components/dashboard/progress-card";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { TopBar } from "@/components/top-bar";
import {
  getAllPrices,
  getAllTransactions,
  getInstruments,
  getMilestones,
  getPortfolio,
  getRecentTransactions,
} from "@/lib/data";
import { buildDashboard } from "@/lib/dashboard";
import { formatRub } from "@/lib/money";
import { requireSession } from "@/lib/session";

type Tx = Awaited<ReturnType<typeof getRecentTransactions>>[number];

function describe(t: Tx): { title: string; income: boolean } {
  const ticker = t.ticker ?? "";
  if (t.kind === "deposit") return { title: "Взнос", income: true };
  if (t.kind === "income") return { title: `Купон или дивиденды ${ticker}`, income: true };
  const qty = t.quantity ? trimDecimal(t.quantity) : "";
  const price = t.price ? trimDecimal(t.price).replace(".", ",") : "";
  return { title: `Покупка ${ticker} · ${qty} шт. по ${price} ₽`, income: false };
}

export default async function Home() {
  await requireSession();
  const portfolio = await getPortfolio();
  if (!portfolio?.onboardedAt) redirect("/setup");

  const [milestones, instruments, txs, prices, recent] = await Promise.all([
    getMilestones(),
    getInstruments(),
    getAllTransactions(),
    getAllPrices(),
    getRecentTransactions(10),
  ]);

  const d = buildDashboard({
    txs,
    prices,
    instruments: instruments.map((i) => ({ id: i.id, assetClass: i.assetClass })),
    targets: { stocks: portfolio.targetStocks, bonds: portfolio.targetBonds, cash: portfolio.targetCash },
    milestones: milestones.map((m) => Number(m.amount)),
    goal: Number(portfolio.goalAmount),
    forecastRate: Number(portfolio.forecastRate),
    forecastMonthly: portfolio.forecastMonthly === null ? null : Number(portfolio.forecastMonthly),
  });

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-6 pb-12">
      <TopBar />

      <header className="flex flex-col gap-2.5 pt-5">
        <EditableText
          as="h1"
          field="title"
          label="Заголовок"
          initial={portfolio.title}
          className="text-balance text-[clamp(32px,6vw,52px)] font-bold leading-[1.05] tracking-tight [overflow-wrap:anywhere]"
        />
        <EditableText
          field="subtitle"
          label="Подзаголовок"
          initial={portfolio.subtitle}
          className="text-balance text-[clamp(16px,2.4vw,20px)] text-ink-2"
        />
      </header>

      <Link
        href="/month"
        className="grid h-14 place-items-center rounded-2xl bg-accent text-base font-semibold text-accent-ink transition-[filter] hover:brightness-110"
      >
        Отметить месяц
      </Link>

      {d.hasData ? (
        <>
          <StatsCard d={d} />
          <ProgressCard d={d} />
          <GrowthChart chart={d.chart} />
          <CalendarCard nowMonth={d.nowMonth} calendar={d.calendar} streak={d.streak} />
          <div className="grid gap-5 md:grid-cols-2">
            <AllocationCard d={d} strategyKey={portfolio.strategyPreset} />
            <OperationsCard recent={recent} />
          </div>
        </>
      ) : (
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-[22px]">
          <p className="text-ink-2">
            Здесь появятся стоимость портфеля, вехи и график роста. Нажмите «Отметить месяц» и внесите первый взнос.
          </p>
        </section>
      )}

      <footer className="flex flex-col items-center gap-2 pt-6 text-center">
        <EditableText
          as="blockquote"
          field="quote"
          label="Цитата"
          initial={portfolio.quote}
          className="max-w-[32ch] text-balance text-[clamp(17px,2.6vw,22px)] font-medium text-ink-2 [overflow-wrap:anywhere]"
        />
        <span className="text-xs text-ink-3">Цитату тоже можно поменять</span>
      </footer>
    </main>
  );
}

function OperationsCard({ recent }: { recent: Tx[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[18px] sm:p-[22px]">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-3">Последние операции</h2>
      {recent.length === 0 ? (
        <p className="text-sm text-ink-2">Операций пока нет.</p>
      ) : (
        <ul className="flex flex-col">
          {recent.map((t) => {
            const d = describe(t);
            return (
              <li key={t.id} className="flex flex-col gap-1 border-t border-line py-3 first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{d.title}</span>
                  <span className={`shrink-0 font-medium tabular-nums ${d.income ? "text-good" : ""}`}>
                    {d.income ? "+" : ""}
                    {formatRub(t.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[13px] text-ink-3">
                  <span>
                    {formatDay(t.date)}
                    {t.note ? ` · ${t.note}` : ""}
                  </span>
                  <DeleteTransactionButton id={t.id} label={d.title} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
