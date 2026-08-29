/**
 * Icônes couleur — glyphes multi-teintes (style « skeuomorphe doux », cf. référence design)
 * dans la palette du produit : sauge, mousse, armée, lilas, sable, tosca, rouge profond.
 * Elles se mélangent volontairement aux icônes filaires (`ui/icons.tsx`) : la couleur pour
 * les points d'entrée et les indicateurs, le trait pour la navigation et les actions.
 *
 * `IconCircle` : pastille teintée qui les porte (cartes stats, listes, états vides).
 */
import type { ReactNode, SVGProps } from "react";

/* ── Palette locale (tokens globals.css) ─────────────────────────────────── */
const INK = "#201F23";
const MOSS = "#4C6C5A";
const MOSS_DEEP = "#3D5A4A";
const SAGE = "#A4C8AE";
const SAGE_00 = "#E6EFEA";
const LILAC = "#595D75";
const LILAC_MID = "#B8BED5";
const LILAC_00 = "#E3E4EA";
const SAND = "#A39170";
const SAND_MID = "#E5D6B8";
const TOSCA = "#C1D8DA";
const TOSCA_DEEP = "#48707A";
const RED = "#98140B";
const WHITE = "#FFFFFF";

export type IconTone = "sage" | "lilac" | "sand" | "tosca" | "ok" | "warn" | "danger" | "ink" | "surface";

const TONES: Record<IconTone, string> = {
  sage: "bg-sage-tint",
  lilac: "bg-lilac-tint",
  sand: "bg-sand-tint",
  tosca: "bg-tosca-tint",
  ok: "bg-ok-tint",
  warn: "bg-warn-tint",
  danger: "bg-danger-tint",
  ink: "bg-ink",
  surface: "bg-surface border border-hairline",
};

/** Pastille circulaire teintée portant une icône (couleur ou filaire). */
export function IconCircle({
  tone = "sage",
  size = 44,
  className = "",
  children,
}: {
  tone?: IconTone;
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${TONES[tone]} ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

function base(p: SVGProps<SVGSVGElement>) {
  return { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true as const, ...p };
}

/* ── Glyphes couleur ─────────────────────────────────────────────────────── */

/** Immeuble — lots, copropriété. */
export const CBuilding = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="7" width="8" height="14" rx="1.6" fill={SAGE} />
    <rect x="10" y="3" width="10" height="18" rx="1.6" fill={MOSS} />
    <rect x="12.4" y="6" width="2" height="2" rx="0.6" fill={SAGE_00} />
    <rect x="16" y="6" width="2" height="2" rx="0.6" fill={SAGE_00} />
    <rect x="12.4" y="9.6" width="2" height="2" rx="0.6" fill={SAGE_00} />
    <rect x="16" y="9.6" width="2" height="2" rx="0.6" fill={SAGE_00} />
    <rect x="12.4" y="13.2" width="2" height="2" rx="0.6" fill={SAGE_00} opacity="0.7" />
    <rect x="16" y="13.2" width="2" height="2" rx="0.6" fill={SAGE_00} opacity="0.7" />
    <rect x="13.6" y="16.6" width="2.8" height="4.4" rx="0.9" fill={SAND_MID} />
    <rect x="5.8" y="9.4" width="1.8" height="1.8" rx="0.5" fill={WHITE} opacity="0.75" />
    <rect x="8.6" y="9.4" width="1.8" height="1.8" rx="0.5" fill={WHITE} opacity="0.75" />
    <rect x="5.8" y="12.8" width="1.8" height="1.8" rx="0.5" fill={WHITE} opacity="0.55" />
    <rect x="2.8" y="20.4" width="18.4" height="1.4" rx="0.7" fill={INK} opacity="0.14" />
  </svg>
);

/** Pièces empilées — appels de fonds, encaissements. */
export const CCoins = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <ellipse cx="9" cy="17.6" rx="6.6" ry="2.9" fill={SAND} />
    <ellipse cx="9" cy="15.8" rx="6.6" ry="2.9" fill={SAND_MID} />
    <ellipse cx="9" cy="13.9" rx="6.6" ry="2.9" fill={SAND} />
    <ellipse cx="9" cy="12.1" rx="6.6" ry="2.9" fill={SAND_MID} />
    <circle cx="16.4" cy="9" r="5.6" fill={MOSS} />
    <circle cx="16.4" cy="9" r="4.3" fill={SAGE} />
    <path
      d="M16.4 6.4v5.2M14.8 7.6h2.6a1.2 1.2 0 1 1 0 2.4h-2a1.2 1.2 0 1 0 0 2.4h2.6"
      stroke={MOSS_DEEP}
      strokeWidth="1.1"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

/** Sac d'argent — totaux, trésorerie. */
export const CMoneyBag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9.4 5.2 8 3.4a.9.9 0 0 1 .7-1.4h6.6a.9.9 0 0 1 .7 1.4l-1.4 1.8z" fill={SAND} />
    <path
      d="M9.6 5.2h4.8c3.6 2.3 5.8 5.6 5.8 9.1 0 4.6-3.5 7.3-8.2 7.3s-8.2-2.7-8.2-7.3c0-3.5 2.2-6.8 5.8-9.1z"
      fill={SAND_MID}
    />
    <path
      d="M12 8.9v8.6M9.6 10.8h3.6a1.7 1.7 0 1 1 0 3.4h-2.4a1.7 1.7 0 1 0 0 3.4h3.6"
      stroke={SAND}
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M6.2 12.4c-.8 1.1-1.3 2.4-1.3 3.8" stroke={WHITE} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
  </svg>
);

