import type { ReactNode } from "react";
import { suArtAvailable, suArtSrc, type SuArtId, type SuArtVariant } from "../../lib/su-art";

/**
 * Une planche du set de marque (lib/su-art.ts). Découpe par défaut, scène avec `variant="S"`.
 * Composant serveur (pas d'état) : tant que la planche n'est pas livrée, rend `fallback` (ou rien).
 */
export function SuArt({
  id,
  variant = "C",
  size,
  width,
  height,
  className = "",
  fallback = null,
  priority = false,
}: {
  id: SuArtId;
  variant?: SuArtVariant;
  /** Carré (largeur = hauteur). */
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  fallback?: ReactNode;
  /** Au-dessus de la ligne de flottaison : chargement non différé. */
  priority?: boolean;
}) {
  if (!suArtAvailable(id)) return <>{fallback}</>;
  const { src, srcSet } = suArtSrc(id, variant);
  const w = width ?? size;
  const h = height ?? size;
  return (
    <img
      src={src}
      srcSet={srcSet}
      alt=""
      aria-hidden
      width={w}
      height={h}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`object-contain ${className}`}
      style={w || h ? { width: w, height: h } : undefined}
    />
  );
}
