/**
 * Seed de développement — couvre M1→M20 : copropriété, utilisateurs/rôles, invitation, lots
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

  // M20 — agent d'entretien salariée de la copropriété (rôle applicatif GARDIEN : seul rôle « personnel »).
  const agentUser = await prisma.utilisateur.create({
    data: { telephone: "+212600000009", nom: "El Fassi", prenom: "Fatima", languePreferee: "AR", statutCompte: "ACTIF" },
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
      { utilisateurId: agentUser.id, coproprieteId: copro.id, role: "GARDIEN", actif: true },
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
  const personnelGardien = await prisma.personnel.create({
    data: {
      coproprieteId: copro.id, utilisateurId: gardienUser.id, statut: "PRESENT", logementLotId: loge.id,
      // M20 — dossier RH (Doc A §9.2 « CDI ou CDD, CNSS obligatoire ») — valeurs de démonstration.
      poste: "GARDIEN", typeContrat: "CDI", dateEmbauche: new Date("2022-03-01"), salaireBrutMensuel: "4500.00", numeroCnss: "118877665",
      contactUrgence: "+212661000000 (épouse)", horairesJson: { lun: [{ debut: "07:00", fin: "12:00" }, { debut: "16:00", fin: "20:00" }], mar: [{ debut: "07:00", fin: "12:00" }, { debut: "16:00", fin: "20:00" }], mer: [{ debut: "07:00", fin: "12:00" }, { debut: "16:00", fin: "20:00" }], jeu: [{ debut: "07:00", fin: "12:00" }, { debut: "16:00", fin: "20:00" }], ven: [{ debut: "07:00", fin: "12:00" }, { debut: "16:00", fin: "20:00" }], sam: [{ debut: "08:00", fin: "13:00" }] },
      notes: "Gardien logé. Astreinte nocturne assurée par la loge.",
    },
  });
  const personnelAgent = await prisma.personnel.create({
    data: {
      coproprieteId: copro.id, utilisateurId: agentUser.id, statut: "PRESENT", poste: "AGENT_ENTRETIEN", typeContrat: "CDD",
      dateEmbauche: new Date(`${new Date().getUTCFullYear()}-02-01`), dateFinContrat: new Date(Date.now() + 25 * 24 * 3600 * 1000), salaireBrutMensuel: "3300.00", numeroCnss: "220099887",
      horairesJson: { lun: [{ debut: "08:00", fin: "12:00" }], mer: [{ debut: "08:00", fin: "12:00" }], ven: [{ debut: "08:00", fin: "12:00" }] },
    },
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

  // ── M19 — Contrats, assurances, échéances (Doc A §7, §8) ──────────────────────
  await prisma.copropriete.update({ where: { id: copro.id }, data: { seuilContratAg: "20000.00" } }); // PROVISOIRE (brief §10)
  const ascenseursAtlas = await prisma.prestataire.create({
    data: { coproprieteId: copro.id, nom: "Ascenseurs Atlas", specialite: "Ascenseur", contact: "+212522445566", telephone: "+212522445566", email: "contact@ascenseurs-atlas.ma", ice: "001998877000045", rc: "RC 77120" },
  });
  const contratDoc = (nom: string) => `${copro.id}/contrats/${randomUUID()}-${nom}`;
  const creerContratSeed = async (data: Parameters<typeof prisma.contrat.create>[0]["data"], logs: { type: "CREE" | "ACTIVE" | "ECHEANCES_GENEREES" | "SUSPENDU" | "EXPIRE"; il: number; details?: object }[]) => {
    const c = await prisma.contrat.create({ data });
    await prisma.contratLog.createMany({ data: logs.map((l) => ({ coproprieteId: copro.id, contratId: c.id, type: l.type, acteurId: syndicUser.id, detailsJson: l.details ?? undefined, horodatage: jour(-l.il) })) });
    return c;
  };
  const echeancesMensuelles = (contratId: string, montant: string, ancreJour: number, n = 6) => {
    const rows: { contratId: string; type: "PAIEMENT"; dateEcheance: Date; montant: string; statut: "A_VENIR" }[] = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
      const y = now.getUTCFullYear(), m = now.getUTCMonth() + i;
      const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const d = new Date(Date.UTC(y, m, Math.min(ancreJour, dim)));
      if (d < jour(0)) continue;
      rows.push({ contratId, type: "PAIEMENT", dateEcheance: d, montant, statut: "A_VENIR" });
    }
    return rows;
  };
  // 1. Maintenance ascenseur — ACTIF, mensuel, tacite, préavis 60 j, contrat signé, échéancier généré.
  const docAscenseur = await prisma.document.create({ data: { coproprieteId: copro.id, type: "CONTRAT", nom: "Contrat maintenance ascenseur 2026.pdf", visibilite: "SYNDIC_ONLY", storagePath: contratDoc("contrat-ascenseur.pdf"), creePar: syndicUser.id } });
  const contratAscenseur = await creerContratSeed(
    { coproprieteId: copro.id, prestataireId: ascenseursAtlas.id, type: "ASCENSEUR", libelle: "Maintenance ascenseur (contrat complet)", reference: "ASC-2026-014", dateDebut: new Date(`${exercice}-01-31`), dateFin: new Date(`${exercice}-12-31`), tacite: true, preavisJours: 60, periodicite: "MENSUELLE", montantPeriode: "1500.00", budgetPosteId: postes.ENTRETIEN_COURANT, statut: "ACTIF", documentId: docAscenseur.id, notes: "Visite mensuelle + astreinte 24/7. Deux cabines.", creeParId: syndicUser.id },
    [{ type: "CREE", il: 240 }, { type: "ACTIVE", il: 239 }, { type: "ECHEANCES_GENEREES", il: 239, details: { creees: 12, horizon_mois: 12 } }]
  );
  await prisma.contratEcheance.createMany({ data: [...echeancesMensuelles(contratAscenseur.id, "1500.00", 31), { contratId: contratAscenseur.id, type: "RENOUVELLEMENT", dateEcheance: new Date(`${exercice}-11-01`), montant: null, statut: "A_VENIR" }, { contratId: contratAscenseur.id, type: "VISITE_TECHNIQUE", dateEcheance: jour(12), montant: null, statut: "A_VENIR" }] });
  // 2. Nettoyage des parties communes — ACTIF, mensuel, lié à la dépense payée « Nettoyage janvier » (Propreté Maroc).
  const contratNettoyage = await creerContratSeed(
    { coproprieteId: copro.id, prestataireId: proprete.id, type: "NETTOYAGE", libelle: "Nettoyage des parties communes", reference: "NET-2025-09", dateDebut: new Date(`${Number(exercice) - 1}-09-01`), dateFin: new Date(`${exercice}-08-31`), tacite: true, preavisJours: 30, periodicite: "MENSUELLE", montantPeriode: "1000.00", budgetPosteId: postes.ENTRETIEN_COURANT, statut: "ACTIF", creeParId: syndicUser.id },
    [{ type: "CREE", il: 370 }, { type: "ACTIVE", il: 369 }]
  );
  await prisma.contratEcheance.createMany({ data: echeancesMensuelles(contratNettoyage.id, "1000.00", 1) });
  await prisma.depense.update({ where: { id: depNettoyage.id }, data: { contratId: contratNettoyage.id } });
  // 3. Assurance multirisque immeuble — ACTIF, annuelle, attestation jointe, détails de la police.
  const attestation = await prisma.document.create({ data: { coproprieteId: copro.id, type: "ATTESTATION_ASSURANCE", nom: `Attestation multirisque ${exercice}.pdf`, visibilite: "CONSEIL_SYNDICAL", storagePath: contratDoc("attestation-mri.pdf"), creePar: syndicUser.id } });
  const contratAssurance = await creerContratSeed(
    { coproprieteId: copro.id, type: "ASSURANCE_IMMEUBLE", libelle: "Multirisque immeuble — Wafa Assurance", reference: "MRI-778812", dateDebut: new Date(`${exercice}-01-01`), dateFin: new Date(`${exercice}-12-31`), tacite: true, preavisJours: 60, periodicite: "ANNUELLE", montantPeriode: "4000.00", budgetPosteId: postes.ASSURANCE, statut: "ACTIF", attestationDocumentId: attestation.id, detailsAssuranceJson: { assureur: "Wafa Assurance", numero_police: "MRI-778812", garanties: ["Incendie", "Dégât des eaux", "Responsabilité civile", "Bris de glace"], franchise: "1500.00", capital_assure: "12000000.00" }, creeParId: syndicUser.id },
    [{ type: "CREE", il: 250 }, { type: "ACTIVE", il: 249 }]
  );
  await prisma.contratEcheance.createMany({ data: [{ contratId: contratAssurance.id, type: "PAIEMENT", dateEcheance: new Date(`${Number(exercice) + 1}-01-01`), montant: "4000.00", statut: "A_VENIR" }, { contratId: contratAssurance.id, type: "RENOUVELLEMENT", dateEcheance: new Date(`${exercice}-11-01`), montant: null, statut: "A_VENIR" }] });
  // 4. Dératisation — BROUILLON (devis reçu, pas encore signé), semestriel.
  await creerContratSeed(
    { coproprieteId: copro.id, prestataireId: prestataire.id, type: "DERATISATION", libelle: "Dératisation semestrielle", dateDebut: jour(20), dateFin: null, tacite: false, periodicite: "SEMESTRIELLE", montantPeriode: "900.00", budgetPosteId: postes.ENTRETIEN_COURANT, statut: "BROUILLON", notes: "Devis reçu, signature en attente.", creeParId: syndicUser.id },
    [{ type: "CREE", il: 3 }]
  );
  // 5. Gardiennage externe — EXPIRE il y a 40 jours (non reconduit) : apparaît dans « à renouveler ».
  await creerContratSeed(
    { coproprieteId: copro.id, type: "GARDIENNAGE", libelle: "Gardiennage de nuit (société externe)", reference: "GARD-2025", dateDebut: jour(-405), dateFin: jour(-40), tacite: false, periodicite: "MENSUELLE", montantPeriode: "6000.00", statut: "EXPIRE", creeParId: syndicUser.id },
    [{ type: "CREE", il: 405 }, { type: "ACTIVE", il: 404 }, { type: "EXPIRE", il: 40, details: { date_fin: jour(-40).toISOString().slice(0, 10) } }]
  );

  // ── M20 — Personnel RH : paramètres de paie, fiches, congés, présences, évaluations (Doc A §9) ──
  const periodePaie = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  await prisma.copropriete.update({
    where: { id: copro.id },
    data: {
      // PROVISOIRE (LEGAL_QUESTIONS_BRIEF §11) — valeurs indicatives de démonstration, saisies par le syndic.
      parametresPaieJson: {
        smig_mensuel: "3200.00", taux_cnss_salarial: "4.48", plafond_cnss: "6000.00", taux_amo_salarial: "2.26",
        taux_cnss_patronal: "8.98", taux_allocations_familiales: "6.40", taux_amo_patronal: "4.11", taux_formation_pro: "1.60",
        taux_frais_professionnels: "25", plafond_frais_professionnels_mensuel: "2500.00",
        tranches_ir: [
          { jusqua: "40000.00", taux: "0", deduction: "0.00" }, { jusqua: "60000.00", taux: "10", deduction: "4000.00" }, { jusqua: "80000.00", taux: "20", deduction: "10000.00" },
          { jusqua: "100000.00", taux: "30", deduction: "18000.00" }, { jusqua: "180000.00", taux: "34", deduction: "22000.00" }, { jusqua: null, taux: "37", deduction: "27400.00" },
        ],
        jours_conge_annuels: "18", jours_ouvres_mois: 26, retenue_absence_injustifiee: true,
        source: "Seed de démonstration — valeurs indicatives à confirmer (brief §11)",
      },
    },
  });
  const { calculerPaie } = await import("../../../apps/api/lib/personnel/paie");
  const paramsPaie = (await prisma.copropriete.findUniqueOrThrow({ where: { id: copro.id }, select: { parametresPaieJson: true } })).parametresPaieJson as Parameters<typeof calculerPaie>[0];
  const logRh = (personnelId: string, type: "FICHE_CREEE" | "PAIE_BROUILLON" | "PAIE_VALIDEE" | "PAIE_PAYEE" | "CONGE_DEMANDE" | "CONGE_APPROUVE" | "PRESENCE_SAISIE" | "EVALUATION", il: number, details?: object, acteur: string | null = syndicUser.id) =>
    prisma.personnelLog.create({ data: { coproprieteId: copro.id, personnelId, type, acteurId: acteur, detailsJson: details ?? undefined, horodatage: jour(-il) } });
  await logRh(personnelGardien.id, "FICHE_CREEE", 400, { poste: "GARDIEN" });
  await logRh(personnelAgent.id, "FICHE_CREEE", 210, { poste: "AGENT_ENTRETIEN" });
  // 1. Fiche de paie du mois précédent du gardien : VALIDEE → dépense PERSONNEL payée → PAYEE.
  const paieGardien = calculerPaie(paramsPaie, { brut: "4500.00" });
  const depPaie = await prisma.depense.create({
    data: { coproprieteId: copro.id, budgetAgId: budget.id, budgetPosteId: postes.PERSONNEL, categorie: "PERSONNEL", libelle: `Paie ${periodePaie} — Rachid Ouazzani`, montantTtc: paieGardien.cout_total_employeur, dateDepense: new Date(`${periodePaie}-28`), statut: "PAYEE", source: "COMPTE_COURANT", creeParId: syndicUser.id, approuveParId: syndicUser.id, approuveLe: jour(-8), payeLe: new Date(`${periodePaie}-30`), methodePaiement: "VIREMENT", referencePaiement: `VIR-PAIE-${periodePaie}`, personnelId: personnelGardien.id, periodePaie },
  });
  await prisma.fichePaie.create({
    data: { coproprieteId: copro.id, personnelId: personnelGardien.id, periode: periodePaie, brut: "4500.00", cotisationsSalarialesJson: paieGardien.cotisations_salariales, cotisationsPatronalesJson: paieGardien.cotisations_patronales, net: paieGardien.net, coutTotalEmployeur: paieGardien.cout_total_employeur, detailsJson: paieGardien as object, statut: "PAYEE", depenseId: depPaie.id, valideParId: syndicUser.id, valideLe: jour(-8) },
  });
  await logRh(personnelGardien.id, "PAIE_VALIDEE", 8, { periode: periodePaie, net: paieGardien.net });
  await logRh(personnelGardien.id, "PAIE_PAYEE", 6, { periode: periodePaie, methode: "VIREMENT" });
  // 2. Fiche de l'agent, même mois : BROUILLON (à valider par le syndic).
  const paieAgent = calculerPaie(paramsPaie, { brut: "3300.00" });
  await prisma.fichePaie.create({
    data: { coproprieteId: copro.id, personnelId: personnelAgent.id, periode: periodePaie, brut: "3300.00", cotisationsSalarialesJson: paieAgent.cotisations_salariales, cotisationsPatronalesJson: paieAgent.cotisations_patronales, net: paieAgent.net, coutTotalEmployeur: paieAgent.cout_total_employeur, detailsJson: paieAgent as object, statut: "BROUILLON" },
  });
  await logRh(personnelAgent.id, "PAIE_BROUILLON", 3, { periode: periodePaie, systeme: true }, null);
  // 3. Congés : un congé annuel approuvé (gardien, remplacé par l'agent) + une demande en attente (agent).
  const congeApprouve = await prisma.conge.create({
    data: { coproprieteId: copro.id, personnelId: personnelGardien.id, type: "ANNUEL", dateDebut: jour(12), dateFin: jour(17), nbJours: "5", statut: "APPROUVE", traiteParId: syndicUser.id, traiteLe: jour(-2), motif: "Congé familial", remplacantPersonnelId: personnelAgent.id, creeLe: jour(-5) },
  });
  for (let d = 12; d <= 17; d++) {
    if (jour(d).getUTCDay() === 0) continue;
    await prisma.presencePersonnel.create({ data: { coproprieteId: copro.id, personnelId: personnelGardien.id, date: jour(d), statut: "CONGE", commentaire: "Congé ANNUEL", saisiParId: syndicUser.id } });
  }
  await logRh(personnelGardien.id, "CONGE_DEMANDE", 5, { conge_id: congeApprouve.id, type: "ANNUEL" }, gardienUser.id);
  await logRh(personnelGardien.id, "CONGE_APPROUVE", 2, { conge_id: congeApprouve.id });
  await prisma.conge.create({ data: { coproprieteId: copro.id, personnelId: personnelAgent.id, type: "MALADIE", dateDebut: jour(1), dateFin: jour(2), nbJours: "2", statut: "DEMANDE", motif: "Certificat à remettre", creeLe: jour(-1) } });
  // 4. Présences du mois : gardien présent (pointage mobile), une absence injustifiée.
  for (let d = -10; d <= 0; d++) {
    const date = jour(d);
    if (date.getUTCDay() === 0) continue;
    await prisma.presencePersonnel.create({ data: { coproprieteId: copro.id, personnelId: personnelGardien.id, date, statut: d === -4 ? "ABSENT" : "PRESENT", commentaire: d === -4 ? "Absence non justifiée" : null, saisiParId: d === -4 ? syndicUser.id : gardienUser.id } });
  }
  await logRh(personnelGardien.id, "PRESENCE_SAISIE", 0, { self: true, statut: "PRESENT" }, gardienUser.id);
  // 5. Évaluations semestrielles (syndic + conseil) — jamais visibles des résidents.
  await prisma.evaluationPersonnel.createMany({ data: [
    { coproprieteId: copro.id, personnelId: personnelGardien.id, periode: `${new Date().getUTCFullYear()}-S1`, note: 5, commentaire: "Ponctuel, très apprécié des résidents.", evaluateurId: syndicUser.id },
    { coproprieteId: copro.id, personnelId: personnelGardien.id, periode: `${new Date().getUTCFullYear()}-S1`, note: 4, commentaire: "Bon relationnel ; améliorer le suivi des tickets.", evaluateurId: conseilUser.id },
  ] });
  await logRh(personnelGardien.id, "EVALUATION", 30, { periode: `${new Date().getUTCFullYear()}-S1`, note: 5 });


  // ── M21 — Communication : bâtiments, contacts utiles, tableau d'affichage, sondages (Doc A §8, §12) ──
  // Bâtiments (colonne lot.batiment, ⚠️ ajout signalé M21) : A1 / A2 dans le bâtiment A, A3 dans le B.
  await prisma.lot.updateMany({ where: { id: { in: [lotA1.id, lotA2.id, parkingP1.id, loge.id] } }, data: { batiment: "A" } });
  await prisma.lot.updateMany({ where: { id: lotA3.id }, data: { batiment: "B" } });
  // Numéros nationaux + contacts propres à la résidence (tap-to-call).
  await prisma.contactUtile.createMany({
    data: [
      { coproprieteId: copro.id, libelle: "Pompiers / Protection civile", telephone: "15", ordre: 1 },
      { coproprieteId: copro.id, libelle: "Police", telephone: "19", ordre: 2 },
      { coproprieteId: copro.id, libelle: "Gendarmerie royale", telephone: "177", ordre: 3 },
      { coproprieteId: copro.id, libelle: "SAMU", telephone: "141", ordre: 4 },
      { coproprieteId: copro.id, libelle: "Lydec (eau / électricité) — dépannage", telephone: "+212 522 31 20 20", ordre: 5 },
      { coproprieteId: copro.id, libelle: "Ascensoriste (astreinte 24h/24)", telephone: "+212 522 44 55 66", ordre: 6 },
      { coproprieteId: copro.id, libelle: "Loge du gardien", telephone: "+212 600 00 00 06", ordre: 7 },
    ],
  });
  const heure = (deltaJours: number, h: number) => { const d = jour(deltaJours); d.setUTCHours(h, 0, 0, 0); return d; };
  const annonce = (data: Omit<Parameters<typeof prisma.annonce.create>[0]["data"], "coproprieteId">) => prisma.annonce.create({ data: { coproprieteId: copro.id, ...data } });
  // 1. URGENCE épinglée (syndic) : coupure d'eau ce soir — lue par une partie des résidents, commentée.
  const annCoupure = await annonce({ auteurId: syndicUser.id, titre: "Coupure d'eau ce soir de 20h à 23h", contenu: "Lydec intervient sur la conduite principale de la rue des Orangers.\n\n- Pensez à faire vos réserves.\n- L'ascenseur reste en service.\n\nContact : voir **Contacts utiles**.", categorie: "URGENCE", audience: "TOUS", epingle: true, statut: "PUBLIEE", publieLe: heure(0, 9), expireLe: heure(1, 6), commentairesActives: true, creeLe: heure(0, 8) });
  await prisma.annonceLecture.createMany({ data: [{ annonceId: annCoupure.id, utilisateurId: proprietaireA.id, luLe: heure(0, 9) }, { annonceId: annCoupure.id, utilisateurId: locataire.id, luLe: heure(0, 10) }, { annonceId: annCoupure.id, utilisateurId: gardienUser.id, luLe: heure(0, 9) }] });
  const comm1 = await prisma.annonceCommentaire.create({ data: { annonceId: annCoupure.id, auteurId: locataire.id, contenu: "Merci pour l'info, la pression était déjà faible ce matin.", creeLe: heure(0, 10) } });
  await prisma.annonceCommentaire.create({ data: { annonceId: annCoupure.id, auteurId: syndicUser.id, contenu: "Oui, c'est lié : Lydec purge le réseau avant l'intervention.", creeLe: heure(0, 11) } });
  await prisma.annonceCommentaire.create({ data: { annonceId: annCoupure.id, auteurId: proprietaireMRE.id, contenu: "Encore une coupure, c'est n'importe quoi ce syndic !!!", masqueParId: syndicUser.id, masqueLe: heure(0, 12), creeLe: heure(0, 11) } });
  // 2. TRAVAUX — ravalement du bâtiment B (audience BATIMENT « B »), avec pièce jointe.
  const annRavalement = await annonce({ auteurId: syndicUser.id, titre: "Ravalement de la façade du bâtiment B", contenu: "Les échafaudages seront montés **lundi prochain** pour six semaines.\n\n- Merci de libérer les balcons.\n- Les fenêtres seront protégées par des films.\n\nLe planning détaillé est en pièce jointe.", categorie: "TRAVAUX", audience: "BATIMENT", batiment: "B", epingle: false, statut: "PUBLIEE", publieLe: heure(-3, 10), commentairesActives: true, creeLe: heure(-3, 9) });
  await prisma.document.create({ data: { coproprieteId: copro.id, type: "ANNONCE_PJ", nom: "planning-ravalement-batiment-B.pdf", visibilite: "PUBLIC_COPROPRIETE", storagePath: `${copro.id}/communication/seed-planning-ravalement.pdf`, creePar: syndicUser.id, annonceId: annRavalement.id, creeLe: heure(-3, 9) } });
  await prisma.annonceLecture.createMany({ data: [{ annonceId: annRavalement.id, utilisateurId: indivisaire1.id, luLe: heure(-2, 8) }] });
  // 3. AG — convocation à venir (audience PROPRIETAIRES), publiée par le conseil.
  const annAg = await annonce({ auteurId: conseilUser.id, titre: "Assemblée générale : ordre du jour disponible", contenu: "L'ordre du jour de la prochaine AG est consultable dans l'application. Les procurations doivent parvenir au syndic **48 h avant** la séance.", categorie: "AG", audience: "PROPRIETAIRES", epingle: false, statut: "PUBLIEE", publieLe: heure(-6, 18), commentairesActives: false, creeLe: heure(-6, 17) });
  await prisma.annonceLecture.createMany({ data: [{ annonceId: annAg.id, utilisateurId: proprietaireA.id, luLe: heure(-5, 8) }, { annonceId: annAg.id, utilisateurId: proprietaireMRE.id, luLe: heure(-4, 20) }] });
  // 4. CONVIVIALITÉ — ftour de la résidence (TOUS), publiée il y a 12 jours.
  await annonce({ auteurId: syndicUser.id, titre: "Ftour de la résidence samedi soir", contenu: "Rendez-vous dans la cour à partir de 19h30. Chacun apporte un plat ; le syndic offre les boissons.", categorie: "CONVIVIALITE", audience: "TOUS", epingle: false, statut: "PUBLIEE", publieLe: heure(-12, 12), commentairesActives: true, creeLe: heure(-12, 11) });
  // 5. RÈGLEMENT — rappel (CONSEIL), 6. brouillon programmé, 7. archivée.
  await annonce({ auteurId: syndicUser.id, titre: "Rappel : encombrants et parties communes", contenu: "Les encombrants déposés dans le hall seront enlevés aux frais de leur propriétaire (règlement de copropriété, art. 12).", categorie: "REGLEMENT", audience: "TOUS", epingle: false, statut: "PUBLIEE", publieLe: heure(-20, 9), commentairesActives: true, creeLe: heure(-20, 9) });
  await annonce({ auteurId: syndicUser.id, titre: "Contrôle annuel de l'ascenseur", contenu: "Le technicien passera jeudi matin ; l'ascenseur sera indisponible de 9h à 12h.", categorie: "INFORMATION", audience: "TOUS", epingle: false, statut: "BROUILLON", publieLe: heure(2, 8), commentairesActives: true, creeLe: heure(0, 14) });
  await annonce({ auteurId: syndicUser.id, titre: "Nettoyage des cuves d'eau (terminé)", contenu: "Les cuves ont été nettoyées et désinfectées le mois dernier.", categorie: "COUPURE", audience: "TOUS", epingle: false, statut: "ARCHIVEE", publieLe: heure(-45, 9), expireLe: heure(-40, 9), commentairesActives: true, creeLe: heure(-45, 9) });
  // Sondages : un OUVERT pondéré (repeindre le hall — propriétaires), un CLOS (horaires du gardien — tous), un brouillon.
  const sondageHall = await prisma.sondage.create({ data: { coproprieteId: copro.id, auteurId: syndicUser.id, question: "Repeindre le hall d'entrée cette année ?", description: "Devis obtenu : 18 000 MAD (fonds de réserve). Sondage consultatif avant inscription à l'ordre du jour de l'AG.", optionsJson: [{ id: "oui", libelle: "Oui, cette année" }, { id: "plus_tard", libelle: "Plutôt l'année prochaine" }, { id: "non", libelle: "Non, pas prioritaire" }], choixMultiple: false, anonyme: true, audience: "PROPRIETAIRES", ponderationTantiemes: true, dateFin: heure(10, 18), statut: "OUVERT", ouvertLe: heure(-4, 10), creeLe: heure(-5, 10) } });
  await prisma.sondageReponse.createMany({ data: [{ sondageId: sondageHall.id, utilisateurId: proprietaireA.id, choixJson: ["oui"], creeLe: heure(-3, 9) }, { sondageId: sondageHall.id, utilisateurId: indivisaire1.id, choixJson: ["plus_tard"], creeLe: heure(-2, 20) }] });
  const sondageGardien = await prisma.sondage.create({ data: { coproprieteId: copro.id, auteurId: conseilUser.id, question: "Quels créneaux de présence du gardien privilégier ?", optionsJson: [{ id: "matin", libelle: "Tôt le matin (6h-8h)" }, { id: "soir", libelle: "Le soir (18h-21h)" }, { id: "weekend", libelle: "Le week-end" }], choixMultiple: true, anonyme: true, audience: "TOUS", ponderationTantiemes: false, dateFin: heure(-15, 18), statut: "CLOS", ouvertLe: heure(-30, 10), closLe: heure(-15, 18), creeLe: heure(-31, 10) } });
  await prisma.sondageReponse.createMany({ data: [
    { sondageId: sondageGardien.id, utilisateurId: proprietaireA.id, choixJson: ["soir", "weekend"], creeLe: heure(-28, 9) },
    { sondageId: sondageGardien.id, utilisateurId: locataire.id, choixJson: ["soir"], creeLe: heure(-27, 21) },
    { sondageId: sondageGardien.id, utilisateurId: proprietaireMRE.id, choixJson: ["weekend"], creeLe: heure(-25, 9) },
    { sondageId: sondageGardien.id, utilisateurId: indivisaire2.id, choixJson: ["matin", "soir"], creeLe: heure(-20, 12) },
  ] });
  await prisma.sondage.create({ data: { coproprieteId: copro.id, auteurId: syndicUser.id, question: "Installer des bornes de recharge au parking ?", optionsJson: [{ id: "oui", libelle: "Oui" }, { id: "non", libelle: "Non" }], choixMultiple: false, anonyme: true, audience: "PROPRIETAIRES", ponderationTantiemes: true, dateFin: heure(30, 18), statut: "BROUILLON", creeLe: heure(0, 15) } });
  // Préférences de notification : le MRE ne veut que le digest par e-mail, le gardien rien le lundi.
  await prisma.utilisateur.update({ where: { id: proprietaireMRE.id }, data: { preferencesNotificationJson: { digest_hebdo: true, canal_digest: "EMAIL", annonces_push: false } } });
  await prisma.utilisateur.update({ where: { id: gardienUser.id }, data: { preferencesNotificationJson: { digest_hebdo: false, canal_digest: "PUSH", annonces_push: true } } });
  await prisma.auditLog.createMany({ data: [
    { coproprieteId: copro.id, acteurId: syndicUser.id, action: "ANNONCE_PUBLIEE", entite: "annonce", entiteId: annCoupure.id, apresJson: { statut: "PUBLIEE", destinataires: 8 }, horodatage: heure(0, 9) },
    { coproprieteId: copro.id, acteurId: syndicUser.id, action: "COMMENTAIRE_MASQUE", entite: "annonce_commentaire", entiteId: comm1.id, apresJson: { masque: true }, horodatage: heure(0, 12) },
    { coproprieteId: copro.id, acteurId: syndicUser.id, action: "SONDAGE_OUVERT", entite: "sondage", entiteId: sondageHall.id, apresJson: { statut: "OUVERT" }, horodatage: heure(-4, 10) },
    { coproprieteId: copro.id, acteurId: conseilUser.id, action: "SONDAGE_CLOS", entite: "sondage", entiteId: sondageGardien.id, apresJson: { statut: "CLOS", nb_reponses: 4 }, horodatage: heure(-15, 18) },
  ] });

  // ── M22 — Tâches et suivi des décisions (Doc A §6, §8) ──
  await prisma.copropriete.update({ where: { id: copro.id }, data: { delaiExecutionResolutionJours: 60 } }); // PROVISOIRE (brief §13)
  await prisma.agResolution.update({ where: { id: resolutionPompe.id }, data: { necessiteExecution: true } });
  const tacheSeed = async (data: Omit<Parameters<typeof prisma.tache.create>[0]["data"], "coproprieteId">, logs: { type: "CREEE" | "STATUT_CHANGE" | "CHECKLIST" | "ASSIGNEE" | "COMMENTAIRE" | "RECURRENCE" | "RAPPEL"; il: number; details?: object; acteur?: string | null }[]) => {
    const t = await prisma.tache.create({ data: { coproprieteId: copro.id, ...data } });
    await prisma.tacheLog.createMany({ data: logs.map((l) => ({ coproprieteId: copro.id, tacheId: t.id, type: l.type, acteurId: l.acteur === undefined ? syndicUser.id : l.acteur, detailsJson: l.details ?? undefined, horodatage: jour(-l.il) })) });
    return t;
  };
  // 1. Résolution adoptée à l'AG passée → exécutée (pompe remplacée, dépense payée).
  const tachePompe = await tacheSeed(
    { titre: `Exécuter la résolution n° 1 : ${resolutionPompe.texte}`, origine: "RESOLUTION_AG", resolutionAgId: resolutionPompe.id, assigneeId: syndicUser.id, priorite: "HAUTE", statut: "TERMINEE", dateEcheance: jour(-120), termineeLe: jour(-140), creeLe: jour(-180) },
    [{ type: "CREEE", il: 180, details: { origine: "RESOLUTION_AG", systeme: true }, acteur: null }, { type: "STATUT_CHANGE", il: 160, details: { de: "A_FAIRE", vers: "EN_COURS" } }, { type: "STATUT_CHANGE", il: 140, details: { de: "EN_COURS", vers: "TERMINEE", commentaire: "Pompe remplacée, facture réglée sur le fonds de réserve." } }]
  );
  await prisma.tacheCommentaire.create({ data: { tacheId: tachePompe.id, auteurId: syndicUser.id, contenu: "Pompe remplacée, facture réglée sur le fonds de réserve.", creeLe: jour(-140) } });
  // 2. Échéances de contrat (renouvellement / visite technique) → tâches liées (contrat_echeance.tache_id).
  const echeancesNonFin = await prisma.contratEcheance.findMany({ where: { contratId: contratAscenseur.id, type: { in: ["RENOUVELLEMENT", "VISITE_TECHNIQUE"] }, statut: "A_VENIR" } });
  for (const e of echeancesNonFin) {
    const t = await tacheSeed(
      { titre: `${e.type === "RENOUVELLEMENT" ? "Renouveler ou résilier le contrat" : "Visite technique"} — ${contratAscenseur.libelle}`, origine: "CONTRAT", assigneeId: syndicUser.id, priorite: e.type === "RENOUVELLEMENT" ? "HAUTE" : "NORMALE", dateEcheance: e.dateEcheance, creeLe: jour(-239) },
      [{ type: "CREEE", il: 239, details: { origine: "CONTRAT", echeance_id: e.id, type: e.type }, acteur: null }]
    );
    await prisma.contratEcheance.update({ where: { id: e.id }, data: { tacheId: t.id } });
  }
  // 3. Incident résolu dont la dépense attend l'approbation → « Régler la dépense ».
  await tacheSeed(
    { titre: `Régler la dépense de l'incident : ${depReparation.libelle}`, description: "Dépense APPROUVEE liée à un incident résolu — paiement à enregistrer.", origine: "INCIDENT", incidentId: incidentAtlas.id, assigneeId: syndicUser.id, priorite: "NORMALE", statut: "EN_COURS", dateEcheance: jour(4), creeLe: jour(-3) },
    [{ type: "CREEE", il: 3, details: { origine: "INCIDENT", systeme: true }, acteur: null }, { type: "STATUT_CHANGE", il: 1, details: { de: "A_FAIRE", vers: "EN_COURS" } }]
  );
  // 4. Rapport de gestion GENERE → « Soumettre à l'AG » (en retard : la prochaine AG approche).
  await tacheSeed(
    { titre: `Soumettre le rapport de gestion ${exercice} à l'AG`, origine: "RAPPORT", rapportGestionId: rapportCourant.id, assigneeId: syndicUser.id, priorite: "HAUTE", dateEcheance: jour(-2), creeLe: jour(-10), rappelJ3Le: jour(-5), rappelJ0Le: jour(-2), rappelRetardLe: jour(-1) },
    [{ type: "CREEE", il: 10, details: { origine: "RAPPORT", systeme: true }, acteur: null }, { type: "RAPPEL", il: 5, details: { type: "j3" }, acteur: null }, { type: "RAPPEL", il: 2, details: { type: "j0" }, acteur: null }, { type: "RAPPEL", il: 1, details: { type: "retard" }, acteur: null }]
  );
  // 5. Obligation récurrente du gardien (checklist, trimestrielle) : occurrence précédente terminée, suivante en cours.
  const cuvesPrecedente = await tacheSeed(
    { titre: "Nettoyage et désinfection des cuves d'eau", description: "Obligation sanitaire trimestrielle (Doc A §8).", origine: "MANUELLE", assigneeId: gardienUser.id, priorite: "NORMALE", statut: "TERMINEE", dateEcheance: jour(-75), termineeLe: jour(-76), checklistJson: [{ id: "c1", libelle: "Vidange", fait: true }, { id: "c2", libelle: "Brossage et désinfection", fait: true }, { id: "c3", libelle: "Remise en eau et contrôle", fait: true }], recurrenceJson: { frequence: "TRIMESTRIELLE" }, visibleConseil: true, creeParId: syndicUser.id, creeLe: jour(-100) },
    [{ type: "CREEE", il: 100, details: { origine: "MANUELLE" } }, { type: "CHECKLIST", il: 77, details: { faits: 3, total: 3 }, acteur: gardienUser.id }, { type: "STATUT_CHANGE", il: 76, details: { de: "A_FAIRE", vers: "TERMINEE" }, acteur: gardienUser.id }]
  );
  const cuvesSuivante = await tacheSeed(
    { titre: "Nettoyage et désinfection des cuves d'eau", description: "Obligation sanitaire trimestrielle (Doc A §8).", origine: "SYSTEME", recurrenceParenteId: cuvesPrecedente.id, assigneeId: gardienUser.id, priorite: "NORMALE", statut: "EN_COURS", dateEcheance: jour(15), checklistJson: [{ id: "c1", libelle: "Vidange", fait: true }, { id: "c2", libelle: "Brossage et désinfection", fait: false }, { id: "c3", libelle: "Remise en eau et contrôle", fait: false }], recurrenceJson: { frequence: "TRIMESTRIELLE" }, visibleConseil: true, creeParId: syndicUser.id, creeLe: jour(-76) },
    [{ type: "RECURRENCE", il: 76, details: { parente_id: cuvesPrecedente.id, frequence: "TRIMESTRIELLE" }, acteur: null }, { type: "STATUT_CHANGE", il: 2, details: { de: "A_FAIRE", vers: "EN_COURS", commentaire: "Vidange faite ce matin." }, acteur: gardienUser.id }, { type: "CHECKLIST", il: 2, details: { faits: 1, total: 3 }, acteur: gardienUser.id }]
  );
  await prisma.tacheCommentaire.create({ data: { tacheId: cuvesSuivante.id, auteurId: gardienUser.id, contenu: "Vidange faite ce matin, désinfection demain.", creeLe: jour(-2) } });
  // 6. Tâches manuelles : extincteurs (conseil, bloquée), déclaration CNSS (syndic, à faire), une tâche invisible du conseil.
  await tacheSeed(
    { titre: "Vérification annuelle des extincteurs", description: "Faire passer le prestataire agréé et récupérer le certificat.", origine: "MANUELLE", assigneeId: conseilUser.id, priorite: "HAUTE", statut: "BLOQUEE", dateEcheance: jour(-6), visibleConseil: true, creeParId: syndicUser.id, creeLe: jour(-30), rappelJ3Le: jour(-9), rappelJ0Le: jour(-6), rappelRetardLe: jour(-5) },
    [{ type: "CREEE", il: 30 }, { type: "STATUT_CHANGE", il: 8, details: { de: "A_FAIRE", vers: "BLOQUEE", commentaire: "Le prestataire ne répond pas." }, acteur: conseilUser.id }]
  );
  await tacheSeed(
    { titre: "Déclaration CNSS du personnel", origine: "MANUELLE", assigneeId: syndicUser.id, priorite: "NORMALE", statut: "A_FAIRE", dateEcheance: jour(10), recurrenceJson: { frequence: "MENSUELLE" }, visibleConseil: false, creeParId: syndicUser.id, creeLe: jour(-20) },
    [{ type: "CREEE", il: 20 }]
  );

  // ── M23 — Parkings et caves (Doc A §4) : emplacements non titrés, attributions, véhicules, badges ──
  // (le lot PARKING P1 reste un lot titré — charges par tantièmes ; ici les places communes / visiteurs.)
  const emp = (data: { type: "PARKING_COMMUN" | "PARKING_VISITEUR" | "PARKING_PMR" | "MOTO" | "VELO" | "CAVE_COMMUNE"; code: string; niveau?: string; attribuable?: boolean; statut?: "DISPONIBLE" | "ATTRIBUE" | "HORS_SERVICE"; notes?: string }) =>
    prisma.emplacement.create({ data: { coproprieteId: copro.id, type: data.type, code: data.code, niveau: data.niveau ?? null, attribuable: data.attribuable ?? true, statut: data.statut ?? "DISPONIBLE", notes: data.notes ?? null } });
  const [empV1, empV2, empC12, empC13, empPmr, empMoto, empVelo, empCave] = await Promise.all([
    emp({ type: "PARKING_VISITEUR", code: "P-V1", niveau: "-1", attribuable: false }),
    emp({ type: "PARKING_VISITEUR", code: "P-V2", niveau: "-1", attribuable: false }),
    emp({ type: "PARKING_COMMUN", code: "P-12", niveau: "-1", statut: "ATTRIBUE", notes: "Place commune louée en interne (décision AG)." }),
    emp({ type: "PARKING_COMMUN", code: "P-13", niveau: "-1" }),
    emp({ type: "PARKING_PMR", code: "P-PMR", niveau: "0", attribuable: false, notes: "Réservée — jamais attribuée (Doc A §4)." }),
    emp({ type: "MOTO", code: "M-1", niveau: "-1", statut: "ATTRIBUE" }),
    emp({ type: "VELO", code: "LV-1", niveau: "0", attribuable: false, notes: "Local vélos collectif." }),
    emp({ type: "CAVE_COMMUNE", code: "CC-2", niveau: "-2", statut: "HORS_SERVICE", notes: "Infiltration — en attente de travaux." }),
  ]);
  // Attributions : P-12 loué en interne au lot A2 (redevance 150 MAD / mois, résolution d'AG), M-1 en rotation
  // annuelle au lot A3, une attribution TEMPORAIRE expirée sur P-13 (lot A1, déménagement) déjà notifiée.
  const attribP12 = await prisma.attributionEmplacement.create({
    data: { coproprieteId: copro.id, emplacementId: empC12.id, lotId: lotA2.id, type: "LOCATION_INTERNE", dateDebut: new Date(`${exercice}-01-01`), dateFin: null, resolutionAgId: resolutionPompe.id, redevanceMensuelle: "150.00", notes: "Location interne votée en AG — redevance appelée mensuellement.", creeParId: syndicUser.id, creeLe: jour(-250) },
  });
  await prisma.attributionEmplacement.create({
    data: { coproprieteId: copro.id, emplacementId: empMoto.id, lotId: lotA3.id, type: "ROTATION", dateDebut: jour(-100), dateFin: jour(265), creeParId: syndicUser.id, creeLe: jour(-100) },
  });
  await prisma.attributionEmplacement.create({
    data: { coproprieteId: copro.id, emplacementId: empC13.id, lotId: lotA1.id, type: "TEMPORAIRE", dateDebut: jour(-40), dateFin: jour(-33), notes: "Déménagement — camionnette une semaine.", creeParId: syndicUser.id, creeLe: jour(-41), expireeNotifieeLe: jour(-32) },
  });
  // Véhicules déclarés (plaque normalisée MAJUSCULES, unique par copropriété) : A1, A2 (locataire), A3 (moto).
  const [vehA1, vehA2] = await Promise.all([
    prisma.vehicule.create({ data: { coproprieteId: copro.id, lotId: lotA1.id, utilisateurId: proprietaireA.id, immatriculation: "12345-A-6", marque: "Dacia Logan", couleur: "Blanc", type: "VOITURE" } }),
    prisma.vehicule.create({ data: { coproprieteId: copro.id, lotId: lotA2.id, utilisateurId: locataire.id, immatriculation: "98765-B-40", marque: "Renault Clio", couleur: "Gris", type: "VOITURE" } }),
    prisma.vehicule.create({ data: { coproprieteId: copro.id, lotId: lotA3.id, utilisateurId: indivisaire1.id, immatriculation: "4567-C-12", marque: "Yamaha", couleur: "Noir", type: "MOTO" } }),
    prisma.vehicule.create({ data: { coproprieteId: copro.id, lotId: lotA1.id, utilisateurId: proprietaireA.id, immatriculation: "11111-A-1", marque: "Peugeot 208", couleur: "Rouge", type: "VOITURE", actif: false } }),
  ]);
  // Badges / télécommandes / clés : télécommande A1 avec caution 300 MAD, badge piéton A2 perdu (tâche créée), clé cave A3 restituée.
  const badgeTelecommandeA1 = await prisma.badge.create({
    data: { coproprieteId: copro.id, lotId: lotA1.id, type: "TELECOMMANDE_PARKING", identifiant: "TC-0007", statut: "ACTIF", remisLe: jour(-200), remisParId: syndicUser.id, cautionMontant: "300.00", notes: "Caution encaissée en espèces (reçu n° 2026-014)." },
  });
  const badgePerduA2 = await prisma.badge.create({
    data: { coproprieteId: copro.id, lotId: lotA2.id, type: "BADGE_PIETON", identifiant: "BP-0042", statut: "PERDU", remisLe: jour(-300), remisParId: syndicUser.id, cautionMontant: "100.00", notes: "Perdu le mois dernier — déclaré par le locataire." },
  });
  await prisma.badge.create({
    data: { coproprieteId: copro.id, lotId: lotA2.id, type: "BADGE_PIETON", identifiant: "BP-0058", statut: "ACTIF", remisLe: jour(-25), remisParId: syndicUser.id, cautionMontant: "100.00", notes: "Remplacement du BP-0042." },
  });
  await prisma.badge.create({
    data: { coproprieteId: copro.id, lotId: lotA3.id, type: "CLE_CAVE", identifiant: "CLE-CC-1", statut: "RESTITUE", remisLe: jour(-400), remisParId: syndicUser.id, restitueLe: jour(-15), cautionMontant: null },
  });
  await tacheSeed(
    { titre: `Désactiver le badge perdu BP-0042 (BADGE_PIETON) — lot A2`, description: "Désactivation physique sur la centrale / le portail, puis remise d'un remplacement (dépense éventuelle).", origine: "SYSTEME", assigneeId: syndicUser.id, priorite: "HAUTE", statut: "TERMINEE", dateEcheance: jour(-28), termineeLe: jour(-26), visibleConseil: true, creeLe: jour(-30) },
    [{ type: "CREEE", il: 30, details: { origine: "SYSTEME", systeme: true } }, { type: "STATUT_CHANGE", il: 26, details: { de: "A_FAIRE", vers: "TERMINEE" }, acteur: syndicUser.id }]
  );
  // Place visiteur : visite du jour autorisée par le gardien sur P-V1 (plaque, heure limite dépassée → job VISITEUR_DEPASSEMENT).
  const visiteParking = await prisma.visite.create({
    data: { coproprieteId: copro.id, gardienId: gardienUser.id, lotId: lotA1.id, visiteurNom: "Karim Bennani (livraison)", statut: "AUTORISE", horodatage: new Date(Date.now() - 3 * 3600 * 1000), emplacementId: empV1.id, immatriculation: "55555-D-9", heureLimite: new Date(Date.now() - 30 * 60 * 1000) },
  });
  // Séjour LCD en cours : place visiteur P-V2 attribuée au voyageur (plaque déjà sur le séjour).
  await prisma.sejourCourteDuree.update({ where: { id: sejourEnCours.id }, data: { emplacementId: empV2.id } });
  // « Véhicule sur ma place » : incident PARKING du lot A2 sur P-12 avec plaque signalée (celle du véhicule de A1).
  const incidentVehicule = await prisma.incident.create({
    data: { coproprieteId: copro.id, lotId: lotA2.id, categorie: "PARKING", sousCategorie: "Véhicule sur ma place", description: "Une Dacia blanche occupe la place P-12 depuis ce matin.", partie: "COMMUNE", urgence: "NORMALE", statut: "OUVERT", creePar: locataire.id, slaDeadline: new Date(Date.now() + 48 * 3600 * 1000), emplacementId: empC12.id, immatriculationSignalee: vehA1.immatriculation, photos: [] },
  });
  await prisma.incidentLog.create({ data: { incidentId: incidentVehicule.id, statutAvant: null, statutApres: "OUVERT", acteurId: locataire.id, commentaire: "Signalement depuis la fiche parking." } });
  // Redevance du mois précédent : appel de fonds REDEVANCE_PARKING (⚠️ valeur d'enum ajoutée) émis par le job, réglé par A2.
  const moisPrecedent = new Date(); moisPrecedent.setUTCDate(1); moisPrecedent.setUTCMonth(moisPrecedent.getUTCMonth() - 1);
  const periodeRedevance = moisPrecedent.toISOString().slice(0, 7);
  const appelRedevance = await prisma.appelDeFonds.create({
    data: { coproprieteId: copro.id, periode: periodeRedevance, type: "REDEVANCE_PARKING", montantTotal: "150.00", dateEcheance: new Date(`${periodeRedevance}-15`), statut: "EMIS", lignes: { create: [{ lotId: lotA2.id, montantDu: "150.00", montantPaye: "150.00", statut: "PAYE" }] } },
    include: { lignes: true },
  });
  const paiementRedevance = await prisma.paiement.create({
    data: { lotId: lotA2.id, appelDeFondsLotId: appelRedevance.lignes[0]!.id, montant: "150.00", methode: "ESPECES", statut: "VALIDE", payeurUtilisateurId: locataire.id, enregistreParId: syndicUser.id, dateValeur: new Date(`${periodeRedevance}-10`) },
  });
  void paiementRedevance; void badgeTelecommandeA1; void badgePerduA2; void vehA2; void visiteParking; void attribP12;
  await prisma.auditLog.createMany({
    data: [
      { coproprieteId: copro.id, acteurId: syndicUser.id, action: "EMPLACEMENT_ATTRIBUE", entite: "emplacement", entiteId: empC12.id, apresJson: { attribution_id: attribP12.id, lot_id: lotA2.id, type: "LOCATION_INTERNE", redevance_mensuelle: "150.00" }, horodatage: jour(-250) },
      { coproprieteId: copro.id, acteurId: gardienUser.id, action: "VEHICULE_RECHERCHE", entite: "vehicule", entiteId: vehA1.id, apresJson: { immatriculation: vehA1.immatriculation, resultats: 1 }, horodatage: new Date(Date.now() - 2 * 3600 * 1000) },
      { coproprieteId: copro.id, acteurId: locataire.id, action: "BADGE_PERDU", entite: "badge", entiteId: badgePerduA2.id, avantJson: { statut: "ACTIF" }, apresJson: { statut: "PERDU" }, horodatage: jour(-30) },
    ],
  });

  // ── M24 — Import Excel & onboarding (Doc A §11) : import LOTS_PROPRIETAIRES terminé (fichier source
  // SYNDIC_ONLY, journal ligne à ligne), invitation pré-remplie jamais envoyée seule, solde d'ouverture
  // repris pour A3 (ligne d'appel SOLDE_OUVERTURE ⚠️ valeur d'enum ajoutée, la plus ancienne du relevé). ──
  const docImport = await prisma.document.create({
    data: { coproprieteId: copro.id, type: "IMPORT_SOURCE", nom: "lots-al-amal.xlsx", visibilite: "SYNDIC_ONLY", storagePath: `${copro.id}/import/${randomUUID()}-lots-al-amal.xlsx`, creePar: syndicUser.id, creeLe: jour(-400) },
  });
  const importJob = await prisma.importJob.create({
    data: {
      coproprieteId: copro.id, type: "LOTS_PROPRIETAIRES", documentId: docImport.id, statut: "TERMINE", lanceParId: syndicUser.id, nbLignes: 5, nbTraitees: 5, nbErreurs: 0, creeLe: jour(-400), termineLe: jour(-400),
      mappingJson: { colonnes: [{ index: 0, entete: "N° lot", champ: "numero" }, { index: 1, entete: "Étage", champ: "etage" }, { index: 2, entete: "Tantièmes", champ: "tantiemes" }, { index: 3, entete: "Propriétaire", champ: "nom" }, { index: 4, entete: "Téléphone", champ: "telephone" }], options: { inviter: true, canal: "SMS" } },
      apercuJson: { entetes: ["N° lot", "Étage", "Tantièmes", "Propriétaire", "Téléphone"], feuille: "Lots", colonnes: [], champs: [], lignes: [], avertissements: ["Somme des tantièmes du fichier : 1000.00 — total du règlement : 1000.00."] },
      resultatJson: { crees: 5, mis_a_jour: 0, ignorees: 0, deja_appliquees: 0, erreurs: [] },
    },
  });
  await prisma.importJobLog.createMany({
    data: [
      { coproprieteId: copro.id, importJobId: importJob.id, type: "CREE", horodatage: jour(-400) },
      { coproprieteId: copro.id, importJobId: importJob.id, type: "ANALYSE", detailsJson: { nb_lignes: 5, nb_erreurs: 0 }, horodatage: jour(-400) },
      { coproprieteId: copro.id, importJobId: importJob.id, type: "LANCE", horodatage: jour(-400) },
      ...[lotA1, lotA2, lotA3, parkingP1, loge].map((l, i) => ({ coproprieteId: copro.id, importJobId: importJob.id, type: "LIGNE" as const, ligne: i + 2, hash: `seed-lots-${l.numero.toLowerCase()}`, resultat: "CREE", detailsJson: { lot_id: l.id, numero: l.numero }, horodatage: jour(-400) })),
      { coproprieteId: copro.id, importJobId: importJob.id, type: "TERMINE", detailsJson: { crees: 5 }, horodatage: jour(-400) },
    ],
  });
  // Invitation pré-remplie (locataire de A3, jamais envoyée automatiquement) — l'écran « Invitations en masse » la propose.
  await prisma.invitation.create({
    data: { coproprieteId: copro.id, lotId: lotA3.id, roleCible: "LOCATAIRE", emetteurId: syndicUser.id, canal: "SMS", code: "SEEDIMP1", expireLe: new Date(Date.now() + 48 * 3600 * 1000), importJobId: importJob.id, preRempliJson: { nom: "Tazi", prenom: "Nour", telephone: "+212600000099", email: null, langue: "FR", lots: [{ lot_id: lotA3.id }] } },
  });
  // Solde d'ouverture de A3 : 600 MAD dus au 1er janvier de l'exercice — première ligne du relevé (FIFO, escalade).
  const appelOuverture = await prisma.appelDeFonds.create({
    data: { coproprieteId: copro.id, periode: `${exercice}-01`, type: "SOLDE_OUVERTURE", montantTotal: "600.00", dateEcheance: new Date(`${exercice}-01-01`), statut: "EMIS", lignes: { create: [{ lotId: lotA3.id, montantDu: "600.00", niveauEscalade: "N2", derniereEscaladeLe: jour(-20) }] } },
    include: { lignes: true },
  });
  await prisma.soldeOuverture.create({ data: { coproprieteId: copro.id, lotId: lotA3.id, montant: "600.00", dateReference: new Date(`${exercice}-01-01`), commentaire: "Arriérés repris de l'ancien syndic (tableur).", importJobId: importJob.id, appelDeFondsLotId: appelOuverture.lignes[0]!.id } });
  await prisma.soldeOuverture.create({ data: { coproprieteId: copro.id, lotId: lotA1.id, montant: "-120.00", dateReference: new Date(`${exercice}-01-01`), commentaire: "Trop-perçu de l'ancien syndic (avoir)." } });
  await prisma.auditLog.createMany({
    data: [
      { coproprieteId: copro.id, acteurId: syndicUser.id, action: "IMPORT_CREE", entite: "import_job", entiteId: importJob.id, apresJson: { type: "LOTS_PROPRIETAIRES", nom_fichier: "lots-al-amal.xlsx", nb_lignes: 5 }, horodatage: jour(-400) },
      { coproprieteId: copro.id, acteurId: syndicUser.id, action: "IMPORT_TERMINE", entite: "import_job", entiteId: importJob.id, apresJson: { type: "LOTS_PROPRIETAIRES", crees: 5, mis_a_jour: 0, ignorees: 0, erreurs: 0 }, horodatage: jour(-400) },
    ],
  });

  // ── M25 — Cabinet de syndic (Doc A §8) : « Atlas Gestion » gère Al Amal (mandat actif, honoraires → contrat
  // SYNDIC_PROFESSIONNEL) et une seconde résidence « Les Palmiers » (gestionnaire dédié +212600000010, qui en est le
  // SYNDIC via role_utilisateur.cabinet_id) ; le syndic d'Al Amal est l'administrateur du cabinet. ──
  const gestionnaireCabinet = await prisma.utilisateur.create({
    data: { email: "gestionnaire.cabinet@example.ma", telephone: "+212600000010", nom: "Tahiri", prenom: "Salma", statutCompte: "ACTIF", languePreferee: "FR" },
  });
  const cabinet = await prisma.cabinet.create({
    data: { nom: "Atlas Gestion", raisonSociale: "Atlas Gestion SARL", ice: "001234567000021", rc: "45678", adresse: "12, boulevard Zerktouni, Casablanca", telephone: "+212522000010", email: "contact@atlas-gestion.ma", parametresJson: { seuil_recouvrement: 70, delai_justificatifs_jours: 7 } },
  });
  await prisma.cabinetMembre.createMany({
    data: [
      { cabinetId: cabinet.id, utilisateurId: syndicUser.id, role: "CABINET_ADMIN" },
      { cabinetId: cabinet.id, utilisateurId: gestionnaireCabinet.id, role: "CABINET_GESTIONNAIRE" },
    ],
  });
  const palmiers = await prisma.copropriete.create({
    data: { nom: "Résidence Les Palmiers", adresse: "8, avenue des Palmiers, Quartier Racine", ville: "Casablanca", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 3, totalTantiemes: "1000.00", cabinetId: cabinet.id, comptesBancairesJson: [{ libelle: "Compte syndicat", banque: "Banque Populaire", rib: "190780000234567890123456" }] },
  });
  const lotsPalmiers = await Promise.all([["P-A1", "400.00"], ["P-A2", "300.00"], ["P-A3", "300.00"]].map(([n, t]) => prisma.lot.create({ data: { coproprieteId: palmiers.id, typeLot: "APPARTEMENT", numero: n!, tantiemes: t!, statut: "OCCUPE" } })));
  await prisma.budgetAg.create({ data: { coproprieteId: palmiers.id, exercice, montantTotal: "60000.00", statut: "ACTIF" } });
  await prisma.appelDeFonds.create({
    data: { coproprieteId: palmiers.id, periode: `${exercice}-${String(new Date().getMonth() + 1).padStart(2, "0")}`, type: "CHARGES_COURANTES", montantTotal: "5000.00", dateEcheance: jour(-10), statut: "EMIS", lignes: { create: [{ lotId: lotsPalmiers[0]!.id, montantDu: "2000.00", montantPaye: "2000.00", statut: "PAYE" }, { lotId: lotsPalmiers[1]!.id, montantDu: "1500.00", statut: "IMPAYE", niveauEscalade: "N1" }, { lotId: lotsPalmiers[2]!.id, montantDu: "1500.00", statut: "IMPAYE", niveauEscalade: "N1" }] } },
  });
  await prisma.incident.create({ data: { coproprieteId: palmiers.id, categorie: "ASCENSEUR", sousCategorie: "Ascenseur bloqué", description: "Cabine bloquée au 3e depuis ce matin.", partie: "COMMUNE", urgence: "URGENTE", statut: "OUVERT", creePar: gestionnaireCabinet.id, slaDeadline: new Date(Date.now() + 4 * 3600 * 1000) } });
  // Accès posés par le cabinet (réconciliation cabinet_appliquer_acces) : la gestionnaire est SYNDIC des Palmiers.
  await prisma.roleUtilisateur.create({ data: { utilisateurId: gestionnaireCabinet.id, coproprieteId: palmiers.id, role: "SYNDIC", cabinetId: cabinet.id } });
  const contratHonoraires = await prisma.contrat.create({
    data: { coproprieteId: copro.id, type: "SYNDIC_PROFESSIONNEL", libelle: "Honoraires de syndic — Atlas Gestion", dateDebut: new Date(`${exercice}-01-01`), tacite: true, periodicite: "MENSUELLE", montantPeriode: "2500.00", notes: "Contrat créé par le mandat du cabinet (M25).", creeParId: syndicUser.id, statut: "ACTIF" },
  });
  await prisma.contratLog.create({ data: { coproprieteId: copro.id, contratId: contratHonoraires.id, type: "CREE", acteurId: syndicUser.id, detailsJson: { cabinet: "Atlas Gestion" } } });
  await prisma.cabinetCopropriete.createMany({
    data: [
      { cabinetId: cabinet.id, coproprieteId: copro.id, gestionnairePrincipalId: syndicUser.id, dateDebutMandat: new Date(`${exercice}-01-01`), resolutionAgId: resolutionComptes.id, honorairesMensuels: "2500.00", contratId: contratHonoraires.id, statut: "ACTIF", confirmeParId: syndicUser.id, confirmeLe: jour(-250) },
      { cabinetId: cabinet.id, coproprieteId: palmiers.id, gestionnairePrincipalId: gestionnaireCabinet.id, dateDebutMandat: jour(-90), honorairesMensuels: "1800.00", statut: "ACTIF", confirmeParId: syndicUser.id, confirmeLe: jour(-90) },
    ],
  });
  await prisma.copropriete.update({ where: { id: copro.id }, data: { cabinetId: cabinet.id } });
  await prisma.roleUtilisateur.updateMany({ where: { utilisateurId: syndicUser.id, coproprieteId: copro.id, role: "SYNDIC" }, data: { cabinetId: cabinet.id } });
  await prisma.cabinetPrestataire.createMany({
    data: [
      { cabinetId: cabinet.id, nom: "Otis Maroc", specialite: "Ascenseur", telephone: "+212522000000", email: "contact@otis.ma", ice: "001234567000089" },
      { cabinetId: cabinet.id, nom: "Clean Pro Services", specialite: "Nettoyage", telephone: "+212661000000" },
    ],
  });
  await prisma.cabinetLog.createMany({
    data: [
      { cabinetId: cabinet.id, type: "CABINET_CREE", acteurId: syndicUser.id, detailsJson: { nom: "Atlas Gestion" }, horodatage: jour(-260) },
      { cabinetId: cabinet.id, type: "MEMBRE_AJOUTE", acteurId: syndicUser.id, detailsJson: { utilisateur_id: gestionnaireCabinet.id, role: "CABINET_GESTIONNAIRE" }, horodatage: jour(-255) },
      { cabinetId: cabinet.id, type: "MANDAT_CONFIRME", acteurId: syndicUser.id, coproprieteId: copro.id, detailsJson: { honoraires_mensuels: "2500.00" }, horodatage: jour(-250) },
      { cabinetId: cabinet.id, type: "MANDAT_CONFIRME", acteurId: syndicUser.id, coproprieteId: palmiers.id, detailsJson: { honoraires_mensuels: "1800.00" }, horodatage: jour(-90) },
      { cabinetId: cabinet.id, type: "ACCES_APPLIQUE", acteurId: syndicUser.id, detailsJson: { voulus: 2, desactives: 0 }, horodatage: jour(-90) },
    ],
  });
  await prisma.$executeRawUnsafe("REFRESH MATERIALIZED VIEW public.portefeuille_kpi");

  console.log("Seed terminé :", {
    personnel: { gardien: personnelGardien.id, agent: personnelAgent.id, periodePaie },
    contrats: { ascenseur: contratAscenseur.id, nettoyage: contratNettoyage.id, assurance: contratAssurance.id },
    rapports: { approuve: rapportPrecedent.id, genere: rapportCourant.id },
    parkings: { emplacements: 8, attributions: 3, vehicules: 4, badges: 4, redevance: periodeRedevance },
    import: { job: importJob.id, soldeOuvertureA3: appelOuverture.id },
    cabinet: { id: cabinet.id, palmiers: palmiers.id, gestionnaire: gestionnaireCabinet.telephone },
    copropriete: copro.nom,
    utilisateurs: 9,
    lcd: { declaration: declarationLcd.id, sejourEnCours: sejourEnCours.id, sejourPrevu: sejourPrevu.id },
    lots: 5,
    justificatifs: { valide: justifValide.id, enAttente: justifAttente.id, especesGardien: justifEspeces.id },
    depenses: { payees: 3, approuvee: depReparation.id, aApprouver: depFacade.id, brouillon: depBrouillon.id, rejetee: depDeco.id, reserve: depPompe.id },
    appelDeFonds: periode,
    ag: ag.id,
    communication: { annonces: 7, sondages: { ouvert: sondageHall.id, clos: sondageGardien.id } },
    taches: { resolutionExecutee: tachePompe.id, recurrente: cuvesSuivante.id },
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
