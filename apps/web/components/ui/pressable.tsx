import type { ComponentProps } from "react";
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

/** Surface pressable SANS forme imposée (tuiles de sélection, lignes de choix, vignettes) :
 *  même enfoncement vivant que les boutons (`su-btn` : 100 ms, relâchement en ressort), la mise
 *  en page reste celle de l'appelant. */
export function Pressable({ className = "", type = "button", ...props }: ComponentProps<"button">) {
  return <button type={type} className={`su-btn su-press ${className}`} {...props} />;
}
