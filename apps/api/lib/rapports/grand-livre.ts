/**
 * Grand livre — M18 (Doc A §8 reddition des comptes). Journal chronologique de l'exercice :
 *   ENTREE  = paiement VALIDE (compte courant),
 *   SORTIE  = dépense PAYEE (compte courant, ou réserve si source FONDS_RESERVE),
 *   RESERVE = mouvement du fonds de réserve SANS dépense liée (cotisation…) — les décaissements liés à
 *             une dépense sont déjà portés par la ligne SORTIE de cette dépense (pas de double compte).
 * Deux soldes courants (compte courant estimé, réserve) partent des soldes d'ouverture au 1er janvier.
 * Mêmes fonctions de calcul que le rapport de gestion (lib/rapports/chiffres.ts) → réconciliation.
 */
import type Decimal from "decimal.js";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { money, toApiString } from "../money";
import { journaliserExport, type CelluleCsv } from "../http/export";
import { debutExercice, finExercice, isoDate, tresorerie } from "./chiffres";
import { PermissionRefuseeError } from "./erreurs";

export interface LigneGrandLivre {
  date: string;
  type: "ENTREE" | "SORTIE" | "RESERVE";
  compte: "COMPTE_COURANT" | "FONDS_RESERVE";
  libelle: string;
  reference: string | null;
  tiers: string | null;
  categorie: string | null;
  entree: string | null;
  sortie: string | null;
  solde_compte_courant: string;
  solde_reserve: string;
  entite: "paiement" | "depense" | "fonds_reserve_mouvement";
  entite_id: string;
}

