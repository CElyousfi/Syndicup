/**
 * M24 — Import Excel / csv et onboarding (Doc A §11) : le syndic téléverse un tableur, l'API
 * détecte les colonnes (synonymes FR / AR / EN), montre un aperçu validé ligne à ligne, le syndic
 * corrige le mapping, puis l'exécution tourne par chunks (job Inngest), idempotente par empreinte
 * de ligne (`import_job_log.hash`) et transactionnelle par chunk — rejouer un import ne crée rien
 * deux fois. Journal append-only, audit `IMPORT_*`, notification à la fin.
 */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import { attacherDocument, preparerUploadModule } from "../documents/attach";
import { telechargerObjet } from "../storage/supabase-storage";
import { emitEvent } from "../events/emit";
import type { ErrorCode } from "../http/respond";
import { money } from "../money";
import { identites, type Identite } from "../communication/communication";
import { CHAMPS, detecterMapping, lireTableur, normaliserDate, normaliserDecimal, normaliserTelephone, type Tableur } from "./parse";
import { EXECUTEURS, LigneError, type CacheImport, type Champs, type OptionsImport } from "./executeurs";
import type { ImportCreateInput, ImportMappingInput, ImportsFiltres, ImportUploadUrlInput, TypeImport } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class ImportError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

const TAILLE_CHUNK = 50;
const APERCU = 20;
type Mapping = { index: number; entete: string; champ: string | null }[];
type ApercuLigne = { n: number; valeurs: string[]; champs: Champs; erreurs: string[]; avertissements: string[] };

