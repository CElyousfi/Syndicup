"use client";

/**
 * Graphiques maison — SVG/DOM interactifs, zéro dépendance, zéro calcul métier :
 * ratios et libellés déjà fournis, formatés et localisés par l'appelant.
 *
 *  - `Donut` : anneau de répartition, tracé animé au montage, survol/tap → segment
 *    mis en avant + centre synchronisé (pourcentage, valeur).
 *  - `Bars` : barres superposées « émis / encaissé » avec lignes de repère, axe de
 *    valeurs et légende — chaque barre raconte combien a été appelé ET combien est
 *    réellement rentré.
 *
 * Série de couleurs : la palette du produit (sauge, sable, tosca, lilas, mousse, encre).
 */
import { useEffect, useState, type ReactNode } from "react";

export const SERIES = [
  "var(--color-sage)",
  "var(--color-sand-mid)",
  "var(--color-tosca-mid)",
  "var(--color-lilac-mid)",
  "var(--color-moss)",
  "var(--color-lilac)",
] as const;

export interface DonutItem {
  label: ReactNode;
  /** Part relative (valeur brute, pas forcément normalisée). */
  value: number;
  /** Valeur affichée (légende + centre au survol), déjà formatée. */
  display?: ReactNode;
  color?: string;
}

/** Anneau de répartition interactif — tracé animé, centre vivant, légende synchronisée. */
export function Donut({
  items,
  centerLabel,
  centerSub,
  size = 176,
}: {
  items: DonutItem[];
  centerLabel: ReactNode;
  centerSub?: ReactNode;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [monte, setMonte] = useState(false);

  // Tracé progressif au montage (double rAF : le premier rendu part de zéro).
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMonte(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = items.reduce((s, it) => s + Math.max(0, it.value), 0);
  const stroke = size * 0.14;
  const r = (size - stroke * 1.5) / 2;
  const c = 2 * Math.PI * r;
  const actifs = items.filter((it) => it.value > 0).length;
  const gap = actifs > 1 ? c * 0.014 : 0;

  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  let offset = -c / 4; // départ à 12h
  const segments = items
    .map((it, i) => {
      if (total <= 0 || it.value <= 0) return null;
      const frac = it.value / total;
      const len = Math.max(0, c * frac - gap);
      const estHover = hover === i;
      const seg = (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={it.color ?? SERIES[i % SERIES.length]}
          strokeWidth={estHover ? stroke * 1.28 : stroke}
          strokeLinecap={gap > 0 ? "round" : "butt"}
          strokeDasharray={`${monte ? len : 0} ${monte ? c - len : c}`}
          strokeDashoffset={-offset - gap / 2}
          opacity={hover === null || estHover ? 1 : 0.35}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onClick={() => setHover(estHover ? null : i)}
          style={{
            transition:
              "stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1), stroke-width 180ms ease, opacity 180ms ease",
            cursor: "pointer",
          }}
        />
      );
      offset += c * frac;
      return seg;
    })
    .filter(Boolean);

  const survole = hover !== null ? items[hover] : null;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden>
          {total <= 0 ? (
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ground)" strokeWidth={stroke} />
          ) : (
            segments
          )}
        </svg>
        <div
          key={hover ?? -1}
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center animate-fade"
        >
          {survole ? (
            <>
              <span className="tnum text-[17px] font-semibold leading-tight tracking-tight text-ink">
                {survole.display ?? survole.value}
              </span>
              <span className="mt-0.5 max-w-full truncate text-[11px] font-medium text-soft">
                {survole.label}
              </span>
              <span className="tnum mt-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">
                {pct(survole.value)}%
              </span>
            </>
          ) : (
            <>
              <span className="tnum max-w-full text-[17px] font-semibold leading-tight tracking-tight text-ink">
                {centerLabel}
              </span>
              {centerSub ? (
                <span className="mt-0.5 max-w-full text-[11px] text-soft">{centerSub}</span>
              ) : null}
            </>
          )}
        </div>
      </div>
      <ul className="min-w-[190px] flex-1 space-y-1">
        {items.map((it, i) => {
          const estHover = hover === i;
          return (
            <li
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(estHover ? null : i)}
              className={`flex cursor-default items-center gap-2.5 rounded-full px-2.5 py-1.5 text-[13px] transition-colors duration-200 ${
                estHover ? "bg-ground" : ""
              }`}
            >
              <span
                className="mt-1 size-2.5 shrink-0 self-start rounded-full transition-transform duration-200"
                style={{
                  background: it.color ?? SERIES[i % SERIES.length],
                  transform: estHover ? "scale(1.35)" : undefined,
                }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-body">{it.label}</span>
                  <span className="tnum shrink-0 text-[11px] font-medium text-soft">
                    {pct(it.value)}%
                  </span>
                </span>
                {it.display ? (
                  <span className="tnum block text-[13px] font-semibold text-ink">{it.display}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface BarItem {
  label: ReactNode;
  /** Hauteur relative du montant appelé (0..1 par rapport à la plus grande barre). */
  totalRatio: number;
  /** Part encaissée DE CETTE barre (0..1 de son montant appelé). */
  paidRatio: number;
  /** Montants affichés (déjà formatés). */
  displayTotal?: ReactNode;
  displayPaid?: ReactNode;
  active?: boolean;
}

/**
 * Barres superposées « appelé / encaissé » : la barre claire est le montant émis,
 * la barre sombre (hachurée si active) la part réellement encaissée. Lignes de
 * repère + axe de valeurs + légende. Survol/tap : détail des deux montants.
 */
export function Bars({
  items,
  height = 210,
  yTop,
  yMid,
  legendPaid,
  legendTotal,
  className = "",
}: {
  items: BarItem[];
  height?: number;
  /** Valeur de l'axe à 100 % (déjà formatée, ex. plus gros appel). */
  yTop?: ReactNode;
  /** Valeur de l'axe à 50 %. */
  yMid?: ReactNode;
  legendPaid?: ReactNode;
  legendTotal?: ReactNode;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [monte, setMonte] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMonte(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const actifIdx = items.findIndex((it) => it.active);
  const focus = hover ?? (actifIdx >= 0 ? actifIdx : null);

  return (
    <div className={className}>
      <div className="flex gap-3">
        {/* Axe des valeurs */}
        {yTop != null ? (
          <div className="relative hidden w-16 shrink-0 sm:block" style={{ height }}>
            <span className="tnum absolute top-0 -translate-y-1/2 text-[10px] text-faint">{yTop}</span>
            {yMid != null ? (
              <span className="tnum absolute top-1/2 -translate-y-1/2 text-[10px] text-faint">
                {yMid}
              </span>
            ) : null}
            <span className="tnum absolute bottom-0 translate-y-1/2 text-[10px] text-faint">0</span>
          </div>
        ) : null}

        {/* Zone de tracé */}
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {/* Lignes de repère */}
          <div aria-hidden className="absolute inset-x-0 top-0 border-t border-dashed border-hairline" />
          <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-hairline" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 border-t border-hairline-strong" />

          <div className="absolute inset-0 flex items-end justify-center gap-3 px-1 sm:gap-6">
            {items.map((it, i) => {
              const total = Math.max(0.04, Math.min(1, it.totalRatio));
              const paye = Math.max(0, Math.min(1, it.paidRatio));
              const estFocus = focus === i;
              const pctPaye = Math.round(paye * 100);
              return (
                <div
                  key={i}
                  className="relative flex h-full w-full max-w-20 cursor-pointer items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}
                >
                  {/* Infobulle : encaissé / appelé */}
                  {estFocus && (it.displayPaid || it.displayTotal) ? (
                    <div className="tnum absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-xl bg-ink px-3 py-1.5 text-center shadow-pop animate-fade">
                      <span className="block text-[12px] font-semibold text-white">
                        {it.displayPaid}
                      </span>
                      <span className="block text-[10px] text-white/60">/ {it.displayTotal}</span>
                    </div>
                  ) : null}

                  {/* Montant appelé (clair) */}
                  <div
                    className={`relative w-full overflow-hidden rounded-t-[10px] bg-action-tint transition-[height,filter] duration-700 ease-out ${
                      estFocus ? "brightness-[0.97]" : ""
                    }`}
                    style={{ height: monte ? `${total * 100}%` : "0%" }}
                    aria-hidden
                  >
                    {/* Part encaissée (sombre, hachurée si active) */}
                    <div
                      className={`absolute inset-x-0 bottom-0 bg-action transition-[height] duration-700 ease-out ${
                        it.active ? "bar-stripes" : ""
                      } ${paye >= 1 ? "rounded-t-[10px]" : ""}`}
                      style={{ height: monte ? `${paye * 100}%` : "0%", transitionDelay: `${i * 60}ms` }}
                    />
                  </div>

                  {/* % encaissé au sommet de la barre */}
                  <span
                    className={`tnum absolute w-full text-center text-[10px] font-semibold transition-opacity duration-300 ${
                      estFocus ? "text-ink" : "text-faint"
                    }`}
                    style={{ bottom: `calc(${total * 100}% + 4px)`, opacity: monte ? 1 : 0 }}
                    aria-hidden
                  >
                    {pctPaye}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Libellés des périodes */}
      <div className="flex gap-3">
        {yTop != null ? <div className="hidden w-16 shrink-0 sm:block" /> : null}
        <div className="flex min-w-0 flex-1 justify-center gap-3 px-1 sm:gap-6">
          {items.map((it, i) => (
            <span
              key={i}
              className={`w-full max-w-20 truncate pt-2 text-center text-[11px] font-medium transition-colors ${
                focus === i ? "text-ink" : "text-soft"
              }`}
            >
              {it.label}
            </span>
          ))}
        </div>
      </div>

      {/* Légende */}
      {legendPaid || legendTotal ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12px] text-body">
          {legendPaid ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[4px] bg-action" aria-hidden />
              {legendPaid}
            </span>
          ) : null}
          {legendTotal ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[4px] bg-action-tint ring-1 ring-inset ring-action/20" aria-hidden />
              {legendTotal}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
