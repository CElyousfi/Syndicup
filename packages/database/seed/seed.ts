/**
 * Seed de développement — une copropriété marocaine réaliste et anonymisée, couvrant les cas
 * que le Master Spec et Doc A identifient comme structurants pour les tests (Partie 16.2) :
 *  - indivision (somme des quote_part = 100%)
 *  - propriétaire MRE (langue email-first)
 *  - locataire vs propriétaire occupant
 *  - tantièmes qui somment correctement au total de la copropriété
 *  - un lot impayé pour tester l'escalade (Doc A §3.3)
 *  - un parking rattaché à un lot (lot_parent_id)
 *
 * Usage : `npx tsx packages/database/seed/seed.ts` (ou via un script npm équivalent une fois
 * Prisma généré — ce fichier assume `@prisma/client` déjà généré depuis schema.prisma).
 *
 * Ce fichier est un point de départ, pas un jeu de données exhaustif — étendre au fil des
 * modules du ROADMAP_BACKLOG (ex. ajouter des lignes AG une fois M6 en cours).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  // Indivision : deux héritiers copropriétaires d'un même lot
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

  // ── Lots ─────────────────────────────────────────────────────────────────
  // Tantièmes calibrés pour sommer à 1000/1000 sur l'ensemble de la copropriété (8 lots),
  // cohérent avec la contrainte Master Spec Partie 2.4 (somme = total défini au règlement).
  const lotA = await prisma.lot.create({
    data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "A1", etage: 0, tantiemes: "180.00", superficie: "95.00", statut: "OCCUPE" },
  });
  const lotMRE = await prisma.lot.create({
    data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "A2", etage: 1, tantiemes: "175.00", superficie: "92.00", statut: "OCCUPE" },
  });
  const lotIndivision = await prisma.lot.create({
    data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "B1", etage: 1, tantiemes: "160.00", superficie: "88.00", statut: "OCCUPE" },
  });
  const lotLoue = await prisma.lot.create({
    data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "B2", etage: 2, tantiemes: "170.00", superficie: "90.00", statut: "OCCUPE" },
  });
  const lotVacant = await prisma.lot.create({
    data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "C1", etage: 2, tantiemes: "165.00", superficie: "91.00", statut: "VACANT" },
  });
  const lotImpaye = await prisma.lot.create({
    data: { coproprieteId: copro.id, typeLot: "APPARTEMENT", numero: "C2", etage: 3, tantiemes: "150.00", superficie: "87.00", statut: "OCCUPE" },
  });
  const loge = await prisma.lot.create({
    data: { coproprieteId: copro.id, typeLot: "LOGE_GARDIEN", numero: "RDC-Loge", etage: 0, tantiemes: "0.00", statut: "OCCUPE" },
  });
  // Parking rattaché au lot A1 (lot_parent_id) — cas fréquent au Maroc, Doc A §1.2/§4
  const parking = await prisma.lot.create({
    data: { coproprieteId: copro.id, typeLot: "PARKING", numero: "P-03", tantiemes: "0.00", statut: "OCCUPE", lotParentId: lotA.id },
  });

  // ── Propriété & occupation ──────────────────────────────────────────────
  await prisma.lotProprietaire.create({
    data: { lotId: lotA.id, utilisateurId: proprietaireA.id, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2019-03-01") },
  });
  await prisma.lotProprietaire.create({
    data: { lotId: lotMRE.id, utilisateurId: proprietaireMRE.id, quotePart: "100.00", typePropriete: "PLEIN", dateDebut: new Date("2020-06-15") },
  });
  // Indivision : 2 héritiers, quote_part somme = 100%
  await prisma.lotProprietaire.create({
    data: { lotId: lotIndivision.id, utilisateurId: indivisaire1.id, quotePart: "50.00", typePropriete: "INDIVISION", estReprensentantIndivision: true, dateDebut: new Date("2021-01-10") },
  });
  await prisma.lotProprietaire.create({
    data: { lotId: lotIndivision.id, utilisateurId: indivisaire2.id, quotePart: "50.00", typePropriete: "INDIVISION", estReprensentantIndivision: false, dateDebut: new Date("2021-01-10") },
  });
  // Propriétaire bailleur (lotLoue) — propriétaire lui-même non seedé ici, seul le locataire l'occupe
  await prisma.lotOccupant.create({
    data: { lotId: lotLoue.id, utilisateurId: locataire.id, typeOccupation: "LOCATAIRE", dateDebut: new Date("2023-09-01"), accesFinancesAccorde: false, recoitConvocations: false },
  });
  await prisma.personnel.create({
    data: { utilisateurId: gardienUser.id, coproprieteId: copro.id, statut: "PRESENT", logementLotId: loge.id },
  });

  // ── Finances : un appel de fonds mensuel émis, avec un lot volontairement impayé ──
  const appel = await prisma.appelDeFonds.create({
    data: {
      coproprieteId: copro.id,
      periode: "2026-08",
      type: "CHARGES_COURANTES",
      montantTotal: "10000.00", // = somme des lignes ci-dessous, à la centime près (test critique Partie 16.2)
      dateEcheance: new Date("2026-08-10"),
      statut: "EMIS",
    },
  });

  const lots = [
    { lot: lotA, montant: "1800.00" },
    { lot: lotMRE, montant: "1750.00" },
    { lot: lotIndivision, montant: "1600.00" },
    { lot: lotLoue, montant: "1700.00" },
    { lot: lotVacant, montant: "1650.00" },
    { lot: lotImpaye, montant: "1500.00" },
  ];

  for (const { lot, montant } of lots) {
    const isImpaye = lot.id === lotImpaye.id;
    await prisma.appelDeFondsLot.create({
      data: {
        appelDeFondsId: appel.id,
        lotId: lot.id,
        montantDu: montant,
        montantPaye: isImpaye ? "0.00" : montant,
        statut: isImpaye ? "IMPAYE" : "PAYE",
      },
    });
  }

  console.log("Seed terminé :", {
    copropriete: copro.nom,
    lots: 8,
    appelDeFonds: appel.periode,
    lotImpayePourTestEscalade: lotImpaye.numero,
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
