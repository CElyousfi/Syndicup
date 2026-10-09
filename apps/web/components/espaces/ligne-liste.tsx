import Link from "next/link";
import type { ReactNode } from "react";
import { IconCircle, type IconTone } from "../ui/color-icons";
import { IconChevronEnd } from "../ui/icons";
import { LiveList } from "../ui/live-list";

/**
 * Liste « transactions » Wise — à plat sur la toile (ou dans une tuile) : pastille ronde, titre
 * gras, sous-titre gris, statut à l'extrémité, chevron vert si la ligne mène quelque part.
 * Le lien du titre couvre toute la ligne (lien étiré) ; les actions restent cliquables au-dessus.
 * Vivante : une ligne arrivée à l'actualisation se déplie, une ligne retirée se replie (LiveList) —
 * les enfants doivent être clés et transmettre `data-live` jusqu'au <li> (voir `LigneLive`).
 */
export function Lignes({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <LiveList as="ul" className={`stagger-grid -mx-3 space-y-0.5 ${className}`}>{children}</LiveList>;
}

/** Attributs posés par LiveList sur l'élément de ligne (entrée / sortie animée). */
export type LigneLive = { "data-live"?: string; "aria-hidden"?: boolean };

export function Ligne({
  icon,
  tone = "sage",
  title,
  href,
  subtitle,
  extra,
  end,
  actions,
  ...live
}: LigneLive & {
  icon: ReactNode;
  tone?: IconTone;
  title: ReactNode;
  href?: string;
  subtitle?: ReactNode;
  /** Ligne complémentaire sous le sous-titre (motif de refus…). */
  extra?: ReactNode;
  /** Statut / valeur à l'extrémité. */
  end?: ReactNode;
  /** Boutons contextuels — au-dessus du lien étiré. */
  actions?: ReactNode;
}) {
  return (
    <li {...live} className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-3 transition-colors hover:bg-wash">
      <IconCircle tone={tone} size={46}>
        {icon}
      </IconCircle>
      <div className="min-w-0 flex-1">
        {href ? (
          <Link
            href={href}
            className="line-clamp-2 text-[15px] font-bold leading-snug text-ink after:absolute after:inset-0 after:rounded-2xl after:content-['']"
          >
            {title}
          </Link>
        ) : (
          <p className="line-clamp-2 text-[15px] font-bold leading-snug text-ink">{title}</p>
        )}
        {subtitle ? <p className="mt-0.5 text-[13px] leading-snug text-soft">{subtitle}</p> : null}
        {extra}
      </div>
      {end || actions || href ? (
        <div
          className={`ms-auto flex shrink-0 flex-wrap items-center gap-2 ${actions ? "relative z-10 w-full justify-start ps-[62px] sm:w-auto sm:justify-end sm:ps-0" : "pointer-events-none justify-end"}`}
        >
          {end}
          {actions}
          {href && !actions ? <IconChevronEnd width={18} height={18} className="pointer-events-none text-link" /> : null}
        </div>
      ) : null}
    </li>
  );
}
