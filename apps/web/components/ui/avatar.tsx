/**
 * Avatar initiales — teinte déterministe (palette produit) dérivée du nom, pour que
 * chaque personne garde sa couleur partout. Jamais de photo générique.
 */
const TONES = [
  { bg: "bg-sage-tint", fg: "text-action" },
  { bg: "bg-lilac-tint", fg: "text-lilac" },
  { bg: "bg-sand-tint", fg: "text-sand" },
  { bg: "bg-tosca-tint", fg: "text-tosca-deep" },
  { bg: "bg-ok-tint", fg: "text-ok" },
] as const;

export function Avatar({
  nom,
  size = 36,
  className = "",
  solid = false,
}: {
  nom: string;
  size?: number;
  className?: string;
  /** Variante encre pleine (utilisateur courant dans la barre latérale). */
  solid?: boolean;
}) {
  const initiales = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  let hash = 0;
  for (const ch of nom) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  // Modulo borné — l'index est toujours valide.
  const tone = TONES[hash % TONES.length]!;
  const cls = solid ? "bg-ink text-white" : `${tone.bg} ${tone.fg}`;
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${cls} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
      aria-hidden
    >
      {initiales || "•"}
    </span>
  );
}
