"use client";

/**
 * Graphiques du module Rapports (M18) — SVG maison, zéro dépendance, zéro calcul métier :
 *  - `TresorerieChart` : 12 mois d'encaissements / décaissements (barres jumelles) et solde
 *    estimé (ligne). Les valeurs sont des nombres déjà dérivés des chaînes décimales par
 *    l'appelant, les libellés déjà localisés. RTL : l'axe du temps s'inverse (le mois le plus
 *    récent reste côté fin de lecture).
 *  - `AgeingBars` : barres horizontales d'ancienneté des impayés.
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
  const ordre = rtl ? points.slice().reverse() : points;
  const maxBar = Math.max(1, ...points.map((p) => Math.max(p.entrees, p.sorties)));
  const soldes = points.map((p) => p.solde);
  const minS = Math.min(0, ...soldes), maxS = Math.max(1, ...soldes);
  const W = 100, H = 100; // viewBox relatif
  const n = Math.max(1, ordre.length);
  const slot = W / n;
  const y = (v: number) => H - (v / maxBar) * (H - 8);
  const yS = (v: number) => H - ((v - minS) / (maxS - minS || 1)) * (H - 8);
  const ligne = ordre.map((p, i) => `${i * slot + slot / 2},${yS(p.solde)}`).join(" ");
  const focus = hover !== null ? ordre[hover] : null;
  return (
    <div>
      <div className="relative w-full" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <line x1="0" x2={W} y1={H} y2={H} stroke="var(--color-hairline-strong)" strokeWidth="0.4" />
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--color-hairline)" strokeWidth="0.3" strokeDasharray="1 1" />
          {ordre.map((p, i) => {
            const x0 = i * slot + slot * 0.18;
            const w = slot * 0.28;
            const dim = hover !== null && hover !== i ? 0.35 : 1;
            return (
              <g key={i} opacity={dim} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)} style={{ cursor: "pointer" }}>
                <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
                <rect x={x0} y={y(p.entrees)} width={w} height={Math.max(0.6, H - y(p.entrees))} rx="0.6" fill="var(--color-sage)" />
                <rect x={x0 + w + slot * 0.08} y={y(p.sorties)} width={w} height={Math.max(0.6, H - y(p.sorties))} rx="0.6" fill="var(--color-sand-mid)" />
              </g>
            );
          })}
          <polyline points={ligne} fill="none" stroke="var(--color-ink)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {ordre.map((p, i) => (
            <circle key={i} cx={i * slot + slot / 2} cy={yS(p.solde)} r={hover === i ? 1.6 : 1} fill="var(--color-ink)" />
          ))}
        </svg>
      </div>
      <div className="mt-2 grid text-[10px] text-faint" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {ordre.map((p, i) => (
          <span key={i} className={`truncate text-center ${hover === i ? "font-semibold text-ink" : ""}`}>{p.label}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-soft">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-sage)" }} />{legend.entrees}{focus ? <b className="tnum ms-1 text-ink">{focus.displayEntrees}</b> : null}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-sand-mid)" }} />{legend.sorties}{focus ? <b className="tnum ms-1 text-ink">{focus.displaySorties}</b> : null}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 rounded" style={{ background: "var(--color-ink)" }} />{legend.solde}{focus ? <b className="tnum ms-1 text-ink">{focus.displaySolde}</b> : null}</span>
      </div>
    </div>
  );
}

export function AgeingBars({ items }: { items: { label: ReactNode; value: number; display: ReactNode; hint?: ReactNode; tone: "info" | "warn" | "danger" }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const couleur = { info: "var(--color-tosca-mid)", warn: "var(--color-sand-mid)", danger: "var(--color-danger)" };
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-body">{it.label}{it.hint ? <span className="ms-2 text-[12px] text-faint">{it.hint}</span> : null}</span>
            <span className="tnum font-semibold text-ink">{it.display}</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ground">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(it.value > 0 ? 3 : 0, (it.value / max) * 100)}%`, background: couleur[it.tone] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
