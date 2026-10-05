import type { ComponentProps, ReactNode } from "react";

const CONTROL =
  "w-full rounded-field border border-hairline-strong bg-surface px-4 text-[15px] text-ink-strong placeholder:text-faint transition-[border-color,box-shadow] hover:border-faint focus:border-ink focus:shadow-[inset_0_0_0_1px_var(--color-ink)] focus:outline-none disabled:bg-wash disabled:text-soft";

/** `w-full` par défaut, sauf si l'appelant fixe lui-même une largeur (w-44, w-56…) —
 *  l'ordre de génération Tailwind ferait sinon toujours gagner `w-full`. */
function base(className: string) {
  return /(^|\s)w-(?!full)/.test(className) ? CONTROL.replace("w-full ", "") : CONTROL;
}

// `suppressHydrationWarning` : les gestionnaires de mots de passe / extensions de remplissage
// (Dashlane, 1Password, Bitwarden…) injectent des attributs (ex. `__gcruniqueid`) sur les champs
// `tel`/`email`/`password` avant l'hydratation React — un mismatch client/serveur inoffensif que
// React signale mais ne « corrige » jamais (https://react.dev/link/hydration-mismatch). Centralisé
// ici : tous les champs de l'app passent par ces trois composants.
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${base(className)} h-12 ${className}`} suppressHydrationWarning {...props} />;
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <select className={`${base(className)} h-12 appearance-none ${className}`} suppressHydrationWarning {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${CONTROL} min-h-24 py-2.5 ${className}`} rows={4} suppressHydrationWarning {...props} />;
}

/** Champ complet : libellé, contrôle, aide, erreur serveur (VALIDATION_ERROR.fields). */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optionalLabel,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[14px] font-semibold text-ink">
        {label}
        {!required && optionalLabel ? (
          <span className="font-normal text-faint">({optionalLabel})</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-soft">{hint}</p>
      ) : null}
    </div>
  );
}

/** Interrupteur (options booléennes) — input checkbox stylé, accessible. */
export function Switch({
  label,
  hint,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" {...props} />
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

/** Case à cocher simple (attestations, confirmations explicites). */
export function Checkbox({
  label,
  hint,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <input
        type="checkbox"
        className="su-check mt-0.5 size-[18px] shrink-0 rounded-[5px] border-hairline-strong text-action accent-[#1e7552] focus-visible:ring-2 focus-visible:ring-action/40"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-strong">{label}</span>
        {hint ? <span className="block text-[13px] text-soft">{hint}</span> : null}
      </span>
    </label>
  );
}
