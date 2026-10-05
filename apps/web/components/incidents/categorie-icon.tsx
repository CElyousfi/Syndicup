/**
 * Glyphe couleur + teinte de pastille par catégorie d'incident — même repère visuel partout
 * (liste, détail, formulaire de signalement).
 */
import type { ReactNode } from "react";
import type { CategorieIncident } from "../../lib/api/types";
import {
  CBell,
  CBuilding,
  CFile,
  CHome,
  CSettings,
  CShield,
  CWrench,
  IconCircle,
  type IconTone,
} from "../ui/color-icons";
import { IconCar } from "../ui/icons";

type Glyphe = (p: { width?: number; height?: number; className?: string }) => ReactNode;

const CATEGORIES: Record<CategorieIncident, { glyphe: Glyphe; tone: IconTone }> = {
  PLOMBERIE: { glyphe: CWrench, tone: "tosca" },
  ELECTRICITE: { glyphe: CSettings, tone: "lilac" },
  ASCENSEUR: { glyphe: CBuilding, tone: "sage" },
  NETTOYAGE: { glyphe: CHome, tone: "sage" },
  SECURITE: { glyphe: CShield, tone: "ok" },
  STRUCTURE: { glyphe: CBuilding, tone: "sand" },
  JARDINS_ESPACES_VERTS: { glyphe: CHome, tone: "ok" },
  NUISANCES: { glyphe: CBell, tone: "sand" },
  PARKING: { glyphe: (p) => <IconCar {...p} className={`text-tosca-deep ${p.className ?? ""}`} />, tone: "tosca" },
  EQUIPEMENTS_COLLECTIFS: { glyphe: CSettings, tone: "sand" },
  ADMINISTRATIF: { glyphe: CFile, tone: "lilac" },
};

/** Glyphe seul (sans pastille). */
export function CategorieGlyphe({ categorie, size = 22 }: { categorie: CategorieIncident; size?: number }) {
  const def = CATEGORIES[categorie] ?? CATEGORIES.PLOMBERIE;
  const G = def.glyphe;
  return <G width={size} height={size} />;
}

/** Pastille de catégorie ; `alerte` = SLA dépassé (pastille rouge, même glyphe). */
export function CategorieIcon({
  categorie,
  size = 44,
  alerte = false,
  className = "",
}: {
  categorie: CategorieIncident;
  size?: number;
  alerte?: boolean;
  className?: string;
}) {
  const def = CATEGORIES[categorie] ?? CATEGORIES.PLOMBERIE;
  const g = Math.round(size * 0.5);
  return (
    <IconCircle tone={alerte ? "danger" : def.tone} size={size} className={className}>
      <CategorieGlyphe categorie={categorie} size={g} />
    </IconCircle>
  );
}
