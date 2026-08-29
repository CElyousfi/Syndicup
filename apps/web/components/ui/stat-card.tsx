import type { ReactNode } from "react";
import Link from "next/link";
import { IconCircle, type IconTone } from "./color-icons";

/**
 * Carte statistique (cf. référence design) : pastille d'icône teintée + libellé,
 * grande valeur, puce de tendance et texte de comparaison. Aucun calcul métier ici —
 * valeurs et tendances déjà formatées par l'appelant.
 * Mise en page par zones de grille (`.stat` dans globals.css) : desktop = icône + libellé
 * puis grande valeur ; mobile = rangée compacte icône | libellé / valeur, comme une app.
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
    neutral: "bg-ground text-ink",
  }[trendTone];

  const body = (
    <>
      <div className="stat-icon">
        <IconCircle tone={tone} size={44}>
          {icon}
        </IconCircle>
      </div>
      <p className="stat-label min-w-0 truncate text-sm font-medium text-body">{label}</p>
      <div className="stat-value-row flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="stat-value tnum text-[28px] font-semibold leading-none tracking-tight text-ink">{value}</p>
        {trend ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${trendCls}`}>
            {trend}
          </span>
        ) : null}
        {hint ? <span className="text-[12px] text-soft">{hint}</span> : null}
      </div>
    </>
  );

  const cls = `card stat ${href ? "transition-shadow hover:shadow-float" : ""} ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
