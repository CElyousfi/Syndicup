import type { ReactNode } from "react";
import { RevealText } from "./ui/reveal-text";

/**
 * En-tête standard de page : titre net, sous-titre discret, UNE action primaire à l'extrémité.
 * Mobile : titre plus compact, actions en boutons pleine largeur qui se partagent la rangée.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  badge,
  reveal = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  badge?: ReactNode;
  /** Titre révélé mot par mot (accueil du tableau de bord) — chaînes uniquement. */
  reveal?: boolean;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {back ? <div className="mb-2 sm:mb-3">{back}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0" data-tour="page-title">
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">{reveal && typeof title === "string" ? <RevealText text={title} /> : title}
            </h1>
            {badge}
          </div>
          {subtitle ? <p className="mt-2 text-sm text-soft sm:text-[15px]">{subtitle}</p> : null}
        </div>
        {actions ? (
          <div className="page-actions flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Retour (Wise) : rond greige + flèche verte, libellé à côté. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="group/back inline-flex min-h-[40px] items-center gap-2.5 text-[13px] font-semibold text-ink-strong"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-tile text-link transition-colors group-hover/back:bg-[#e3e2da]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="icon-flip" aria-hidden>
          <path d="M19 12H5M11 5l-7 7 7 7" />
        </svg>
      </span>
      <span className="sr-only sm:not-sr-only">{label}</span>
    </a>
  );
}