function assertGerer(ctx: TenantContext) {
  if (can("import.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic importe des données.");
}
function assertLire(ctx: TenantContext) {
  if (can("import.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
}
async function audit(db: TenantDb, ctx: TenantContext, action: string, id: string, apres?: Record<string, unknown>) {
  await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action, entite: "import_job", entiteId: id, apres: apres as Prisma.InputJsonValue });
}
async function log(db: TenantDb, ctx: TenantContext, jobId: string, type: "CREE" | "ANALYSE" | "MAPPING" | "LANCE" | "LIGNE" | "TERMINE" | "ECHEC" | "ANNULE", extra: { ligne?: number; hash?: string; resultat?: string; details?: Record<string, unknown> } = {}) {
  await db.importJobLog.create({ data: { coproprieteId: ctx.coproprieteId, importJobId: jobId, type, ligne: extra.ligne ?? null, hash: extra.hash ?? null, resultat: extra.resultat ?? null, detailsJson: (extra.details ?? undefined) as Prisma.InputJsonValue | undefined } });
}

/** Valeurs d'une ligne projetées sur les champs du mapping. */
export function projeter(mapping: Mapping, valeurs: string[]): Champs {
  const c: Champs = {};
  for (const m of mapping) if (m.champ) c[m.champ] = valeurs[m.index]?.trim() || null;
  return c;
}
export function empreinte(type: TypeImport, champs: Champs): string {
  const cles = Object.keys(champs).sort();
  return createHash("sha256").update(`${type}|${cles.map((k) => `${k}=${(champs[k] ?? "").toLowerCase().replace(/\s+/g, " ")}`).join("|")}`).digest("hex");
}

/** Validation ligne à ligne (sans écriture) — erreurs bloquantes pour la ligne, avertissements informatifs. */
function validerLigne(type: TypeImport, c: Champs): { erreurs: string[]; avertissements: string[] } {
  const erreurs: string[] = [], avertissements: string[] = [];
  for (const ch of CHAMPS[type]) if (ch.requis && !c[ch.cle]) erreurs.push(`${ch.libelle.FR} manquant.`);
  if ("telephone" in c && c.telephone && !normaliserTelephone(c.telephone)) (type === "PERSONNEL" ? erreurs : avertissements).push(`Téléphone invalide : « ${c.telephone} ».`);
  if ("email" in c && c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) avertissements.push(`E-mail invalide : « ${c.email} ».`);
  if (type === "LOTS_PROPRIETAIRES" && c.tantiemes && normaliserDecimal(c.tantiemes) === null) erreurs.push(`Tantièmes illisibles : « ${c.tantiemes} ».`);
  if (type === "LOTS_PROPRIETAIRES" && c.quote_part && normaliserDecimal(c.quote_part) === null) avertissements.push(`Quote-part illisible : « ${c.quote_part} ».`);
  if (type === "SOLDES_OUVERTURE") { const m = normaliserDecimal(c.montant); if (c.montant && (m === null || money(m).isZero())) erreurs.push(`Solde illisible ou nul : « ${c.montant} ».`); if (c.date_reference && !normaliserDate(c.date_reference)) avertissements.push(`Date illisible : « ${c.date_reference} ».`); }
  if (type === "CONTRATS") { if (c.date_debut && !normaliserDate(c.date_debut)) erreurs.push(`Date de début illisible : « ${c.date_debut} ».`); if (c.date_fin && !normaliserDate(c.date_fin)) avertissements.push(`Date de fin illisible : « ${c.date_fin} ».`); }
  return { erreurs, avertissements };
}

/** Analyse complète : mapping (auto ou confirmé), aperçu, avertissements globaux, compteurs. */
async function analyser(db: TenantDb, ctx: TenantContext, job: { id: string; type: TypeImport; mappingJson: Prisma.JsonValue }, tableur: Tableur) {
  const stocke = job.mappingJson as { colonnes?: Mapping; options?: OptionsImport } | null;
  const mapping: Mapping = stocke?.colonnes?.length ? stocke.colonnes.map((m) => ({ index: m.index, entete: tableur.entetes[m.index] ?? m.entete, champ: m.champ })) : detecterMapping(job.type, tableur.entetes);
  const options = stocke?.options ?? {};
  const requisManquants = CHAMPS[job.type].filter((ch) => ch.requis && !mapping.some((m) => m.champ === ch.cle)).map((ch) => ch.libelle.FR);
  const avertissements: string[] = [];
  if (requisManquants.length) avertissements.push(`Colonnes obligatoires non reconnues : ${requisManquants.join(", ")} — associez-les dans le mapping.`);
  const lignes: ApercuLigne[] = [];
  let nbErreurs = 0;
  const numeros = new Map<string, number[]>();
  const parTelephone = new Map<string, Set<string>>();
  let sommeTantiemes = money(0);
  let toutesTantiemes = true;
  for (const l of tableur.lignes) {
    const champs = projeter(mapping, l.valeurs);
    const v = validerLigne(job.type, champs);
    if (v.erreurs.length) nbErreurs++;
    if (lignes.length < APERCU) lignes.push({ n: l.n, valeurs: l.valeurs, champs, erreurs: v.erreurs, avertissements: v.avertissements });
    if (champs.numero) { const k = champs.numero.toUpperCase(); numeros.set(k, [...(numeros.get(k) ?? []), l.n]); }
    if (job.type === "LOTS_PROPRIETAIRES") {
      const t = normaliserDecimal(champs.tantiemes);
      if (t) sommeTantiemes = sommeTantiemes.plus(money(t)); else toutesTantiemes = false;
      const tel = normaliserTelephone(champs.telephone);
      if (tel) { const s = parTelephone.get(tel) ?? new Set<string>(); if (champs.nom) s.add(champs.nom.toLowerCase()); parTelephone.set(tel, s); }
    }
  }
  if (job.type === "LOTS_PROPRIETAIRES") {
    const doublons = [...numeros.entries()].filter(([, ns]) => ns.length > 1);
    if (doublons.length) avertissements.push(`Numéros de lot en double : ${doublons.slice(0, 8).map(([k, ns]) => `${k} (lignes ${ns.join(", ")})`).join(" ; ")}${doublons.length > 8 ? "…" : ""}.`);
    const copro = await db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { totalTantiemes: true, nbLots: true } });
    if (copro?.totalTantiemes && toutesTantiemes && !sommeTantiemes.equals(money(copro.totalTantiemes.toString()))) avertissements.push(`La somme des tantièmes du fichier (${sommeTantiemes.toFixed(2)}) diffère du total du règlement (${money(copro.totalTantiemes.toString()).toFixed(2)}).`);
    else if (!copro?.totalTantiemes && toutesTantiemes) avertissements.push(`Somme des tantièmes du fichier : ${sommeTantiemes.toFixed(2)} — renseignez le total du règlement dans Paramètres pour la contrôler.`);
    const multiLots = [...parTelephone.entries()].filter(([, noms]) => noms.size > 1);
    if (multiLots.length) avertissements.push(`Un même téléphone porte des noms différents : ${multiLots.slice(0, 5).map(([t, noms]) => `${t} (${[...noms].join(" / ")})`).join(" ; ")} — traités comme la même personne.`);
    const memePersonne = [...parTelephone.entries()].filter(([t]) => tableur.lignes.filter((l) => normaliserTelephone(projeter(mapping, l.valeurs).telephone) === t).length > 1).length;
    if (memePersonne) avertissements.push(`${memePersonne} propriétaire(s) présent(s) sur plusieurs lots (même téléphone) : une seule invitation, tous les lots rattachés.`);
  }
  if (job.type === "SOLDES_OUVERTURE" && !options.date_reference && !mapping.some((m) => m.champ === "date_reference")) avertissements.push("Aucune date de référence : la date du jour sera utilisée (modifiable dans les options du mapping).");
  const apercu = { entetes: tableur.entetes, feuille: tableur.feuille, colonnes: mapping, lignes, avertissements, champs: CHAMPS[job.type].map((ch) => ({ cle: ch.cle, requis: ch.requis, libelle: ch.libelle })) };
  const statut = requisManquants.length ? "ANALYSE" : "PRET";
  await db.importJob.update({ where: { id: job.id }, data: { statut, mappingJson: { colonnes: mapping, options } as Prisma.InputJsonValue, apercuJson: apercu as Prisma.InputJsonValue, nbLignes: tableur.lignes.length, nbErreurs, nbTraitees: 0 } });
  await log(db, ctx, job.id, "ANALYSE", { details: { nb_lignes: tableur.lignes.length, nb_erreurs: nbErreurs, requis_manquants: requisManquants } });
  return statut;
}

