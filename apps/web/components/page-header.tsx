import type { ReactNode } from "react";

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
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-5 sm:mb-7">
      {back ? <div className="mb-2 sm:mb-3">{back}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0" data-tour="page-title">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[24px]">{title}</h1>
            {badge}
          </div>
          {subtitle ? <p className="mt-1 text-[13px] text-soft sm:text-sm">{subtitle}</p> : null}
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

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-[32px] items-center gap-1.5 text-[13px] font-medium text-soft transition-colors hover:text-ink-strong"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="icon-flip" aria-hidden>
        <path d="M19 12H5M10 6l-6 6 6 6" />
      </svg>
      {label}
    </a>
  );
}