/** Portefeuille — budgets. */
export const CWallet = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="16.4" height="4.4" rx="1.8" fill={MOSS_DEEP} />
    <rect x="3" y="7.2" width="18" height="12" rx="2.2" fill={MOSS} />
    <path d="M13.6 12.2h7.4v4.4h-7.4a2.2 2.2 0 0 1 0-4.4z" fill={SAGE} />
    <circle cx="15.6" cy="14.4" r="1.15" fill={MOSS_DEEP} />
    <path d="M5 9.4h6" stroke={WHITE} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
  </svg>
);

/** Urne de vote — assemblées générales. */
export const CVote = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12.6h16l1.1 6.6a1.4 1.4 0 0 1-1.4 1.6H4.3a1.4 1.4 0 0 1-1.4-1.6z" fill={LILAC} />
    <rect x="8.6" y="12.6" width="6.8" height="1.9" rx="0.9" fill={LILAC_00} />
    <rect x="9.7" y="3.4" width="7.4" height="9.2" rx="1.1" transform="rotate(8 9.7 3.4)" fill={LILAC_MID} />
    <path d="m11.6 7.6 1.5 1.5 2.8-3" stroke={LILAC} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <rect x="5.2" y="16.2" width="4" height="1.4" rx="0.7" fill={WHITE} opacity="0.35" />
  </svg>
);

/** Clé à molette — incidents, maintenance. */
export const CWrench = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path
      d="M15.2 6a4.4 4.4 0 0 0-5.9 5.4L3.6 17a2.1 2.1 0 1 0 3 3l5.6-5.7a4.4 4.4 0 0 0 5.4-5.9l-2.7 2.7-2.4-2.4z"
      fill={TOSCA_DEEP}
    />
    <path d="M5 18.7a.9.9 0 1 0 1.3 1.3.9.9 0 0 0-1.3-1.3z" fill={TOSCA} />
    <circle cx="17.6" cy="17.4" r="4.1" fill={SAND_MID} />
    <circle cx="17.6" cy="17.4" r="2" fill="none" stroke={SAND} strokeWidth="1.5" />
  </svg>
);

/** Calendrier — réservations, échéances. */
export const CCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.4" y="4.8" width="17.2" height="16" rx="2.4" fill={TOSCA} />
    <path d="M3.4 7.2A2.4 2.4 0 0 1 5.8 4.8h12.4a2.4 2.4 0 0 1 2.4 2.4v2.4H3.4z" fill={TOSCA_DEEP} />
    <rect x="6.8" y="2.6" width="1.9" height="4" rx="0.95" fill={INK} opacity="0.75" />
    <rect x="15.3" y="2.6" width="1.9" height="4" rx="0.95" fill={INK} opacity="0.75" />
    <rect x="6.4" y="12" width="3" height="3" rx="0.9" fill={WHITE} opacity="0.85" />
    <rect x="10.6" y="12" width="3" height="3" rx="0.9" fill={WHITE} opacity="0.6" />
    <rect x="14.8" y="12" width="3" height="3" rx="0.9" fill={WHITE} opacity="0.6" />
    <rect x="6.4" y="16.4" width="3" height="3" rx="0.9" fill={WHITE} opacity="0.6" />
    <circle cx="16.3" cy="17.9" r="2.6" fill={RED} opacity="0.9" />
    <path d="m15.2 17.9.8.8 1.4-1.5" stroke={WHITE} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** Porte — visites. */
