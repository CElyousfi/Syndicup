import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = true,
  id,
  "data-live": live,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
  /** Posé par <LiveList> : la carte entre / sort en direct. */
  "data-live"?: string;
}) {
  return (
    <div id={id} data-live={live} className={`card ${padded ? "p-6" : ""} ${className}`}>
      {children}
    </div>
  );
}

/** En-tête de section (Wise : titre 20 px gras + lien souligné à l'extrémité). */
export function SectionHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[19px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-[13px] text-soft">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
