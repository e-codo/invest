"use client";

import { useState, useTransition } from "react";
import { deleteTransaction } from "@/app/actions/month";

/** Удаление в два нажатия: сначала «Удалить», затем «Точно?». */
export function DeleteTransactionButton({ id, label }: { id: number; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Удалить: ${label}`}
        className="text-[13px] text-ink-3 underline-offset-2 hover:text-danger hover:underline"
      >
        Удалить
      </button>
    );
  }

  return (
    <span className="flex items-center gap-3 text-[13px]">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteTransaction(id))}
        className="font-medium text-danger underline-offset-2 hover:underline disabled:opacity-60"
      >
        {pending ? "Удаляю…" : "Точно?"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="text-ink-3 underline-offset-2 hover:text-ink hover:underline"
      >
        Отмена
      </button>
    </span>
  );
}
