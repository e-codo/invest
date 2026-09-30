"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveSettings } from "@/app/actions/settings";
import { useToast } from "@/components/toast";
import { parseAmount } from "@/lib/format";
import { autoStrategyName } from "@/lib/portfolio";
import { ASSET_NAME_MAX, type SettingsInput } from "@/lib/schemas";
import { MAX_ASSETS, type AppState } from "@/lib/types";

type DraftAsset = { id: string; name: string; w: string };
type DelState = { id: string; target: string; sole: boolean; mode: "move" | "off" | "new"; weights: Record<string, string>; error: string };
type Draft = {
  assets: DraftAsset[];
  strategyOn: boolean;
  stratName: string;
  plan: string;
  goal: string;
  miles: string[];
  texts: { title: string; sub: string; quote: string };
  transfers: { from: string; to: string }[];
  newAsset: { name: string; error: string } | null;
  del: DelState | null;
  error: string;
};

const wNum = (a: DraftAsset) => {
  const v = parseInt(a.w, 10);
  return Number.isNaN(v) ? 0 : v;
};
const autoName = (assets: DraftAsset[]) => autoStrategyName(assets.map(wNum));
let counter = 0;

function makeDraft(state: AppState): Draft {
  return {
    assets: state.assets.map((a) => ({ id: a.id, name: a.name, w: String(a.weight) })),
    strategyOn: state.strategy.enabled,
    stratName: state.strategy.name ?? "",
    plan: String(state.plan),
    goal: String(state.goal),
    miles: [...state.milestones].sort((a, b) => a - b).map(String),
    texts: { title: state.texts.title, sub: state.texts.subtitle, quote: state.texts.quote },
    transfers: [],
    newAsset: null,
    del: null,
    error: "",
  };
}

