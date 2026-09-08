/**
 * Jobs Parkings — M23.
 *  - `parkings-quotidien` (07:00) : attributions temporaires / à durée arrivées à échéance → emplacement
 *    libéré (DISPONIBLE) + `ATTRIBUTION_EXPIREE` aux résidents du lot (une fois : `expiree_notifiee_le`) ;
 *    attributions dont le début est arrivé → emplacement ATTRIBUE ; visiteurs au-delà de `heure_limite`
 *    → `VISITEUR_DEPASSEMENT` au gardien (une fois par visite, via la notification existante).
 *  - `parkings-redevances-mensuel` (1er du mois, 06:00) : appel de fonds REDEVANCE_PARKING pour la période
 *    (YYYY-MM) = somme des redevances mensuelles des attributions actives ce mois, une ligne par lot ;
 *    idempotent via l'unicité (copropriete_id, periode, type) ; fan-out `finances/appel_de_fonds.emis`.
 * Une transaction tenant (contexte système) par copropriété.
 */
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { envoyerNotification } from "../notifications/notifications";
import { ecrireAuditLog } from "../audit/audit";
import { emitEvent } from "../events/emit";
import { money, toApiString } from "../money";
import { dateUtc, gardiens, isoDate, residentsDuLot } from "./parkings";

