"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveMonth } from "@/app/actions/month";
import { addAsset } from "@/app/actions/settings";
import { CloseIcon } from "@/components/icons";
import { MONTHS, parseAmount, rub } from "@/lib/format";
import { splitContribution, summarize } from "@/lib/portfolio";
import { ASSET_NAME_MAX, type MonthInput } from "@/lib/schemas";
import { MAX_ASSETS, type AppState } from "@/lib/types";

type DepForm = { id: string; date: string; amounts: Record<string, string>; showAll: boolean };
type CouponForm = { id: string; date: string; amount: string };
type ReinvestForm = { id: string; date: string; amount: string; assetId: string };
type Form = {
  ym: string;
  edit: boolean;
  deposits: DepForm[];
  value: string;
  valueDate: string;
  coupons: CouponForm[];
  reinvests: ReinvestForm[];
  moreOpen: boolean;
  newAsset: { name: string; error: string } | null;
  error: string;
};

type Props = {
  state: AppState;
  today: string;
  ym: string;
  onClose: () => void;
  onSaved: (ym: string) => void;
  /** Данные на сервере изменились (например, добавлен актив): обновить страницу. */
  onRefresh: () => void;
};

let counter = 0;
const nid = () => `f${++counter}`;
const asText = (n: number) => String(n);

function initForm(state: AppState, ym: string, today: string): Form {
  const rec = state.months[ym];
  const defDate = today.slice(0, 7) === ym ? today : `${ym}-22`;
  if (rec) {
    return {
      ym,
      edit: true,
      deposits: rec.deposits.map((d) => {
        const amounts: Record<string, string> = {};
        for (const a of state.assets) amounts[a.id] = d.amounts[a.id] ? asText(d.amounts[a.id]) : "";
        return { id: nid(), date: d.date, amounts, showAll: !Object.values(amounts).some((v) => v !== "") };
      }),
      value: rec.value === null ? "" : asText(rec.value),
      valueDate: rec.valueDate ?? defDate,
      coupons: rec.coupons.map((c) => ({ id: nid(), date: c.date, amount: asText(c.amount) })),
      reinvests: rec.reinvests.map((r) => ({ id: nid(), date: r.date, amount: asText(r.amount), assetId: r.assetId })),
      moreOpen: rec.coupons.length + rec.reinvests.length > 0,
      newAsset: null,
      error: "",
    };
  }
  // Новый месяц: суммы подставляются из плана по стратегии. Без стратегии поля пустые.
  const base = summarize(state, today.slice(0, 7)).base;
  const weights = state.strategy.enabled ? state.assets.map((a) => a.weight) : state.assets.map(() => 0);
  const split = splitContribution(Math.round(state.plan), state.assets.map((a) => base[a.id]), weights);
  const amounts: Record<string, string> = {};
  state.assets.forEach((a, i) => (amounts[a.id] = split[i] > 0 ? asText(split[i]) : ""));
  return {
    ym,
    edit: false,
    deposits: [{ id: nid(), date: defDate, amounts, showAll: true }],
    value: "",
    valueDate: defDate,
    coupons: [],
    reinvests: [],
    moreOpen: false,
    newAsset: null,
    error: "",
  };
}

