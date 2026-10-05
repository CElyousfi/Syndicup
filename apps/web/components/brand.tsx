/**
 * Marque SyndicUp : symbole (double chevron + hampe, docs/brand/symbole-*.svg) et wordmark
 * « syndic » encre / « up » vert (Archivo Black). Le nom ne se traduit pas et le logo ne se
 * miroite jamais en arabe (dir="ltr").
 */
const TOP = "0,125 185,0 370,125 370,225 185,100 0,225";
const BOTTOM = "0,280 185,155 370,280 370,380 226,282.7 226,395 144,395 144,282.7 0,380";

export function BrandMark({ size = 34, className = "text-brand" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 370 395" width={size} height={size} className={`shrink-0 select-none ${className}`} fill="currentColor" aria-hidden>
      <polygon points={TOP} />
      <polygon points={BOTTOM} />
    </svg>
  );
}

/** Icône d'app : symbole lime sur carré vert arrondi. */
export function BrandTile({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-brand"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      aria-hidden
    >
      <BrandMark size={size * 0.6} className="text-lime" />
    </span>
  );
}

export function BrandWordmark({ inverse = false, size = 22 }: { inverse?: boolean; size?: number }) {
  return (
    <span
      className={`font-[family-name:var(--font-wordmark)] font-black leading-none ${inverse ? "text-lime" : "text-ink"}`}
      style={{ fontSize: size, letterSpacing: `${-0.045 * size}px` }}
      dir="ltr"
    >
      syndic<span className={inverse ? "text-lime" : "text-brand"}>up</span>
    </span>
  );
}

/** Logo horizontal : symbole + wordmark, toujours de gauche à droite. */
export function Brand({ inverse = false, size = 34 }: { inverse?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.26 }} dir="ltr">
      <BrandMark size={size * 0.82} className={inverse ? "text-lime" : "text-brand"} />
      <BrandWordmark inverse={inverse} size={size * 0.74} />
    </span>
  );
}
