import { FadeImg } from "./motion/fade-img";

/**
 * Bandeau photo de page — la résidence en tête d'écran (rayon tuile, à plat, sans ombre), voile
 * encre progressif pour garder le titre lisible. Image décorative (alt vide). Photo personnalisée par
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
    <div className={`relative h-36 overflow-hidden rounded-card bg-tile sm:h-44 ${className}`}>
      <FadeImg src={src} alt="" className="absolute inset-0 size-full object-cover" />
      {title ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
            <p className="text-[19px] font-bold tracking-tight text-white sm:text-[22px]"><bdi>{title}</bdi></p>
            {subtitle ? <p className="mt-0.5 text-[13px] font-medium text-white/80"><bdi>{subtitle}</bdi></p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
