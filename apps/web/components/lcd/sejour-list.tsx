import Link from "next/link";
import type { ReactNode } from "react";
import type { LcdSejour } from "../../lib/api/types";
import { fill, type Dict, type Locale } from "../../lib/i18n";
import { formatDateCourte } from "../../lib/format";
import { nbNuits } from "../../lib/lcd";
import { sejourVariant } from "../../lib/status";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { CCalendar, IconCircle } from "../ui/color-icons";

/**
 * Liste de séjours — la même ligne partout (accueil, déclaration, fiche lot, gardien) :
 * voyageur principal, lot, dates → nuits, voyageurs, statut, et une zone d'actions à l'extrémité.
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
    <Card padded={false} className={`divide-y divide-hairline ${className}`}>
      {sejours.map((s) => {
        const nuits = nbNuits(s.dateArrivee, s.dateDepart);
        const tone = s.statut === "EN_COURS" ? "ok" : s.statut === "PREVU" ? "tosca" : "sand";
        return (
          <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
            <IconCircle tone={tone} size={40}>
              <CCalendar width={20} height={20} />
            </IconCircle>
            <div className="min-w-0 flex-1">
              <Link
                href={`/${locale}/location-courte-duree/sejours/${s.id}`}
                className="block truncate text-sm font-semibold text-ink hover:text-action"
              >
                {s.voyageurPrincipalNom}
              </Link>
              <p className="mt-0.5 text-[13px] text-soft">
                {l.lot} {s.lot?.numero ?? lotNumero ?? "—"} ·{" "}
                <span className="tnum inline-block" dir="ltr">
                  {formatDateCourte(s.dateArrivee, locale)} → {formatDateCourte(s.dateDepart, locale)}
                </span>
                {s.heureArriveePrevue ? ` · ${s.heureArriveePrevue}` : ""} ·{" "}
                {nuits === 1 ? l.nuit : fill(l.nuits, { n: nuits })} ·{" "}
                {s.nbVoyageurs === 1 ? l.voyageur : fill(l.voyageurs, { n: s.nbVoyageurs })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={sejourVariant[s.statut]} pulse={s.statut === "EN_COURS"}>
                {dict.enums.statutSejour[s.statut]}
              </Badge>
              {actions ? actions(s) : null}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
