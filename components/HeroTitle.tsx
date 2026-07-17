"use client";

import { useEffect, useRef } from "react";

const LINE_HEIGHT = 1.05;
const MAX_LINES = 2;
const MIN_FONT_PX = 16;
const MAX_FONT_PX = 44;

type HeroTitleProps = {
  children: string;
};

function fitsTwoLines(el: HTMLElement, fontSizePx: number) {
  el.style.fontSize = `${fontSizePx}px`;
  const maxHeight = fontSizePx * LINE_HEIGHT * MAX_LINES + 1;
  return el.scrollHeight <= maxHeight;
}

function fitTitle(el: HTMLElement) {
  let low = MIN_FONT_PX;
  let high = MAX_FONT_PX;
  let best = MIN_FONT_PX;

  if (fitsTwoLines(el, MAX_FONT_PX)) {
    el.style.fontSize = `${MAX_FONT_PX}px`;
    return;
  }

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (fitsTwoLines(el, mid)) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  el.style.fontSize = `${best}px`;
}

export function HeroTitle({ children }: HeroTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    const container = el?.parentElement;
    if (!el || !container) {
      return;
    }

    const runFit = () => fitTitle(el);
    runFit();

    const observer = new ResizeObserver(runFit);
    observer.observe(container);

    return () => observer.disconnect();
  }, [children]);

  return (
    <h1 ref={ref} className="article-hero-title">
      {children}
    </h1>
  );
}
