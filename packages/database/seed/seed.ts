/**
 * Seed de développement — couvre M1→M11 : copropriété, utilisateurs/rôles, invitation, lots
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

import { PrismaClient } from "@prisma/client";

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

  // ── M5 — Budget ACTIF + appel de fonds EMIS + un paiement partiel ────────
  const exercice = String(new Date().getFullYear());
  await prisma.budgetAg.create({
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
    data: { coproprieteId: copro.id, nom: "Plomberie Atlas", specialite: "Plomberie", contact: "+212522000000" },
  });
  await prisma.incident.create({
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
  const jour = (delta: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + delta);
    return d;
  };
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

  console.log("Seed terminé :", {
    copropriete: copro.nom,
    utilisateurs: 8,
    lcd: { declaration: declarationLcd.id, sejourEnCours: sejourEnCours.id, sejourPrevu: sejourPrevu.id },
    lots: 5,
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
