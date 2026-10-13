/**
 * Dari — le DOSSIER de l'utilisateur : ce que Dari sait de la personne connectée et de sa
 * résidence, au moment de la question. Chargé dans UNE transaction tenant (RLS en seconde
 * couche), bloc par bloc selon le rôle (même matrice `can` que les écrans) ; chaque liste est
 * bornée pour tenir dans le budget de jetons du modèle.
 *
 * Confidentialité (CNDP, transfert vers Groq hors Maroc) :
 *  - l'utilisateur est désigné par son prénom et son rôle, jamais par e-mail, téléphone ni id ;
 *  - les AUTRES personnes n'apparaissent jamais nommément : un copropriétaire en retard est
 *    « lot B-12 », un visiteur est « visiteur pour le lot 4 », un employé est « agent de
 *    sécurité » ; aucune plaque, aucune pièce d'identité, aucun RIB ;
 *  - aucun identifiant technique (uuid) ne sort : les écrans sont désignés par leur clé.
 * Les montants sont des chaînes décimales (lib/money), jamais des floats.
 */
import type { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import type { Role } from "../auth/permissions";
import { money, toApiString } from "../money";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { composerCharges, composerRecouvrement, CATEGORIES_URGENTES, type WidgetSnapshot } from "../users/widget-compose";

export interface Dossier extends WidgetSnapshot {
  moi: {
    prenom: string | null;
    langue: "FR" | "AR";
    /** Lots de l'utilisateur (propriétaire ou occupant) : « B-12 (3e) ». */
    lots: Array<{ libelle: string; tantiemes: string | null; occupation: "proprietaire" | "locataire" }>;
    cabinet: string | null;
  };
  residenceInfo: { nom: string; ville: string; type: string; nb_lots: number; total_tantiemes: string | null } | null;
  /** Appels de fonds de MES lots (résident) — 6 derniers émis. */
  mes_appels: Array<{ periode: string; type: string; echeance: string; du: string; paye: string; reste: string; statut: string; conteste: boolean; lot: string }> | null;
  mes_paiements: Array<{ date: string; montant: string; methode: string; statut: string }> | null;
  mes_justificatifs: Array<{ date: string; montant: string; methode: string; statut: string; motif_rejet: string | null }> | null;
  mes_contestations: Array<{ periode: string; statut: string }> | null;
  incidents: Array<{ ref: string; categorie: string; sous_categorie: string; urgence: string; statut: string; cree_le: string; delai: string | null; en_retard: boolean; lot: string | null; mien: boolean }> | null;
  ag_detail: { resolutions: Array<{ ordre: number; texte: string; majorite: string; resultat: string }>; procuration_donnee: boolean; date_convocation: string | null } | null;
  mes_reservations: Array<{ espace: string; debut: string; fin: string; statut: string }> | null;
  visites: Array<{ lot: string; statut: string; quand: string; gardien_moi: boolean }> | null;
  annonces_detail: Array<{ titre: string; categorie: string; urgent: boolean; publie_le: string | null; lu: boolean; extrait: string }> | null;
  documents: Array<{ nom: string; type: string; date: string }> | null;
  gestion: {
    justificatifs_a_valider: number;
    depenses_a_approuver: Array<{ libelle: string; montant: string; categorie: string }>;
    contrats_echeance: Array<{ libelle: string; type: string; date_fin: string | null; statut: string }>;
    taches_en_retard: Array<{ titre: string; echeance: string | null; priorite: string }>;
    lots_impayes: Array<{ lot: string; reste: string; niveau_relance: string }>;
    budget: { exercice: string; montant: string; statut: string } | null;
    personnel_actif: number;
    contestations_ouvertes: number;
    reservations_a_valider: Array<{ espace: string; lot: string; debut: string }>;
  } | null;
  mes_taches: Array<{ titre: string; echeance: string | null; priorite: string; statut: string }> | null;
  sejours_lcd: Array<{ lot: string; arrivee: string; depart: string; voyageurs: number; statut: string }> | null;
}

const RESIDENTS = new Set<Role>(["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT", "LOCATAIRE"]);
const PROPRIOS = new Set<Role>(["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT"]);
const GESTION = new Set<Role>(["SYNDIC", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE", "SUPER_ADMIN"]);
const COPRO = new Set<Role>(["SYNDIC", "CONSEIL_SYNDICAL"]);

/** Dates en jj/mm/aaaa (lisibles par le modèle et par l'utilisateur, usage marocain). */
const jour = (d: Date | null | undefined) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : null);
const dateHeure = (d: Date) => `${jour(d)} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

/**
 * Libellés humains des codes (jamais un code en capitales dans ce que lit le modèle : il le
 * recopierait tel quel). Un code inconnu est rendu en minuscules.
 */
const LIBELLES: Record<string, string> = {
  // statuts
  OUVERT: "ouvert", EN_COURS: "en cours", RESOLU: "résolu", FERME: "fermé",
  PAYE: "payé", PARTIEL: "partiellement payé", IMPAYE: "impayé",
  EMIS: "émis", CLOTURE: "clôturé", BROUILLON: "brouillon",
  VALIDE: "validé", EN_ATTENTE: "en attente", REJETE: "refusé", ANNULE: "annulé",
  PLANIFIEE: "planifiée", CONVOQUEE: "convoquée (convocations envoyées)", CLOTUREE: "clôturée", ANNULEE: "annulée",
  CONFIRMEE: "confirmée", REJETEE: "refusée", AUTORISE: "autorisé", REFUSE: "refusé",
  A_APPROUVER: "à approuver", APPROUVEE: "approuvée", PAYEE: "payée",
  ACTIF: "actif", SUSPENDU: "suspendu", RESILIE: "résilié", EXPIRE: "expiré",
  A_FAIRE: "à faire", BLOQUEE: "bloquée", TERMINEE: "terminée",
  PROPOSE: "proposé (à voter en AG)", VOTE: "voté", REMPLACE: "remplacé",
  PREVU: "prévu", TERMINE: "terminé",
  OUVERTE: "ouverte", REPONDUE: "répondue", MEDIEE: "en médiation", TRIBUNAL: "au tribunal",
  // urgence, priorité, majorité, résultat
  NORMALE: "normale", URGENTE: "urgente", URGENCE_MAXIMALE: "urgence maximale",
  BASSE: "basse", MOYENNE: "moyenne", HAUTE: "haute", CRITIQUE: "critique",
  SIMPLE: "majorité simple", DOUBLE: "double majorité", UNANIMITE: "unanimité",
  ADOPTEE: "adoptée",
  // types
  ORDINAIRE: "ordinaire", EXTRAORDINAIRE: "extraordinaire", REVOCATION: "révocation du syndic",
  CHARGES_COURANTES: "charges courantes", EXCEPTIONNEL: "appel exceptionnel", FONDS_RESERVE: "fonds de réserve", REGULARISATION: "régularisation", DEMARRAGE: "démarrage", REDEVANCE_PARKING: "redevance parking", SOLDE_OUVERTURE: "solde d'ouverture",
  CMI: "carte bancaire", VIREMENT: "virement", ESPECES: "espèces", CHEQUE: "chèque",
  PLOMBERIE: "plomberie", ELECTRICITE: "électricité", ASCENSEUR: "ascenseur", NETTOYAGE: "nettoyage", SECURITE: "sécurité", STRUCTURE: "structure / bâti", JARDINS_ESPACES_VERTS: "espaces verts", NUISANCES: "nuisances", PARKING: "parking", EQUIPEMENTS_COLLECTIFS: "équipements collectifs", ADMINISTRATIF: "administratif",
  ASSURANCE_IMMEUBLE: "assurance immeuble", ASSURANCE_RC: "assurance responsabilité civile", GARDIENNAGE: "gardiennage", JARDINAGE: "jardinage", DERATISATION: "dératisation", EAU: "eau", INTERNET: "internet", SYNDIC_PROFESSIONNEL: "syndic professionnel", AUTRE: "autre",
  URGENCE: "urgence", INFORMATION: "information", TRAVAUX: "travaux", COUPURE: "coupure (eau / électricité)", AG: "assemblée générale", CONVIVIALITE: "convivialité", REGLEMENT: "règlement",
  RESIDENCE_FERMEE: "résidence fermée", IMMEUBLE_COLLECTIF: "immeuble collectif", RESIDENCE_VILLAS: "résidence de villas", IMMEUBLE_BUREAUX: "immeuble de bureaux", IMMEUBLE_MIXTE: "immeuble mixte", RESIDENCE_ETUDIANTE: "résidence étudiante",
  N0: "aucune relance", N1: "1er rappel", N2: "2e rappel", N3: "mise en demeure", N4: "escalade conseil syndical", N5: "procédure amiable", N6: "procédure judiciaire",
};
const lib = (code: string | null | undefined) => (code ? (LIBELLES[code] ?? code.toLowerCase().replace(/_/g, " ")) : code ?? null);
const pct = (x: number) => `${Math.round(x * 100)} %`;
export { pct as pourcentage, jour as dateLisible, lib as libelleCode };
const libelleLot = (l: { numero: string; batiment: string | null; etage: number | null }) =>
  `${l.batiment ? `${l.batiment}-` : ""}${l.numero}${l.etage !== null && l.etage !== undefined ? ` (étage ${l.etage})` : ""}`;
const court = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function mesLots(db: TenantDb, ctx: TenantContext) {
  const [prop, occ] = await Promise.all([
    db.lotProprietaire.findMany({
      where: { utilisateurId: ctx.utilisateurId, dateFin: null, lot: { coproprieteId: ctx.coproprieteId } },
      select: { lot: { select: { id: true, numero: true, batiment: true, etage: true, tantiemes: true } } },
    }),
    db.lotOccupant.findMany({
      where: { utilisateurId: ctx.utilisateurId, dateFin: null, lot: { coproprieteId: ctx.coproprieteId } },
      select: { lot: { select: { id: true, numero: true, batiment: true, etage: true, tantiemes: true } } },
    }),
  ]);
  const vus = new Map<string, { libelle: string; tantiemes: string | null; occupation: "proprietaire" | "locataire"; id: string }>();
  for (const p of prop) vus.set(p.lot.id, { id: p.lot.id, libelle: libelleLot(p.lot), tantiemes: p.lot.tantiemes ? toApiString(p.lot.tantiemes) : null, occupation: "proprietaire" });
  for (const o of occ) if (!vus.has(o.lot.id)) vus.set(o.lot.id, { id: o.lot.id, libelle: libelleLot(o.lot), tantiemes: null, occupation: "locataire" });
  return [...vus.values()];
}

export async function chargerDossier(ctx: TenantContext): Promise<Dossier> {
  return withTenant(ctx, async (db) => {
    const now = new Date();
    const role = ctx.role;
    const [moi, copro, lots] = await Promise.all([
      db.utilisateur.findUnique({ where: { id: ctx.utilisateurId }, select: { prenom: true, languePreferee: true, cabinets: { select: { cabinet: { select: { nom: true } } }, take: 1 } } }),
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { id: true, nom: true, ville: true, typeResidence: true, nbLots: true, totalTantiemes: true } }),
      mesLots(db, ctx),
    ]);
    const lotIds = lots.map((l) => l.id);
    const parLot = new Map(lots.map((l) => [l.id, l.libelle]));

    // ── Charges (résident propriétaire — l'occupant locataire n'a pas le solde, sauf accès accordé) ──
    let charges: Dossier["charges"] = null;
    let mes_appels: Dossier["mes_appels"] = null;
    let mes_paiements: Dossier["mes_paiements"] = null;
    let mes_justificatifs: Dossier["mes_justificatifs"] = null;
    let mes_contestations: Dossier["mes_contestations"] = null;
    if (PROPRIOS.has(role) && can("finances.voir_solde_lot", role) !== false && lotIds.length) {
      const lignes = await db.appelDeFondsLot.findMany({
        where: { lotId: { in: lotIds } },
        select: { lotId: true, montantDu: true, montantPaye: true, statut: true, conteste: true, niveauEscalade: true, appelDeFonds: { select: { periode: true, type: true, dateEcheance: true, statut: true } }, contestations: { select: { statut: true }, take: 1, orderBy: { creeLe: "desc" } } },
      });
      charges = composerCharges(lotIds, lignes.map((l) => ({ lotId: l.lotId, montantDu: l.montantDu, montantPaye: l.montantPaye, statut: l.statut, dateEcheance: l.appelDeFonds.dateEcheance, appelStatut: l.appelDeFonds.statut })));
      mes_appels = lignes
        .filter((l) => l.appelDeFonds.statut !== "BROUILLON")
        .sort((a, b) => b.appelDeFonds.dateEcheance.getTime() - a.appelDeFonds.dateEcheance.getTime())
        .slice(0, 6)
        .map((l) => ({
          periode: l.appelDeFonds.periode,
          type: lib(l.appelDeFonds.type)!,
          echeance: jour(l.appelDeFonds.dateEcheance)!,
          du: toApiString(l.montantDu),
          paye: toApiString(l.montantPaye),
          reste: toApiString(money(l.montantDu).minus(money(l.montantPaye)).lessThan(0) ? money(0) : money(l.montantDu).minus(money(l.montantPaye))),
          statut: lib(l.statut)!,
          conteste: l.conteste,
          lot: parLot.get(l.lotId) ?? "?",
        }));
      mes_contestations = lignes.filter((l) => l.contestations.length).map((l) => ({ periode: l.appelDeFonds.periode, statut: lib(l.contestations[0]!.statut)! }));
      const [paiements, justifs] = await Promise.all([
        db.paiement.findMany({ where: { lotId: { in: lotIds } }, orderBy: { horodatage: "desc" }, take: 4, select: { horodatage: true, dateValeur: true, montant: true, methode: true, statut: true } }),
        db.justificatifPaiement.findMany({ where: { lotId: { in: lotIds } }, orderBy: { creeLe: "desc" }, take: 3, select: { datePaiementDeclaree: true, montant: true, methode: true, statut: true, motifRejet: true } }),
      ]);
      mes_paiements = paiements.map((p) => ({ date: jour(p.dateValeur ?? p.horodatage)!, montant: toApiString(p.montant), methode: lib(p.methode)!, statut: lib(p.statut)! }));
      mes_justificatifs = justifs.map((j) => ({ date: jour(j.datePaiementDeclaree)!, montant: toApiString(j.montant), methode: lib(j.methode)!, statut: lib(j.statut)!, motif_rejet: j.motifRejet }));
    }

    // ── Incidents : les miens (résident / prestataire) ou tous les ouverts (gestion / gardien) ──
    let incidents: Dossier["incidents"] = null;
    if (role !== "SYNDIC_COMPTABLE") {
      const ouverts = { in: ["OUVERT" as const, "EN_COURS" as const] };
      const where: Prisma.IncidentWhereInput = GESTION.has(role) || role === "GARDIEN"
        ? { coproprieteId: ctx.coproprieteId, statut: ouverts }
        : role === "PRESTATAIRE"
          ? { coproprieteId: ctx.coproprieteId, assigneAId: ctx.utilisateurId, statut: ouverts }
          : { coproprieteId: ctx.coproprieteId, OR: [{ creePar: ctx.utilisateurId }, ...(lotIds.length ? [{ lotId: { in: lotIds } }] : [])] };
      const rows = await db.incident.findMany({
        where,
        orderBy: [{ statut: "asc" }, { creeLe: "desc" }],
        take: 6,
        select: { id: true, categorie: true, sousCategorie: true, urgence: true, statut: true, creeLe: true, slaDeadline: true, creePar: true, lot: { select: { numero: true, batiment: true, etage: true } } },
      });
      incidents = rows.map((i) => ({
        ref: i.id.slice(-6).toUpperCase(),
        categorie: lib(i.categorie)!,
        sous_categorie: court(i.sousCategorie, 60),
        urgence: lib(i.urgence)!,
        statut: lib(i.statut)!,
        cree_le: jour(i.creeLe)!,
        delai: jour(i.slaDeadline),
        en_retard: Boolean(i.slaDeadline && i.slaDeadline < now && (i.statut === "OUVERT" || i.statut === "EN_COURS")),
        lot: i.lot ? libelleLot(i.lot) : null,
        mien: i.creePar === ctx.utilisateurId,
      }));
    }

    // ── AG : la prochaine, avec ses résolutions ──
    let ag: Dossier["ag"] = null;
    let ag_detail: Dossier["ag_detail"] = null;
    if (can("ag.lire", role) === true) {
      const a = await db.assembleeGenerale.findFirst({
        where: { coproprieteId: ctx.coproprieteId, statut: { in: ["PLANIFIEE", "CONVOQUEE", "EN_COURS"] } },
        orderBy: [{ dateAg: "asc" }],
        select: { id: true, type: true, dateAg: true, dateConvocation: true, statut: true, resolutions: { orderBy: { ordre: "asc" }, take: 8, select: { ordre: true, texte: true, typeMajorite: true, resultat: true, votes: lotIds.length ? { where: { lotId: { in: lotIds } }, select: { id: true } } : false } }, _count: { select: { resolutions: true } } },
      });
      if (a) {
        const votees = a.resolutions.filter((r) => Array.isArray(r.votes) && r.votes.length > 0).length;
        ag = { id: a.id, type: a.type, date_ag: a.dateAg.toISOString(), statut: a.statut, nb_resolutions: a._count.resolutions, nb_votees: votees };
        const procuration = lotIds.length ? await db.agProcuration.count({ where: { agId: a.id, lotId: { in: lotIds } } }).catch(() => 0) : 0;
        ag_detail = {
          date_convocation: jour(a.dateConvocation),
          procuration_donnee: procuration > 0,
          resolutions: a.resolutions.map((r) => ({ ordre: r.ordre, texte: court(r.texte, 110), majorite: lib(r.typeMajorite)!, resultat: lib(r.resultat)! })),
        };
      }
    }

    // ── Réservations, visites ──
    let mes_reservations: Dossier["mes_reservations"] = null;
    if (RESIDENTS.has(role) || COPRO.has(role)) {
      const r = await db.reservationEspaceCommun.findMany({
        where: { utilisateurId: ctx.utilisateurId, dateFin: { gte: now }, statut: { in: ["EN_ATTENTE", "CONFIRMEE"] } },
        orderBy: { dateDebut: "asc" }, take: 3,
        select: { dateDebut: true, dateFin: true, statut: true, espace: { select: { nom: true } } },
      }).catch(() => []);
      mes_reservations = r.map((x) => ({ espace: x.espace.nom, debut: dateHeure(x.dateDebut), fin: dateHeure(x.dateFin), statut: lib(x.statut)! }));
    }
    let visites: Dossier["visites"] = null;
    if (role === "GARDIEN" || RESIDENTS.has(role)) {
      const v = await db.visite.findMany({
        where: role === "GARDIEN" ? { coproprieteId: ctx.coproprieteId, statut: "EN_ATTENTE" } : { coproprieteId: ctx.coproprieteId, lotId: { in: lotIds }, horodatage: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
        orderBy: { horodatage: "desc" }, take: 5,
        select: { statut: true, horodatage: true, gardienId: true, lot: { select: { numero: true, batiment: true, etage: true } } },
      });
      visites = v.map((x) => ({ lot: libelleLot(x.lot), statut: lib(x.statut)!, quand: dateHeure(x.horodatage), gardien_moi: x.gardienId === ctx.utilisateurId }));
    }

    // ── Annonces (avec extrait), documents récents ──
    let affichage: Dossier["affichage"] = null;
    let annonces_detail: Dossier["annonces_detail"] = null;
    if (can("annonces.lire", role) === true) {
      const where = { coproprieteId: ctx.coproprieteId, statut: "PUBLIEE" as const, OR: [{ expireLe: null }, { expireLe: { gt: now } }] };
      const [rows, nonLues] = await Promise.all([
        db.annonce.findMany({ where, orderBy: [{ epingle: "desc" }, { publieLe: "desc" }], take: 4, select: { id: true, titre: true, contenu: true, categorie: true, publieLe: true, lectures: { where: { utilisateurId: ctx.utilisateurId }, select: { id: true } } } }),
        db.annonce.count({ where: { ...where, lectures: { none: { utilisateurId: ctx.utilisateurId } } } }),
      ]);
      affichage = { non_lues: nonLues, annonces: rows.slice(0, 3).map((a) => ({ id: a.id, titre: a.titre, categorie: a.categorie, urgent: CATEGORIES_URGENTES.has(a.categorie), publie_le: a.publieLe?.toISOString() ?? null, lu: a.lectures.length > 0 })) };
      annonces_detail = rows.map((a) => ({ titre: a.titre, categorie: lib(a.categorie)!, urgent: CATEGORIES_URGENTES.has(a.categorie), publie_le: jour(a.publieLe), lu: a.lectures.length > 0, extrait: court(a.contenu.replace(/\s+/g, " "), 140) }));
    }
    let documents: Dossier["documents"] = null;
    if (can("documents.lire", role) !== false && role !== "PRESTATAIRE") {
      const d = await db.document.findMany({ where: { coproprieteId: ctx.coproprieteId }, orderBy: { creeLe: "desc" }, take: 4, select: { nom: true, type: true, creeLe: true } }).catch(() => []);
      documents = d.map((x) => ({ nom: court(x.nom, 60), type: lib(x.type)!, date: jour(x.creeLe)! }));
    }

    // ── Gestion (syndic / conseil / comptable) ──
    let residence: Dossier["residence"] = null;
    let gestion: Dossier["gestion"] = null;
    if (GESTION.has(role)) {
      const [appels, lignes, incidentsOuverts, slaDepasse, aValider, justifs, depenses, contrats, taches, retard, budget, personnel, contestations] = await Promise.all([
        db.appelDeFonds.findMany({ where: { coproprieteId: ctx.coproprieteId }, select: { id: true, periode: true, statut: true } }),
        db.appelDeFondsLot.findMany({ where: { appelDeFonds: { coproprieteId: ctx.coproprieteId, statut: { not: "BROUILLON" } } }, select: { appelDeFondsId: true, lotId: true, montantDu: true, montantPaye: true, niveauEscalade: true, lot: { select: { numero: true, batiment: true, etage: true } } } }),
        db.incident.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["OUVERT", "EN_COURS"] } } }),
        db.incident.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["OUVERT", "EN_COURS"] }, slaDeadline: { lt: now } } }),
        db.reservationEspaceCommun.findMany({ where: { espace: { coproprieteId: ctx.coproprieteId }, statut: "EN_ATTENTE" }, take: 3, orderBy: { dateDebut: "asc" }, select: { dateDebut: true, espace: { select: { nom: true } }, lot: { select: { numero: true, batiment: true, etage: true } } } }).catch(() => []),
        db.justificatifPaiement.count({ where: { coproprieteId: ctx.coproprieteId, statut: "EN_ATTENTE" } }).catch(() => 0),
        db.depense.findMany({ where: { coproprieteId: ctx.coproprieteId, statut: "A_APPROUVER" }, take: 4, orderBy: { creeLe: "desc" }, select: { libelle: true, montantTtc: true, categorie: true } }).catch(() => []),
        db.contrat.findMany({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["ACTIF", "BROUILLON", "SUSPENDU"] }, OR: [{ dateFin: null }, { dateFin: { lt: new Date(now.getTime() + 90 * 86_400_000) } }] }, take: 5, orderBy: { dateFin: "asc" }, select: { libelle: true, type: true, dateFin: true, statut: true } }).catch(() => []),
        db.tache.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["A_FAIRE", "EN_COURS", "BLOQUEE"] } } }).catch(() => 0),
        db.tache.findMany({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["A_FAIRE", "EN_COURS", "BLOQUEE"] }, dateEcheance: { lt: now } }, take: 4, orderBy: { dateEcheance: "asc" }, select: { titre: true, dateEcheance: true, priorite: true } }).catch(() => []),
        db.budgetAg.findFirst({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["ACTIF", "VOTE", "PROPOSE"] } }, orderBy: [{ statut: "asc" }, { exercice: "desc" }], select: { exercice: true, montantTotal: true, statut: true } }).catch(() => null),
        db.personnel.count({ where: { coproprieteId: ctx.coproprieteId, statut: "PRESENT" } }).catch(() => 0),
        db.contestationCharge.count({ where: { statut: "OUVERTE", appelDeFondsLot: { appelDeFonds: { coproprieteId: ctx.coproprieteId } } } }).catch(() => 0),
      ]);
      void taches;
      const r = composerRecouvrement(appels, lignes);
      residence = { ...r, incidents_ouverts: incidentsOuverts, incidents_sla_depasse: slaDepasse, reservations_a_valider: aValider.length };
      // Lots les plus en retard — désignés par leur numéro, jamais par le nom du propriétaire.
      const parLotImpaye = new Map<string, { lot: string; reste: ReturnType<typeof money>; niveau: string }>();
      for (const l of lignes) {
        const reste = money(l.montantDu).minus(money(l.montantPaye));
        if (!reste.greaterThan(0)) continue;
        const acc = parLotImpaye.get(l.lotId) ?? { lot: libelleLot(l.lot), reste: money(0), niveau: l.niveauEscalade };
        acc.reste = acc.reste.plus(reste);
        if (l.niveauEscalade > acc.niveau) acc.niveau = l.niveauEscalade;
        parLotImpaye.set(l.lotId, acc);
      }
      gestion = {
        justificatifs_a_valider: justifs,
        depenses_a_approuver: depenses.map((d) => ({ libelle: court(d.libelle, 50), montant: toApiString(d.montantTtc), categorie: lib(d.categorie)! })),
        contrats_echeance: contrats.map((c) => ({ libelle: court(c.libelle, 50), type: lib(c.type)!, date_fin: jour(c.dateFin), statut: lib(c.statut)! })),
        taches_en_retard: retard.map((t) => ({ titre: court(t.titre, 50), echeance: jour(t.dateEcheance), priorite: lib(t.priorite)! })),
        lots_impayes: [...parLotImpaye.values()].sort((a, b) => b.reste.minus(a.reste).toNumber()).slice(0, 5).map((x) => ({ lot: x.lot, reste: toApiString(x.reste), niveau_relance: lib(x.niveau)! })),
        budget: budget ? { exercice: budget.exercice, montant: toApiString(budget.montantTotal), statut: lib(budget.statut)! } : null,
        personnel_actif: personnel,
        contestations_ouvertes: contestations,
        reservations_a_valider: aValider.map((x) => ({ espace: x.espace.nom, lot: libelleLot(x.lot), debut: dateHeure(x.dateDebut) })),
      };
    }

    // ── Gardien / employé : ses tâches, les séjours LCD du jour ──
    let gardien: Dossier["gardien"] = null;
    let mes_taches: Dossier["mes_taches"] = null;
    let sejours_lcd: Dossier["sejours_lcd"] = null;
    if (role === "GARDIEN") {
      const debut = new Date(now); debut.setUTCHours(0, 0, 0, 0);
      const fin = new Date(debut.getTime() + 86_400_000);
      const [visitesAttente, arrivees, departs, incidentsOuverts, taches] = await Promise.all([
        db.visite.count({ where: { coproprieteId: ctx.coproprieteId, statut: "EN_ATTENTE" } }),
        db.sejourCourteDuree.findMany({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["PREVU", "EN_COURS"] }, dateArrivee: { gte: debut, lt: fin } }, take: 4, select: { dateArrivee: true, dateDepart: true, nbVoyageurs: true, statut: true, lot: { select: { numero: true, batiment: true, etage: true } } } }).catch(() => []),
        db.sejourCourteDuree.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["PREVU", "EN_COURS"] }, dateDepart: { gte: debut, lt: fin } } }).catch(() => 0),
        db.incident.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["OUVERT", "EN_COURS"] } } }),
        db.tache.findMany({ where: { coproprieteId: ctx.coproprieteId, assigneeId: ctx.utilisateurId, statut: { in: ["A_FAIRE", "EN_COURS", "BLOQUEE"] } }, take: 5, orderBy: [{ dateEcheance: "asc" }], select: { titre: true, dateEcheance: true, priorite: true, statut: true } }).catch(() => []),
      ]);
      gardien = { visites_en_attente: visitesAttente, arrivees_lcd_aujourdhui: arrivees.length, departs_lcd_aujourdhui: departs, incidents_ouverts: incidentsOuverts };
      mes_taches = taches.map((t) => ({ titre: court(t.titre, 50), echeance: jour(t.dateEcheance), priorite: lib(t.priorite)!, statut: lib(t.statut)! }));
      sejours_lcd = arrivees.map((s) => ({ lot: libelleLot(s.lot), arrivee: jour(s.dateArrivee)!, depart: jour(s.dateDepart)!, voyageurs: s.nbVoyageurs, statut: lib(s.statut)! }));
    }
    if (role === "GESTIONNAIRE_LCD" || (PROPRIOS.has(role) && lotIds.length)) {
      const s = await db.sejourCourteDuree.findMany({
        where: role === "GESTIONNAIRE_LCD" ? { coproprieteId: ctx.coproprieteId, declareParId: ctx.utilisateurId, statut: { in: ["PREVU", "EN_COURS"] } } : { coproprieteId: ctx.coproprieteId, lotId: { in: lotIds }, statut: { in: ["PREVU", "EN_COURS"] } },
        take: 3, orderBy: { dateArrivee: "asc" },
        select: { dateArrivee: true, dateDepart: true, nbVoyageurs: true, statut: true, lot: { select: { numero: true, batiment: true, etage: true } } },
      }).catch(() => []);
      if (s.length) sejours_lcd = s.map((x) => ({ lot: libelleLot(x.lot), arrivee: jour(x.dateArrivee)!, depart: jour(x.dateDepart)!, voyageurs: x.nbVoyageurs, statut: lib(x.statut)! }));
    }

    return {
      genere_le: now.toISOString(),
      role,
      copropriete: copro ? { id: copro.id, nom: copro.nom } : null,
      charges,
      ag,
      residence,
      affichage,
      gardien,
      moi: {
        prenom: moi?.prenom ?? null,
        langue: moi?.languePreferee === "AR" ? "AR" : "FR",
        lots: lots.map(({ libelle, tantiemes, occupation }) => ({ libelle, tantiemes, occupation })),
        cabinet: moi?.cabinets[0]?.cabinet.nom ?? null,
      },
      residenceInfo: copro ? { nom: copro.nom, ville: copro.ville, type: lib(copro.typeResidence)!, nb_lots: copro.nbLots, total_tantiemes: copro.totalTantiemes ? toApiString(copro.totalTantiemes) : null } : null,
      mes_appels,
      mes_paiements,
      mes_justificatifs,
      mes_contestations,
      incidents,
      ag_detail,
      mes_reservations,
      visites,
      annonces_detail,
      documents,
      gestion,
      mes_taches,
      sejours_lcd,
    };
  });
}
