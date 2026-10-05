import type { ReactNode } from "react";
import Link from "next/link";
import { IconCircle, type IconTone } from "./color-icons";
import { Odometer } from "./odometer";

/**
 * Tuile statistique (Wise, tuile de solde) : pastille d'icône, grand montant gras, puce de
 * tendance, libellé discret dessous. Greige plate (`.card`). Aucun calcul métier ici —
 * valeurs et tendances déjà formatées par l'appelant.
 * Mise en page par zones de grille (`.stat` dans globals.css).
 */
export function StatCard({
  icon,
  tone = "sage",
  label,
  value,
  trend,
  trendTone = "ok",
  hint,
  href,
  className = "",
}: {
  icon: ReactNode;
  tone?: IconTone;
  label: ReactNode;
  value: ReactNode;
  /** Puce de tendance, ex. « ↗ 20% » — déjà localisée. */
  trend?: ReactNode;
  trendTone?: "ok" | "warn" | "danger" | "neutral";
  /** Texte discret après la puce, ex. « vs mois dernier ». */
  hint?: ReactNode;
  href?: string;
  className?: string;
}) {
  const trendCls = {
    ok: "bg-ok text-white",
    warn: "bg-warn text-white",
    danger: "bg-danger text-white",
    neutral: "bg-wash-strong text-ink",
  }[trendTone];

  const body = (
    <>
      <div className="stat-icon">
        <IconCircle tone={tone} size={44}>
          {icon}
        </IconCircle>
      </div>
      <p className="stat-label min-w-0 text-sm font-medium leading-snug text-soft">{label}</p>
      <div className="stat-value-row flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="stat-value tnum text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
          {typeof value === "string" || typeof value === "number" ? <Odometer value={String(value)} /> : value}
        </p>
        {trend ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${trendCls}`}>
            {trend}
          </span>
        ) : null}
        {hint ? <span className="text-[12px] text-soft">{hint}</span> : null}
      </div>
    </>
  );

  const cls = `card stat ${href ? "card-interactive" : ""} ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
