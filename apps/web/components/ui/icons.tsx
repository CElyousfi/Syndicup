/**
 * Icônes maison — traits 1.6, 20×20, currentColor. Jeu volontairement restreint et cohérent.
 * `.icon-flip` : à poser sur les flèches directionnelles pour le miroir RTL (géré en CSS).
 */
import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </svg>
);

export const IconBuilding = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 21V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V21" />
    <path d="M15 9h2.5A1.5 1.5 0 0 1 19 10.5V21" />
    <path d="M3 21h18" />
    <path d="M8 8h1.5M8 11.5h1.5M8 15h1.5M11.5 8H13M11.5 11.5H13M11.5 15H13" />
  </svg>
);

export const IconCoins = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="6.5" rx="7" ry="3" />
    <path d="M5 6.5v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5" />
    <path d="M5 11.5v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5" />
  </svg>
);

export const IconVote = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12.5h16l1 7a1 1 0 0 1-1 1.1H4a1 1 0 0 1-1-1.1z" />
    <path d="M12 12.5V4.8" />
    <path d="M9 7.8 12 4.8l3 3" />
  </svg>
);

export const IconWrench = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14.7 6.3a4.2 4.2 0 0 0-5.6 5.2L3.5 17a2 2 0 1 0 2.8 2.8l5.6-5.6a4.2 4.2 0 0 0 5.2-5.6L14.5 11l-2.3-2.3z" />
  </svg>
);

export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);

export const IconDoor = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 21h16" />
    <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21" />
    <path d="M14.5 12.2v.01" strokeWidth={2.4} />
  </svg>
);

export const IconFile = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3.5h7L18 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5z" />
    <path d="M13 3.5V9h5" />
  </svg>
);

export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M18 16H6l1.2-2V9.8A4.8 4.8 0 0 1 12 5a4.8 4.8 0 0 1 4.8 4.8V14z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const IconScale = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 4v16M8 20h8" />
    <path d="M6 7h12" />
    <path d="M6 7 3.5 12.5a2.7 2.7 0 0 0 5 0zM18 7l-2.5 5.5a2.7 2.7 0 0 0 5 0z" />
  </svg>
);

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19 12a7 7 0 0 0-.15-1.4l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.4-1.4L13.7 3h-3.4l-.45 2.3a7 7 0 0 0-2.4 1.4l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.8l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.4 1.4l.45 2.3h3.4l.45-2.3a7 7 0 0 0 2.4-1.4l2.3 1 2-3.4-2-1.5c.1-.45.15-.92.15-1.4z" />
  </svg>
);

export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.4a3.2 3.2 0 0 1 0 5.8M17.8 15.1a5.5 5.5 0 0 1 2.7 4.9" />
  </svg>
);

export const IconKey = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="8" cy="15.5" r="4.5" />
    <path d="M11.5 12 20 3.5M15.5 8l3 3M18 5.5l2.5 2.5" />
  </svg>
);

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.8-3.8" />
  </svg>
);

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const IconChevronEnd = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ ...p, className: `icon-flip ${p.className ?? ""}` })}>
    <path d="m9.5 6 6 6-6 6" />
  </svg>
);

export const IconArrowEnd = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ ...p, className: `icon-flip ${p.className ?? ""}` })}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </svg>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 5 5L19.5 7" />
  </svg>
);

export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7.5 11 12 15.5 16.5 11" />
    <path d="M4.5 19.5h15" />
  </svg>
);

export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" transform="translate(0)" />
  </svg>
);

export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ ...p, className: `icon-flip ${p.className ?? ""}` })}>
    <path d="M14 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h8" />
    <path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
  </svg>
);

export const IconGlobe = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.2 3.8 5.2 3.8 8.5s-1.3 6.3-3.8 8.5c-2.5-2.2-3.8-5.2-3.8-8.5s1.3-6.3 3.8-8.5z" />
  </svg>
);

export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 4 2.8 19.5a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5z" />
    <path d="M12 10v4.5M12 17.8v.01" strokeWidth={2.2} />
  </svg>
);

export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 7.8v.01" strokeWidth={2.2} />
  </svg>
);

export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5.2l3.4 2" />
  </svg>
);

export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3.5 5 6v5.2c0 4.5 2.9 7.7 7 9.3 4.1-1.6 7-4.8 7-9.3V6z" />
    <path d="m9 11.8 2.2 2.2 3.8-4" />
  </svg>
);

export const IconPrinter = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 8V3.5h10V8" />
    <rect x="4" y="8" width="16" height="8" rx="1.5" />
    <path d="M7 13.5h10v7H7z" />
  </svg>
);

export const IconQr = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
    <path d="M13.5 13.5h2.8v2.8h-2.8zM17.2 17.2H20V20h-2.8z" />
  </svg>
);

export const IconEye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m4 11 8-7 8 7" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-5.5h4V20" />
  </svg>
);

export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ ...p, className: `icon-flip ${p.className ?? ""}` })}>
    <path d="M21 3.5 10.5 14M21 3.5l-6.8 17-3.7-6.5L4 10.3z" />
  </svg>
);

export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 20h16" />
    <rect x="5" y="11" width="3.4" height="6" rx="1" />
    <rect x="10.3" y="6.5" width="3.4" height="10.5" rx="1" />
    <rect x="15.6" y="9" width="3.4" height="8" rx="1" />
  </svg>
);

export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8.5 6.5 9.8 4.5h4.4l1.3 2H19A1.5 1.5 0 0 1 20.5 8v10A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V8A1.5 1.5 0 0 1 5 6.5z" />
    <circle cx="12" cy="12.5" r="3.4" />
  </svg>
);

export const IconImage = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m3.5 16 4.5-4 3.5 3 3.5-3.5 5.5 5" />
  </svg>
);

export const IconWallet = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h12A1.5 1.5 0 0 1 19 7.5v1" />
    <rect x="4" y="8.5" width="16" height="10.5" rx="1.5" />
    <path d="M15.5 13.7v.01" strokeWidth={2.4} />
  </svg>
);

/** Valise — location courte durée (M15). */
export const IconSuitcase = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 7v13M16 7v13" />
  </svg>
);

/** M16 — dépenses / factures (reçu). */
export const IconReceipt = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 3.5h12v17l-2.5-1.6-2.5 1.6-2.5-1.6-2.5 1.6-2-1.3z" />
    <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
  </svg>
);
