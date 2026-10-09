"use client";

import type { ComponentProps, ReactNode } from "react";
import { haptic } from "../../lib/feel/haptics";

/**
 * Interrupteur et case à cocher VIVANTS (couche Alive) — inputs natifs (formulaires serveur,
 * accessibilité, clavier) : curseur en ressort, case qui se remplit et coche qui SE TRACE,
 * `select()` haptique à chaque bascule (Android). Les deux restent non contrôlés ou contrôlés
 * au choix de l'appelant.
 */
export function Switch({
  label,
  hint,
  className = "",
  onChange,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          onChange={(e) => {
            haptic("select");
            onChange?.(e);
          }}
          {...props}
        />
        <span className="h-6 w-10 rounded-full bg-hairline-strong transition-colors duration-300 peer-checked:bg-action peer-focus-visible:ring-2 peer-focus-visible:ring-action/40" />
        <span className="su-switch-thumb absolute top-0.5 start-0.5 size-5 rounded-full bg-white shadow-sm" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-strong">{label}</span>
        {hint ? <span className="block text-[13px] text-soft">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Case à cocher simple (attestations, confirmations explicites) — coche tracée. */
export function Checkbox({
  label,
  hint,
  className = "",
  onChange,
  ...props
}: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <span className="relative mt-0.5 inline-flex size-[18px] shrink-0">
        <input
          type="checkbox"
          className="su-check peer size-[18px] appearance-none rounded-[5px] border-[1.6px] border-hairline-strong bg-surface transition-colors duration-150 checked:border-ink checked:bg-ink focus-visible:ring-2 focus-visible:ring-action/40 disabled:opacity-50"
          onChange={(e) => {
            haptic("select");
            onChange?.(e);
          }}
          {...props}
        />
        <svg aria-hidden viewBox="0 0 18 18" className="su-check-mark pointer-events-none absolute inset-0 size-[18px]">
          <path d="M4.2 9.4 7.6 12.6 13.8 5.8" fill="none" stroke="var(--color-lime)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-strong">{label}</span>
        {hint ? <span className="block text-[13px] text-soft">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Groupe de choix exclusifs (remplace les <input type="radio"> bruts). */
export function RadioGroup({
  name,
  options,
  defaultValue,
  value,
  onChange,
  className = "",
}: {
  name: string;
  options: Array<{ value: string; label: ReactNode; hint?: ReactNode; disabled?: boolean }>;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={`space-y-2 ${className}`}>
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-start gap-3">
          <span className="relative mt-0.5 inline-flex size-5 shrink-0">
            <input
              type="radio"
              name={name}
              value={o.value}
              disabled={o.disabled}
              {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })}
              onChange={() => {
                haptic("select");
                onChange?.(o.value);
              }}
              className="su-radio peer size-5 appearance-none rounded-full border-[1.6px] border-hairline-strong bg-surface transition-colors duration-150 checked:border-ink focus-visible:ring-2 focus-visible:ring-action/40"
            />
            <span aria-hidden className="su-radio-dot pointer-events-none absolute inset-[5px] rounded-full bg-ink" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink-strong">{o.label}</span>
            {o.hint ? <span className="block text-[13px] text-soft">{o.hint}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}
