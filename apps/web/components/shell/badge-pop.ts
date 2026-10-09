"use client";

import { useEffect } from "react";

/**
 * Badges vivants : un badge (composant serveur, `data-badge`) dont le texte ou la variante CHANGE
 * après une actualisation live éclot une fois (`.badge-pop`, motion.css). Un badge qui apparaît
 * avec sa liste ne bouge pas. Observé dans la coque connectée seulement : zéro JS sur les pages
 * publiques (D5).
 */
export function useBadgePop() {
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const nous = new WeakSet<Element>();
    const mo = new MutationObserver((records) => {
      if (document.documentElement.dataset.alive === "0") return;
      const cibles = new Set<HTMLElement>();
      for (const r of records) {
        const node = r.target instanceof HTMLElement ? r.target : r.target.parentElement;
        const el = node?.closest<HTMLElement>("[data-badge]");
        if (!el) continue;
        // Nos propres retouches de classe ne comptent pas.
        if (r.type === "attributes" && nous.has(el)) continue;
        cibles.add(el);
      }
      for (const el of cibles) {
        nous.add(el);
        el.classList.remove("badge-pop");
        void el.offsetWidth; // relance l'animation
        el.classList.add("badge-pop");
        window.setTimeout(() => nous.delete(el), 0);
      }
    });
    mo.observe(document.body, { subtree: true, characterData: true, childList: true, attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
}