export async function calculerGrandLivre(db: TenantDb, coproprieteId: string, exercice: string) {
  const debut = debutExercice(exercice);
  const fin = finExercice(exercice);
  const [ouverture, paiements, depenses, fonds] = await Promise.all([
    tresorerie(db, coproprieteId, debut),
    db.paiement.findMany({
      where: { lot: { coproprieteId }, statut: "VALIDE", horodatage: { gte: debut, lt: fin } },
      select: { id: true, montant: true, methode: true, horodatage: true, referenceCmi: true, lot: { select: { numero: true } }, appelDeFondsLot: { select: { appelDeFonds: { select: { periode: true, type: true } } } } },
    }),
    db.depense.findMany({
      where: { coproprieteId, statut: "PAYEE" },
      select: { id: true, libelle: true, categorie: true, montantTtc: true, source: true, payeLe: true, dateDepense: true, referencePaiement: true, prestataire: { select: { nom: true } } },
    }),
    db.fondsReserve.findUnique({ where: { coproprieteId }, select: { mouvements: { where: { depenseId: null, horodatage: { gte: debut, lt: fin } }, select: { id: true, type: true, montant: true, description: true, horodatage: true } } } }),
  ]);

  type Brut = Omit<LigneGrandLivre, "solde_compte_courant" | "solde_reserve"> & { horodatage: Date; deltaCourant: Decimal; deltaReserve: Decimal };
  const brutes: Brut[] = [];
  for (const p of paiements) {
    brutes.push({
      horodatage: p.horodatage, date: isoDate(p.horodatage), type: "ENTREE", compte: "COMPTE_COURANT",
      libelle: `Paiement lot ${p.lot.numero} — ${p.appelDeFondsLot.appelDeFonds.type} ${p.appelDeFondsLot.appelDeFonds.periode}`,
      reference: p.referenceCmi ?? null, tiers: `Lot ${p.lot.numero}`, categorie: p.methode,
      entree: toApiString(p.montant), sortie: null, entite: "paiement", entite_id: p.id,
      deltaCourant: money(p.montant), deltaReserve: money(0),
    });
  }
  for (const d of depenses) {
    const date = d.payeLe ?? d.dateDepense;
    if (date < debut || date >= fin) continue;
    const reserve = d.source === "FONDS_RESERVE";
    brutes.push({
      horodatage: date, date: isoDate(date), type: "SORTIE", compte: reserve ? "FONDS_RESERVE" : "COMPTE_COURANT",
      libelle: d.libelle, reference: d.referencePaiement ?? null, tiers: d.prestataire?.nom ?? null, categorie: d.categorie,
      entree: null, sortie: toApiString(d.montantTtc), entite: "depense", entite_id: d.id,
      deltaCourant: reserve ? money(0) : money(d.montantTtc).negated(), deltaReserve: reserve ? money(d.montantTtc).negated() : money(0),
    });
  }
  for (const m of fonds?.mouvements ?? []) {
    const montant = money(m.montant);
    brutes.push({
      horodatage: m.horodatage, date: isoDate(m.horodatage), type: "RESERVE", compte: "FONDS_RESERVE",
      libelle: m.description ?? (m.type === "COTISATION" ? "Cotisation au fonds de réserve" : "Décaissement du fonds de réserve"),
      reference: null, tiers: null, categorie: m.type,
      entree: montant.isNegative() ? null : toApiString(montant), sortie: montant.isNegative() ? toApiString(montant.negated()) : null,
      entite: "fonds_reserve_mouvement", entite_id: m.id,
      deltaCourant: money(0), deltaReserve: montant,
    });
  }
  brutes.sort((a, b) => a.horodatage.getTime() - b.horodatage.getTime() || a.entite_id.localeCompare(b.entite_id));

  let soldeCourant = money(ouverture.compte_courant_estime);
  let soldeReserve = money(ouverture.reserve);
  let totalEntrees = money(0), totalSortiesCourant = money(0), totalSortiesReserve = money(0), totalCotisations = money(0);
  const lignes: LigneGrandLivre[] = brutes.map((b) => {
    soldeCourant = soldeCourant.plus(b.deltaCourant);
    soldeReserve = soldeReserve.plus(b.deltaReserve);
    if (b.type === "ENTREE") totalEntrees = totalEntrees.plus(b.deltaCourant);
    else if (b.type === "SORTIE" && b.compte === "COMPTE_COURANT") totalSortiesCourant = totalSortiesCourant.minus(b.deltaCourant);
    else if (b.type === "SORTIE") totalSortiesReserve = totalSortiesReserve.minus(b.deltaReserve);
    else totalCotisations = totalCotisations.plus(b.deltaReserve);
    const { horodatage, deltaCourant, deltaReserve, ...reste } = b;
    void horodatage; void deltaCourant; void deltaReserve;
    return { ...reste, solde_compte_courant: toApiString(soldeCourant), solde_reserve: toApiString(soldeReserve) };
  });

  return {
    exercice,
    ouverture: { compte_courant: ouverture.compte_courant_estime, reserve: ouverture.reserve },
    totaux: {
      entrees: toApiString(totalEntrees),
      sorties_compte_courant: toApiString(totalSortiesCourant),
      sorties_reserve: toApiString(totalSortiesReserve),
      mouvements_reserve: toApiString(totalCotisations),
    },
    cloture: { compte_courant: toApiString(soldeCourant), reserve: toApiString(soldeReserve) },
    nb_lignes: lignes.length,
    lignes,
  };
}
export type GrandLivre = Awaited<ReturnType<typeof calculerGrandLivre>>;

export async function obtenirGrandLivre(ctx: TenantContext, exercice: string) {
  if (can("rapports.syndic.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter le grand livre.");
  return withTenant(ctx, (db) => calculerGrandLivre(db, ctx.coproprieteId, exercice));
}

export const ENTETES_GRAND_LIVRE = ["date", "type", "compte", "libelle", "reference", "tiers", "categorie", "entree", "sortie", "solde_compte_courant", "solde_reserve", "entite", "entite_id"];

export async function exporterGrandLivre(ctx: TenantContext, exercice: string, format: "csv" | "xlsx") {
  if (can("exports.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à exporter le grand livre.");
  return withTenant(ctx, async (db) => {
    const gl = await calculerGrandLivre(db, ctx.coproprieteId, exercice);
    const lignes: CelluleCsv[][] = gl.lignes.map((l) => [l.date, l.type, l.compte, l.libelle, l.reference, l.tiers, l.categorie, l.entree, l.sortie, l.solde_compte_courant, l.solde_reserve, l.entite, l.entite_id]);
    await journaliserExport(db, ctx, { type: "GRAND_LIVRE", filtres: { exercice }, nbLignes: lignes.length, format });
    return { entetes: ENTETES_GRAND_LIVRE, lignes, nbLignes: lignes.length };
  });
}
