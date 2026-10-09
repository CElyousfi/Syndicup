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

/** Pose `data-reveal` sur les blocs de `.page-root` hors écran au chargement, puis les révèle une fois. */
export function useScrollReveal() {
  const pathname = usePathname();
  useEffect(() => {
    const d = document.documentElement;
    const ambiance =
      d.dataset.alive !== "0" && d.dataset.lite !== "1" && d.dataset.motion !== "reduced" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ambiance || typeof IntersectionObserver === "undefined") return;
    const root = document.querySelector(".page-root");
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.reveal = "in";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    const h = window.innerHeight;
    root.querySelectorAll<HTMLElement>(":scope > *, :scope > .grid > *").forEach((el) => {
      if (el.dataset.reveal) return;
      if (el.getBoundingClientRect().top > h) {
        el.dataset.reveal = "wait";
        io.observe(el);
      }
    });
    return () => io.disconnect();
  }, [pathname]);
}

