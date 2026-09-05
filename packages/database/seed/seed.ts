/**
 * Seed de développement — couvre M1→M18 : copropriété, utilisateurs/rôles, invitation, lots
 * (plein/indivision/parking rattaché/loge), occupants, personnel gardien, budget ACTIF +
 * appel de fonds EMIS + paiement partiel, espace commun + réservation, AG convoquée avec
 * résolutions, prestataire + incident. Les paramètres légaux (délai convocation, quorum,
 * procurations, rétention CNDP) restent NULL — discipline 422 (LEGAL_QUESTIONS_BRIEF).
 *
 * Connexion via DIRECT_URL (postgres) et non DATABASE_URL (app_local) : le seed écrit dans
 * plusieurs copropriétés sans contexte tenant, ce que RLS interdit à juste titre au rôle
 * applicatif. Réservé au local — même garde-fou que scripts/setup-local-app-role.ts.
 *
 * Usage : npm run seed --workspace=@copropriete-maroc/database
 */

import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
// M18 — l'instantané du rapport de gestion est construit par la MÊME fonction que l'API (jamais recopié).
import { construireDonneesRapport } from "../../../apps/api/lib/rapports/gestion-donnees";
import type { TenantDb } from "../../../apps/api/lib/tenant/db";

const directUrl = process.env.DIRECT_URL;
if (!directUrl || !directUrl.includes("127.0.0.1")) {
  console.error("DIRECT_URL absent ou non local — ce seed est réservé au Supabase local.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function main() {
  // ── Copropriété ──────────────────────────────────────────────────────────
  const copro = await prisma.copropriete.create({
    data: {
      nom: "Résidence Al Amal",
      adresse: "12 Rue des Orangers, Quartier Gauthier",
      ville: "Casablanca",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 8,
      statut: "ACTIVE",
      // delaiConvocationJours volontairement NULL — voir docs/LEGAL_QUESTIONS_BRIEF.md §1,
      // ne pas mettre 15 en dur ici tant que ce n'est pas confirmé par l'avocat pour la prod.
      configJson: {
        locataire_voit_pv: true,
        reservation_espaces_proprietaires_only: false,
      },
    },
  });

  // ── Utilisateurs ─────────────────────────────────────────────────────────
  const syndicUser = await prisma.utilisateur.create({
    data: {
      email: "syndic.alamal@example.ma",
      telephone: "+212600000001",
      nom: "Bennani",
      prenom: "Youssef",
      languePreferee: "FR",
      statutCompte: "ACTIF",
    },
  });

  const proprietaireA = await prisma.utilisateur.create({
    data: {
      email: "a.hassani@example.ma",
      telephone: "+212600000002",
      nom: "Hassani",
      prenom: "Amina",
      languePreferee: "AR",
      statutCompte: "ACTIF",
    },
  });

  // MRE — Marocain Résidant à l'Étranger, persona clé pour la priorité email (Master Spec §5.1)
  const proprietaireMRE = await prisma.utilisateur.create({
    data: {
      email: "k.alaoui.mre@example.com",
      telephone: null,
      nom: "Alaoui",
      prenom: "Karim",
      languePreferee: "FR",
      statutCompte: "ACTIF",
    },
  });

  // Indivision : deux héritiers copropriétaires d'un même lot (le lot lui-même arrive en M3)
  const indivisaire1 = await prisma.utilisateur.create({
    data: {
      email: "s.idrissi@example.ma",
      telephone: "+212600000003",
      nom: "Idrissi",
      prenom: "Sanaa",
      languePreferee: "FR",
      statutCompte: "ACTIF",
    },
  });
  const indivisaire2 = await prisma.utilisateur.create({
    data: {
      email: "m.idrissi@example.ma",
      telephone: "+212600000004",
      nom: "Idrissi",
      prenom: "Mehdi",
      languePreferee: "AR",
      statutCompte: "ACTIF",
    },
  });

  const locataire = await prisma.utilisateur.create({
    data: {
      telephone: "+212600000005",
      nom: "Fassi",
      prenom: "Nadia",
      languePreferee: "AR",
      statutCompte: "ACTIF",
    },
  });

  const gardienUser = await prisma.utilisateur.create({
    data: {
      telephone: "+212600000006",
      nom: "Ouazzani",
      prenom: "Rachid",
      languePreferee: "AR",
      statutCompte: "ACTIF",
    },
  });

  // M16 — membre du conseil syndical (approuve les dépenses au-dessus du seuil, Doc A §8.3).
  const conseilUser = await prisma.utilisateur.create({
    data: {
      email: "l.berrada@example.ma",
      telephone: "+212600000007",
      nom: "Berrada",
      prenom: "Leila",
      languePreferee: "FR",
      statutCompte: "ACTIF",
    },
  });

  // ── Rôles ────────────────────────────────────────────────────────────────
  await prisma.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicUser.id, coproprieteId: copro.id, role: "SYNDIC", actif: true },
      { utilisateurId: proprietaireA.id, coproprieteId: copro.id, role: "PROPRIETAIRE", actif: true },
      { utilisateurId: proprietaireMRE.id, coproprieteId: copro.id, role: "PROPRIETAIRE", actif: true },
      { utilisateurId: indivisaire1.id, coproprieteId: copro.id, role: "INDIVISAIRE", actif: true },
      { utilisateurId: indivisaire2.id, coproprieteId: copro.id, role: "INDIVISAIRE", actif: true },
      { utilisateurId: locataire.id, coproprieteId: copro.id, role: "LOCATAIRE", actif: true },
      { utilisateurId: gardienUser.id, coproprieteId: copro.id, role: "GARDIEN", actif: true },
      { utilisateurId: conseilUser.id, coproprieteId: copro.id, role: "CONSEIL_SYNDICAL", actif: true },
    ],
  });

  // ── Invitation en attente (M2) — utile pour tester le flux invite/accept à la main ──────
  // GARDIEN et non PROPRIETAIRE : une invitation PROPRIETAIRE exige un lot_id (Partie 5.3)
  // et les lots n'existent qu'à partir de M3.
  const invitation = await prisma.invitation.create({
    data: {
      coproprieteId: copro.id,
      roleCible: "GARDIEN",
      emetteurId: syndicUser.id,
      canal: "EMAIL",
      code: "SEED0001", // code stable pour les tests manuels — jamais utilisé hors local
      statut: "EN_ATTENTE",
      expireLe: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  // ── M3 — Lots (tantièmes alignés sur totalTantiemes = 1000) ──────────────
  // Paramètres légaux : valeurs PROVISOIRES autorisées par le propriétaire du projet le
  // 27/08/2026 (docs/LEGAL_QUESTIONS_BRIEF.md, section « Valeurs PROVISOIRES en vigueur ») —
  // configuration de copropriété, pas du code en dur ; à confirmer/corriger par l'avocat.
  await prisma.copropriete.update({
    where: { id: copro.id },
    data: {
      totalTantiemes: "1000.00",
      delaiConvocationJours: 15, // §1 — art. 22 Loi 18-00 (sources convergentes)
      quorumPremiereConvocation: "0.5", // §2 — art. 18, moitié des voix
      limiteProcurationsMandataire: 3, // §4 — max 3 mandants par mandataire
      retentionDesactivationMois: 24, // §5 — « durée légale + 2 ans », base prudente
    },
  });
  const [lotA1, lotA2, lotA3, parkingP1, loge] = await Promise.all([
    prisma.lot.create({
      data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "A1", etage: 1, tantiemes: "300.00", statut: "OCCUPE" },
    }),
    prisma.lot.create({
      data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "A2", etage: 2, tantiemes: "250.00", statut: "OCCUPE" },
    }),
    prisma.lot.create({
      data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "A3", etage: 3, tantiemes: "250.00", statut: "OCCUPE" },
    }),
    prisma.lot.create({
      data: { coproprieteId: copro.id, typeLot: "PARKING", numero: "P1", tantiemes: "100.00", statut: "OCCUPE" },
    }),
    prisma.lot.create({
      data: { coproprieteId: copro.id, typeLot: "LOGE_GARDIEN", numero: "LG", tantiemes: "100.00", statut: "OCCUPE" },
    }),
  ]);
  await prisma.lot.update({ where: { id: parkingP1.id }, data: { lotParentId: lotA1.id } });

  // Propriétés : A1 plein (proprietaireA, aussi propriétaire du parking), A2 bailleur MRE
  // (loué au locataire), A3 en indivision 50/50 (représentant : indivisaire1 — Doc A §2.4).
  await prisma.lotProprietaire.createMany({
    data: [
      { lotId: lotA1.id, utilisateurId: proprietaireA.id, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      { lotId: parkingP1.id, utilisateurId: proprietaireA.id, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      { lotId: lotA2.id, utilisateurId: proprietaireMRE.id, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2024-01-01") },
      { lotId: lotA3.id, utilisateurId: indivisaire1.id, quotePart: "50.00", typePropriete: "INDIVISION", estRepresentantIndivision: true, dateDebut: new Date("2024-01-01") },
      { lotId: lotA3.id, utilisateurId: indivisaire2.id, quotePart: "50.00", typePropriete: "INDIVISION", dateDebut: new Date("2024-01-01") },
    ],
  });
  await prisma.lotOccupant.createMany({
    data: [
      { lotId: lotA1.id, utilisateurId: proprietaireA.id, typeOccupation: "PROPRIETAIRE_OCCUPANT", dateDebut: new Date("2024-01-01") },
      { lotId: lotA2.id, utilisateurId: locataire.id, typeOccupation: "LOCATAIRE", dateDebut: new Date("2025-03-01"), accesFinancesAccorde: false, recoitConvocations: false },
    ],
  });

  // ── M10 — Personnel (gardien logé) ───────────────────────────────────────
  await prisma.personnel.create({
    data: { coproprieteId: copro.id, utilisateurId: gardienUser.id, statut: "PRESENT", logementLotId: loge.id },
  });

  const jour = (delta: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + delta);
    return d;
  };

  // ── M5 — Budget ACTIF + appel de fonds EMIS + un paiement partiel ────────
  const exercice = String(new Date().getFullYear());
  const budget = await prisma.budgetAg.create({
    data: { coproprieteId: copro.id, exercice, montantTotal: "48000.00", statut: "ACTIF" },
  });
  const periode = `${exercice}-01`;
  const appel = await prisma.appelDeFonds.create({
    data: {
      coproprieteId: copro.id,
      periode,
      type: "CHARGES_COURANTES",
      montantTotal: "4000.00",
      dateEcheance: new Date(`${exercice}-01-10`),
      statut: "EMIS",
      lignes: {
        create: [
          { lotId: lotA1.id, montantDu: "1200.00" },
          { lotId: lotA2.id, montantDu: "1000.00" },
          { lotId: lotA3.id, montantDu: "1000.00" },
          { lotId: parkingP1.id, montantDu: "400.00" },
          { lotId: loge.id, montantDu: "400.00" },
        ],
      },
    },
    include: { lignes: true },
  });
  const ligneA1 = appel.lignes.find((l) => l.lotId === lotA1.id)!;
  await prisma.paiement.create({
    data: { lotId: lotA1.id, appelDeFondsLotId: ligneA1.id, montant: "500.00", methode: "VIREMENT", statut: "VALIDE" },
  });
  await prisma.appelDeFondsLot.update({
    where: { id: ligneA1.id },
    data: { montantPaye: "500.00", statut: "PARTIEL" },
  });

  // ── M8 — Espace commun réservable + une réservation confirmée ────────────
  const salle = await prisma.espaceCommun.create({
    data: {
      coproprieteId: copro.id,
      nom: "Salle polyvalente",
      type: "SALLE",
      capacite: 30,
      reservable: true,
      reglesReservationJson: { validation_automatique: true },
    },
  });
  await prisma.reservationEspaceCommun.create({
    data: {
      espaceId: salle.id,
      lotId: lotA1.id,
      utilisateurId: proprietaireA.id,
      dateDebut: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      dateFin: new Date(Date.now() + 7 * 24 * 3600 * 1000 + 3 * 3600 * 1000),
      statut: "CONFIRMEE",
    },
  });

  // ── M6 — AG convoquée avec deux résolutions (quorum/délais légaux NULL → 422 assumé) ──
  const ag = await prisma.assembleeGenerale.create({
    data: {
      coproprieteId: copro.id,
      type: "ORDINAIRE",
      dateAg: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      dateConvocation: new Date(),
      statut: "CONVOQUEE",
      resolutions: {
        create: [
          { ordre: 1, texte: `Approbation du budget ${exercice} (48 000 MAD).`, typeMajorite: "SIMPLE" },
          { ordre: 2, texte: "Travaux de ravalement de la façade.", typeMajorite: "DOUBLE" },
        ],
      },
    },
  });

  // ── M7 — Prestataire + incident en cours ─────────────────────────────────
  const prestataire = await prisma.prestataire.create({
    data: {
      coproprieteId: copro.id,
      nom: "Plomberie Atlas",
      specialite: "Plomberie",
      contact: "+212522000000",
      // M16 — fiche fournisseur (le RIB n'est jamais renvoyé en clair par l'API : 4 derniers caractères).
      telephone: "+212522000000",
      email: "contact@plomberie-atlas.ma",
      ice: "001234567000089",
      rc: "RC 45678 Casablanca",
      adresse: "Zone industrielle Aïn Sebaâ, Casablanca",
      rib: "007780000123456789012345",
      notes: "Intervient sous 4 h en urgence. Devis systématique au-delà de 2 000 MAD.",
      noteMoyenne: "4.00",
    },
  });
  const incidentAtlas = await prisma.incident.create({
    data: {
      coproprieteId: copro.id,
      lotId: null,
      categorie: "PLOMBERIE",
      sousCategorie: "Fuite colonne montante",
      description: "Fuite au sous-sol près du compteur général.",
      partie: "COMMUNE",
      urgence: "URGENTE",
      statut: "EN_COURS",
      creePar: locataire.id,
      assigneAId: prestataire.id,
      slaDeadline: new Date(Date.now() + 4 * 3600 * 1000),
    },
  });

  // ── M15 — Location courte durée (Doc A §10.2) ────────────────────────────
  // Régime ENCADREE voté « hors plateforme » (pas encore de résolution ADOPTEE en base) ;
  // paramètres de démonstration — valeurs de règlement, pas des valeurs légales.
  await prisma.copropriete.update({
    where: { id: copro.id },
    data: {
      regimeLcd: "ENCADREE",
      parametresLcdJson: {
        declaration_prealable_obligatoire: true,
        delai_declaration_heures: 24,
        nb_nuits_max_par_an: 120,
        nb_voyageurs_max_par_lot: 4,
        gestionnaire_obligatoire_si_proprietaire_absent: true,
        contact_gardien_obligatoire: true,
      },
    },
  });
  const gestionnaireLcd = await prisma.utilisateur.create({
    data: {
      email: "conciergerie.atlas@example.ma",
      telephone: "+212600000008",
      nom: "Atlas Conciergerie",
      prenom: "Karim",
      languePreferee: "FR",
      statutCompte: "ACTIF",
    },
  });
  await prisma.roleUtilisateur.create({
    data: { utilisateurId: gestionnaireLcd.id, coproprieteId: copro.id, role: "GESTIONNAIRE_LCD", actif: true },
  });
  const declarationLcd = await prisma.lotLocationCourteDuree.create({
    data: {
      coproprieteId: copro.id,
      lotId: lotA1.id,
      declareParId: proprietaireA.id,
      gestionnaireId: gestionnaireLcd.id,
      plateformesJson: ["Airbnb", "Booking"],
      contactUrgenceNom: "Karim (Atlas Conciergerie)",
      contactUrgenceTelephone: "+212600000008",
      statut: "VALIDEE",
      decideParId: syndicUser.id,
      decideLe: new Date(),
      dateDebut: new Date("2026-01-01"),
    },
  });
  const sejourEnCours = await prisma.sejourCourteDuree.create({
    data: {
      coproprieteId: copro.id,
      lotId: lotA1.id,
      declarationLcdId: declarationLcd.id,
      declareParId: gestionnaireLcd.id,
      dateArrivee: jour(-1),
      dateDepart: jour(1),
      heureArriveePrevue: "16:00",
      nbVoyageurs: 2,
      voyageurPrincipalNom: "Famille Dupont",
      voyageurNationalite: "FR",
      pieceIdentiteType: "PASSEPORT",
      pieceIdentiteFin: "7Z41",
      statut: "EN_COURS",
      gardienInformeLe: new Date(Date.now() - 36 * 3600 * 1000),
    },
  });
  const sejourPrevu = await prisma.sejourCourteDuree.create({
    data: {
      coproprieteId: copro.id,
      lotId: lotA1.id,
      declarationLcdId: declarationLcd.id,
      declareParId: proprietaireA.id,
      dateArrivee: jour(1),
      dateDepart: jour(4),
      heureArriveePrevue: "14:30",
      nbVoyageurs: 3,
      voyageurPrincipalNom: "Sara El Idrissi",
      voyageurTelephone: "+212661000000",
      voyageurNationalite: "MA",
      pieceIdentiteType: "CIN",
      pieceIdentiteFin: "12AB",
      plaqueVehicule: "12345-A-6",
      statut: "PREVU",
      gardienInformeLe: new Date(),
    },
  });
  await prisma.sejourEvenement.createMany({
    data: [
      { coproprieteId: copro.id, sejourId: sejourEnCours.id, type: "DECLARE", acteurId: gestionnaireLcd.id, horodatage: new Date(Date.now() - 48 * 3600 * 1000) },
      { coproprieteId: copro.id, sejourId: sejourEnCours.id, type: "GARDIEN_NOTIFIE", acteurId: null, horodatage: new Date(Date.now() - 36 * 3600 * 1000) },
      { coproprieteId: copro.id, sejourId: sejourEnCours.id, type: "ARRIVEE_CONFIRMEE", acteurId: gardienUser.id, detailsJson: { nb_voyageurs_constate: 2 }, horodatage: new Date(Date.now() - 20 * 3600 * 1000) },
      { coproprieteId: copro.id, sejourId: sejourPrevu.id, type: "DECLARE", acteurId: proprietaireA.id },
      { coproprieteId: copro.id, sejourId: sejourPrevu.id, type: "GARDIEN_NOTIFIE", acteurId: null },
    ],
  });

  // ── M16 — Dépenses, factures, fournisseurs, postes budgétaires (Doc A §3, §8) ──────────
  // Paramètres de copropriété (LEGAL_QUESTIONS_BRIEF §8 — PROVISOIRES, configuration, pas du code).
  await prisma.copropriete.update({
    where: { id: copro.id },
    data: { seuilApprobationConseil: "5000.00", tvaParDefaut: "20.00", reserveSansResolutionAutorisee: false },
  });
  // Postes du budget ACTIF (Σ = 48 000 — le trigger budget_poste_recalculer_total tient le total).
  const postesData = [
    { categorie: "ENTRETIEN_COURANT", libelle: "Nettoyage des parties communes", montantPrevu: "12000.00", ordre: 1 },
    { categorie: "PERSONNEL", libelle: "Salaire du gardien", montantPrevu: "15000.00", ordre: 2 },
    { categorie: "ENERGIE_EAU", libelle: "Électricité et eau des communs", montantPrevu: "9000.00", ordre: 3 },
    { categorie: "REPARATIONS", libelle: "Petites réparations", montantPrevu: "5000.00", ordre: 4 },
    { categorie: "ASSURANCE", libelle: "Assurance de l'immeuble", montantPrevu: "4000.00", ordre: 5 },
    { categorie: "HONORAIRES_SYNDIC", libelle: "Honoraires du syndic", montantPrevu: "3000.00", ordre: 6 },
  ] as const;
  const postes: Record<string, string> = {};
  for (const p of postesData) {
    const poste = await prisma.budgetPoste.create({ data: { budgetAgId: budget.id, ...p } });
    postes[p.categorie] = poste.id;
  }
  const proprete = await prisma.prestataire.create({
    data: {
      coproprieteId: copro.id,
      nom: "Propreté Maroc",
      specialite: "Nettoyage",
      contact: "+212661000111",
      telephone: "+212661000111",
      email: "devis@proprete-maroc.ma",
      ice: "002233445000067",
    },
  });
  // AG passée CLOTUREE avec une résolution ADOPTEE : décaissement du fonds de réserve autorisé.
  const agPassee = await prisma.assembleeGenerale.create({
    data: {
      coproprieteId: copro.id,
      type: "EXTRAORDINAIRE",
      dateAg: new Date(Date.now() - 180 * 24 * 3600 * 1000),
      dateConvocation: new Date(Date.now() - 200 * 24 * 3600 * 1000),
      statut: "CLOTUREE",
      quorumRequis: "0.500",
      quorumAtteint: "0.750",
      resolutions: {
        create: [{ ordre: 1, texte: "Remplacement de la pompe du surpresseur, financé par le fonds de réserve.", typeMajorite: "SIMPLE", resultat: "ADOPTEE" }],
      },
    },
    include: { resolutions: true },
  });
  const resolutionPompe = agPassee.resolutions[0]!;
  // Fonds de réserve : cotisation puis décaissement lié à la dépense payée ci-dessous.
  const fondsReserve = await prisma.fondsReserve.create({ data: { coproprieteId: copro.id } });
  await prisma.fondsReserveMouvement.create({
    data: { fondsReserveId: fondsReserve.id, type: "COTISATION", montant: "20000.00", description: `Cotisations fonds de réserve ${Number(exercice) - 1}`, horodatage: new Date(`${Number(exercice) - 1}-12-15T10:00:00Z`) },
  });
  const docPath = (nom: string) => `${copro.id}/depenses/${randomUUID()}-${nom}`;
  const journal = async (depenseId: string, entrees: { type: "CREEE" | "SOUMISE" | "APPROUVEE" | "REJETEE" | "PAYEE" | "FACTURE_AJOUTEE" | "MODIFIEE"; acteurId: string | null; details?: object; il?: number }[]) => {
    await prisma.depenseLog.createMany({
      data: entrees.map((e, i) => ({
        coproprieteId: copro.id,
        depenseId,
        type: e.type,
        acteurId: e.acteurId,
        detailsJson: e.details ?? undefined,
        horodatage: new Date(Date.now() - (e.il ?? 10 - i) * 24 * 3600 * 1000),
      })),
    });
  };
  // 1. PAYEE (compte courant) — électricité, preuve de virement jointe.
  const justifLydec = await prisma.document.create({
    data: { coproprieteId: copro.id, type: "JUSTIFICATIF_DEPENSE", nom: "Reçu virement Lydec janvier.pdf", visibilite: "CONSEIL_SYNDICAL", storagePath: docPath("recu-virement-lydec.pdf"), creePar: syndicUser.id },
  });
  const depLydec = await prisma.depense.create({
    data: {
      coproprieteId: copro.id, budgetAgId: budget.id, budgetPosteId: postes.ENERGIE_EAU, categorie: "ENERGIE_EAU",
      libelle: "Électricité des communs — janvier", montantHt: "650.42", tva: "130.08", montantTtc: "780.50",
      dateDepense: new Date(`${exercice}-01-20`), statut: "PAYEE", source: "COMPTE_COURANT", creeParId: syndicUser.id,
      approuveParId: syndicUser.id, approuveLe: new Date(`${exercice}-01-21T09:00:00Z`), payeLe: new Date(`${exercice}-01-25`),
      methodePaiement: "VIREMENT", referencePaiement: `VIR-${exercice}-0114`, justificatifPaiementDocumentId: justifLydec.id,
    },
  });
  await journal(depLydec.id, [
    { type: "CREEE", acteurId: syndicUser.id, il: 40 },
    { type: "SOUMISE", acteurId: syndicUser.id, details: { niveau: "SYNDIC" }, il: 39 },
    { type: "APPROUVEE", acteurId: syndicUser.id, il: 39 },
    { type: "PAYEE", acteurId: syndicUser.id, details: { methode: "VIREMENT", reference: `VIR-${exercice}-0114` }, il: 35 },
  ]);
  // 2. PAYEE — nettoyage mensuel (prestataire Propreté Maroc), payé par chèque.
  const depNettoyage = await prisma.depense.create({
    data: {
      coproprieteId: copro.id, budgetAgId: budget.id, budgetPosteId: postes.ENTRETIEN_COURANT, categorie: "ENTRETIEN_COURANT",
      prestataireId: proprete.id, libelle: "Nettoyage des parties communes — janvier", montantHt: "833.33", tva: "166.67", montantTtc: "1000.00",
      dateDepense: new Date(`${exercice}-01-31`), statut: "PAYEE", source: "COMPTE_COURANT", creeParId: syndicUser.id,
      approuveParId: syndicUser.id, approuveLe: new Date(`${exercice}-02-01T09:00:00Z`), payeLe: new Date(`${exercice}-02-03`),
      methodePaiement: "CHEQUE", referencePaiement: "CHQ 0451233",
    },
  });
  await journal(depNettoyage.id, [
    { type: "CREEE", acteurId: syndicUser.id, il: 30 },
    { type: "SOUMISE", acteurId: syndicUser.id, details: { niveau: "SYNDIC" }, il: 30 },
    { type: "APPROUVEE", acteurId: syndicUser.id, il: 29 },
    { type: "PAYEE", acteurId: syndicUser.id, details: { methode: "CHEQUE", reference: "CHQ 0451233" }, il: 27 },
  ]);
  // 3. APPROUVEE non payée — réparation issue de l'incident (Plomberie Atlas), facture RECUE à échéance J+5.
  const docFactureAtlas = await prisma.document.create({
    data: { coproprieteId: copro.id, type: "FACTURE", nom: "Facture Plomberie Atlas FA-0231.pdf", visibilite: "CONSEIL_SYNDICAL", storagePath: docPath("facture-atlas-FA-0231.pdf"), creePar: syndicUser.id },
  });
  const depReparation = await prisma.depense.create({
    data: {
      coproprieteId: copro.id, budgetAgId: budget.id, budgetPosteId: postes.REPARATIONS, categorie: "REPARATIONS",
      prestataireId: prestataire.id, incidentId: incidentAtlas.id, libelle: "Réparation fuite colonne montante (sous-sol)",
      description: "Remplacement d'un tronçon de colonne et reprise de l'étanchéité.", montantHt: "2000.00", tva: "400.00", montantTtc: "2400.00",
      dateDepense: jour(-3), statut: "APPROUVEE", source: "COMPTE_COURANT", creeParId: syndicUser.id,
      approuveParId: syndicUser.id, approuveLe: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    },
  });
  await prisma.facture.create({
    data: {
      depenseId: depReparation.id, prestataireId: prestataire.id, numero: "FA-0231", dateFacture: jour(-3), dateEcheance: jour(5),
      montantTtc: "2400.00", statut: "RECUE", documentId: docFactureAtlas.id,
    },
  });
  await journal(depReparation.id, [
    { type: "CREEE", acteurId: syndicUser.id, details: { origine: "incident", incident_id: incidentAtlas.id }, il: 3 },
    { type: "FACTURE_AJOUTEE", acteurId: syndicUser.id, details: { numero: "FA-0231", montant_ttc: "2400.00" }, il: 3 },
    { type: "SOUMISE", acteurId: syndicUser.id, details: { niveau: "SYNDIC" }, il: 2 },
    { type: "APPROUVEE", acteurId: syndicUser.id, il: 2 },
  ]);
  // 4. A_APPROUVER — travaux au-dessus du seuil (5 000) : en attente du conseil syndical.
  const depFacade = await prisma.depense.create({
    data: {
      coproprieteId: copro.id, budgetAgId: budget.id, categorie: "TRAVAUX", libelle: "Ravalement de la façade — acompte 30 %",
      description: "Acompte à la commande, devis n° DV-2026-018 (3 devis comparés).", montantHt: "15000.00", tva: "3000.00", montantTtc: "18000.00",
      dateDepense: jour(-1), statut: "A_APPROUVER", source: "COMPTE_COURANT", creeParId: syndicUser.id,
    },
  });
  await journal(depFacade.id, [
    { type: "CREEE", acteurId: syndicUser.id, il: 1 },
    { type: "SOUMISE", acteurId: syndicUser.id, details: { niveau: "CONSEIL", seuil: "5000.00" }, il: 1 },
  ]);
  // 5. BROUILLON — fournitures administratives.
  const depBrouillon = await prisma.depense.create({
    data: {
      coproprieteId: copro.id, budgetAgId: budget.id, categorie: "ADMINISTRATIF", libelle: "Fournitures de bureau et affichage",
      montantTtc: "350.00", dateDepense: jour(0), statut: "BROUILLON", source: "COMPTE_COURANT", creeParId: syndicUser.id,
    },
  });
  await journal(depBrouillon.id, [{ type: "CREEE", acteurId: syndicUser.id, il: 0 }]);
  // 6. REJETEE par le conseil — motif tracé.
  const depDeco = await prisma.depense.create({
    data: {
      coproprieteId: copro.id, budgetAgId: budget.id, categorie: "AUTRE", libelle: "Décoration du hall d'entrée",
      montantTtc: "6500.00", dateDepense: jour(-12), statut: "REJETEE", source: "COMPTE_COURANT", creeParId: syndicUser.id,
      motifRejet: "Dépense non prioritaire : à représenter à la prochaine AG avec trois devis.",
    },
  });
  await journal(depDeco.id, [
    { type: "CREEE", acteurId: syndicUser.id, il: 12 },
    { type: "SOUMISE", acteurId: syndicUser.id, details: { niveau: "CONSEIL", seuil: "5000.00" }, il: 12 },
    { type: "REJETEE", acteurId: conseilUser.id, details: { motif: "Dépense non prioritaire : à représenter à la prochaine AG avec trois devis." }, il: 10 },
  ]);
  // 7. PAYEE depuis le FONDS DE RÉSERVE — résolution d'AG ADOPTEE, mouvement DEPENSE dans le grand livre de la réserve.
  const depPompe = await prisma.depense.create({
    data: {
      coproprieteId: copro.id, budgetAgId: budget.id, categorie: "TRAVAUX", prestataireId: prestataire.id,
      libelle: "Remplacement de la pompe du surpresseur", montantHt: "5000.00", tva: "1000.00", montantTtc: "6000.00",
      dateDepense: new Date(Date.now() - 60 * 24 * 3600 * 1000), statut: "PAYEE", source: "FONDS_RESERVE", resolutionAgId: resolutionPompe.id,
      creeParId: syndicUser.id, approuveParId: conseilUser.id, approuveLe: new Date(Date.now() - 58 * 24 * 3600 * 1000),
      payeLe: new Date(Date.now() - 55 * 24 * 3600 * 1000), methodePaiement: "VIREMENT", referencePaiement: `VIR-${exercice}-0098`,
    },
  });
  await prisma.fondsReserveMouvement.create({
    data: { fondsReserveId: fondsReserve.id, type: "DEPENSE", montant: "-6000.00", resolutionAgId: resolutionPompe.id, depenseId: depPompe.id, description: "Remplacement de la pompe du surpresseur", horodatage: new Date(Date.now() - 55 * 24 * 3600 * 1000) },
  });
  await journal(depPompe.id, [
    { type: "CREEE", acteurId: syndicUser.id, il: 60 },
    { type: "SOUMISE", acteurId: syndicUser.id, details: { niveau: "CONSEIL", seuil: "5000.00" }, il: 60 },
    { type: "APPROUVEE", acteurId: conseilUser.id, il: 58 },
    { type: "PAYEE", acteurId: syndicUser.id, details: { methode: "VIREMENT", reference: `VIR-${exercice}-0098`, source: "FONDS_RESERVE", mouvement: "-6000.00" }, il: 55 },
  ]);
  // Incident RESOLU évalué par le résident (Doc A §8.3 transparence prestataires) → note_moyenne 4.00.
  await prisma.incident.create({
    data: {
      coproprieteId: copro.id, lotId: lotA1.id, categorie: "PLOMBERIE", sousCategorie: "Robinetterie commune",
      description: "Robinet du local poubelles qui fuit.", partie: "COMMUNE", urgence: "NORMALE", statut: "RESOLU",
      creePar: proprietaireA.id, assigneAId: prestataire.id, notePrestataire: 4, commentairePrestataire: "Rapide et propre, un peu cher.",
      evalueLe: new Date(Date.now() - 20 * 24 * 3600 * 1000), creeLe: new Date(Date.now() - 25 * 24 * 3600 * 1000),
    },
  });

  // ── M17 — Justificatifs de paiement (Doc A §3.3/§3.4) ───────────────────────
  await prisma.copropriete.update({
    where: { id: copro.id },
    data: {
      comptesBancairesJson: [
        { libelle: "Compte courant — Attijariwafa bank", banque: "Attijariwafa bank", rib: "007780000112233445566778" },
        { libelle: "Fonds de réserve — BMCE", banque: "Bank of Africa", rib: "011780000998877665544332" },
      ],
      delaiValidationJustificatifJours: 5, // PROVISOIRE — rappel au syndic après 5 jours d'attente (brief §8.5)
    },
  });
  const ligneA2 = appel.lignes.find((l) => l.lotId === lotA2.id)!;
  const ligneA3 = appel.lignes.find((l) => l.lotId === lotA3.id)!;
  // 1. Justificatif VALIDÉ : virement du propriétaire MRE (lot A2), paiement créé à la validation.
  const preuveMre = await prisma.document.create({
    data: { coproprieteId: copro.id, type: "JUSTIFICATIF_PAIEMENT", nom: "Reçu virement A2 janvier.pdf", visibilite: "SYNDIC_ONLY", storagePath: `${copro.id}/justificatifs/${randomUUID()}-recu-a2.pdf`, creePar: proprietaireMRE.id },
  });
  const justifValide = await prisma.justificatifPaiement.create({
    data: {
      coproprieteId: copro.id, lotId: lotA2.id, appelDeFondsLotId: ligneA2.id, declareParId: proprietaireMRE.id, montant: "1000.00", methode: "VIREMENT",
      datePaiementDeclaree: new Date(`${exercice}-01-08`), banqueEmettrice: "Société Générale (France)", beneficiaire: "Compte courant — Attijariwafa bank", reference: "SG-INT-77120",
      documentId: preuveMre.id, statut: "VALIDE", traiteParId: syndicUser.id, traiteLe: new Date(`${exercice}-01-12T10:00:00Z`),
      creeLe: new Date(`${exercice}-01-09T18:30:00Z`),
    },
  });
  const paiementMre = await prisma.paiement.create({
    data: { lotId: lotA2.id, appelDeFondsLotId: ligneA2.id, montant: "1000.00", methode: "VIREMENT", statut: "VALIDE", payeurUtilisateurId: proprietaireMRE.id, justificatifId: justifValide.id, enregistreParId: syndicUser.id, dateValeur: new Date(`${exercice}-01-08`), horodatage: new Date(`${exercice}-01-12T10:00:00Z`) },
  });
  await prisma.appelDeFondsLot.update({ where: { id: ligneA2.id }, data: { montantPaye: "1000.00", statut: "PAYE" } });
  await prisma.quittance.create({ data: { appelDeFondsLotId: ligneA2.id, numero: `QT-${ligneA2.id.slice(0, 8).toUpperCase()}-SEED` } });
  await prisma.justificatifPaiement.update({ where: { id: justifValide.id }, data: { paiementId: paiementMre.id, detailsJson: { affectations: [{ appel_de_fonds_lot_id: ligneA2.id, montant: "1000.00", statut: "PAYE" }] } } });
  // 2. Justificatif EN ATTENTE : chèque déposé par la représentante de l'indivision (lot A3), paiement sur solde.
  const preuveA3 = await prisma.document.create({
    data: { coproprieteId: copro.id, type: "JUSTIFICATIF_PAIEMENT", nom: "Photo chèque A3.jpg", visibilite: "SYNDIC_ONLY", storagePath: `${copro.id}/justificatifs/${randomUUID()}-cheque-a3.jpg`, creePar: indivisaire1.id },
  });
  const justifAttente = await prisma.justificatifPaiement.create({
    data: {
      coproprieteId: copro.id, lotId: lotA3.id, appelDeFondsLotId: null, declareParId: indivisaire1.id, montant: "600.00", methode: "CHEQUE",
      datePaiementDeclaree: jour(-2), banqueEmettrice: "CIH Bank", beneficiaire: "Compte courant — Attijariwafa bank", reference: "CHQ 0098211", documentId: preuveA3.id, statut: "EN_ATTENTE",
    },
  });
  // 3. Espèces reçues à la loge par le gardien (lot A1, sur solde) — en attente de confirmation du syndic.
  const justifEspeces = await prisma.justificatifPaiement.create({
    data: {
      coproprieteId: copro.id, lotId: lotA1.id, appelDeFondsLotId: ligneA1.id, declareParId: gardienUser.id, montant: "200.00", methode: "ESPECES",
      datePaiementDeclaree: jour(0), beneficiaire: "Espèces remises au gardien", statut: "EN_ATTENTE",
    },
  });

  // ── M18 — Rapports, rapport de gestion, exports, transparence (Doc A §8, §6, §3.5) ──
  const exercicePrecedent = String(Number(exercice) - 1);
  await prisma.copropriete.update({
    where: { id: copro.id },
    data: {
      facturesVisiblesResidents: true, // les résidents d'Al Amal voient les factures des dépenses payées
      configJson: {
        reservation_espaces_proprietaires_only: false,
        // PROVISOIRE — majorité requise pour l'approbation des comptes (LEGAL_QUESTIONS_BRIEF §9) ;
        // valeur de démonstration, jamais codée en dur côté API (422 si absente).
        majorite_approbation_comptes: "SIMPLE",
      },
    },
  });
  const dbSeed = prisma as unknown as TenantDb;
  const ctxSyndic = { utilisateurId: syndicUser.id, coproprieteId: copro.id, role: "SYNDIC" as const };
  // 1. Rapport de l'exercice précédent : soumis à l'AG passée (résolution « approbation des comptes » ADOPTEE) → APPROUVE.
  const resolutionComptes = await prisma.agResolution.create({
    data: { agId: agPassee.id, ordre: 2, texte: `Approbation des comptes de l'exercice ${exercicePrecedent} (rapport de gestion du syndic)`, typeMajorite: "SIMPLE", resultat: "ADOPTEE" },
  });
  const docRapportPrecedent = await prisma.document.create({
    data: { coproprieteId: copro.id, type: "RAPPORT_GESTION", nom: `Rapport de gestion ${exercicePrecedent}.pdf`, visibilite: "PUBLIC_COPROPRIETE", storagePath: `${copro.id}/rapports/rapport-gestion-${exercicePrecedent}.pdf`, creePar: syndicUser.id, creeLe: new Date(Date.now() - 185 * 24 * 3600 * 1000) },
  });
  const rapportPrecedent = await prisma.rapportGestion.create({
    data: {
      coproprieteId: copro.id, exercice: exercicePrecedent, statut: "APPROUVE", agId: agPassee.id, resolutionAgId: resolutionComptes.id, documentId: docRapportPrecedent.id,
      donneesJson: (await construireDonneesRapport(dbSeed, ctxSyndic, exercicePrecedent, null, new Date(Date.now() - 185 * 24 * 3600 * 1000))) as never,
      genereParId: syndicUser.id, genereLe: new Date(Date.now() - 185 * 24 * 3600 * 1000),
    },
  });
  // 2. Rapport de l'exercice courant : GENERE (PDF conseil syndical), prêt à être soumis à la prochaine AG.
  const docRapportCourant = await prisma.document.create({
    data: { coproprieteId: copro.id, type: "RAPPORT_GESTION", nom: `Rapport de gestion ${exercice}.pdf`, visibilite: "CONSEIL_SYNDICAL", storagePath: `${copro.id}/rapports/rapport-gestion-${exercice}.pdf`, creePar: syndicUser.id },
  });
  const rapportCourant = await prisma.rapportGestion.create({
    data: {
      coproprieteId: copro.id, exercice, statut: "GENERE", budgetAgId: budget.id, documentId: docRapportCourant.id,
      donneesJson: (await construireDonneesRapport(dbSeed, ctxSyndic, exercice, budget.id)) as never,
      genereParId: syndicUser.id,
    },
  });
  // 3. Journal des exports (append-only) : deux extractions du syndic.
  await prisma.exportLog.createMany({
    data: [
      { coproprieteId: copro.id, utilisateurId: syndicUser.id, type: "PROPRIETAIRES", filtresJson: { format: "xlsx" }, nbLignes: 6, horodatage: jour(-12) },
      { coproprieteId: copro.id, utilisateurId: syndicUser.id, type: "GRAND_LIVRE", filtresJson: { format: "csv", exercice: exercicePrecedent }, nbLignes: 14, horodatage: jour(-3) },
    ],
  });

  console.log("Seed terminé :", {
    rapports: { approuve: rapportPrecedent.id, genere: rapportCourant.id },
    copropriete: copro.nom,
    utilisateurs: 9,
    lcd: { declaration: declarationLcd.id, sejourEnCours: sejourEnCours.id, sejourPrevu: sejourPrevu.id },
    lots: 5,
    justificatifs: { valide: justifValide.id, enAttente: justifAttente.id, especesGardien: justifEspeces.id },
    depenses: { payees: 3, approuvee: depReparation.id, aApprouver: depFacade.id, brouillon: depBrouillon.id, rejetee: depDeco.id, reserve: depPompe.id },
    appelDeFonds: periode,
    ag: ag.id,
    invitationEnAttente: invitation.code,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