export function SettingsForm({ state }: { state: AppState }) {
  const router = useRouter();
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => makeDraft(state));
  const [pending, startTransition] = useTransition();
  const focusId = useRef<string | null>(null);

  const up = (fn: (x: Draft) => Draft) => setD((x) => ({ ...fn(x), error: "" }));

  useEffect(() => {
    if (!focusId.current) return;
    document.getElementById(focusId.current)?.focus();
    focusId.current = null;
  });

  // Escape закрывает запрос названия или окно удаления.
  const escState = useRef({ del: false, na: false });
  useEffect(() => {
    escState.current = { del: d.del !== null, na: d.newAsset !== null };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (escState.current.del) setD((x) => ({ ...x, del: null }));
      else if (escState.current.na) setD((x) => ({ ...x, newAsset: null }));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const weightSum = d.assets.reduce((s, a) => s + wNum(a), 0);

  const addNewAsset = () => {
    const na = d.newAsset;
    if (!na) return;
    const nm = na.name.trim();
    let er = "";
    if (!nm) er = "Введите название актива.";
    else if (nm.length > ASSET_NAME_MAX) er = `Название не длиннее ${ASSET_NAME_MAX} символов.`;
    else if (d.assets.some((x) => x.name.trim().toLowerCase() === nm.toLowerCase())) er = "Актив с таким названием уже есть.";
    else if (d.assets.length >= MAX_ASSETS) er = "Можно не больше 5 активов.";
    if (er) {
      focusId.current = "sna";
      return setD((x) => ({ ...x, newAsset: { name: na.name, error: er } }));
    }
    const id = `new:${++counter}`;
    focusId.current = `an-${id}`;
    up((x) => ({ ...x, assets: [...x.assets, { id, name: nm, w: "0" }], newAsset: null }));
  };

  const askDelete = (id: string) => {
    if (d.assets.length <= 1) return toast("Должен остаться хотя бы один актив.");
    const a = d.assets.find((x) => x.id === id);
    if (!a) return;
    const others = d.assets.filter((x) => x.id !== id);
    const sole = d.strategyOn && wNum(a) > 0 && others.every((o) => wNum(o) === 0);
    up((x) => ({ ...x, del: { id, target: others[0].id, sole, mode: sole ? "off" : "move", weights: {}, error: "" } }));
  };

  const confirmDelete = () => {
    const del = d.del;
    if (!del) return;
    const gone = d.assets.find((x) => x.id === del.id);
    if (!gone) return;
    const rest = d.assets.filter((x) => x.id !== del.id).map((x) => ({ ...x }));
    let strategyOn = d.strategyOn;
    const failDel = (error: string) => setD((x) => ({ ...x, del: { ...del, error } }));

    if (del.sole && del.mode === "new") {
      let sum = 0;
      for (const o of rest) {
        const raw = (del.weights[o.id] ?? "").trim();
        if (!/^\d{1,3}$/.test(raw)) return failDel("Доли: целые числа от 0 до 100.");
        sum += parseInt(raw, 10);
      }
      if (sum !== 100) return failDel(`Сумма долей сейчас ${sum}%, нужно ровно 100%.`);
      for (const o of rest) o.w = String(parseInt(del.weights[o.id], 10));
    } else if (del.sole && del.mode === "off") {
      strategyOn = false;
    } else if (d.strategyOn) {
      const tgt = rest.find((o) => o.id === del.target);
      if (tgt) tgt.w = String(wNum(tgt) + wNum(gone));
    }

    // Ранее запланированные переносы в этот актив перенаправляем на новый выбор. Для актива, добавленного только что, переносить нечего.
    const transfers = d.transfers.map((t) => (t.to === del.id ? { ...t, to: del.target } : t));
    if (!del.id.startsWith("new:")) transfers.push({ from: del.id, to: del.target });
    up((x) => ({ ...x, assets: rest, strategyOn, transfers, del: null }));
  };

  const save = () => {
    const fail = (error: string) => setD((x) => ({ ...x, error }));
    const names = new Set<string>();
    for (const a of d.assets) {
      const nm = a.name.trim();
      if (!nm) return fail("Название актива не может быть пустым.");
      if (nm.length > ASSET_NAME_MAX) return fail(`Название актива не длиннее ${ASSET_NAME_MAX} символов.`);
      if (names.has(nm.toLowerCase())) return fail(`Названия активов не должны повторяться: «${nm}».`);
      names.add(nm.toLowerCase());
    }
    for (const a of d.assets) {
      if (!/^\d{1,3}$/.test(a.w.trim()) || wNum(a) > 100) return fail("Доли стратегии: целые числа от 0 до 100.");
    }
    if (d.strategyOn && weightSum !== 100) return fail(`Сумма долей стратегии сейчас ${weightSum}%, нужно ровно 100%.`);
    const plan = parseAmount(d.plan);
    if (Number.isNaN(plan) || plan <= 0) return fail("План взноса: число больше нуля.");
    const goal = parseAmount(d.goal);
    if (Number.isNaN(goal) || goal <= 0) return fail("Цель: число больше нуля.");
    const milestones: number[] = [];
    for (const [k, raw] of d.miles.entries()) {
      const v = parseAmount(raw);
      if (Number.isNaN(v) || v <= 0) return fail(`Веха ${k + 1}: число больше нуля.`);
      if (milestones.includes(v)) return fail("Вехи не должны повторяться.");
      milestones.push(v);
    }
    const title = d.texts.title.trim();
    const subtitle = d.texts.sub.trim();
    const quote = d.texts.quote.trim();
    if (!title || !subtitle || !quote) return fail("Заголовок, подзаголовок и цитата не могут быть пустыми.");

    const custom = d.stratName.trim();
    const input: SettingsInput = {
      assets: d.assets.map((a) => ({ id: a.id, name: a.name.trim(), weight: wNum(a) })),
      transfers: d.transfers,
      strategyEnabled: d.strategyOn,
      strategyName: custom && custom !== autoName(d.assets) ? custom : null,
      plan,
      goal,
      milestones,
      texts: { title, subtitle, quote },
    };
    startTransition(async () => {
      const res = await saveSettings(input);
      if (!res.ok) return fail(res.error);
      toast("Настройки сохранены.");
      router.push("/");
      router.refresh();
    });
  };

  const back = () => router.push("/");

  return (
    <div className="wrap set">
      <header className="top">
        <button type="button" className="linkbtn" onClick={back}>
          ← Назад
        </button>
        <div className="meta">
          <span>Настройки</span>
        </div>
      </header>
      <section className="hero">
        <h1>Настройки</h1>
        <p>Всё можно поменять в любой момент. Изменения применятся после «Сохранить».</p>
      </section>

      <section className="sec">
        <div className="sec-h">
          <span className="lbl">Активы</span>
          <span className="lbl num">{d.assets.length} из 5</span>
        </div>
        <div className="grp">
          {d.assets.map((a) => (
            <div className="arow2" key={a.id}>
              <div className="fld">
                <label htmlFor={`an-${a.id}`}>Название</label>
                <input id={`an-${a.id}`} className="inp" maxLength={ASSET_NAME_MAX} autoComplete="off" value={a.name} onChange={(e) => up((x) => ({ ...x, assets: x.assets.map((y) => (y.id === a.id ? { ...y, name: e.target.value } : y)) }))} />
              </div>
              <button type="button" className="danger" onClick={() => askDelete(a.id)} aria-label={`Удалить актив ${a.name}`}>
                Удалить
              </button>
            </div>
          ))}
          {d.newAsset ? (
            <div className="newasset">
              <div className="fld">
                <label htmlFor="sna">Название нового актива</label>
                <input
                  id="sna"
                  className="inp"
                  maxLength={ASSET_NAME_MAX}
                  autoComplete="off"
                  autoFocus
                  placeholder="Например, Бизнес"
                  value={d.newAsset.name}
                  onChange={(e) => setD((x) => ({ ...x, newAsset: { name: e.target.value, error: "" } }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addNewAsset();
                    }
                  }}
                />
              </div>
              {d.newAsset.error && (
                <p className="err" role="alert">
                  {d.newAsset.error}
                </p>
              )}
              <div className="acts">
                <button type="button" className="btn fill" onClick={addNewAsset}>
                  Добавить
                </button>
                <button type="button" className="btn ghost" onClick={() => setD((x) => ({ ...x, newAsset: null }))}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            d.assets.length < MAX_ASSETS && (
              <div>
                <button type="button" className="linkbtn" onClick={() => setD((x) => ({ ...x, newAsset: { name: "", error: "" } }))}>
                  + Новый актив
                </button>
              </div>
            )
          )}
          <p className="sum">Удаление актива не стирает историю: его взносы переносятся в актив, который вы выберете. Суммы по месяцам, график и прибыль не меняются.</p>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h">
          <span className="lbl">Стратегия</span>
        </div>
        <div className="grp">
          <div className="seg" role="group" aria-label="Стратегия">
            <button type="button" aria-pressed={d.strategyOn} onClick={() => up((x) => ({ ...x, strategyOn: true }))}>
              Включена
            </button>
            <button type="button" aria-pressed={!d.strategyOn} onClick={() => up((x) => ({ ...x, strategyOn: false }))}>
              Отключена
            </button>
          </div>
          {d.strategyOn ? (
            <>
              <div className="grid2">
                {d.assets.map((a) => (
                  <div className="fld" key={a.id}>
                    <label htmlFor={`sw-${a.id}`}>{a.name}, %</label>
                    <input id={`sw-${a.id}`} className="inp num" inputMode="numeric" value={a.w} onChange={(e) => up((x) => ({ ...x, assets: x.assets.map((y) => (y.id === a.id ? { ...y, w: e.target.value } : y)) }))} />
                  </div>
                ))}
              </div>
              <p className="sum">
                Сумма долей: <b className="num">{weightSum}%</b>
                {weightSum === 100 ? "" : " (нужно ровно 100%)"}
              </p>
              <div className="fld">
                <label htmlFor="sn">Имя в шапке</label>
                <input id="sn" className="inp" maxLength={40} autoComplete="off" placeholder={autoName(d.assets)} value={d.stratName} onChange={(e) => up((x) => ({ ...x, stratName: e.target.value }))} />
              </div>
              <p className="sum">Оставьте поле пустым, и имя соберётся из долей само. Активы с долей 0% считаются вне стратегии.</p>
            </>
          ) : (
            <p className="sum">Без стратегии блок аллокации и её имя в шапке скрыты. Взносы и прибыль считаются как обычно.</p>
          )}
        </div>
      </section>

      <section className="sec">
        <div className="sec-h">
          <span className="lbl">План взноса</span>
        </div>
        <div className="grp">
          <div className="fld">
            <label htmlFor="s-plan">Сумма в месяц, ₽</label>
            <input id="s-plan" className="inp num" inputMode="decimal" value={d.plan} onChange={(e) => up((x) => ({ ...x, plan: e.target.value }))} />
          </div>
          <p className="sum">Подставляется в форму месяца и раскладывается по активам в подсказке «Направить в следующий взнос».</p>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h">
          <span className="lbl">Цель и вехи</span>
        </div>
        <div className="grp">
          <div className="fld">
            <label htmlFor="s-goal">Цель, ₽</label>
            <input id="s-goal" className="inp num" inputMode="decimal" value={d.goal} onChange={(e) => up((x) => ({ ...x, goal: e.target.value }))} />
          </div>
          {d.miles.map((m, i) => (
            <div className="arow2" key={i}>
              <div className="fld">
                <label htmlFor={`sm-${i}`}>Веха {i + 1}, ₽</label>
                <input id={`sm-${i}`} className="inp num" inputMode="decimal" value={m} onChange={(e) => up((x) => ({ ...x, miles: x.miles.map((v, k) => (k === i ? e.target.value : v)) }))} />
              </div>
              <button type="button" className="danger" onClick={() => up((x) => ({ ...x, miles: x.miles.filter((_, k) => k !== i) }))} aria-label={`Удалить веху ${i + 1}`}>
                Удалить
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                focusId.current = `sm-${d.miles.length}`;
                up((x) => ({ ...x, miles: [...x.miles, ""] }));
              }}
            >
              + Веха
            </button>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h">
          <span className="lbl">Тексты на главной</span>
        </div>
        <div className="grp">
          <div className="fld">
            <label htmlFor="t-title">Заголовок</label>
            <input id="t-title" className="inp" maxLength={80} value={d.texts.title} onChange={(e) => up((x) => ({ ...x, texts: { ...x.texts, title: e.target.value } }))} />
          </div>
          <div className="fld">
            <label htmlFor="t-sub">Подзаголовок</label>
            <input id="t-sub" className="inp" maxLength={140} value={d.texts.sub} onChange={(e) => up((x) => ({ ...x, texts: { ...x.texts, sub: e.target.value } }))} />
          </div>
          <div className="fld">
            <label htmlFor="t-quote">Цитата внизу</label>
            <textarea id="t-quote" className="inp" maxLength={240} value={d.texts.quote} onChange={(e) => up((x) => ({ ...x, texts: { ...x.texts, quote: e.target.value } }))} />
          </div>
        </div>
      </section>

      <div style={{ height: 120 }} />
      <div className="savebar">
        <div>
          {d.error && (
            <p className="err" role="alert">
              {d.error}
            </p>
          )}
          <button type="button" className="btn ghost" onClick={back}>
            Отмена
          </button>
          <button type="button" className="btn fill" onClick={save} disabled={pending}>
            {pending ? "Сохраняю…" : "Сохранить"}
          </button>
        </div>
      </div>

      {d.del && <DeleteDialog d={d} setD={setD} onConfirm={confirmDelete} />}
    </div>
  );
}

function DeleteDialog({ d, setD, onConfirm }: { d: Draft; setD: React.Dispatch<React.SetStateAction<Draft>>; onConfirm: () => void }) {
  const del = d.del as DelState;
  const a = d.assets.find((x) => x.id === del.id);
  const others = d.assets.filter((x) => x.id !== del.id);
  const downOnOverlay = useRef(false);
  if (!a) return null;
  const set = (p: Partial<DelState>) => setD((x) => ({ ...x, del: x.del ? { ...x.del, ...p, error: "" } : null }));
  const tgt = others.find((o) => o.id === del.target);
  return (
    <div
      className="ov"
      onPointerDown={(e) => { downOnOverlay.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnOverlay.current) setD((x) => ({ ...x, del: null })); }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="dm-t">
        <h2 id="dm-t">Удалить «{a.name}»?</h2>
        <p className="sum">История останется. Суммы по месяцам, график и прибыль не изменятся: взносы этого актива перейдут в выбранный.</p>
        <div className="fld">
          <label htmlFor="dm-to">Перенести взносы в</label>
          <select id="dm-to" className="inp" value={del.target} onChange={(e) => set({ target: e.target.value })}>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        {del.sole ? (
          <div className="mini">
            <p className="sum">
              <b>Это единственный актив в вашей стратегии.</b> Что сделать со стратегией?
            </p>
            <label className="radio">
              <input type="radio" name="dm-mode" value="off" checked={del.mode === "off"} onChange={() => set({ mode: "off" })} /> Отключить стратегию
            </label>
            <label className="radio">
              <input type="radio" name="dm-mode" value="new" checked={del.mode === "new"} onChange={() => set({ mode: "new" })} /> Задать доли заново
            </label>
            {del.mode === "new" && (
              <div className="grid2">
                {others.map((o) => (
                  <div className="fld" key={o.id}>
                    <label htmlFor={`dw-${o.id}`}>{o.name}, %</label>
                    <input id={`dw-${o.id}`} className="inp num" inputMode="numeric" value={del.weights[o.id] ?? ""} onChange={(e) => set({ weights: { ...del.weights, [o.id]: e.target.value } })} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          d.strategyOn &&
          wNum(a) > 0 && (
            <p className="sum">
              Доля «{a.name}» в стратегии ({wNum(a)}%) перейдёт к «{tgt?.name}». Потом её можно поправить.
            </p>
          )
        )}
        {del.error && (
          <p className="err" role="alert">
            {del.error}
          </p>
        )}
        <div className="acts">
          <button type="button" className="btn fill" onClick={onConfirm}>
            Удалить
          </button>
          <button type="button" className="btn ghost" onClick={() => setD((x) => ({ ...x, del: null }))}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
