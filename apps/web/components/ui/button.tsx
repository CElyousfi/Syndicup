import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "dangerGhost";
type Size = "sm" | "md" | "lg";

/** Langage Wise (identique au mobile) : principale = pill lime au texte encre ; secondaire = pill
 *  contour vert marque ; fantôme = voile d'encre au survol ; aucune ombre. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-cta text-ink hover:bg-lime-hover",
  secondary: "bg-transparent text-link border-[1.5px] border-link hover:bg-action-wash",
  danger: "bg-danger text-white hover:brightness-110",
  ghost: "text-ink-strong hover:bg-wash",
  dangerGhost: "text-danger hover:bg-danger-tint",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-12 px-7 text-[15px] gap-2",
};

const BASE =
  "inline-flex items-center justify-center su-btn rounded-btn font-semibold select-none disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: Size }) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <Link className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
}

/** Bouton-icône (fermer, menu, actions de ligne) : pastille ronde, enfoncement vif, libellé
 *  accessible obligatoire. `tone` : greige (défaut), transparent ou danger. */
export function IconButton({
  label,
  tone = "tile",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { label: string; tone?: "tile" | "ghost" | "danger" | "none"; size?: "sm" | "md" }) {
  const tones = {
    tile: "bg-tile text-ink hover:bg-[#e3e2da]",
    ghost: "text-ink-strong hover:bg-wash",
    danger: "text-danger hover:bg-danger-tint",
    none: "",
  } as const;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`su-btn su-btn-icon inline-flex shrink-0 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-45 ${size === "sm" ? "size-8" : "size-10"} ${tones[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
