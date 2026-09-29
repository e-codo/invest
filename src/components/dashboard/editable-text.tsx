"use client";

import { useRef, useTransition, type ElementType } from "react";
import { updateText } from "@/app/actions/settings";
import { TEXT_LIMITS, type TextField } from "@/lib/settings-schema";

type Props = {
  field: TextField;
  initial: string;
  as?: ElementType;
  className?: string;
  label: string;
};

/** Текст, который правится прямо на странице и сохраняется, когда фокус уходит. Enter завершает правку. */
export function EditableText({ field, initial, as: Tag = "p", className = "", label }: Props) {
  const ref = useRef<HTMLElement>(null);
  const saved = useRef(initial);
  const [, startTransition] = useTransition();

  function commit() {
    const el = ref.current;
    if (!el) return;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text === saved.current) {
      el.textContent = saved.current;
      return;
    }
    if (text.length === 0 || text.length > TEXT_LIMITS[field]) {
      el.textContent = saved.current; // пустой или слишком длинный текст не сохраняем
      return;
    }
    startTransition(async () => {
      const result = await updateText(field, text);
      if (result.ok) saved.current = text;
      else if (ref.current) ref.current.textContent = saved.current;
    });
  }

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label={label}
      title="Нажмите, чтобы изменить"
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onPaste={(e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        document.execCommand("insertText", false, text);
      }}
      className={`rounded-lg outline-none transition-colors hover:bg-accent/5 focus:bg-accent/10 ${className}`}
    >
      {initial}
    </Tag>
  );
}
