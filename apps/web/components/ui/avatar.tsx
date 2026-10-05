/**
 * Avatar initiales — teinte déterministe (palette du logo + accents secondaires) dérivée du
 * nom, pour que chaque personne garde sa couleur partout. Jamais de photo générique.
 */
const TONES = [
  { bg: "bg-sage-tint", fg: "text-brand" },
  { bg: "bg-lime", fg: "text-brand-deep" },
  { bg: "bg-lilac-tint", fg: "text-lilac" },
  { bg: "bg-sand-tint", fg: "text-sand" },
  { bg: "bg-tosca-tint", fg: "text-tosca-deep" },
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
  /** Variante pleine vert marque, initiales lime (utilisateur courant). */
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
  const cls = solid ? "bg-brand text-lime" : `${tone.bg} ${tone.fg}`;
  return (
    <span
      className={`avatar-in inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold ${cls} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
      aria-hidden
    >
      {initiales || "•"}
    </span>
  );
}