type JobRow = Prisma.ImportJobGetPayload<Record<string, never>> & { document: { id: string; nom: string; storagePath: string }; lancePar: Identite | null };
function presenter(j: JobRow, detail = false) {
  return { id: j.id, coproprieteId: j.coproprieteId, type: j.type, statut: j.statut, nomFichier: j.document.nom, documentId: j.document.id, nbLignes: j.nbLignes, nbTraitees: j.nbTraitees, nbErreurs: j.nbErreurs, mapping: detail ? j.mappingJson : undefined, apercu: detail ? j.apercuJson : undefined, resultat: j.resultatJson, lancePar: j.lancePar, creeLe: j.creeLe, termineLe: j.termineLe };
}
/** Le fichier source est SYNDIC_ONLY et le lanceur peut être invisible (RLS) : lectures tolérantes, jamais un include obligatoire. */
async function decorer(db: TenantDb, rows: Prisma.ImportJobGetPayload<Record<string, never>>[]): Promise<JobRow[]> {
  const docs = new Map((await db.document.findMany({ where: { id: { in: rows.map((r) => r.documentId) } }, select: { id: true, nom: true, storagePath: true } })).map((d) => [d.id, d]));
  const noms = await identites(db, rows.map((r) => r.lanceParId));
  return rows.map((r) => ({ ...r, document: docs.get(r.documentId) ?? { id: r.documentId, nom: `import-${r.type.toLowerCase()}`, storagePath: "" }, lancePar: noms.get(r.lanceParId) ?? null }));
}
async function charger(db: TenantDb, id: string) {
  const j = await db.importJob.findUnique({ where: { id } });
  if (!j) throw new IntrouvableError("Import introuvable.");
  return (await decorer(db, [j]))[0]!;
}

export async function preparerUploadImport(ctx: TenantContext, input: ImportUploadUrlInput) {
  assertGerer(ctx);
  return preparerUploadModule(ctx, "import", input.nom_fichier);
}