const SYSTEME = "00000000-0000-0000-0000-000000000000";
const ctxSysteme = (coproprieteId: string): TenantContext => ({ utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" });

export async function executerParkingsQuotidien(db: TenantDb, coproprieteId: string, now = new Date()): Promise<{ expirees: number; demarrees: number; depassements: number }> {
  const res = { expirees: 0, demarrees: 0, depassements: 0 };
  const aujourdhui = dateUtc(isoDate(now));
  // 1. Attributions expirées (date_fin < aujourd'hui) non encore notifiées.
  const expirees = await db.attributionEmplacement.findMany({ where: { coproprieteId, dateFin: { lt: aujourdhui }, expireeNotifieeLe: null }, include: { emplacement: { select: { id: true, code: true, statut: true } } } });
  for (const a of expirees) {
    const autre = await db.attributionEmplacement.findFirst({ where: { emplacementId: a.emplacementId, id: { not: a.id }, dateDebut: { lte: aujourdhui }, OR: [{ dateFin: null }, { dateFin: { gte: aujourdhui } }] }, select: { id: true } });
    if (!autre && a.emplacement.statut === "ATTRIBUE") await db.emplacement.update({ where: { id: a.emplacementId }, data: { statut: "DISPONIBLE" } });
    await db.attributionEmplacement.update({ where: { id: a.id }, data: { expireeNotifieeLe: now } });
    for (const u of await residentsDuLot(db, a.lotId)) {
      await envoyerNotification(db, { coproprieteId, utilisateurId: u, templateCode: "ATTRIBUTION_EXPIREE", canal: "PUSH", contenuJson: { emplacement_id: a.emplacementId, code: a.emplacement.code, date_fin: isoDate(a.dateFin!) } });
    }
    await ecrireAuditLog(db, { coproprieteId, acteurId: null, action: "EMPLACEMENT_LIBERE", entite: "emplacement", entiteId: a.emplacementId, avant: { attribution_id: a.id }, apres: { motif: "EXPIRATION", date_fin: isoDate(a.dateFin!) } });
    res.expirees += 1;
  }
  // 2. Attributions dont le début est arrivé : l'emplacement passe ATTRIBUE.
  const actives = await db.attributionEmplacement.findMany({ where: { coproprieteId, dateDebut: { lte: aujourdhui }, OR: [{ dateFin: null }, { dateFin: { gte: aujourdhui } }], emplacement: { statut: "DISPONIBLE" } }, select: { emplacementId: true }, distinct: ["emplacementId"] });
  for (const a of actives) {
    await db.emplacement.update({ where: { id: a.emplacementId }, data: { statut: "ATTRIBUE" } });
    res.demarrees += 1;
  }
  // 3. Visiteurs au-delà de l'heure limite (aujourd'hui) → gardiens, une fois par visite.
  const depassees = await db.visite.findMany({ where: { coproprieteId, emplacementId: { not: null }, heureLimite: { lt: now, gte: aujourdhui } }, include: { emplacement: { select: { code: true } }, lot: { select: { numero: true } } } });
  const gard = await gardiens(db, coproprieteId);
  for (const v of depassees) {
    const deja = await db.notification.findFirst({ where: { coproprieteId, templateCode: "VISITEUR_DEPASSEMENT", contenuJson: { path: ["visite_id"], equals: v.id } }, select: { id: true } });
    if (deja) continue;
    for (const u of gard) {
      await envoyerNotification(db, { coproprieteId, utilisateurId: u, templateCode: "VISITEUR_DEPASSEMENT", canal: "PUSH", contenuJson: { visite_id: v.id, code: v.emplacement?.code ?? "", visiteur: v.visiteurNom, lot: v.lot.numero, immatriculation: v.immatriculation ?? "—", heure_limite: v.heureLimite!.toISOString().slice(11, 16) } });
    }
    res.depassements += 1;
  }
  return res;
}

/** Redevances mensuelles → appel de fonds REDEVANCE_PARKING (période YYYY-MM). */
export async function executerRedevancesParking(db: TenantDb, coproprieteId: string, now = new Date()): Promise<{ appels: number; lignes: number }> {
  const periode = now.toISOString().slice(0, 7);
  const debutMois = dateUtc(`${periode}-01`);
  const finMois = new Date(Date.UTC(debutMois.getUTCFullYear(), debutMois.getUTCMonth() + 1, 0));
  const deja = await db.appelDeFonds.findUnique({ where: { coproprieteId_periode_type: { coproprieteId, periode, type: "REDEVANCE_PARKING" } }, select: { id: true } });
  if (deja) return { appels: 0, lignes: 0 };
  const attributions = await db.attributionEmplacement.findMany({ where: { coproprieteId, redevanceMensuelle: { gt: 0 }, dateDebut: { lte: finMois }, OR: [{ dateFin: null }, { dateFin: { gte: debutMois } }] }, select: { lotId: true, redevanceMensuelle: true, emplacement: { select: { code: true } } } });
  if (!attributions.length) return { appels: 0, lignes: 0 };
  const parLot = new Map<string, { montant: ReturnType<typeof money>; codes: string[] }>();
  for (const a of attributions) {
    const cur = parLot.get(a.lotId) ?? { montant: money(0), codes: [] };
    cur.montant = cur.montant.plus(money(a.redevanceMensuelle!.toString()));
    cur.codes.push(a.emplacement.code);
    parLot.set(a.lotId, cur);
  }
  const total = [...parLot.values()].reduce((acc, v) => acc.plus(v.montant), money(0));
  const echeance = new Date(Date.UTC(debutMois.getUTCFullYear(), debutMois.getUTCMonth(), 15));
  const appel = await db.appelDeFonds.create({ data: { coproprieteId, periode, type: "REDEVANCE_PARKING", montantTotal: total.toString(), dateEcheance: echeance, statut: "EMIS", lignes: { create: [...parLot.entries()].map(([lotId, v]) => ({ lotId, montantDu: v.montant.toString() })) } } });
  await ecrireAuditLog(db, { coproprieteId, acteurId: null, action: "APPEL_DE_FONDS_EMIS", entite: "appel_de_fonds", entiteId: appel.id, apres: { periode, type: "REDEVANCE_PARKING", montant_total: toApiString(total), emplacements: [...parLot.values()].flatMap((v) => v.codes) } });
  await emitEvent("finances/appel_de_fonds.emis", { copropriete_id: coproprieteId, appel_de_fonds_id: appel.id });
  return { appels: 1, lignes: parLot.size };
}

export const executerParkingsQuotidienCopropriete = (coproprieteId: string, now = new Date()) => withTenant(ctxSysteme(coproprieteId), (db) => executerParkingsQuotidien(db, coproprieteId, now));
export const executerRedevancesParkingCopropriete = (coproprieteId: string, now = new Date()) => withTenant(ctxSysteme(coproprieteId), (db) => executerRedevancesParking(db, coproprieteId, now));

async function pourToutes<T extends Record<string, number>>(fn: (id: string) => Promise<T>) {
  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const total = { coproprietes: 0, compteurs: {} as Record<string, number>, erreurs: [] as string[] };
  try {
    for (const { id } of await raw.copropriete.findMany({ where: { statut: "ACTIVE" }, select: { id: true } })) {
      total.coproprietes += 1;
      try {
        const r = await fn(id);
        for (const [k, v] of Object.entries(r)) total.compteurs[k] = (total.compteurs[k] ?? 0) + v;
      } catch (e) {
        total.erreurs.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return total;
  } finally {
    await raw.$disconnect();
  }
}
export const executerParkingsQuotidienToutesCoproprietes = (now = new Date()) => pourToutes((id) => executerParkingsQuotidienCopropriete(id, now));
export const executerRedevancesParkingToutesCoproprietes = (now = new Date()) => pourToutes((id) => executerRedevancesParkingCopropriete(id, now));
