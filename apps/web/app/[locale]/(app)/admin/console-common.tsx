/** M29 — éléments partagés des écrans de la console opérateur (rendu serveur). */
import Link from "next/link";
import { Badge, type BadgeVariant } from "../../../../components/ui/badge";
import { fill, type Dict } from "../../../../lib/i18n";
import type { EtatAbonnement, EtatAcces, StatutFacture } from "../../../../lib/api/console-types";

export const etatVariant: Record<EtatAbonnement, BadgeVariant> = {
  SANS_ABONNEMENT: "outline",
  EN_ESSAI: "info",
  A_JOUR: "ok",
  RENOUVELLEMENT_PROCHE: "neutral",
  ESSAI_EXPIRE: "warn",
  EN_RETARD: "warn",
  ACCES_PROLONGE: "warn",
  BLOQUE_IMPAYE: "danger",
  SUSPENDU: "danger",
  RESILIE: "ink",
};

export const factureVariant: Record<StatutFacture, BadgeVariant> = { EMISE: "warn", PAYEE: "ok", ANNULEE: "neutral" };

export function EtatBadge({ etat, dict }: { etat: EtatAcces | { etat: EtatAbonnement; niveau?: string }; dict: Dict }) {
  return (
    <Badge variant={etatVariant[etat.etat]} pulse={etat.niveau === "GRACE"}>
      {dict.console.etats[etat.etat]}
    </Badge>
  );
}

/** Ligne d'échéance lisible : « Coupure dans 3 j », « Échéance dans 12 j »… */
export function Echeance({ etat, dict }: { etat: EtatAcces; dict: Dict }) {
  const c = dict.console;
  if (etat.niveau === "GRACE" && etat.jours_avant_blocage !== null) {
    return (
      <span className="text-[13px] font-semibold text-danger">
        {etat.jours_avant_blocage <= 0 ? c.coupureAujourdhui : fill(c.coupureDans, { n: etat.jours_avant_blocage })}
      </span>
    );
  }
  if (etat.jours_avant_echeance !== null && etat.jours_avant_echeance >= 0 && etat.niveau !== "BLOQUE") {
    return <span className="text-[13px] text-soft">{fill(c.echeanceDans, { n: etat.jours_avant_echeance })}</span>;
  }
  return null;
}

/** Filtres en pastilles (état dans l'URL). */
export function FiltrePills({ items }: { items: { href: string; label: string; actif: boolean; count?: number }[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.actif ? "page" : undefined}
          className={`su-press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
            it.actif ? "bg-ink text-white" : "bg-wash text-ink-strong hover:bg-wash-strong"
          }`}
        >
          {it.label}
          {typeof it.count === "number" ? <span className={`tnum ${it.actif ? "text-white/70" : "text-soft"}`}>{it.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