/** POST /import — attache le fichier (IMPORT_SOURCE, syndic seul), lit et analyse immédiatement. */
export async function creerImport(ctx: TenantContext, input: ImportCreateInput) {
  assertGerer(ctx);
  const buffer = await telechargerObjet(input.storage_path);
  let tableur: Tableur;
  try { tableur = await lireTableur(buffer, input.nom_fichier); } catch (e) { throw new ImportError("IMPORT_FICHIER_ILLISIBLE", `Fichier illisible : ${e instanceof Error ? e.message : String(e)}`); }
  if (tableur.lignes.length === 0) throw new ImportError("IMPORT_FICHIER_ILLISIBLE", "Le fichier ne contient aucune ligne de données sous l'en-tête.");
  if (tableur.lignes.length > 5000) throw new ImportError("IMPORT_FICHIER_ILLISIBLE", "5 000 lignes maximum par import — découpez le fichier.");
  return withTenant(ctx, async (db) => {
    const doc = await attacherDocument(db, ctx, { module: "import", type: "IMPORT_SOURCE", nom: input.nom_fichier, storagePath: input.storage_path, visibilite: "SYNDIC_ONLY" });
    const job = await db.importJob.create({ data: { coproprieteId: ctx.coproprieteId, type: input.type, documentId: doc.id, lanceParId: ctx.utilisateurId, mappingJson: input.options ? ({ colonnes: [], options: input.options } as Prisma.InputJsonValue) : undefined } });
    await log(db, ctx, job.id, "CREE", { details: { type: input.type, nom_fichier: input.nom_fichier } });
    await audit(db, ctx, "IMPORT_CREE", job.id, { type: input.type, nom_fichier: input.nom_fichier, nb_lignes: tableur.lignes.length });
    await analyser(db, ctx, { id: job.id, type: input.type, mappingJson: job.mappingJson }, tableur);
    return presenter(await charger(db, job.id), true);
  });
}

export async function listerImports(ctx: TenantContext, filtres: ImportsFiltres) {
  assertLire(ctx);
  return withTenant(ctx, async (db) => (await decorer(db, await db.importJob.findMany({ where: { coproprieteId: ctx.coproprieteId, ...(filtres.type ? { type: filtres.type } : {}), ...(filtres.statut ? { statut: filtres.statut } : {}) }, orderBy: { creeLe: "desc" }, take: 100 }))).map((j) => presenter(j)));
}
export async function obtenirImport(ctx: TenantContext, id: string) {
  assertLire(ctx);
  return withTenant(ctx, async (db) => presenter(await charger(db, id), true));
}
export async function apercuImport(ctx: TenantContext, id: string) {
  assertLire(ctx);
  return withTenant(ctx, async (db) => { const j = await charger(db, id); return { id: j.id, type: j.type, statut: j.statut, nbLignes: j.nbLignes, nbErreurs: j.nbErreurs, mapping: j.mappingJson, apercu: j.apercuJson }; });
}

/** PATCH /import/{id}/mapping — le syndic corrige les colonnes ; ré-analyse. */
export async function modifierMapping(ctx: TenantContext, id: string, input: ImportMappingInput) {
  assertGerer(ctx);
  const j0 = await withTenant(ctx, (db) => charger(db, id));
  if (!["TELEVERSE", "ANALYSE", "PRET"].includes(j0.statut)) throw new ImportError("IMPORT_STATUT_INVALIDE", `Le mapping ne se modifie plus (statut ${j0.statut}).`);
  const champsValides = new Set(CHAMPS[j0.type].map((c) => c.cle));
  const vus = new Set<string>();
  for (const c of input.colonnes) { if (c.champ && !champsValides.has(c.champ)) throw new ImportError("VALIDATION_ERROR", `Champ inconnu : ${c.champ}.`); if (c.champ && vus.has(c.champ)) throw new ImportError("VALIDATION_ERROR", `Champ associé deux fois : ${c.champ}.`); if (c.champ) vus.add(c.champ); }
  const tableur = await lireTableur(await telechargerObjet(j0.document.storagePath), j0.document.nom);
  return withTenant(ctx, async (db) => {
    const ancien = (j0.mappingJson as { options?: OptionsImport } | null)?.options ?? {};
    const mapping = { colonnes: input.colonnes.map((c) => ({ index: c.index, entete: tableur.entetes[c.index] ?? "", champ: c.champ })), options: { ...ancien, ...(input.options ?? {}) } };
    await db.importJob.update({ where: { id }, data: { mappingJson: mapping as Prisma.InputJsonValue } });
    await log(db, ctx, id, "MAPPING", { details: { colonnes: mapping.colonnes.filter((c) => c.champ).map((c) => `${c.index}:${c.champ}`) } });
    await analyser(db, ctx, { id, type: j0.type, mappingJson: mapping as Prisma.JsonValue }, tableur);
    return presenter(await charger(db, id), true);
  });
}

