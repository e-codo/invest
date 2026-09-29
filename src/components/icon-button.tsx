"use client";

import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"button">, "aria-label" | "title"> & { label: string };

/** Круглая кнопка с иконкой. Иконка передаётся как <svg> внутрь. */
export function IconButton({ label, className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-btn grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:border-ink-3 hover:text-ink ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
