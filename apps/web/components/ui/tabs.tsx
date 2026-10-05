"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Contrôle segmenté (onglets de formulaire : téléphone/email, ciblé/FIFO…).
 * Une seule pastille blanche glisse sous l'option active (ressort, sens RTL respecté). Les
 * options ayant toutes la même largeur, le déplacement est un pur `translateX` en CSS : pas de
 * mesure, pas de bibliothèque (le formulaire de connexion reste léger).
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  className?: string;
}) {
  const n = Math.max(1, options.length);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="tablist"
      className={`relative inline-flex w-full rounded-btn bg-wash p-1 ${className}`}
      style={{ "--n": n, "--idx": idx } as CSSProperties}
    >
      <span aria-hidden className="seg-pill absolute inset-y-1 start-1 rounded-full bg-surface shadow-[0_1px_3px_rgb(18_18_18/0.12)]" />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`relative h-10 flex-1 rounded-full px-3 text-sm font-semibold transition-colors duration-200 ${
              active ? "text-ink" : "text-soft hover:text-ink-strong"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
