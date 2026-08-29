import type { ReactNode } from "react";

/**
 * État vide — toujours avec une explication ET, si le rôle le permet, l'action qui débloque.
 * L'illustration est un motif maison en couleurs de la palette (résidence sous le soleil),
 * jamais une image générique.
 */
export function EmptyState({
  title,
  hint,
  action,
  icon,
  className = "",
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col items-center px-8 py-14 text-center ${className}`}>
      <div className="mb-6">{icon ?? <MotifResidence />}</div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {hint ? <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-soft">{hint}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

function MotifResidence() {
  return (
    <svg width="132" height="88" viewBox="0 0 132 88" fill="none" aria-hidden>
      {/* sol */}
      <ellipse cx="66" cy="80" rx="58" ry="7" fill="#ECEBE4" />
      {/* soleil */}
      <circle cx="106" cy="18" r="10" fill="#E5D6B8" />
      <circle cx="106" cy="18" r="6" fill="#F1EAD9" />
      {/* immeuble arrière */}
      <rect x="24" y="26" width="30" height="54" rx="5" fill="#A4C8AE" opacity="0.55" />
      <rect x="30" y="34" width="6" height="6" rx="1.8" fill="#FFFFFF" opacity="0.8" />
      <rect x="41" y="34" width="6" height="6" rx="1.8" fill="#FFFFFF" opacity="0.8" />
      <rect x="30" y="46" width="6" height="6" rx="1.8" fill="#FFFFFF" opacity="0.6" />
      <rect x="41" y="46" width="6" height="6" rx="1.8" fill="#FFFFFF" opacity="0.6" />
      {/* immeuble principal */}
      <rect x="50" y="12" width="38" height="68" rx="5" fill="#4C6C5A" />
      <rect x="57" y="22" width="7" height="7" rx="2" fill="#E6EFEA" />
      <rect x="74" y="22" width="7" height="7" rx="2" fill="#E6EFEA" />
      <rect x="57" y="36" width="7" height="7" rx="2" fill="#E6EFEA" opacity="0.85" />
      <rect x="74" y="36" width="7" height="7" rx="2" fill="#E6EFEA" opacity="0.85" />
      <rect x="57" y="50" width="7" height="7" rx="2" fill="#E6EFEA" opacity="0.6" />
      <rect x="74" y="50" width="7" height="7" rx="2" fill="#A4C8AE" opacity="0.9" />
      <rect x="63" y="64" width="12" height="16" rx="2.5" fill="#E5D6B8" />
      {/* petite maison */}
      <rect x="92" y="52" width="22" height="28" rx="4" fill="#C1D8DA" />
      <path d="m103 40 14 12H89z" fill="#48707A" />
      <rect x="99.5" y="62" width="7" height="18" rx="2" fill="#48707A" opacity="0.7" />
      {/* verdure */}
      <circle cx="16" cy="72" r="8" fill="#A4C8AE" />
      <rect x="14.8" y="72" width="2.4" height="9" rx="1.2" fill="#617C6C" />
      <circle cx="122" cy="74" r="6" fill="#A4C8AE" opacity="0.8" />
      <rect x="121" y="74" width="2" height="7" rx="1" fill="#617C6C" />
    </svg>
  );
}
