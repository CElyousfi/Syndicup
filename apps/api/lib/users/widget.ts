/**
 * GET /users/me/widget — instantané compact pour les widgets d'écran d'accueil et d'écran
 * verrouillé du mobile (Android AppWidget / iOS WidgetKit). Un seul appel, lecture seule,
 * aucune pagination : l'app le copie tel quel dans le stockage partagé des widgets.
 *
 * Chaque bloc n'est renseigné que si le rôle y a droit (même matrice `can` que les écrans) ;
 * la RLS reste la seconde couche. Les montants sont des chaînes décimales (jamais de float).
 */
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { composerCharges, composerRecouvrement, CATEGORIES_URGENTES, type WidgetAg, type WidgetCharges, type WidgetGardien, type WidgetResidence, type WidgetSnapshot } from "./widget-compose";

export { type WidgetSnapshot } from "./widget-compose";
export class PermissionRefuseeError extends Error {}

// ── Chargement ───────────────────────────────────────────────────────────────

const RESIDENCE_ROLES = new Set(["SYNDIC", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE", "SUPER_ADMIN"]);
const CHARGES_ROLES = new Set(["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT"]);

async function lotsDe(db: TenantDb, ctx: TenantContext) {
  const rows = await db.lotProprietaire.findMany({
    where: { utilisateurId: ctx.utilisateurId, dateFin: null, lot: { coproprieteId: ctx.coproprieteId } },
    select: { lotId: true },
  });
  return Array.from(new Set<string>(rows.map((r: { lotId: string }) => r.lotId)));
}

async function chargerCharges(db: TenantDb, ctx: TenantContext): Promise<WidgetCharges | null> {
  if (!CHARGES_ROLES.has(ctx.role) || can("finances.voir_solde_lot", ctx.role) === false) return null;
  const lotIds = await lotsDe(db, ctx);
  if (!lotIds.length) return null;
  const lignes = await db.appelDeFondsLot.findMany({
    where: { lotId: { in: lotIds } },
    select: { lotId: true, montantDu: true, montantPaye: true, statut: true, appelDeFonds: { select: { dateEcheance: true, statut: true } } },
  });
  return composerCharges(
    lotIds,
    lignes.map((l) => ({ lotId: l.lotId, montantDu: l.montantDu, montantPaye: l.montantPaye, statut: l.statut, dateEcheance: l.appelDeFonds.dateEcheance, appelStatut: l.appelDeFonds.statut }))
  );
}

async function chargerAg(db: TenantDb, ctx: TenantContext): Promise<WidgetAg | null> {
  if (can("ag.lire", ctx.role) !== true) return null;
  const ag = await db.assembleeGenerale.findFirst({
    where: { coproprieteId: ctx.coproprieteId, statut: { in: ["PLANIFIEE", "CONVOQUEE", "EN_COURS"] } },
    orderBy: [{ dateAg: "asc" }],
    select: { id: true, type: true, dateAg: true, statut: true, _count: { select: { resolutions: true } } },
  });
  if (!ag) return null;
  let votees = 0;
  if (ag.statut === "EN_COURS" && CHARGES_ROLES.has(ctx.role)) {
    const lotIds = await lotsDe(db, ctx);
    if (lotIds.length) {
      const votes = await db.agVote.findMany({ where: { lotId: { in: lotIds }, resolution: { agId: ag.id } }, select: { resolutionId: true } });
      votees = new Set(votes.map((v) => v.resolutionId)).size;
    }
  }
  return { id: ag.id, type: ag.type, date_ag: ag.dateAg.toISOString(), statut: ag.statut, nb_resolutions: ag._count.resolutions, nb_votees: votees };
}

async function chargerResidence(db: TenantDb, ctx: TenantContext): Promise<WidgetResidence | null> {
  if (!RESIDENCE_ROLES.has(ctx.role)) return null;
  const now = new Date();
  const [appels, lignes, incidentsOuverts, slaDepasse, aValider] = await Promise.all([
    db.appelDeFonds.findMany({ where: { coproprieteId: ctx.coproprieteId }, select: { id: true, periode: true, statut: true } }),
    db.appelDeFondsLot.findMany({ where: { appelDeFonds: { coproprieteId: ctx.coproprieteId } }, select: { appelDeFondsId: true, montantDu: true, montantPaye: true } }),
    db.incident.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["OUVERT", "EN_COURS"] } } }),
    db.incident.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["OUVERT", "EN_COURS"] }, slaDeadline: { lt: now } } }),
    db.reservationEspaceCommun.count({ where: { espace: { coproprieteId: ctx.coproprieteId }, statut: "EN_ATTENTE" } }).catch(() => 0),
  ]);
  const r = composerRecouvrement(appels, lignes);
  return { ...r, incidents_ouverts: incidentsOuverts, incidents_sla_depasse: slaDepasse, reservations_a_valider: aValider };
}

