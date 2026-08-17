/**
 * Seed de développement — aligné sur l'état RÉEL du schéma (M1 + M2 : copropriete,
 * utilisateur, role_utilisateur, invitation).
 *
 * ⚠️ La version initiale de ce fichier (commit 4ab8055) seedait aussi lots, indivision,
 * occupants, personnel et appels de fonds — modèles pas encore présents dans schema.prisma.
 * Restaurer ces sections depuis l'historique git AU FIL de M3 (lots) et M4 (finances), pas
 * avant : un seed qui référence des modèles inexistants casse `npm run seed` silencieusement.
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

  console.log("Seed terminé :", {
    copropriete: copro.nom,
    utilisateurs: 7,
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
