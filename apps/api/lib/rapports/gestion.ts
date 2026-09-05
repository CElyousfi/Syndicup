/**
 * Rapport de gestion annuel — M18 (Doc A §8 reddition des comptes, §6 approbation des comptes en AG).
 *
 * Génération (syndic) : instantané figé `donnees_json` (mêmes fonctions que le tableau de bord et le
 * grand livre) → rendu PDF FR « publique » (sans détail par lot) téléversé comme Document
 * RAPPORT_GESTION (visibilité CONSEIL_SYNDICAL) → statut GENERE. Un rapport BROUILLON / GENERE du
 * même exercice est régénéré (l'instantané est remplacé) ; SOUMIS_AG / APPROUVE → 409.
 * Soumission à l'AG : AG PLANIFIEE / CONVOQUEE de la copropriété, résolution « Approbation des
 * comptes de l'exercice N » créée par le service AG existant (creerResolutionDb), majorité lue dans
 * le payload ou `config_json.majorite_approbation_comptes` (jamais devinée — brief §9), document
 * rendu PUBLIC_COPROPRIETE, notification RAPPORT_GESTION_DISPONIBLE aux copropriétaires.
 * Finalisation de la résolution (ag.ts) → APPROUVE / REJETE (finaliserRapportsLies).
 *
 * La transaction idempotente ne couvre que la construction de l'instantané : le rendu PDF et le
 * téléversement se font hors transaction (délai), puis une seconde transaction attache le document.
 */
