import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Carte-affiche (Wise « BOOST YOUR BALANCE… ») : salle de marque verte (logo inversé), grand
 * titre en capitales d'affiche lime, accroche blanche, action lime. UNE par écran au plus, pour
 * le fait le plus important (prochaine AG, onboarding…). Identique à PosterCard côté mobile.
 *
 * `poster` : affiche 2D (public/illustrations/poster-*.png, 1600×1000, moitié gauche vide) posée
 * en fond — le texte occupe la moitié vide ; en arabe l'affiche est miroitée pour libérer le
 * côté du texte. Sous 640 px, elle devient un bandeau en tête de carte (comme le mobile).
 */
export function PosterCard({
  title,
  kicker,
  body,
  href,
  ctaLabel,
  art,
  poster,
  tone = "brand",
  className = "",
}: {
  title: string;
  kicker?: ReactNode;
  body?: ReactNode;
  href?: string;
  ctaLabel?: string;
  /** Visuel à l'extrémité (illustration, motif) — ignoré si `poster` est fourni. */
  art?: ReactNode;
  /** Nom d'affiche (poster-ag, poster-annonce, poster-onboarding, poster-securite, poster-transparence). */
  poster?: string;
  tone?: "brand" | "ink";
  className?: string;
}) {
  const bg = tone === "ink" ? "bg-ink" : "bg-brand";
  const src = poster ? `/illustrations/${poster}.png` : null;
  const inner = (
    <div className={`alive-drift relative overflow-hidden rounded-[28px] ${bg} ${className}`}>
      {src ? (
        <>
          <img src={src} alt="" aria-hidden className="block h-40 w-full object-cover object-right rtl:-scale-x-100 sm:hidden" />
          <img src={src} alt="" aria-hidden className="su-parallax absolute inset-0 hidden size-full object-cover object-right rtl:-scale-x-100 sm:block" />
        </>
      ) : null}
      <div className={`relative flex min-h-[200px] items-stretch gap-6 p-7 sm:p-9 ${src ? "sm:min-h-[260px]" : ""}`}>
        <div className={`relative z-10 flex min-w-0 flex-1 flex-col justify-center ${src ? "sm:max-w-[46%]" : ""}`}>
          {kicker ? <p className="mb-3 text-[15px] font-semibold text-white">{kicker}</p> : null}
          <p className="font-poster text-[34px] text-lime sm:text-[44px] [:root[lang=ar]_&]:text-[28px] sm:[:root[lang=ar]_&]:text-[36px]">{title}</p>
          {body ? <div className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">{body}</div> : null}
          {ctaLabel ? (
            <span className="mt-6 inline-flex h-11 w-fit items-center rounded-btn bg-cta px-6 text-[15px] font-semibold text-ink transition-colors group-hover/poster:bg-lime-hover">
              {ctaLabel}
            </span>
          ) : null}
        </div>
        {art && !src ? <div className="relative hidden shrink-0 items-center sm:flex">{art}</div> : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="group/poster block rounded-[28px]">
      {inner}
    </Link>
  ) : (
    inner
  );
}
