"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { logout } from "@/app/actions/auth";
import { deleteMonth } from "@/app/actions/month";
import { Clock } from "@/components/clock";
import { LogoutIcon, PlusIcon, SettingsIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { strategyName, summarize } from "@/lib/portfolio";
import type { AppState } from "@/lib/types";
import { AllocationBlock, CalendarBlock, MonthCard, ProgressBlock, ValueBlock } from "./blocks";
import { GrowthChart } from "./growth-chart";
import { MonthSheet } from "./month-sheet";

export function Dashboard({ state, today }: { state: AppState; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const nowYm = today.slice(0, 7);
  const summary = useMemo(() => summarize(state, nowYm), [state, nowYm]);

  const [selected, setSelected] = useState<string | null>(null);
  const [endYear, setEndYear] = useState(Number(nowYm.slice(0, 4)));
  const [sheetYm, setSheetYm] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, startTransition] = useTransition();

  const select = (ym: string | null) => {
    setSelected(ym);
    setConfirming(false);
  };

  const remove = (ym: string) =>
    startTransition(async () => {
      const res = await deleteMonth(ym);
      if (!res.ok) return toast(res.error);
      select(null);
      router.refresh();
      toast("Месяц удалён.");
    });

  return (
    <div className="wrap">
      <header className="top">
        <div className="meta">
          <Clock />
          {state.strategy.enabled && <span>{strategyName(state)}</span>}
        </div>
        <div className="tools">
          <Link className="ibtn" href="/settings" aria-label="Настройки" title="Настройки">
            <SettingsIcon />
          </Link>
          <form action={logout}>
            <button className="ibtn" type="submit" aria-label="Выйти" title="Выйти">
              <LogoutIcon />
            </button>
          </form>
        </div>
      </header>

      <section className="hero">
        <h1>{state.texts.title}</h1>
        <p>{state.texts.subtitle}</p>
      </section>

      <ValueBlock summary={summary} />
      <ProgressBlock state={state} summary={summary} />
      <CalendarBlock state={state} summary={summary} nowYm={nowYm} endYear={endYear} onEndYear={setEndYear} selected={selected} onSelect={select}>
        {selected && state.months[selected] ? (
          <MonthCard
            state={state}
            ym={selected}
            confirming={confirming}
            busy={busy}
            onEdit={() => setSheetYm(selected)}
            onAskDelete={() => setConfirming(true)}
            onCancelDelete={() => setConfirming(false)}
            onDelete={() => remove(selected)}
          />
        ) : undefined}
      </CalendarBlock>
      <GrowthChart key={summary.series.length} series={summary.series} />
      {state.strategy.enabled && <AllocationBlock state={state} summary={summary} />}

      <footer className="sec">
        <blockquote className="quote">{state.texts.quote}</blockquote>
      </footer>

      <button type="button" className="fab" onClick={() => setSheetYm(nowYm)} aria-label="Отметить месяц" title="Отметить месяц">
        <PlusIcon />
        <span>Отметить месяц</span>
      </button>

      {sheetYm && (
        <MonthSheet
          key={sheetYm}
          state={state}
          today={today}
          ym={sheetYm}
          onClose={() => setSheetYm(null)}
          onRefresh={() => router.refresh()}
          onSaved={(ym) => {
            setSheetYm(null);
            setSelected(ym);
            setConfirming(false);
            router.refresh();
            toast("Месяц сохранён.");
          }}
        />
      )}
    </div>
  );
}
