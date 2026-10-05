import type { ReactNode } from "react";
import type { LcdSejour } from "../../lib/api/types";
import { fill, type Dict, type Locale } from "../../lib/i18n";
import { formatDateCourte } from "../../lib/format";
import { nbNuits } from "../../lib/lcd";
import { sejourVariant } from "../../lib/status";
import { Badge } from "../ui/badge";
import { CCalendar } from "../ui/color-icons";
import { Ligne, Lignes } from "../espaces/ligne-liste";

/**
 * Liste de séjours — la même ligne partout (accueil, déclaration, fiche lot, gardien) :
 * voyageur principal, lot, dates → nuits, voyageurs, statut, et une zone d'actions à l'extrémité.
 * À plat (liste Wise) : la ligne entière ouvre le séjour.
 */
export function SejourListe({
  sejours,
  dict,
  locale,
  actions,
  lotNumero,
  className = "",
}: {
  sejours: LcdSejour[];
  dict: Dict;
  locale: Locale;
  /** Numéro de lot à afficher quand la ligne ne porte pas la relation `lot` (détail déclaration). */
  lotNumero?: string;
  /** Boutons contextuels (confirmer l'arrivée, le départ…) rendus à l'extrémité de la ligne. */
  actions?: (sejour: LcdSejour) => ReactNode;
  className?: string;
}) {
  const l = dict.lcd;
  return (
    <Lignes className={className}>
      {sejours.map((s) => {
        const nuits = nbNuits(s.dateArrivee, s.dateDepart);
        const tone = s.statut === "EN_COURS" ? "ok" : s.statut === "PREVU" ? "tosca" : "sand";
        return (
          <Ligne
            key={s.id}
            icon={<CCalendar width={22} height={22} />}
            tone={tone}
            href={`/${locale}/location-courte-duree/sejours/${s.id}`}
            title={s.voyageurPrincipalNom}
            subtitle={
              <>
                {l.lot} {s.lot?.numero ?? lotNumero ?? "—"} ·{" "}
                <span className="tnum inline-block" dir="ltr">
                  {formatDateCourte(s.dateArrivee, locale)} → {formatDateCourte(s.dateDepart, locale)}
                </span>
                {s.heureArriveePrevue ? <span className="tnum"> · {s.heureArriveePrevue}</span> : ""} ·{" "}
                {nuits === 1 ? l.nuit : fill(l.nuits, { n: nuits })} ·{" "}
                {s.nbVoyageurs === 1 ? l.voyageur : fill(l.voyageurs, { n: s.nbVoyageurs })}
              </>
            }
            end={
              <Badge variant={sejourVariant[s.statut]} pulse={s.statut === "EN_COURS"}>
                {dict.enums.statutSejour[s.statut]}
              </Badge>
            }
            actions={actions ? actions(s) || undefined : undefined}
          />
        );
      })}
    </Lignes>
  );
}
