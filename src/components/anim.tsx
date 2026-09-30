"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// useLayoutEffect на сервере только ругается, поэтому там берём обычный.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Число «пробегает» от прежнего значения до нового (при первом показе от нуля). */
export function Count({ value, format, slow }: { value: number; format: (v: number) => string; slow?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const formatRef = useRef(format);
  useIsoLayoutEffect(() => {
    formatRef.current = format;
  });

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    shown.current = value;
    if (prefersReducedMotion() || from === value || Number.isNaN(value)) {
      el.textContent = formatRef.current(value);
      return;
    }
    const duration = slow ? 1400 : 950;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = formatRef.current(k < 1 ? from + (value - from) * eased : value);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    el.textContent = formatRef.current(from);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, slow]);

  return (
    <span ref={ref} className="cnt" suppressHydrationWarning>
      {format(value)}
    </span>
  );
}

/** Полоса, которая плавно растёт от прежней ширины (или от нуля) до новой. Ширину анимирует CSS. */
export function Fill({ percent }: { percent: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);
  return <i style={{ width: `${width}%` }} />;
}
