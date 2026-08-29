"use client";

import type { ReactNode } from "react";

/** Contrôle segmenté (onglets de formulaire : téléphone/email, ciblé/FIFO…). */
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
  return (
    <div
      role="tablist"
      className={`inline-flex w-full rounded-btn border border-hairline bg-ground p-1 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`h-9 flex-1 rounded-[10px] px-3 text-sm font-medium transition-all ${
              active ? "bg-surface text-ink shadow-sm" : "text-soft hover:text-ink-strong"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
