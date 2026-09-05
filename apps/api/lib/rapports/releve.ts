/**
 * Relevé de charges par lot (« état daté », Doc A §11 — utilisé par le notaire à la vente) — M18.
 * Appels de fonds de l'exercice (dû / payé / statut / échéance), paiements de l'exercice,
 * déclarations en attente (M17), solde de l'exercice et solde total dû. Syndic / conseil : tout
 * lot ; propriétaire (indivisaire, représentant) : SES lots — vérification applicative + RLS.
 * Chaque relevé (JSON ou PDF) est journalisé dans export_log (RELEVE_LOT).
 */
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { money, toApiString } from "../money";
import { journaliserExport } from "../http/export";
import { debutExercice, finExercice, isoDate } from "./chiffres";
import { IntrouvableError, PermissionRefuseeError } from "./erreurs";
import type { LanguePdf } from "./schemas";

export interface ReleveLot {
  exercice: string;
  emis_le: string;
  copropriete: { nom: string; adresse: string; ville: string };
  lot: { id: string; numero: string; type_lot: string; etage: number | null; tantiemes: string };
  proprietaires: { nom: string | null; prenom: string | null; quote_part: string; type_propriete: string }[];
  appels: { appel_de_fonds_lot_id: string; periode: string; type: string; date_echeance: string; montant_du: string; montant_paye: string; reste_du: string; statut: string; conteste: boolean }[];
  paiements: { id: string; date: string; methode: string; montant: string; reference: string | null; periode: string }[];
  justificatifs_en_attente: { id: string; date_paiement: string; methode: string; montant: string; reference: string | null }[];
  totaux: { appele: string; paye: string; solde_exercice: string; solde_total_du: string; en_attente: string };
}

async function lotsDuProprietaire(db: TenantDb, utilisateurId: string): Promise<Set<string>> {
  const p = await db.lotProprietaire.findMany({ where: { utilisateurId, dateFin: null }, select: { lotId: true } });
  return new Set(p.map((x) => x.lotId));
}