async function chargerAffichage(db: TenantDb, ctx: TenantContext): Promise<WidgetSnapshot["affichage"]> {
  if (can("annonces.lire", ctx.role) !== true) return null;
  const now = new Date();
  const where = { coproprieteId: ctx.coproprieteId, statut: "PUBLIEE" as const, OR: [{ expireLe: null }, { expireLe: { gt: now } }] };
  const [rows, nonLues] = await Promise.all([
    db.annonce.findMany({ where, orderBy: [{ epingle: "desc" }, { publieLe: "desc" }], take: 3, select: { id: true, titre: true, categorie: true, publieLe: true, lectures: { where: { utilisateurId: ctx.utilisateurId }, select: { id: true } } } }),
    db.annonce.count({ where: { ...where, lectures: { none: { utilisateurId: ctx.utilisateurId } } } }),
  ]);
  return {
    non_lues: nonLues,
    annonces: rows.map((a) => ({ id: a.id, titre: a.titre, categorie: a.categorie, urgent: CATEGORIES_URGENTES.has(a.categorie), publie_le: a.publieLe?.toISOString() ?? null, lu: a.lectures.length > 0 })),
  };
}

async function chargerGardien(db: TenantDb, ctx: TenantContext): Promise<WidgetGardien | null> {
  if (ctx.role !== "GARDIEN") return null;
  const debut = new Date();
  debut.setUTCHours(0, 0, 0, 0);
  const fin = new Date(debut.getTime() + 24 * 60 * 60 * 1000);
  const [visites, arrivees, departs, incidents] = await Promise.all([
    db.visite.count({ where: { coproprieteId: ctx.coproprieteId, statut: "EN_ATTENTE" } }),
    db.sejourCourteDuree.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["PREVU", "EN_COURS"] }, dateArrivee: { gte: debut, lt: fin } } }).catch(() => 0),
    db.sejourCourteDuree.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["PREVU", "EN_COURS"] }, dateDepart: { gte: debut, lt: fin } } }).catch(() => 0),
    db.incident.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["OUVERT", "EN_COURS"] } } }),
  ]);
  return { visites_en_attente: visites, arrivees_lcd_aujourdhui: arrivees, departs_lcd_aujourdhui: departs, incidents_ouverts: incidents };
}

export async function instantaneWidget(ctx: TenantContext): Promise<WidgetSnapshot> {
  return withTenant(ctx, async (db) => {
    const [copro, charges, ag, residence, affichage, gardien] = await Promise.all([
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { id: true, nom: true } }),
      chargerCharges(db, ctx),
      chargerAg(db, ctx),
      chargerResidence(db, ctx),
      chargerAffichage(db, ctx),
      chargerGardien(db, ctx),
    ]);
    return {
      genere_le: new Date().toISOString(),
      role: ctx.role,
      copropriete: copro ? { id: copro.id, nom: copro.nom } : null,
      charges,
      ag,
      residence,
      affichage,
      gardien,
    };
  });
}