/** POST /import/{id}/executer — passe EN_COURS et délègue au job (ou exécute en ligne pour les tests / petits fichiers). */
export async function lancerImport(ctx: TenantContext, id: string, opts: { enLigne?: boolean } = {}) {
  assertGerer(ctx);
  const job = await withTenant(ctx, async (db) => {
    const j = await charger(db, id);
    if (j.statut !== "PRET") throw new ImportError("IMPORT_STATUT_INVALIDE", j.statut === "ANALYSE" ? "Des colonnes obligatoires manquent : corrigez le mapping." : `Import non exécutable (statut ${j.statut}).`);
    await db.importJob.update({ where: { id }, data: { statut: "EN_COURS", nbTraitees: 0, resultatJson: Prisma.DbNull } });
    await log(db, ctx, id, "LANCE");
    await audit(db, ctx, "IMPORT_LANCE", id, { type: j.type, nb_lignes: j.nbLignes });
    return j;
  });
  if (opts.enLigne) return executerImport(ctx, id);
  await emitEvent("import/executer", { copropriete_id: ctx.coproprieteId, import_job_id: id, utilisateur_id: ctx.utilisateurId });
  return presenter({ ...job, statut: "EN_COURS" }, false);
}

/** Exécution complète par chunks — appelée par le job Inngest (contexte du lanceur) ou en ligne. Rejouable. */
export async function executerImport(ctx: TenantContext, id: string) {
  const j0 = await withTenant(ctx, (db) => charger(db, id));
  if (j0.statut !== "EN_COURS") throw new ImportError("IMPORT_STATUT_INVALIDE", `Import non en cours (statut ${j0.statut}).`);
  const type = j0.type as TypeImport;
  const mapping = (j0.mappingJson as { colonnes: Mapping; options?: OptionsImport } | null) ?? { colonnes: [], options: {} };
  const options = mapping.options ?? {};
  const tableur = await lireTableur(await telechargerObjet(j0.document.storagePath), j0.document.nom);
  const resume = { crees: 0, mis_a_jour: 0, ignorees: 0, erreurs: [] as { n: number; message: string }[], deja_appliquees: 0 };
  try {
    for (let debut = 0; debut < tableur.lignes.length; debut += TAILLE_CHUNK) {
      const chunk = tableur.lignes.slice(debut, debut + TAILLE_CHUNK);
      const continuer = await withTenant(ctx, async (db) => {
        const etat = await db.importJob.findUnique({ where: { id }, select: { statut: true } });
        if (etat?.statut !== "EN_COURS") return false; // annulé entre deux chunks
        const cache: CacheImport = new Map();
        const hashes = chunk.map((l) => empreinte(type, projeter(mapping.colonnes, l.valeurs)));
        const dejas = new Set((await db.importJobLog.findMany({ where: { coproprieteId: ctx.coproprieteId, hash: { in: hashes }, resultat: { in: ["CREE", "MIS_A_JOUR", "IGNOREE"] } }, select: { hash: true } })).map((x) => x.hash!));
        for (const [i, l] of chunk.entries()) {
          const champs = projeter(mapping.colonnes, l.valeurs);
          const hash = hashes[i]!;
          if (dejas.has(hash)) { resume.deja_appliquees++; continue; }
          const v = validerLigne(type, champs);
          if (v.erreurs.length) { resume.erreurs.push({ n: l.n, message: v.erreurs.join(" ") }); await log(db, ctx, id, "LIGNE", { ligne: l.n, hash, resultat: "ERREUR", details: { message: v.erreurs.join(" ") } }); continue; }
          // Point de sauvegarde par ligne : une ligne en erreur (contrainte, trigger) n'annule pas le chunk.
          await db.$executeRawUnsafe("SAVEPOINT import_ligne");
          try {
            const r = await EXECUTEURS[type](db, ctx, champs, options, cache, id);
            await db.$executeRawUnsafe("RELEASE SAVEPOINT import_ligne");
            if (r.resultat === "CREE") resume.crees++; else if (r.resultat === "MIS_A_JOUR") resume.mis_a_jour++; else resume.ignorees++;
            await log(db, ctx, id, "LIGNE", { ligne: l.n, hash, resultat: r.resultat, details: r.details });
          } catch (e) {
            await db.$executeRawUnsafe("ROLLBACK TO SAVEPOINT import_ligne");
            cache.clear();
            const message = e instanceof LigneError ? e.message : e instanceof Prisma.PrismaClientKnownRequestError ? `Contrainte de données (${e.code}${e.meta?.target ? ` : ${JSON.stringify(e.meta.target)}` : ""}).` : e instanceof Prisma.PrismaClientUnknownRequestError ? (e.message.match(/message: \\?"([^"\\]+)/)?.[1] ?? e.message.match(/(Somme[^"\n]*|violates[^"\n]*)/)?.[1] ?? "Contrainte de données.") : ((e as Error).message ?? "Erreur inconnue");
            if (!(e instanceof LigneError) && !(e instanceof Prisma.PrismaClientKnownRequestError) && !(e instanceof Prisma.PrismaClientUnknownRequestError)) throw e;
            resume.erreurs.push({ n: l.n, message });
            await log(db, ctx, id, "LIGNE", { ligne: l.n, hash, resultat: "ERREUR", details: { message } });
          }
        }
        await db.importJob.update({ where: { id }, data: { nbTraitees: Math.min(debut + chunk.length, tableur.lignes.length), nbErreurs: resume.erreurs.length } });
        return true;
      });
      if (!continuer) return withTenant(ctx, (db) => charger(db, id).then((j) => presenter(j, true)));
    }
  } catch (e) {
    await withTenant(ctx, async (db) => {
      await db.importJob.update({ where: { id }, data: { statut: "ECHOUE", termineLe: new Date(), resultatJson: { ...resume, echec: e instanceof Error ? e.message : String(e) } as Prisma.InputJsonValue } });
      await log(db, ctx, id, "ECHEC", { details: { message: e instanceof Error ? e.message : String(e) } });
      await audit(db, ctx, "IMPORT_ECHOUE", id, { message: e instanceof Error ? e.message : String(e) });
    });
    throw e;
  }
  return withTenant(ctx, async (db) => {
    await db.importJob.update({ where: { id }, data: { statut: "TERMINE", termineLe: new Date(), nbTraitees: tableur.lignes.length, nbErreurs: resume.erreurs.length, resultatJson: resume as Prisma.InputJsonValue } });
    await log(db, ctx, id, "TERMINE", { details: { crees: resume.crees, mis_a_jour: resume.mis_a_jour, ignorees: resume.ignorees, erreurs: resume.erreurs.length, deja_appliquees: resume.deja_appliquees } });
    await audit(db, ctx, "IMPORT_TERMINE", id, { type, crees: resume.crees, mis_a_jour: resume.mis_a_jour, ignorees: resume.ignorees, erreurs: resume.erreurs.length });
    await envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: j0.lanceParId, templateCode: "IMPORT_TERMINE", canal: "PUSH", contenuJson: { import_job_id: id, type, crees: String(resume.crees), mis_a_jour: String(resume.mis_a_jour), erreurs: String(resume.erreurs.length) } });
    return presenter(await charger(db, id), true);
  });
}

