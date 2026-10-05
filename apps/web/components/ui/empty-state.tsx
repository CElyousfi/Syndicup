import type { ReactNode } from "react";
import { Illustration } from "./illustration";

/**
 * État vide (Wise) — à plat sur la toile, illustration 2D au-dessus d'un titre gras et d'une
 * explication, puis, si le rôle le permet, l'action qui débloque. `illustration` : nom d'un
 * fichier public/illustrations (empty-incidents, empty-appels… — mêmes noms que le mobile) ;
 * tant qu'il manque, le motif maison s'affiche.
 */
export function EmptyState({
  title,
  hint,
  action,
  icon,
  illustration,
  className = "",
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  illustration?: string;
  className?: string;
}) {
  const motif = icon ?? <MotifResidence />;
  return (
    <div className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <div className="mb-5 animate-zoom-in">
        {illustration ? <Illustration name={illustration} size={150} fallback={motif} /> : motif}
      </div>
      <h3 className="text-[19px] font-bold tracking-tight text-ink">{title}</h3>
      {hint ? <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-soft">{hint}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Motif « résidence » en aplats 2D aux couleurs du logo — vivant au repos : une fenêtre
 *  s'allume de temps en temps, les arbres se balancent (motion.css, coupé en mouvement réduit). */
function MotifResidence() {
  return (
    <svg width="132" height="96" viewBox="0 0 132 96" fill="none" aria-hidden className="motif overflow-visible">
      <rect x="8" y="84" width="116" height="6" rx="3" fill="#ECEBE4" />
      <g className="motif-sun">
        <circle cx="108" cy="18" r="9" fill="#E3EF8D" />
      </g>
      <rect x="22" y="34" width="30" height="50" rx="4" fill="#A4C8AE" />
      <rect className="motif-win" x="28" y="42" width="7" height="7" rx="2" fill="#FFFFFF" />
      <rect x="39" y="42" width="7" height="7" rx="2" fill="#FFFFFF" />
      <rect x="28" y="55" width="7" height="7" rx="2" fill="#FFFFFF" />
      <rect className="motif-win" x="39" y="55" width="7" height="7" rx="2" fill="#FFFFFF" />
      {/* immeuble principal, coiffé du double chevron du logo */}
      <path d="M48 30 69 16l21 14v54H48z" fill="#1E7552" />
      <path d="M52 22 69 10l17 12v-6L69 4 52 16z" fill="#E3EF8D" />
      <path d="M56 38a4 4 0 0 1 8 0v6h-8zM74 38a4 4 0 0 1 8 0v6h-8zM56 54a4 4 0 0 1 8 0v6h-8zM74 54a4 4 0 0 1 8 0v6h-8z" fill="#E3EF8D" />
      <path d="M63 84V72a6 6 0 0 1 12 0v12z" fill="#121212" />
      <g className="motif-tree">
        <circle cx="104" cy="70" r="9" fill="#A4C8AE" />
        <rect x="102.6" y="70" width="2.8" height="14" rx="1.4" fill="#1E7552" />
      </g>
      <g className="motif-tree motif-tree-2">
        <circle cx="13" cy="74" r="6" fill="#1E7552" />
        <rect x="12" y="74" width="2" height="10" rx="1" fill="#121212" />
      </g>
    </svg>
  );
}