export async function calculerReleveLot(db: TenantDb, coproprieteId: string, lotId: string, exercice: string, maintenant = new Date()): Promise<ReleveLot> {
  const lot = await db.lot.findUnique({ where: { id: lotId }, select: { id: true, coproprieteId: true, numero: true, typeLot: true, etage: true, tantiemes: true } });
  if (!lot || lot.coproprieteId !== coproprieteId) throw new IntrouvableError("Lot introuvable.");
  const debut = debutExercice(exercice), fin = finExercice(exercice);
  const [copro, proprietaires, lignesExercice, toutesLignes, paiements, justifs] = await Promise.all([
    db.copropriete.findUniqueOrThrow({ where: { id: coproprieteId }, select: { nom: true, adresse: true, ville: true } }),
    db.lotProprietaire.findMany({ where: { lotId, dateFin: null }, select: { quotePart: true, typePropriete: true, utilisateur: { select: { nom: true, prenom: true, raisonSociale: true } } } }),
    db.appelDeFondsLot.findMany({ where: { lotId, appelDeFonds: { periode: { startsWith: exercice }, statut: { not: "BROUILLON" } } }, select: { id: true, montantDu: true, montantPaye: true, statut: true, conteste: true, appelDeFonds: { select: { periode: true, type: true, dateEcheance: true } } }, orderBy: { appelDeFonds: { periode: "asc" } } }),
    db.appelDeFondsLot.findMany({ where: { lotId, appelDeFonds: { statut: { not: "BROUILLON" } } }, select: { montantDu: true, montantPaye: true } }),
    db.paiement.findMany({ where: { lotId, statut: "VALIDE", horodatage: { gte: debut, lt: fin } }, select: { id: true, horodatage: true, methode: true, montant: true, referenceCmi: true, appelDeFondsLot: { select: { appelDeFonds: { select: { periode: true } } } } }, orderBy: { horodatage: "asc" } }),
    db.justificatifPaiement.findMany({ where: { lotId, statut: "EN_ATTENTE" }, select: { id: true, datePaiementDeclaree: true, methode: true, montant: true, reference: true }, orderBy: { datePaiementDeclaree: "asc" } }),
  ]);
  const appele = lignesExercice.reduce((a, l) => a.plus(money(l.montantDu)), money(0));
  const paye = lignesExercice.reduce((a, l) => a.plus(money(l.montantPaye)), money(0));
  const soldeTotal = toutesLignes.reduce((a, l) => a.plus(money(l.montantDu).minus(money(l.montantPaye))), money(0));
  const enAttente = justifs.reduce((a, j) => a.plus(money(j.montant)), money(0));
  return {
    exercice,
    emis_le: maintenant.toISOString(),
    copropriete: copro,
    lot: { id: lot.id, numero: lot.numero, type_lot: lot.typeLot, etage: lot.etage, tantiemes: toApiString(lot.tantiemes) },
    proprietaires: proprietaires.map((p) => ({ nom: p.utilisateur.raisonSociale ?? p.utilisateur.nom, prenom: p.utilisateur.raisonSociale ? null : p.utilisateur.prenom, quote_part: toApiString(p.quotePart), type_propriete: p.typePropriete })),
    appels: lignesExercice.map((l) => ({ appel_de_fonds_lot_id: l.id, periode: l.appelDeFonds.periode, type: l.appelDeFonds.type, date_echeance: isoDate(l.appelDeFonds.dateEcheance), montant_du: toApiString(l.montantDu), montant_paye: toApiString(l.montantPaye), reste_du: toApiString(money(l.montantDu).minus(money(l.montantPaye))), statut: l.statut, conteste: l.conteste })),
    paiements: paiements.map((p) => ({ id: p.id, date: isoDate(p.horodatage), methode: p.methode, montant: toApiString(p.montant), reference: p.referenceCmi, periode: p.appelDeFondsLot.appelDeFonds.periode })),
    justificatifs_en_attente: justifs.map((j) => ({ id: j.id, date_paiement: isoDate(j.datePaiementDeclaree), methode: j.methode, montant: toApiString(j.montant), reference: j.reference })),
    totaux: { appele: toApiString(appele), paye: toApiString(paye), solde_exercice: toApiString(appele.minus(paye)), solde_total_du: toApiString(soldeTotal), en_attente: toApiString(enAttente) },
  };
}

async function assertAccesLot(db: TenantDb, ctx: TenantContext, lotId: string) {
  const permission = can("exports.releve_lot", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé à obtenir un relevé de charges.");
  if (permission === "scoped") {
    const mes = await lotsDuProprietaire(db, ctx.utilisateurId);
    if (!mes.has(lotId)) throw new PermissionRefuseeError("Ce lot n'est pas le vôtre.");
  }
}

export async function obtenirReleveLot(ctx: TenantContext, lotId: string, exercice: string, format: "json" | "pdf" = "json", langue: LanguePdf = "fr") {
  if (can("exports.releve_lot", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé à obtenir un relevé de charges.");
  return withTenant(ctx, async (db) => {
    await assertAccesLot(db, ctx, lotId);
    const releve = await calculerReleveLot(db, ctx.coproprieteId, lotId, exercice);
    await journaliserExport(db, ctx, { type: "RELEVE_LOT", filtres: { lot_id: lotId, exercice, langue }, nbLignes: releve.appels.length + releve.paiements.length, format });
    return releve;
  });
}

export async function pdfReleveLot(ctx: TenantContext, lotId: string, exercice: string, langue: LanguePdf) {
  const releve = await obtenirReleveLot(ctx, lotId, exercice, "pdf", langue);
  const { genererRelevePdf } = await import("./releve-pdf");
  const buffer = await genererRelevePdf(releve, langue);
  return { buffer, nomFichier: `releve-charges-${releve.lot.numero}-${exercice}-${langue}.pdf` };
}
