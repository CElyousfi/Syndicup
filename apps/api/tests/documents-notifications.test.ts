/**
 * Tests M9 (ROADMAP_BACKLOG.md) : notifications & documents — Master Spec Partie 7, 9,
 * Doc A §12.2/12.3. Prérequis : Supabase local démarré + migration
 * `20260824090000_m9_notifications_documents`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import {
  creerDocument,
  listerDocuments,
  PermissionRefuseeError as DocPermissionRefuseeError,
} from "../lib/documents/documents";
import {
  envoyerNotification,
  listerMesNotifications,
  marquerLue,
  IntrouvableError,
} from "../lib/notifications/notifications";

const admin = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

let coproA: string;
let syndicA: string;
let alice: string;
let bob: string;

const ctxSyndicA = (): TenantContext => ({ utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" });
const ctxAlice = (): TenantContext => ({ utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" });
const ctxBob = (): TenantContext => ({ utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" });

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Notifs",
      adresse: "1 rue des Notifications",
      ville: "Rabat",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 2,
    },
  });
  coproA = copro.id;

  const [us, ua, ub] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-notif@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "alice-notif@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "bob-notif@test.local", statutCompte: "ACTIF" } }),
  ]);
  syndicA = us.id;
  alice = ua.id;
  bob = ub.id;

  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicA, coproprieteId: coproA, role: "SYNDIC" },
      { utilisateurId: alice, coproprieteId: coproA, role: "PROPRIETAIRE" },
      { utilisateurId: bob, coproprieteId: coproA, role: "PROPRIETAIRE" },
    ],
  });
});

afterAll(async () => {
  await admin.notification.deleteMany({ where: { coproprieteId: coproA } });
  await admin.document.deleteMany({ where: { coproprieteId: coproA } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproA } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicA, alice, bob] } } });
  await admin.copropriete.deleteMany({ where: { id: coproA } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Documents — visibilité par rôle (Doc A §12.3)", () => {
  it("un PROPRIETAIRE ne peut pas créer un document", async () => {
    await expect(
      creerDocument(ctxAlice(), {
        type: "reglement_interieur",
        nom: "Règlement intérieur",
        visibilite: "PUBLIC_COPROPRIETE",
        storage_path: `${coproA}/documents/reglement/1.pdf`,
      })
    ).rejects.toBeInstanceOf(DocPermissionRefuseeError);
  });

  it("un document PUBLIC_COPROPRIETE est visible par tous les rôles du tenant", async () => {
    await creerDocument(ctxSyndicA(), {
      type: "reglement_interieur",
      nom: "Règlement intérieur",
      visibilite: "PUBLIC_COPROPRIETE",
      storage_path: `${coproA}/documents/reglement/1.pdf`,
    });
    const rows = await listerDocuments(ctxAlice());
    expect(rows.some((d) => d.nom === "Règlement intérieur")).toBe(true);
  });

  it("un document SYNDIC_ONLY n'est pas visible par un PROPRIETAIRE", async () => {
    await creerDocument(ctxSyndicA(), {
      type: "contrat_prestataire",
      nom: "Contrat ascensoriste",
      visibilite: "SYNDIC_ONLY",
      storage_path: `${coproA}/documents/contrat/1.pdf`,
    });
    const rowsAlice = await listerDocuments(ctxAlice());
    expect(rowsAlice.some((d) => d.nom === "Contrat ascensoriste")).toBe(false);
    const rowsSyndic = await listerDocuments(ctxSyndicA());
    expect(rowsSyndic.some((d) => d.nom === "Contrat ascensoriste")).toBe(true);
  });

  it("un document CONSEIL_SYNDICAL n'est pas visible par un PROPRIETAIRE mais l'est par le CONSEIL_SYNDICAL", async () => {
    await creerDocument(ctxSyndicA(), {
      type: "rapport_audit",
      nom: "Rapport d'audit 2025",
      visibilite: "CONSEIL_SYNDICAL",
      storage_path: `${coproA}/documents/audit/1.pdf`,
    });
    const rowsAlice = await listerDocuments(ctxAlice());
    expect(rowsAlice.some((d) => d.nom === "Rapport d'audit 2025")).toBe(false);
    const ctxConseil: TenantContext = { utilisateurId: bob, coproprieteId: coproA, role: "CONSEIL_SYNDICAL" };
    const rowsConseil = await listerDocuments(ctxConseil);
    expect(rowsConseil.some((d) => d.nom === "Rapport d'audit 2025")).toBe(true);
  });
});

describe("Notifications — boîte de réception personnelle (Partie 7.2)", () => {
  it("un utilisateur ne voit que ses propres notifications", async () => {
    await withTenant(ctxSyndicA(), (db) =>
      envoyerNotification(db, {
        coproprieteId: coproA,
        utilisateurId: alice,
        templateCode: "AG_CONVOCATION",
        canal: "EMAIL",
      })
    );
    const rowsAlice = await listerMesNotifications(ctxAlice());
    expect(rowsAlice.length).toBe(1);
    expect(rowsAlice[0]?.statutEnvoi).toBe("ENVOYE");
    const rowsBob = await listerMesNotifications(ctxBob());
    expect(rowsBob.length).toBe(0);
  });

  it("marque une notification comme lue", async () => {
    const notif = await withTenant(ctxSyndicA(), (db) =>
      envoyerNotification(db, {
        coproprieteId: coproA,
        utilisateurId: bob,
        templateCode: "INCIDENT_STATUT_CHANGE",
        canal: "PUSH",
      })
    );
    expect(notif.lu).toBe(false);
    const lue = await marquerLue(ctxBob(), notif.id);
    expect(lue.lu).toBe(true);
    expect(lue.luLe).not.toBeNull();
  });

  it("un utilisateur ne peut pas marquer comme lue la notification d'un autre", async () => {
    const notif = await withTenant(ctxSyndicA(), (db) =>
      envoyerNotification(db, {
        coproprieteId: coproA,
        utilisateurId: alice,
        templateCode: "AG_PV_DISPONIBLE",
        canal: "EMAIL",
      })
    );
    await expect(marquerLue(ctxBob(), notif.id)).rejects.toBeInstanceOf(IntrouvableError);
  });
});
