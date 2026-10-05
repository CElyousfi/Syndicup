"use client";

/**
 * Graphiques du module Rapports (M18) — SVG maison, zéro dépendance, zéro calcul métier :
 *  - `TresorerieChart` : 12 mois d'encaissements / décaissements (barres jumelles) et solde
 *    estimé (ligne). Les valeurs sont des nombres déjà dérivés des chaînes décimales par
 *    l'appelant, les libellés déjà localisés. RTL : l'axe du temps s'inverse (le mois le plus
 *    récent reste côté fin de lecture).
 *  - `AgeingBars` : barres horizontales d'ancienneté des impayés.
 * Langage Wise : entrées en vert marque, sorties sable, solde en ligne encre ; repères en voile
 * d'encre, barres arrondies, aucun dégradé.
 */
import { useState, type ReactNode } from "react";

export interface PointTresorerie {
  label: ReactNode;
  entrees: number;
  sorties: number;
  solde: number;
  displayEntrees: ReactNode;
  displaySorties: ReactNode;
  displaySolde: ReactNode;
}

export function TresorerieChart({ points, rtl = false, height = 220, legend }: { points: PointTresorerie[]; rtl?: boolean; height?: number; legend: { entrees: ReactNode; sorties: ReactNode; solde: ReactNode } }) {
  const [hover, setHover] = useState<number | null>(null);
  // Tracé en repère LTR explicite (barres, ligne et libellés partagent le même ordre) ; en arabe
  // l'axe est inversé à la main pour que le mois le plus récent reste en fin de lecture.
  const ordre = rtl ? points.slice().reverse() : points;
  const maxBar = Math.max(1, ...points.map((p) => Math.max(p.entrees, p.sorties)));
  const soldes = points.map((p) => p.solde);
  const minS = Math.min(0, ...soldes), maxS = Math.max(1, ...soldes);
  const n = Math.max(1, ordre.length);
  const hBar = (v: number) => Math.max(v > 0 ? 1.5 : 0, (v / maxBar) * 92);
  // Ordonnée du solde en % depuis le haut (marge de 8 % pour les pastilles).
  const yS = (v: number) => 100 - ((v - minS) / (maxS - minS || 1)) * 92;
  const xC = (i: number) => ((i + 0.5) / n) * 100;
  const ligne = ordre.map((p, i) => `${xC(i)},${yS(p.solde)}`).join(" ");
  const focus = hover !== null ? ordre[hover] : null;
  return (
    <div>
      <div dir="ltr" className="relative w-full" style={{ height }}>
        {/* Repères en voile d'encre */}
        <div aria-hidden className="absolute inset-x-0 top-[8%] h-px bg-wash" />
        <div aria-hidden className="absolute inset-x-0 top-[54%] h-px bg-wash" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-wash-strong" />
        {/* Barres jumelles entrées / sorties */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {ordre.map((p, i) => (
            <div
              key={i}
              className={`relative flex h-full cursor-pointer items-end justify-center gap-[3px] rounded-[10px] px-[14%] transition-[background-color,opacity] duration-200 sm:gap-1 ${hover === i ? "bg-wash" : ""}`}
              style={{ opacity: hover !== null && hover !== i ? 0.4 : 1 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
              aria-hidden
            >
              <span className="animate-bar-grow w-full max-w-4 rounded-t-full bg-brand" style={{ height: `${hBar(p.entrees)}%`, animationDelay: `${i * 30}ms` }} />
              <span className="animate-bar-grow w-full max-w-4 rounded-t-full bg-sand" style={{ height: `${hBar(p.sorties)}%`, animationDelay: `${i * 30 + 15}ms` }} />
            </div>
          ))}
        </div>
        {/* Solde estimé : ligne encre, pastilles blanches, point lime au survol */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <polyline points={ligne} fill="none" stroke="var(--color-ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {ordre.map((p, i) => (
          <span
            key={i}
            aria-hidden
            className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink transition-[width,height,background-color] duration-200 ${hover === i ? "size-3.5 bg-lime" : "size-2.5 bg-surface"}`}
            style={{ left: `${xC(i)}%`, top: `${yS(p.solde)}%` }}
          />
        ))}
      </div>
      <div dir="ltr" className="mt-2 grid text-[10.5px] font-medium text-soft" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {ordre.map((p, i) => (
          <span key={i} className={`truncate text-center ${hover === i ? "font-bold text-ink" : ""}`}>{p.label}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] font-medium text-body">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded-full bg-brand" />{legend.entrees}{focus ? <b className="tnum ms-1 text-ink">{focus.displayEntrees}</b> : null}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded-full bg-sand" />{legend.sorties}{focus ? <b className="tnum ms-1 text-ink">{focus.displaySorties}</b> : null}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-4 rounded-full bg-ink" />{legend.solde}{focus ? <b className="tnum ms-1 text-ink">{focus.displaySolde}</b> : null}</span>
      </div>
    </div>
  );
}

export function AgeingBars({ items }: { items: { label: ReactNode; value: number; display: ReactNode; hint?: ReactNode; tone: "info" | "warn" | "danger" }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const couleur = { info: "var(--color-tosca-deep)", warn: "var(--color-sand)", danger: "var(--color-danger)" };
  return (
    <ul className="space-y-3.5">
      {items.map((it, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink-strong">{it.label}{it.hint ? <span className="ms-2 text-[12px] font-normal text-soft">{it.hint}</span> : null}</span>
            <span className="tnum font-bold text-ink">{it.display}</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-wash">
            <div className="pb-fill h-full rounded-full" style={{ width: `${Math.max(it.value > 0 ? 3 : 0, (it.value / max) * 100)}%`, background: couleur[it.tone] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
