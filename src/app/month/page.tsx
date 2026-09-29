import Link from "next/link";
import { redirect } from "next/navigation";
import { getHoldings, getInstruments, getLatestPrices, getMarkedMonths, getPortfolio } from "@/lib/data";
import { requireSession } from "@/lib/session";
import { MonthForm } from "./month-form";
import { trimDecimal, type InstrumentInfo } from "./state";

export const metadata = { title: "Отметить месяц" };

export default async function MonthPage() {
  await requireSession();
  const portfolio = await getPortfolio();
  if (!portfolio?.onboardedAt) redirect("/setup");

  const [rows, holdings, latest, marked] = await Promise.all([
    getInstruments(),
    getHoldings(),
    getLatestPrices(),
    getMarkedMonths(),
  ]);

  const instruments: InstrumentInfo[] = rows
    .filter((i) => !i.archived)
    .map((i) => ({
      id: i.id,
      ticker: i.ticker,
      name: i.name,
      assetClass: i.assetClass,
      held: holdings.get(i.id) ?? "0",
      lastPrice: latest.has(i.id) ? trimDecimal(latest.get(i.id)!.price) : null,
      lastMonth: latest.get(i.id)?.month ?? null,
    }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 pb-16">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm text-ink-3 underline-offset-2 hover:text-ink hover:underline">
          ← На главную
        </Link>
        <h1 className="text-balance text-[clamp(28px,5vw,40px)] font-bold leading-tight tracking-tight">
          Отметить месяц
        </h1>
        <p className="text-ink-2">Взнос, покупки, купоны и цены. Займёт пару минут.</p>
      </header>
      <MonthForm instruments={instruments} markedMonths={marked.map((m) => m.slice(0, 7))} />
    </main>
  );
}
