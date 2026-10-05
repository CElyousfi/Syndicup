/** Pastille d'icône par catégorie de dépense (listes Wise de Transparence et du rapport de gestion). */
import type { ComponentType } from "react";
import type { CategorieDepense } from "../../../../lib/api/types";
import { CCoins, CFile, CHandshake, CHome, CScale, CSettings, CShield, CUsers, CWrench, IconCircle, type IconTone } from "../../../../components/ui/color-icons";

const ICONES: Record<CategorieDepense, { icone: ComponentType; tone: IconTone }> = {
  ENTRETIEN_COURANT: { icone: CHome, tone: "sage" },
  REPARATIONS: { icone: CWrench, tone: "sand" },
  TRAVAUX: { icone: CWrench, tone: "sand" },
  PERSONNEL: { icone: CUsers, tone: "lilac" },
  ENERGIE_EAU: { icone: CSettings, tone: "tosca" },
  ASSURANCE: { icone: CShield, tone: "sage" },
  HONORAIRES_SYNDIC: { icone: CHandshake, tone: "lilac" },
  ADMINISTRATIF: { icone: CFile, tone: "tosca" },
  IMPOTS_TAXES: { icone: CScale, tone: "sand" },
  AUTRE: { icone: CCoins, tone: "sage" },
};

export function CategorieIcone({ categorie, size = 46 }: { categorie: CategorieDepense; size?: number }) {
  const { icone: Icone, tone } = ICONES[categorie] ?? ICONES.AUTRE;
  return (
    <IconCircle tone={tone} size={size}>
      <Icone />
    </IconCircle>
  );
}
