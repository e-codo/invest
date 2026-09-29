import Link from "next/link";
import { redirect } from "next/navigation";
import { AllocationBar } from "@/app/setup/allocation-bar";
import { formatDay } from "@/app/month/format";
import { trimDecimal } from "@/app/month/state";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { TopBar } from "@/components/top-bar";
import { getInstruments, getMilestones, getPortfolio, getRecentTransactions } from "@/lib/data";
import { formatRub } from "@/lib/money";
import { requireSession } from "@/lib/session";
import { assetClassName, strategyName } from "@/lib/strategies";

type Tx = Awaited<ReturnType<typeof getRecentTransactions>>[number];

function describe(t: Tx): { title: string; sign: "+" | "" } {
  const ticker = t.ticker ?? "";
  if (t.kind === "deposit") return { title: "Взнос", sign: "+" };
  if (t.kind === "income") return { title: `Купон или дивиденды ${ticker}`, sign: "+" };
  const qty = t.quantity ? trimDecimal(t.quantity) : "";
  const price = t.price ? trimDecimal(t.price).replace(".", ",") : "";
  return { title: `Покупка ${ticker} · ${qty} шт. по ${price} ₽`, sign: "" };
}

export default async function Home() {
  await requireSession();
  const portfolio = await getPortfolio();
  if (!portfolio?.onboardedAt) redirect("/setup");

  const [milestones, instruments, recent] = await Promise.all([
    getMilestones(),
    getInstruments(),
    getRecentTransactions(10),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-6 pb-12">
      <TopBar />
      <header className="flex flex-col gap-2.5 pt-5">
        <h1 className="text-balance text-[clamp(32px,6vw,52px)] font-bold leading-[1.05] tracking-tight [overflow-wrap:anywhere]">
          {portfolio.title}
        </h1>
        <p className="text-balance text-[clamp(16px,2.4vw,20px)] text-ink-2">{portfolio.subtitle}</p>
      </header>

      <Link
        href="/month"
        className="grid h-14 place-items-center rounded-2xl bg-accent text-base font-semibold text-accent-ink transition-[filter] hover:brightness-110"
      >
        Отметить месяц
      </Link>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-[22px]">
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

        <section className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[22px]">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-3">Последние операции</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-2">Операций пока нет. Нажмите «Отметить месяц», чтобы добавить первую.</p>
          ) : (
            <ul className="flex flex-col">
              {recent.map((t) => {
                const d = describe(t);
                return (
                  <li key={t.id} className="flex flex-col gap-1 border-t border-line py-3 first:border-t-0 first:pt-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{d.title}</span>
                      <span
                        className={`shrink-0 font-medium tabular-nums ${d.sign ? "text-good" : ""}`}
                      >
                        {d.sign}
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
      </div>

      <p className="text-sm text-ink-3">Дашборд с графиками и доходностью появится на следующем шаге.</p>
    </main>
  );
}
