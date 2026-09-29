"use client";

import { formatRub, kopecksToDecimal, parseDecimal } from "@/lib/money";
import { formatDay, formatMonth } from "./format";
import { rowCost } from "./cost";
import { summarize, type InstrumentInfo, type MonthState } from "./state";

const rub = (k: bigint) => formatRub(kopecksToDecimal(k));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-3">{title}</h3>
      {children}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-ink-2">{children}</p>;

export function StepReview({ state, instruments }: { state: MonthState; instruments: InstrumentInfo[] }) {
  const sum = summarize(state, instruments);
  const spent = sum.bought + sum.reinvested;
  const balance = sum.deposit + sum.income - spent;
  const ticker = (id: number | null) => instruments.find((i) => i.id === id)?.ticker ?? "";

  const buys = instruments.flatMap((i) =>
    (state.buys[i.id] ?? []).flatMap((r) => {
      const cost = rowCost(r.quantity, r.price);
      return cost === null ? [] : [{ key: r.key, ticker: i.ticker, q: r.quantity, p: r.price, date: r.date, cost }];
    }),
  );
  const prices = instruments.filter((i) => (state.prices[i.id] ?? "").trim() !== "");

  return (
    <div className="flex flex-col gap-4">
      <Section title="Месяц">
        <p className="font-medium capitalize">{formatMonth(state.month)}</p>
      </Section>

      <Section title="Взнос">
        {sum.deposit > 0n ? (
          <p className="text-sm tabular-nums">
            <b className="font-semibold">{rub(sum.deposit)}</b>, {formatDay(state.depositDate)}
          </p>
        ) : (
          <Empty>Взноса нет.</Empty>
        )}
      </Section>

      <Section title="Покупки">
        {buys.length === 0 ? (
          <Empty>Покупок нет.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {buys.map((b) => (
              <li key={b.key} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm tabular-nums">
                <span>
                  <b className="font-semibold">{b.ticker}</b>{" "}
                  <span className="text-ink-2">
                    {b.q} шт. по {b.p.replace(".", ",")} ₽
                  </span>
                </span>
                <span>{rub(b.cost)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Купоны и дивиденды">
        {state.incomes.length === 0 ? (
          <Empty>Доходов нет.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {state.incomes.map((inc) => {
              const amount = parseDecimal(inc.amount, 2) ?? "0";
              return (
                <li key={inc.key} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm tabular-nums">
                  <span>
                    <b className="font-semibold">{ticker(inc.instrumentId)}</b>{" "}
                    <span className="text-ink-2">{inc.reinvest ? "реинвестирован" : "на счёт"}</span>
                  </span>
                  <span>{formatRub(amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Цены">
        {prices.length === 0 ? (
          <Empty>Цены не указаны.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {prices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm tabular-nums">
                <b className="font-semibold">{i.ticker}</b>
                <span>{(parseDecimal(state.prices[i.id], 4) ?? "").replace(".", ",")} ₽</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(sum.deposit > 0n || spent > 0n || sum.income > 0n) && (
        <p className="rounded-xl bg-bg px-4 py-3 text-sm text-ink-2 tabular-nums">
          {balance === 0n
            ? "Взнос и доход потрачены полностью."
            : balance > 0n
              ? `Не потрачено ${rub(balance)} из взноса и дохода. Эти деньги лежат на счёте.`
              : `Покупок больше взноса и дохода на ${rub(-balance)}. Проверьте суммы, если это не так.`}
        </p>
      )}
    </div>
  );
}
