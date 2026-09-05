/**
 * Bandeau photo de page — la résidence en tête d'écran (rayon carte, ombre lift), voile encre
 * progressif pour garder le titre lisible. Image décorative (alt vide). Photo personnalisée par
 * le syndic ou image par défaut (lib/photos).
 */
export function PhotoBanner({
  src,
  title,
  subtitle,
  className = "",
}: {
  src: string;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`relative h-36 overflow-hidden rounded-card shadow-lift sm:h-44 ${className}`}>
      <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      {title ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-[17px] font-semibold text-white">{title}</p>
            {subtitle ? <p className="text-[13px] text-white/80">{subtitle}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
