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

/** Champ complet : libellé, contrôle, aide, erreur serveur (VALIDATION_ERROR.fields).
 *  Vivant : une erreur qui apparaît secoue le champ (miroir RTL via --dir) et se pose en fondu ;
 *  `valid` trace une petite coche à côté du libellé. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optionalLabel,
  valid,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optionalLabel?: string;
  /** Saisie reconnue valide (code complet, référence reconnue…). */
  valid?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${error ? "su-field-invalid" : ""}`}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[14px] font-semibold text-ink">
        {label}
        {!required && optionalLabel ? (
          <span className="font-normal text-faint">({optionalLabel})</span>
        ) : null}
        {valid ? (
          <svg aria-hidden viewBox="0 0 18 18" className="su-tick ms-auto size-4 self-center">
            <path d="M4.2 9.4 7.6 12.6 13.8 5.8" fill="none" stroke="var(--color-ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </label>
      {children}
      {error ? (
        <p key={error} className="su-field-error text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-soft">{hint}</p>
      ) : null}
    </div>
  );
}

/** Interrupteur, case à cocher, groupe radio : composants client vivants (toggle.tsx). */
export { Switch, Checkbox, RadioGroup } from "./toggle";