export function MonthSheet({ state, today, ym, onClose, onSaved, onRefresh }: Props) {
  const [form, setForm] = useState<Form>(() => initForm(state, ym, today));
  const [pending, startTransition] = useTransition();
  const sheetRef = useRef<HTMLDivElement>(null);
  const downOnOverlay = useRef(false);
  const focusAfterAdd = useRef<string | null>(null);
  const newAssetOpen = useRef(false);
  const { assets } = state;
  const [y, m] = form.ym.split("-").map(Number);
  const maxYm = today.slice(0, 7);
  useEffect(() => {
    newAssetOpen.current = form.newAsset !== null;
  });

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p, error: "error" in p ? (p.error as string) : "" }));
  const setDeposit = (id: string, fn: (d: DepForm) => DepForm) => setForm((f) => ({ ...f, error: "", deposits: f.deposits.map((d) => (d.id === id ? fn(d) : d)) }));

  // Escape закрывает запрос названия, затем окно. Фон под окном не прокручивается.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (newAssetOpen.current) setForm((f) => ({ ...f, newAsset: null }));
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLInputElement>('input[data-k="amt"]')?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Новый актив появился в props после обновления страницы: переводим фокус на его поле.
  useEffect(() => {
    if (!focusAfterAdd.current) return;
    const name = focusAfterAdd.current.toLowerCase();
    const added = assets.find((a) => a.name.toLowerCase() === name);
    if (!added) return;
    focusAfterAdd.current = null;
    sheetRef.current?.querySelector<HTMLInputElement>(`input[data-a="${added.id}"]`)?.focus();
  }, [assets]);

  const shownAssets = (d: DepForm) => {
    if (d.showAll) return assets;
    const list = assets.filter((a) => (d.amounts[a.id] ?? "").trim() !== "");
    return list.length === 0 ? assets : list;
  };

  const total = useMemo(() => {
    let t = 0;
    for (const d of form.deposits) for (const v of Object.values(d.amounts)) {
      const n = parseAmount(v);
      if (!Number.isNaN(n)) t += n;
    }
    return t;
  }, [form.deposits]);

  const changeMonth = (next: string) => {
    if (!/^\d{4}-\d{2}$/.test(next)) return;
    const fix = (d: string) => next + d.slice(7);
    setForm((f) => ({
      ...f,
      ym: next,
      edit: !!state.months[next],
      error: "",
      deposits: f.deposits.map((d) => ({ ...d, date: fix(d.date) })),
      coupons: f.coupons.map((c) => ({ ...c, date: fix(c.date) })),
      reinvests: f.reinvests.map((r) => ({ ...r, date: fix(r.date) })),
      valueDate: fix(f.valueDate),
    }));
  };

  const submitNewAsset = () => {
    const na = form.newAsset;
    if (!na) return;
    const name = na.name.trim();
    const fail = (error: string) => setForm((f) => ({ ...f, newAsset: { name: na.name, error } }));
    if (!name) return fail("Введите название актива.");
    if (name.length > ASSET_NAME_MAX) return fail(`Название не длиннее ${ASSET_NAME_MAX} символов.`);
    if (assets.some((a) => a.name.toLowerCase() === name.toLowerCase())) return fail("Актив с таким названием уже есть.");
    if (assets.length >= MAX_ASSETS) return fail("Можно не больше 5 активов.");
    startTransition(async () => {
      const res = await addAsset(name);
      if (!res.ok) return fail(res.error);
      focusAfterAdd.current = name;
      setForm((f) => ({ ...f, newAsset: null, deposits: f.deposits.map((d) => ({ ...d, showAll: true })) }));
      onRefresh();
    });
  };

  const submit = () => {
    const fail = (error: string) => setForm((f) => ({ ...f, error }));
    const deposits: MonthInput["deposits"] = [];
    for (const [i, d] of form.deposits.entries()) {
      if (!d.date.startsWith(form.ym)) return fail(`Взнос ${i + 1}: дата должна быть в выбранном месяце.`);
      if (d.date > today) return fail(`Взнос ${i + 1}: дата не может быть в будущем.`);
      const amounts: Record<string, number> = {};
      for (const a of assets) {
        const raw = (d.amounts[a.id] ?? "").trim();
        if (raw === "") continue;
        const v = parseAmount(raw);
        if (Number.isNaN(v) || v < 0) return fail(`Взнос ${i + 1}, ${a.name}: укажите сумму числом.`);
        if (v > 0) amounts[a.id] = v;
      }
      if (Object.keys(amounts).length > 0) deposits.push({ date: d.date, amounts });
    }
    let value: number | null = null;
    if (form.value.trim() !== "") {
      value = parseAmount(form.value);
      if (Number.isNaN(value) || value <= 0) return fail("Стоимость портфеля: укажите число больше нуля.");
      if (!form.valueDate.startsWith(form.ym)) return fail("Стоимость портфеля: дата должна быть в выбранном месяце.");
    } else if (deposits.length > 0) {
      return fail("Укажите стоимость портфеля на дату взноса: без неё нельзя посчитать прибыль.");
    }
    const coupons: MonthInput["coupons"] = [];
    for (const c of form.coupons) {
      const v = parseAmount(c.amount);
      if (Number.isNaN(v) || v <= 0) return fail("Купон: укажите сумму числом больше нуля.");
      coupons.push({ date: c.date, amount: v });
    }
    const reinvests: MonthInput["reinvests"] = [];
    for (const r of form.reinvests) {
      const v = parseAmount(r.amount);
      if (Number.isNaN(v) || v <= 0) return fail("Реинвест: укажите сумму числом больше нуля.");
      reinvests.push({ date: r.date, amount: v, assetId: r.assetId });
    }
    if (deposits.length === 0 && value === null && coupons.length === 0 && reinvests.length === 0) {
      return fail("Нечего сохранять: добавьте взнос и стоимость портфеля.");
    }
    const input: MonthInput = { ym: form.ym, deposits, value, valueDate: value === null ? null : form.valueDate, coupons, reinvests };
    startTransition(async () => {
      const res = await saveMonth(input);
      if (!res.ok) return fail(res.error);
      onSaved(form.ym);
    });
  };

  const allOpen = form.deposits.every((d) => shownAssets(d).length === assets.length);

  return (
    <div
      className="ov"
      onPointerDown={(e) => { downOnOverlay.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnOverlay.current) onClose(); }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t" ref={sheetRef}>
        <div className="dep-h">
          <h2 id="sh-t">
            {form.edit ? "Изменить " : "Отметить "}
            {MONTHS[m - 1]} {y}
          </h2>
          <button type="button" className="ibtn" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>

        <div className="fld">
          <label htmlFor="f-ym">Месяц</label>
          <input id="f-ym" className="inp" type="month" value={form.ym} max={maxYm} onChange={(e) => changeMonth(e.target.value)} />
        </div>

        <div className="grp">
          <h3>Взносы</h3>
          {form.deposits.map((d, di) => {
            const visible = shownAssets(d);
            return (
              <div className="dep" key={d.id}>
                <div className="dep-h">
                  <span className="sum">
                    <b>Взнос {di + 1}</b>
                  </span>
                  {form.deposits.length > 1 && (
                    <button type="button" className="danger" onClick={() => patch({ deposits: form.deposits.filter((x) => x.id !== d.id) })}>
                      Убрать
                    </button>
                  )}
                </div>
                <div className="fld">
                  <label htmlFor={`d-${d.id}`}>Дата</label>
                  <input id={`d-${d.id}`} className="inp" type="date" value={d.date} onChange={(e) => setDeposit(d.id, (x) => ({ ...x, date: e.target.value }))} />
                </div>
                <div className="grid2">
                  {visible.map((a) => (
                    <div className="fld" key={a.id}>
                      <label htmlFor={`a-${d.id}-${a.id}`}>{a.name}, ₽</label>
                      <input
                        id={`a-${d.id}-${a.id}`}
                        className="inp num"
                        inputMode="decimal"
                        data-k="amt"
                        data-a={a.id}
                        placeholder="0"
                        value={d.amounts[a.id] ?? ""}
                        onChange={(e) => setDeposit(d.id, (x) => ({ ...x, amounts: { ...x.amounts, [a.id]: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
                {visible.length < assets.length && (
                  <button type="button" className="linkbtn" onClick={() => setDeposit(d.id, (x) => ({ ...x, showAll: true }))}>
                    + Другой актив
                  </button>
                )}
              </div>
            );
          })}
          <div className="acts">
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                const last = form.deposits[form.deposits.length - 1];
                patch({ deposits: [...form.deposits, { id: nid(), date: last ? last.date : `${form.ym}-22`, amounts: {}, showAll: true }] });
              }}
            >
              + Ещё взнос
            </button>
            {allOpen && assets.length < MAX_ASSETS && !form.newAsset && (
              <button type="button" className="linkbtn" onClick={() => patch({ newAsset: { name: "", error: "" } })}>
                + Новый актив
              </button>
            )}
          </div>
          {form.newAsset && (
            <div className="newasset">
              <div className="fld">
                <label htmlFor="na-name">Название нового актива</label>
                <input
                  id="na-name"
                  className="inp"
                  maxLength={ASSET_NAME_MAX}
                  autoComplete="off"
                  autoFocus
                  placeholder="Например, Бизнес"
                  value={form.newAsset.name}
                  onChange={(e) => setForm((f) => ({ ...f, newAsset: { name: e.target.value, error: "" } }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitNewAsset();
                    }
                  }}
                />
              </div>
              {form.newAsset.error && (
                <p className="err" role="alert">
                  {form.newAsset.error}
                </p>
              )}
              <div className="acts">
                <button type="button" className="btn fill" onClick={submitNewAsset} disabled={pending}>
                  Добавить
                </button>
                <button type="button" className="btn ghost" onClick={() => patch({ newAsset: null })}>
                  Отмена
                </button>
              </div>
              <p className="sum">Доля нового актива в стратегии 0%: он считается вне стратегии, пока вы не зададите долю в настройках.</p>
            </div>
          )}
          <p className="sum">
            Взносы в месяце: <b className="num">{rub(total)}</b>
          </p>
        </div>

        <div className="grp">
          <h3>Стоимость портфеля</h3>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="f-val">Сумма из приложения брокера, ₽</label>
              <input id="f-val" className="inp num" inputMode="decimal" placeholder="0" value={form.value} onChange={(e) => patch({ value: e.target.value })} />
            </div>
            <div className="fld">
              <label htmlFor="f-vd">На дату</label>
              <input id="f-vd" className="inp" type="date" value={form.valueDate} onChange={(e) => patch({ valueDate: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="grp">
          <button type="button" className="linkbtn" aria-expanded={form.moreOpen} onClick={() => patch({ moreOpen: !form.moreOpen })}>
            {form.moreOpen ? "− " : "+ "}Купоны и реинвест (необязательно)
          </button>
          {form.moreOpen && (
            <>
              {form.coupons.map((c) => (
                <div className="grid2" key={c.id}>
                  <div className="fld">
                    <label htmlFor={`c-${c.id}d`}>Купон, дата</label>
                    <input id={`c-${c.id}d`} className="inp" type="date" value={c.date} onChange={(e) => patch({ coupons: form.coupons.map((x) => (x.id === c.id ? { ...x, date: e.target.value } : x)) })} />
                  </div>
                  <div className="fld">
                    <label htmlFor={`c-${c.id}a`}>Сумма, ₽</label>
                    <input id={`c-${c.id}a`} className="inp num" inputMode="decimal" value={c.amount} onChange={(e) => patch({ coupons: form.coupons.map((x) => (x.id === c.id ? { ...x, amount: e.target.value } : x)) })} />
                  </div>
                </div>
              ))}
              {form.reinvests.map((r) => (
                <div className="grid2" key={r.id}>
                  <div className="fld">
                    <label htmlFor={`r-${r.id}d`}>Реинвест, дата</label>
                    <input id={`r-${r.id}d`} className="inp" type="date" value={r.date} onChange={(e) => patch({ reinvests: form.reinvests.map((x) => (x.id === r.id ? { ...x, date: e.target.value } : x)) })} />
                  </div>
                  <div className="fld">
                    <label htmlFor={`r-${r.id}a`}>Сумма, ₽</label>
                    <input id={`r-${r.id}a`} className="inp num" inputMode="decimal" value={r.amount} onChange={(e) => patch({ reinvests: form.reinvests.map((x) => (x.id === r.id ? { ...x, amount: e.target.value } : x)) })} />
                  </div>
                  <div className="fld" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor={`r-${r.id}s`}>В какой актив</label>
                    <select id={`r-${r.id}s`} className="inp" value={r.assetId} onChange={(e) => patch({ reinvests: form.reinvests.map((x) => (x.id === r.id ? { ...x, assetId: e.target.value } : x)) })}>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <div className="acts">
                <button type="button" className="linkbtn" onClick={() => patch({ moreOpen: true, coupons: [...form.coupons, { id: nid(), date: form.valueDate, amount: "" }] })}>
                  + Купон
                </button>
                <button type="button" className="linkbtn" onClick={() => patch({ moreOpen: true, reinvests: [...form.reinvests, { id: nid(), date: form.valueDate, amount: "", assetId: assets[0]?.id ?? "" }] })}>
                  + Реинвест
                </button>
              </div>
            </>
          )}
        </div>

        {form.error && (
          <p className="err" role="alert">
            {form.error}
          </p>
        )}
        <div className="acts">
          <button type="button" className="btn fill" onClick={submit} disabled={pending}>
            {pending ? "Сохраняю…" : "Сохранить"}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