import type { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import { withTenantIdempotent } from "../http/idempotency";
import { creerUrlSignee, televerserDocument } from "../storage/supabase-storage";
import { attacherDocument, cheminModule } from "../documents/attach";
import { creerResolutionDb } from "../ag/ag";
import type { Pagination, Tri } from "../http/pagination";
import { journaliserExport } from "../http/export";
import { construireDonneesRapport, type RapportGestionDonnees } from "./gestion-donnees";
import { genererRapportGestionPdf, type VariantePdf } from "./rapport-gestion-pdf";
import type { LanguePdf, RapportGestionCreateInput, RapportSoumettreAgInput, RapportsGestionFiltres, TRIS_RAPPORT } from "./schemas";
import { ConflitError, IntrouvableError, PermissionRefuseeError, RapportError } from "./erreurs";

const rapportInclude = {
  generePar: { select: { id: true, nom: true, prenom: true } },
  ag: { select: { id: true, type: true, dateAg: true, statut: true } },
  resolutionAg: { select: { id: true, ordre: true, texte: true, typeMajorite: true, resultat: true } },
  document: { select: { id: true, nom: true, visibilite: true, storagePath: true } },
} as const;

type RapportRow = Prisma.RapportGestionGetPayload<{ include: typeof rapportInclude }>;

function resume(d: RapportGestionDonnees) {
  return {
    compte_courant_cloture: d.tresorerie.cloture.compte_courant,
    reserve_cloture: d.tresorerie.cloture.reserve,
    taux_recouvrement: d.recouvrement.taux,
    impayes_total: d.impayes.total,
    nb_lots_en_retard: d.impayes.nb_lots_en_retard,
    depenses_total: d.depenses_par_categorie.total,
    budget_prevu: d.budget_vs_realise.totaux.montant_prevu,
    budget_realise: d.budget_vs_realise.totaux.realise,
  };
}

function presenter(r: RapportRow, avecDonnees: boolean) {
  const d = r.donneesJson as unknown as RapportGestionDonnees;
  return {
    id: r.id,
    exercice: r.exercice,
    statut: r.statut,
    budget_ag_id: r.budgetAgId,
    ag: r.ag ? { id: r.ag.id, type: r.ag.type, date_ag: r.ag.dateAg.toISOString(), statut: r.ag.statut } : null,
    resolution: r.resolutionAg ? { id: r.resolutionAg.id, ordre: r.resolutionAg.ordre, texte: r.resolutionAg.texte, type_majorite: r.resolutionAg.typeMajorite, resultat: r.resolutionAg.resultat } : null,
    document_id: r.documentId,
    document_visibilite: r.document?.visibilite ?? null,
    genere_par: r.generePar ? { id: r.generePar.id, nom: r.generePar.nom, prenom: r.generePar.prenom } : null,
    genere_le: r.genereLe.toISOString(),
    cree_le: r.creeLe.toISOString(),
    modifie_le: r.modifieLe.toISOString(),
    resume: resume(d),
    ...(avecDonnees ? { donnees: d } : {}),
  };
}

async function chargerRapport(db: TenantDb, id: string): Promise<RapportRow> {
  const r = await db.rapportGestion.findUnique({ where: { id }, include: rapportInclude });
  if (!r) throw new IntrouvableError("Rapport de gestion introuvable.");
  return r;
}

async function logoBuffer(storagePath: string | null): Promise<{ data: Buffer; format: "png" | "jpg" } | undefined> {
  if (!storagePath) return undefined;
  try {
    const url = await creerUrlSignee(storagePath);
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = Buffer.from(await res.arrayBuffer());
    const format: "png" | "jpg" = data.subarray(0, 4).toString("hex") === "89504e47" ? "png" : "jpg";
    return { data, format };
  } catch {
    return undefined;
  }
}

/** POST /rapports/gestion — génère (ou régénère) le rapport de l'exercice. */
export async function genererRapportGestion(ctx: TenantContext, input: RapportGestionCreateInput, cle?: string) {
  if (can("rapports.gestion.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic génère le rapport de gestion.");
  const maintenant = new Date();
  // 1. Instantané figé — transaction idempotente.
  const { id, regenere } = await withTenantIdempotent(ctx, { cle, endpoint: "POST /rapports/gestion", payload: input }, async (db) => {
    const existant = await db.rapportGestion.findFirst({ where: { coproprieteId: ctx.coproprieteId, exercice: input.exercice, statut: { not: "REJETE" } } });
    if (existant && (existant.statut === "SOUMIS_AG" || existant.statut === "APPROUVE")) {
      throw new ConflitError(`Un rapport ${existant.statut} existe déjà pour l'exercice ${input.exercice} — il ne peut pas être régénéré.`);
    }
    if (input.budget_ag_id) {
      const budget = await db.budgetAg.findUnique({ where: { id: input.budget_ag_id }, select: { coproprieteId: true, exercice: true } });
      if (!budget || budget.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Budget introuvable.");
      if (budget.exercice !== input.exercice) throw new RapportError("RAPPORT_STATUT_INVALIDE", `Le budget visé porte sur l'exercice ${budget.exercice}, pas ${input.exercice}.`);
    }
    const donnees = await construireDonneesRapport(db, ctx, input.exercice, input.budget_ag_id ?? null, maintenant);
    const data = { budgetAgId: donnees.budget_ag_id, statut: "BROUILLON" as const, donneesJson: donnees as unknown as Prisma.InputJsonValue, genereParId: ctx.utilisateurId, genereLe: maintenant, documentId: null };
    const row = existant
      ? await db.rapportGestion.update({ where: { id: existant.id }, data })
      : await db.rapportGestion.create({ data: { ...data, coproprieteId: ctx.coproprieteId, exercice: input.exercice } });
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: existant ? "RAPPORT_GESTION_REGENERE" : "RAPPORT_GESTION_GENERE", entite: "rapport_gestion", entiteId: row.id, apres: { exercice: input.exercice, resume: resume(donnees) } as never });
    return { id: row.id, regenere: existant !== null };
  });

  // 2. PDF publique FR → storage → Document (hors transaction : rendu + réseau).
  let pdfErreur: string | null = null;
  let storagePath: string | null = null;
  const donnees = await withTenant(ctx, async (db) => (await chargerRapport(db, id)).donneesJson as unknown as RapportGestionDonnees);
  try {
    const logo = await logoBuffer(donnees.copropriete.logo_storage_path);
    const buffer = await genererRapportGestionPdf(donnees, "fr", "publique", logo);
    storagePath = cheminModule(ctx, "rapports", `rapport-gestion-${input.exercice}.pdf`);
    await televerserDocument(storagePath, buffer, "application/pdf");
  } catch (e) {
    pdfErreur = e instanceof Error ? e.message : String(e);
  }

  // 3. Rattachement + statut GENERE (ou BROUILLON conservé si le PDF a échoué — régénérable).
  return withTenant(ctx, async (db) => {
    if (storagePath && !pdfErreur) {
      const doc = await attacherDocument(db, ctx, { module: "rapports", type: "RAPPORT_GESTION", nom: `Rapport de gestion ${input.exercice}.pdf`, storagePath, visibilite: "CONSEIL_SYNDICAL" });
      await db.rapportGestion.update({ where: { id }, data: { statut: "GENERE", documentId: doc.id } });
    } else {
      await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "RAPPORT_GESTION_PDF_ECHEC", entite: "rapport_gestion", entiteId: id, apres: { erreur: pdfErreur } as never });
    }
    return { ...presenter(await chargerRapport(db, id), true), regenere, pdf_erreur: pdfErreur };
  });
}