export async function annulerImport(ctx: TenantContext, id: string) {
  assertGerer(ctx);
  return withTenant(ctx, async (db) => {
    const j = await charger(db, id);
    if (["TERMINE", "ECHOUE", "ANNULE"].includes(j.statut)) throw new ImportError("IMPORT_STATUT_INVALIDE", `Import déjà ${j.statut}.`);
    await db.importJob.update({ where: { id }, data: { statut: "ANNULE", termineLe: new Date() } });
    await log(db, ctx, id, "ANNULE", { details: { depuis: j.statut, nb_traitees: j.nbTraitees } });
    await audit(db, ctx, "IMPORT_ANNULE", id, { depuis: j.statut, nb_traitees: j.nbTraitees });
    return presenter(await charger(db, id), true);
  });
}

/** GET /import/{id}/rapport.csv — résultat ligne à ligne (journal LIGNE). */
export const ENTETES_RAPPORT = ["ligne", "resultat", "message", "details"];
export async function rapportImport(ctx: TenantContext, id: string): Promise<{ entetes: string[]; lignes: (string | number)[][] }> {
  assertLire(ctx);
  return withTenant(ctx, async (db) => {
    await charger(db, id);
    const logs = await db.importJobLog.findMany({ where: { importJobId: id, type: "LIGNE" }, orderBy: [{ ligne: "asc" }, { horodatage: "asc" }] });
    return { entetes: ENTETES_RAPPORT, lignes: logs.map((l) => { const d = (l.detailsJson ?? {}) as Record<string, unknown>; return [l.ligne ?? "", l.resultat ?? "", String(d.message ?? ""), JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => k !== "message")))]; }) };
  });
}
