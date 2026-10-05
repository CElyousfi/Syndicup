import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Carte-affiche (Wise « BOOST YOUR BALANCE… ») : salle de marque verte (logo inversé), grand
 * titre en capitales d'affiche lime, accroche blanche, action lime. UNE par écran au plus, pour
 * le fait le plus important (prochaine AG, onboarding…). Identique à PosterCard côté mobile.
 */
export function PosterCard({
  title,
  kicker,
  body,
  href,
  ctaLabel,
  art,
  tone = "brand",
  className = "",
}: {
  title: string;
  kicker?: ReactNode;
  body?: ReactNode;
  href?: string;
  ctaLabel?: string;
  /** Visuel à l'extrémité (illustration, motif). */
  art?: ReactNode;
  tone?: "brand" | "ink";
  className?: string;
}) {
  const bg = tone === "ink" ? "bg-ink" : "bg-brand";
  const inner = (
    <div className={`relative flex min-h-[200px] items-stretch gap-6 overflow-hidden rounded-[28px] ${bg} p-7 sm:p-9 ${className}`}>
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">
        {kicker ? <p className="mb-3 text-[15px] font-semibold text-white">{kicker}</p> : null}
        <p className="font-poster text-[34px] text-lime sm:text-[44px] [:root[lang=ar]_&]:text-[28px] sm:[:root[lang=ar]_&]:text-[36px]">{title}</p>
        {body ? <div className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">{body}</div> : null}
        {ctaLabel ? (
          <span className="mt-6 inline-flex h-11 w-fit items-center rounded-btn bg-cta px-6 text-[15px] font-semibold text-ink transition-colors group-hover/poster:bg-lime-hover">
            {ctaLabel}
          </span>
        ) : null}
      </div>
      {art ? <div className="relative hidden shrink-0 items-center sm:flex">{art}</div> : null}
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
