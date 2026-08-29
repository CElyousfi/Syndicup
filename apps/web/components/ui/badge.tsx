/**
 * Badges de statut — pills pleines (rayon 999) : fond couleur franche, texte blanc
 * (ou encre sur fond clair) — jamais de texte coloré sur teinte. Les statuts sont
 * OMNIPRÉSENTS dans le produit et doivent se lire d'un coup d'œil. Variantes :
 *  ok/warn/danger pleins · info (tosca profond) · ink (encre, chiffres mono — escalade N1→N6) ·
 *  neutral (fond greige, texte encre) · outline (liseré discret, texte encre).
 */
export type BadgeVariant = "ok" | "warn" | "danger" | "info" | "ink" | "neutral" | "outline";

const STYLES: Record<BadgeVariant, string> = {
  ok: "bg-ok text-white",
  warn: "bg-warn text-white",
  danger: "bg-danger text-white",
  info: "bg-tosca-deep text-white",
  ink: "bg-ink text-white font-mono tracking-tight",
  neutral: "bg-ground text-ink",
  outline: "border border-hairline-strong text-ink bg-surface",
};

export function Badge({
  variant = "neutral",
  children,
  className = "",
  pulse = false,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STYLES[variant]} ${className}`}
    >
      {pulse ? <span className="size-1.5 rounded-full bg-current animate-pulse-dot" /> : null}
      {children}
    </span>
  );
}
