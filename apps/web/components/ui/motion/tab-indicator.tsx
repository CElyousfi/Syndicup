"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Soulignement glissant des <LinkTabs> : se place sous l'onglet d'index `index` (frère dans le
 * même <nav>) et glisse jusqu'au nouvel onglet quand la page change d'onglet. Mesure physique
 * (`offsetLeft`) + `left: 0` : juste en LTR comme en RTL. Sans JS, le soulignement statique
 * rendu par le serveur reste visible.
 */
export function TabIndicator({ index, inset = 8 }: { index: number; inset?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const nav = ref.current?.parentElement;
    if (!nav) return;
    const measure = () => {
      const el = nav.children.item(index);
      if (!(el instanceof HTMLElement) || el === ref.current) return;
      setBox({ x: el.offsetLeft + inset, w: Math.max(0, el.offsetWidth - inset * 2) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [index, inset]);

  // Premier placement : sans glissé (sinon l'indicateur partirait du bord).
  useLayoutEffect(() => {
    if (box && first.current) {
      const id = requestAnimationFrame(() => {
        first.current = false;
        ref.current?.removeAttribute("data-instant");
      });
      return () => cancelAnimationFrame(id);
    }
  }, [box]);

  return (
    <span
      ref={ref}
      aria-hidden
      className="tab-ind"
      data-instant=""
      data-ready={box ? "" : undefined}
      style={box ? { transform: `translateX(${box.x}px)`, width: box.w } : undefined}
    />
  );
}
