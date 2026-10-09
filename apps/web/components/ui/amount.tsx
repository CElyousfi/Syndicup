"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatMAD, formatMontant } from "../../lib/format";

/**
 * Nombres VIVANTS (couche Alive) — même contrat que le mobile `AnimatedFigureText` :
 *  - au premier affichage : texte simple (une liste qui se charge ne s'anime pas) ;
 *  - quand la valeur CHANGE (actualisation live, `router.refresh()` toutes les 25 s, action) :
 *    seuls les caractères qui changent roulent vers la nouvelle valeur, avec une teinte brève
 *    verte (hausse) ou rouge (baisse) ;
 *  - aucune arithmétique sur le montant : comparaison exacte des chiffres de la chaîne formatée
 *    (BigInt), jamais de float (CLAUDE.md §1.1).
 * Lecteurs d'écran : le texte final seulement. « Réduire les animations » : fondu simple.
 */

/** Compare deux nombres formatés (« 1 250,00 MAD », « 12,5 % ») — null si non comparables. */
export function compareFigures(a: string, b: string): number | null {
  const parse = (s: string): bigint | null => {
    const m = s.match(/(\d[\d\s\u00a0\u202f]*)(?:[.,](\d+))?/);
    if (!m) return null;
    const ent = (m[1] ?? "").replace(/\D/g, "");
    const dec = ((m[2] ?? "") + "0000").slice(0, 4);
    const v = BigInt(ent + dec);
    return /[-−]/.test(s) ? -v : v;
  };
  const x = parse(a);
  const y = parse(b);
  if (x === null || y === null) return null;
  return x === y ? 0 : x > y ? 1 : -1;
}

type Roll = { from: string; to: string; dir: 1 | -1 | 0; id: number };

export function Figure({
  value,
  className = "",
  upIsGood = true,
  tint = true,
  dir,
}: {
  value: string;
  className?: string;
  /** false : une hausse est une mauvaise nouvelle (impayés, retards). */
  upIsGood?: boolean;
  tint?: boolean;
  dir?: "ltr" | "rtl" | "auto";
}) {
  const prev = useRef(value);
  const [roll, setRoll] = useState<Roll | null>(null);

  useEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    prev.current = value;
    if (typeof document !== "undefined" && document.documentElement.dataset.alive === "0") return;
    const c = compareFigures(value, from);
    const r: Roll = { from, to: value, dir: c === null ? 0 : (c as 1 | -1 | 0), id: Date.now() };
    setRoll(r);
    const t = window.setTimeout(() => setRoll((cur) => (cur?.id === r.id ? null : cur)), 1300);
    return () => window.clearTimeout(t);
  }, [value]);

  if (!roll) {
    return (
      <span className={`tnum ${className}`} dir={dir}>
        {value}
      </span>
    );
  }

  // Alignement par la fin : les unités restent sous les unités quand la longueur change.
  const n = Math.max(roll.from.length, roll.to.length);
  const a = roll.from.padStart(n, " ");
  const b = roll.to.padStart(n, " ");
  let changed = 0;
  const good = roll.dir === 0 ? null : (roll.dir > 0) === upIsGood;
  return (
    <span
      key={roll.id}
      className={`amt-live tnum ${tint && good !== null ? (good ? "amt-up" : "amt-down") : ""} ${className}`}
      dir={dir}
    >
      <span className="sr-only">{roll.to}</span>
      <span aria-hidden className="amt-chars" dir="ltr">
        {Array.from(b).map((cb, i) => {
          const ca = a[i] ?? " ";
          if (ca === cb) return cb === " " && i < n - roll.to.length ? null : <span key={i}>{cb}</span>;
          const style = { "--k": changed++ } as CSSProperties;
          return (
            <span key={i} className={`amt-roll ${roll.dir < 0 ? "amt-roll-down" : ""}`} style={style}>
              <span className="amt-ghost">{cb.trim() ? cb : ca}</span>
              {ca.trim() ? <span className="amt-old">{ca}</span> : null}
              {cb.trim() ? <span className="amt-new">{cb}</span> : null}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Montant au format API (« 1250.50 ») formaté exactement comme partout, puis vivant. */
export function Amount({
  value,
  locale,
  currency = true,
  className = "",
  upIsGood = true,
  prefix = "",
}: {
  value: string | null | undefined;
  locale: string;
  currency?: boolean;
  className?: string;
  upIsGood?: boolean;
  /** Signe ou libellé collé devant (« − », « + »), déjà localisé. */
  prefix?: string;
}) {
  const text = currency ? formatMAD(value ?? null, locale as "fr" | "ar") : formatMontant(value ?? null);
  return <Figure value={`${prefix}${text}`} className={className} upIsGood={upIsGood} />;
}