export const CDoor = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="5" y="3" width="14" height="18.4" rx="1.8" fill={SAND_MID} />
    <rect x="7.2" y="5.2" width="9.6" height="16.2" rx="1.2" fill={SAND} />
    <circle cx="14.6" cy="13.4" r="1.15" fill={SAND_MID} />
    <path d="M8.8 6.8v4" stroke={WHITE} strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
    <rect x="3.4" y="20.6" width="17.2" height="1.4" rx="0.7" fill={INK} opacity="0.14" />
  </svg>
);

/** Personnes — personnel, membres. */
export const CUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="15.4" cy="8.2" r="3.4" fill={LILAC_MID} />
    <path d="M9.8 20a5.9 5.9 0 0 1 11.4 0z" fill={LILAC_MID} />
    <circle cx="8.6" cy="7.4" r="3.9" fill={MOSS} />
    <path d="M2.4 20.2a6.5 6.5 0 0 1 12.6 0z" fill={MOSS} />
    <path d="M6.9 6.6a2.2 2.2 0 0 1 2.4-1.3" stroke={SAGE} strokeWidth="1.2" strokeLinecap="round" fill="none" />
  </svg>
);

/** Clé — invitations, accès. */
export const CKey = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="8" cy="15.6" r="5.2" fill={SAND_MID} />
    <circle cx="8" cy="15.6" r="2.3" fill={WHITE} />
    <path d="M11.8 11.8 20.2 3.4M15.6 8l2.8 2.8M18.2 5.4l2.3 2.3" stroke={SAND} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Document — GED, quittances, PV. */
export const CFile = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3.2h7.2L18.6 8.6V19.4a1.9 1.9 0 0 1-1.9 1.9H6a1.9 1.9 0 0 1-1.9-1.9V5.1A1.9 1.9 0 0 1 6 3.2z" fill={TOSCA} />
    <path d="M13.2 3.2v4.2a1.2 1.2 0 0 0 1.2 1.2h4.2z" fill={TOSCA_DEEP} />
    <path d="M7.4 12.4h8M7.4 15.2h8M7.4 18h5" stroke={WHITE} strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
  </svg>
);

/** Balance — contestations, litiges. */
export const CScale = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M11.3 4h1.4v15h-1.4z" fill={LILAC} />
    <rect x="6.6" y="19" width="10.8" height="1.9" rx="0.95" fill={LILAC} />
    <rect x="5" y="6.2" width="14" height="1.5" rx="0.75" fill={LILAC} />
    <path d="M5.8 7.7 3.2 13a3.1 3.1 0 0 0 5.9 0z" fill={LILAC_MID} />
    <path d="M18.2 7.7 15.6 13a3.1 3.1 0 0 0 5.9 0z" fill={LILAC_MID} />
    <circle cx="12" cy="5.4" r="1.7" fill={LILAC_MID} />
  </svg>
);

/** Engrenage — paramètres. */
export const CSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path
      d="M19.4 12a7.4 7.4 0 0 0-.16-1.48l2.1-1.58-2.1-3.58-2.42 1.05a7.4 7.4 0 0 0-2.53-1.48L13.8 2.5h-3.6l-.48 2.43a7.4 7.4 0 0 0-2.53 1.48L4.77 5.36l-2.1 3.58 2.1 1.58a7.4 7.4 0 0 0 0 2.96l-2.1 1.58 2.1 3.58 2.42-1.05a7.4 7.4 0 0 0 2.53 1.48l.48 2.43h3.6l.48-2.43a7.4 7.4 0 0 0 2.53-1.48l2.42 1.05 2.1-3.58-2.1-1.58c.1-.48.16-.97.16-1.48z"
      fill={LILAC_MID}
    />
    <circle cx="12" cy="12" r="3.4" fill={WHITE} />
    <circle cx="12" cy="12" r="1.6" fill={LILAC} />
  </svg>
);

