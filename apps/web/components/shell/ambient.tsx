"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { haptic } from "../../lib/feel/haptics";

/**
 * Ambiance « Alive » de la coque web (phase 3) :
 *  - bandeau de connexion CALME : hors ligne → se déplie ; retour du réseau → « Connexion
 *    rétablie » quelques secondes puis se replie (aucune file d'écriture côté web : les finances ne
 *    sont jamais mises en attente, Master Spec 13.3) ;
 *  - révélation au défilement : les blocs de page situés sous la ligne de flottaison glissent et
 *    apparaissent la PREMIÈRE fois qu'ils entrent à l'écran (jamais rejoué), en ambiance seulement.
 */
export function ConnectivityBanner({ offline, online }: { offline: string; online: string }) {
  const [etat, setEtat] = useState<"ok" | "off" | "back">("ok");
  const t = useRef<number | undefined>(undefined);
  useEffect(() => {
    const off = () => {
      window.clearTimeout(t.current);
      setEtat("off");
      haptic("warning");
    };
    const on = () => {
      setEtat((e) => (e === "off" ? "back" : e));
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setEtat("ok"), 2600);
    };
    if (!navigator.onLine) setEtat("off");
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
      window.clearTimeout(t.current);
    };
  }, []);
  return (
    <div className="su-net" data-state={etat} role="status" aria-live="polite">
      <div className="su-net-inner">
        <span className="su-net-dot" aria-hidden />
        {etat === "off" ? offline : etat === "back" ? online : null}
      </div>
    </div>
  );
}

/**
 * Révélation au défilement : les blocs de `.page-root` situés sous la ligne de flottaison glissent
 * et apparaissent la PREMIÈRE fois qu'ils approchent de l'écran — jamais rejoué. Web Animations
 * API : aucun attribut n'est posé sur le DOM rendu par React (aucun écart d'hydratation, même
 * pendant une page servie en flux), et rien ne bouge hors écran.
 */
export function useScrollReveal() {
  const pathname = usePathname();
  useEffect(() => {
    const d = document.documentElement;
    const ambiance =
      d.dataset.alive !== "0" && d.dataset.lite !== "1" && d.dataset.motion !== "reduced" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ambiance || typeof IntersectionObserver === "undefined" || !("animate" in Element.prototype)) return;
    const root = document.querySelector(".page-root");
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          e.target.animate(
            [
              { opacity: 0, transform: "translateY(16px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 400, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          );
        }
      },
      // Déclenché juste AVANT l'entrée à l'écran : le premier pixel visible est déjà animé.
      { rootMargin: "0px 0px 48px 0px" }
    );
    const h = window.innerHeight;
    root.querySelectorAll<HTMLElement>(":scope > *, :scope > .grid > *").forEach((el) => {
      if (el.getBoundingClientRect().top > h + 48) io.observe(el);
    });
    return () => io.disconnect();
  }, [pathname]);
}
