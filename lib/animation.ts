"use client";

import { useEffect, useState } from "react";

// Typemachine-effect: onthult `text` teken voor teken. Bij een nieuwe tekst
// begint het typen opnieuw (render-time reset, geen effect-cascade).
export function useTypewriter(text: string, speed = 40) {
  const [state, setState] = useState({ text, count: 0 });
  if (state.text !== text) {
    setState({ text, count: 0 });
  }

  useEffect(() => {
    if (state.count >= text.length) return;
    const timer = setTimeout(
      () =>
        setState((s) =>
          s.text === text ? { ...s, count: Math.min(s.count + 1, text.length) } : s
        ),
      speed
    );
    return () => clearTimeout(timer);
  }, [state, text, speed]);

  return {
    display: text.slice(0, state.count),
    done: text.length > 0 && state.count >= text.length,
  };
}

// Telt soepel op van 0 naar `target` (ease-out), voor scores en tellers.
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