/** Maison — espaces communs, accueil. */
export const CHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m12 3 9.2 8h-2.4v9.4a1 1 0 0 1-1 1H6.2a1 1 0 0 1-1-1V11H2.8z" fill={SAGE} />
    <path d="m12 3 9.2 8h-2.4l-6.8-5.9L5.2 11H2.8z" fill={MOSS} />
    <rect x="9.8" y="14.2" width="4.4" height="7.2" rx="1" fill={MOSS_DEEP} />
    <rect x="10.9" y="16.9" width="0.9" height="0.9" rx="0.4" fill={SAND_MID} />
  </svg>
);

/** Bouclier — administration, conformité. */
export const CShield = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 2.8 4.6 5.4v5.5c0 4.8 3.1 8.2 7.4 9.9 4.3-1.7 7.4-5.1 7.4-9.9V5.4z" fill={MOSS} />
    <path d="M12 2.8 4.6 5.4v5.5c0 4.8 3.1 8.2 7.4 9.9z" fill={SAGE} opacity="0.55" />
    <path d="m8.8 11.6 2.3 2.3 4.1-4.4" stroke={WHITE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** Avion papier — prestataires, envois. */
export const CSend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ ...p, className: `icon-flip ${p.className ?? ""}` })}>
    <path d="M21 3.4 3.8 10l5.7 2.3z" fill={TOSCA} />
    <path d="M21 3.4 14.2 20.6l-4.7-8.3z" fill={TOSCA_DEEP} />
    <path d="M21 3.4 9.5 12.3v4.9l2.5-3z" fill={TOSCA} opacity="0.7" />
  </svg>
);

/** Cloche — notifications. */
export const CBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M18.4 16.4H5.6l1.3-2.2V9.6A5.1 5.1 0 0 1 12 4.5a5.1 5.1 0 0 1 5.1 5.1v4.6z" fill={SAND_MID} />
    <path d="M12 4.5a5.1 5.1 0 0 1 5.1 5.1v4.6l1.3 2.2H12z" fill={SAND} opacity="0.55" />
    <path d="M9.9 19a2.1 2.1 0 0 0 4.2 0z" fill={SAND} />
    <circle cx="17" cy="6.4" r="3" fill={RED} />
  </svg>
);

/** Graphique — synthèses, rapports. */
export const CChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.6" y="12.6" width="4" height="8" rx="1.3" fill={SAGE} />
    <rect x="10" y="7.2" width="4" height="13.4" rx="1.3" fill={MOSS} />
    <rect x="16.4" y="10" width="4" height="10.6" rx="1.3" fill={SAND_MID} />
    <path d="m4.6 8.6 4.6-3.2 3.4 1.9 6-4" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
    <circle cx="18.6" cy="3.3" r="1.4" fill={RED} />
  </svg>
);

/** Alerte — SLA dépassés, retards. */
export const CAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3.4 2.9 19a1.2 1.2 0 0 0 1 1.8h16.2a1.2 1.2 0 0 0 1-1.8z" fill={SAND_MID} />
    <path d="M12 9.2v5" stroke={RED} strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17.3" r="1.15" fill={RED} />
  </svg>
);

/** Poignée de main — accords, invitations acceptées. */
export const CHandshake = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2.6 7.8 7 5.6l5 2.5 4.6-2.4 4.8 2.3-2.2 7.3-3.2 3.4a2 2 0 0 1-2.9.1L7.4 13z" fill={SAND_MID} />
    <path d="m7 5.6 5 2.5-2.9 2.9a1.7 1.7 0 0 0 2.4 2.4l3-3 4.3 4.2-1.5 1.6-3.2 3.4a2 2 0 0 1-2.9.1L5.4 14z" fill={SAND} />
    <path d="m12.1 8.1 4.5-2.4 4.8 2.3-1.5 5z" fill={MOSS} opacity="0.35" />
  </svg>
);
