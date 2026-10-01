import type { CSSProperties } from "react";

/**
 * Titre révélé mot par mot (flou → net, léger soulèvement). Découpage sur les espaces
 * uniquement — jamais lettre par lettre, pour que l'arabe garde ses liaisons. Composant
 * serveur, CSS pur (`.reveal-word` dans motion.css). Le texte complet reste lisible par les
 * lecteurs d'écran et sélectionnable tel quel.
 */
export function RevealText({
  text,
  delayMs = 60,
  className = "",
}: {
  text: string;
  /** Décalage avant le premier mot (ms). */
  delayMs?: number;
  className?: string;
}) {
  const words = text.split(/(\s+)/);
  let i = 0;
  return (
    <span className={className} style={{ "--reveal-delay": `${delayMs}ms` } as CSSProperties}>
      {words.map((w, k) =>
        /^\s+$/.test(w) || w === "" ? (
          w
        ) : (
          <span key={k} className="reveal-word" style={{ "--i": i++ } as CSSProperties}>
            {w}
          </span>
        )
      )}
    </span>
  );
}