export async function listerRapportsGestion(ctx: TenantContext, filtres: RapportsGestionFiltres, pagination: Pagination, tri: Tri<(typeof TRIS_RAPPORT)[number]>) {
  if (can("rapports.syndic.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter les rapports de gestion.");
  const where: Prisma.RapportGestionWhereInput = { coproprieteId: ctx.coproprieteId, ...(filtres.statut ? { statut: filtres.statut } : {}), ...(filtres.exercice ? { exercice: filtres.exercice } : {}) };
  const orderBy: Prisma.RapportGestionOrderByWithRelationInput = tri.champ === "genere_le" ? { genereLe: tri.sens } : tri.champ === "statut" ? { statut: tri.sens } : { exercice: tri.sens };
  return withTenant(ctx, async (db) => {
    const [total, rows] = await Promise.all([db.rapportGestion.count({ where }), db.rapportGestion.findMany({ where, include: rapportInclude, orderBy: [orderBy, { creeLe: "desc" }], skip: pagination.skip, take: pagination.take })]);
    return { total, rows: rows.map((r) => presenter(r, false)) };
  });
}

export async function obtenirRapportGestion(ctx: TenantContext, id: string) {
  if (can("rapports.syndic.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter les rapports de gestion.");
  return withTenant(ctx, async (db) => {
    const r = await chargerRapport(db, id);
    const documentUrl = r.document ? await creerUrlSignee(r.document.storagePath) : null;
    return { ...presenter(r, true), document_url: documentUrl };
  });
}

/** GET /rapports/gestion/{id}/pdf?langue=fr|ar&variante=publique|complete — rendu depuis l'instantané, export journalisé. */
export async function pdfRapportGestion(ctx: TenantContext, id: string, langue: LanguePdf, variante: VariantePdf) {
  if (can("rapports.syndic.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à télécharger le rapport de gestion.");
  const r = await withTenant(ctx, async (db) => {
    const row = await chargerRapport(db, id);
    await journaliserExport(db, ctx, { type: "RAPPORT_GESTION_PDF", filtres: { rapport_id: id, exercice: row.exercice, langue, variante }, nbLignes: 1, format: "pdf" });
    return row;
  });
  const donnees = r.donneesJson as unknown as RapportGestionDonnees;
  const logo = await logoBuffer(donnees.copropriete.logo_storage_path);
  const buffer = await genererRapportGestionPdf(donnees, langue, variante, logo);
  return { buffer, exercice: r.exercice, nomFichier: `rapport-gestion-${r.exercice}-${langue}${variante === "complete" ? "-complet" : ""}.pdf` };
}

function majoriteConfiguree(configJson: Prisma.JsonValue | null): "SIMPLE" | "DOUBLE" | "UNANIMITE" | null {
  if (typeof configJson !== "object" || configJson === null || Array.isArray(configJson)) return null;
  const v = (configJson as Record<string, unknown>).majorite_approbation_comptes;
  return v === "SIMPLE" || v === "DOUBLE" || v === "UNANIMITE" ? v : null;
}

/** POST /rapports/gestion/{id}/soumettre-ag */
export async function soumettreRapportAg(ctx: TenantContext, id: string, input: RapportSoumettreAgInput, cle?: string) {
  if (can("rapports.gestion.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic soumet le rapport de gestion à l'AG.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /rapports/gestion/${id}/soumettre-ag`, payload: { id, ...input } }, async (db) => {
    const r = await chargerRapport(db, id);
    if (r.statut !== "GENERE") throw new RapportError("RAPPORT_STATUT_INVALIDE", `Seul un rapport GENERE peut être soumis à l'AG (statut actuel : ${r.statut}).`);
    const [ag, copro] = await Promise.all([
      db.assembleeGenerale.findUnique({ where: { id: input.ag_id }, include: { resolutions: { select: { ordre: true } } } }),
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { configJson: true } }),
    ]);
    if (!ag || ag.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("AG introuvable.");
    if (ag.statut !== "PLANIFIEE" && ag.statut !== "CONVOQUEE") throw new RapportError("RAPPORT_STATUT_INVALIDE", `L'AG doit être PLANIFIEE ou CONVOQUEE (statut actuel : ${ag.statut}).`);
    const typeMajorite = input.type_majorite ?? majoriteConfiguree(copro?.configJson ?? null);
    if (!typeMajorite) {
      throw new RapportError("RAPPORT_PARAMETRE_NON_CONFIGURE", "Majorité requise pour l'approbation des comptes non configurée (config_json.majorite_approbation_comptes) — LEGAL_QUESTIONS_BRIEF §9 ; précisez type_majorite ou configurez la copropriété.");
    }
    const ordre = ag.resolutions.reduce((m, x) => Math.max(m, x.ordre), 0) + 1;
    const resolution = await creerResolutionDb(db, ag.id, { ordre, texte: `Approbation des comptes de l'exercice ${r.exercice} (rapport de gestion du syndic)`, type_majorite: typeMajorite });
    await db.rapportGestion.update({ where: { id }, data: { statut: "SOUMIS_AG", agId: ag.id, resolutionAgId: resolution.id } });
    if (r.documentId) {
      await db.document.update({ where: { id: r.documentId }, data: { visibilite: "PUBLIC_COPROPRIETE" } });
    }
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "RAPPORT_GESTION_SOUMIS_AG", entite: "rapport_gestion", entiteId: id, avant: { statut: r.statut }, apres: { statut: "SOUMIS_AG", ag_id: ag.id, resolution_id: resolution.id, type_majorite: typeMajorite } });
    // Copropriétaires (tous les rôles de propriété actifs) : rapport disponible.
    const destinataires = await db.roleUtilisateur.findMany({ where: { coproprieteId: ctx.coproprieteId, actif: true, role: { in: ["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT", "CONSEIL_SYNDICAL"] } }, select: { utilisateurId: true }, distinct: ["utilisateurId"] });
    await Promise.all(destinataires.map((d) => envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: d.utilisateurId, templateCode: "RAPPORT_GESTION_DISPONIBLE", canal: "PUSH", contenuJson: { rapport_id: id, exercice: r.exercice, date_ag: ag.dateAg.toISOString().slice(0, 10), document_id: r.documentId } })));
    return presenter(await chargerRapport(db, id), false);
  });
}

/** Hook appelé par ag.ts::finaliserResolution — même transaction. */
export async function finaliserRapportsLies(db: TenantDb, ctx: TenantContext, resolutionId: string, resultat: "ADOPTEE" | "REJETEE") {
  const lies = await db.rapportGestion.findMany({ where: { resolutionAgId: resolutionId, statut: "SOUMIS_AG" }, select: { id: true, exercice: true } });
  if (lies.length === 0) return;
  const statut = resultat === "ADOPTEE" ? "APPROUVE" : "REJETE";
  await db.rapportGestion.updateMany({ where: { id: { in: lies.map((l) => l.id) } }, data: { statut } });
  await Promise.all(lies.map((l) => ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: statut === "APPROUVE" ? "RAPPORT_GESTION_APPROUVE" : "RAPPORT_GESTION_REJETE", entite: "rapport_gestion", entiteId: l.id, avant: { statut: "SOUMIS_AG" }, apres: { statut, resolution_id: resolutionId, exercice: l.exercice } })));
}
