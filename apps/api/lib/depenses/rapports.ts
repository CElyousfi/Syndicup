/**
 * Budget vs réalisé — M16 (Doc A §3.7 « dépassement budget en cours d'année », §10.2 « détail
 * budget par poste »). Colonne vertébrale du tableau de bord M18 : par poste du budget ACTIF de
 * l'exercice — prévu, en attente (A_APPROUVER), engagé (APPROUVEE non payée), réalisé (PAYEE),
 * écart, % ; les dépenses sans poste sont regroupées « hors poste » par catégorie ; totaux ; solde
 * de la réserve ; impayés ; indicateur « seuil d'approbation non configuré ».
 * Toute somme passe par lib/money ; les montants sortent en chaînes décimales.
 */
import type Decimal from "decimal.js";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { money, toApiString } from "../money";
import { chargerParametresDepenses, soldeFondsReserve, PermissionRefuseeError } from "./depenses";

interface Cumul {
  en_attente: Decimal;
  engage: Decimal;
  realise: Decimal;
  nb: number;
}
const vide = (): Cumul => ({ en_attente: money(0), engage: money(0), realise: money(0), nb: 0 });

function cumuler(c: Cumul, statut: string, montant: Decimal) {
  if (statut === "A_APPROUVER") c.en_attente = c.en_attente.plus(montant);
  else if (statut === "APPROUVEE") c.engage = c.engage.plus(montant);
  else if (statut === "PAYEE") c.realise = c.realise.plus(montant);
  else return;
  c.nb += 1;
}

function pourcent(part: Decimal, total: Decimal): string | null {
  if (total.isZero()) return null;
  return part.dividedBy(total).times(100).toDecimalPlaces(1).toString();
}

function presenter(prevu: Decimal | null, c: Cumul) {
  const consomme = c.engage.plus(c.realise);
  return {
    montant_prevu: prevu ? toApiString(prevu) : null,
    en_attente: toApiString(c.en_attente),
    engage: toApiString(c.engage),
    realise: toApiString(c.realise),
    consomme: toApiString(consomme),
    ecart: prevu ? toApiString(prevu.minus(consomme)) : null,
    pourcentage_realise: prevu ? pourcent(c.realise, prevu) : null,
    pourcentage_consomme: prevu ? pourcent(consomme, prevu) : null,
    depassement: prevu ? consomme.greaterThan(prevu) : false,
    nb_depenses: c.nb,
  };
}

export async function budgetVsRealise(ctx: TenantContext, exerciceDemande?: string) {
  if (can("depenses.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter le budget vs réalisé.");
  const exercice = exerciceDemande ?? String(new Date().getUTCFullYear());
  return withTenant(ctx, (db) => calculerBudgetVsRealise(db, ctx.coproprieteId, exercice));
}

export type BudgetVsRealise = Awaited<ReturnType<typeof calculerBudgetVsRealise>>;

/**
 * Cœur du calcul, sans contrôle de permission — réutilisé par M18 (tableau de bord, transparence,
 * rapport de gestion). Sous un rôle résident, la RLS ne montre que les dépenses PAYEE : les
 * colonnes « en attente / engagé » ressortent à zéro, ce qui est exactement la vue anonymisée voulue.
 */
export async function calculerBudgetVsRealise(db: TenantDb, coproprieteId: string, exercice: string) {
  {
    const [budget, params, reserve] = await Promise.all([
      db.budgetAg.findFirst({ where: { coproprieteId, exercice, statut: "ACTIF" }, include: { postes: { orderBy: [{ ordre: "asc" }, { creeLe: "asc" }] } } }),
      chargerParametresDepenses(db, coproprieteId),
      soldeFondsReserve(db, coproprieteId),
    ]);
    const depenses = await db.depense.findMany({
      where: {
        coproprieteId,
        statut: { in: ["A_APPROUVER", "APPROUVEE", "PAYEE"] },
        OR: [
          ...(budget ? [{ budgetAgId: budget.id }] : []),
          { budgetAgId: null, dateDepense: { gte: new Date(`${exercice}-01-01T00:00:00Z`), lte: new Date(`${exercice}-12-31T00:00:00Z`) } },
        ],
      },
      select: { budgetPosteId: true, categorie: true, statut: true, montantTtc: true, source: true },
    });

    const parPoste = new Map<string, Cumul>();
    const horsPoste = new Map<string, Cumul>();
    const parCategorie = new Map<string, Cumul>();
    const total = vide();
    const reserveCumul = vide();
    for (const d of depenses) {
      const m = money(d.montantTtc);
      const cible = d.budgetPosteId ? parPoste : horsPoste;
      const cle = d.budgetPosteId ?? d.categorie;
      if (!cible.has(cle)) cible.set(cle, vide());
      cumuler(cible.get(cle)!, d.statut, m);
      if (!parCategorie.has(d.categorie)) parCategorie.set(d.categorie, vide());
      cumuler(parCategorie.get(d.categorie)!, d.statut, m);
      cumuler(total, d.statut, m);
      if (d.source === "FONDS_RESERVE") cumuler(reserveCumul, d.statut, m);
    }

    const postes = (budget?.postes ?? []).map((p) => ({
      poste_id: p.id,
      categorie: p.categorie,
      libelle: p.libelle,
      ordre: p.ordre,
      ...presenter(money(p.montantPrevu), parPoste.get(p.id) ?? vide()),
    }));
    const prevuTotal = budget ? money(budget.montantTotal) : null;

    // Impayés (charges appelées non encaissées) — même calcul que le solde de lot, agrégé.
    const lignes = await db.appelDeFondsLot.findMany({
      where: { appelDeFonds: { coproprieteId }, statut: { in: ["IMPAYE", "PARTIEL"] } },
      select: { montantDu: true, montantPaye: true },
    });
    const impayes = lignes.reduce((acc, l) => acc.plus(money(l.montantDu).minus(money(l.montantPaye))), money(0));

    return {
      exercice,
      budget: budget ? { id: budget.id, statut: budget.statut, montant_total: toApiString(budget.montantTotal) } : null,
      postes,
      hors_poste: [...horsPoste.entries()].map(([categorie, c]) => ({ categorie, ...presenter(null, c) })),
      par_categorie: [...parCategorie.entries()].map(([categorie, c]) => ({ categorie, ...presenter(null, c) })),
      totaux: presenter(prevuTotal, total),
      fonds_reserve: { solde: toApiString(reserve.solde), decaisse_exercice: toApiString(reserveCumul.realise), engage: toApiString(reserveCumul.engage) },
      impayes_total: toApiString(impayes),
      seuil_approbation_conseil: params.seuilApprobationConseil ? toApiString(params.seuilApprobationConseil) : null,
      seuil_non_configure: params.seuilApprobationConseil === null,
      nb_a_approuver: depenses.filter((d) => d.statut === "A_APPROUVER").length,
    };
  }
}
