/**
 * Tests M19 — appareils push (Master Spec Partie 13.4) : enregistrement idempotent, jeton
 * déplacé quand le téléphone change de compte (RLS `app.push_token`), retrait, lecture des
 * jetons du destinataire sous la policy m19, transport FCM v1 (OAuth2 + envoi + jetons
 * invalides) avec fetch simulé — aucun appel réseau réel.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { exportPKCS8, generateKeyPair } from "jose";
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { enregistrerAppareil, retirerAppareil, tokensPushDe } from "../lib/users/appareils";
import { fcmTransport } from "../lib/notifications/transports/fcm";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproId: string;
let coproAutre: string;
let amina: string;
let rachid: string;
let etranger: string;

const TOKEN_A = "fcm-token-amina-0123456789abcdef";
const TOKEN_B = "fcm-token-rachid-0123456789abcdef";

const ctx = (u: string, role: TenantContext["role"] = "PROPRIETAIRE", copro = coproId): TenantContext => ({
  utilisateurId: u,
  coproprieteId: copro,
  role,
});

beforeAll(async () => {
  const [c1, c2] = await Promise.all([
    admin.copropriete.create({ data: { nom: "Résidence Push", adresse: "1 rue Push", ville: "Casablanca", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2 } }),
    admin.copropriete.create({ data: { nom: "Résidence Ailleurs", adresse: "2 rue Loin", ville: "Tanger", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 2 } }),
  ]);
  coproId = c1.id;
  coproAutre = c2.id;
  const [a, r, e] = await Promise.all([
    admin.utilisateur.create({ data: { email: "amina-push@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "rachid-push@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({ data: { email: "etranger-push@test.local", statutCompte: "ACTIF" } }),
  ]);
  amina = a.id;
  rachid = r.id;
  etranger = e.id;
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: amina, coproprieteId: coproId, role: "PROPRIETAIRE" },
      { utilisateurId: rachid, coproprieteId: coproId, role: "GARDIEN" },
      { utilisateurId: etranger, coproprieteId: coproAutre, role: "PROPRIETAIRE" },
    ],
  });
});

afterAll(async () => {
  await admin.appareilPush.deleteMany({ where: { utilisateurId: { in: [amina, rachid, etranger] } } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: { in: [coproId, coproAutre] } } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [amina, rachid, etranger] } } });
  await admin.copropriete.deleteMany({ where: { id: { in: [coproId, coproAutre] } } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("M19 — enregistrement des appareils", () => {
  it("enregistre puis rafraîchit (idempotent par jeton)", async () => {
    const a1 = await enregistrerAppareil(ctx(amina), { token: TOKEN_A, plateforme: "ANDROID", langue: "AR", version_app: "0.1.0" });
    expect(a1.plateforme).toBe("ANDROID");
    expect(a1.langue).toBe("AR");
    const a2 = await enregistrerAppareil(ctx(amina), { token: TOKEN_A, plateforme: "ANDROID", version_app: "0.1.1" });
    expect(a2.id).toBe(a1.id);
    expect(a2.version_app).toBe("0.1.1");
    expect(await admin.appareilPush.count({ where: { token: TOKEN_A } })).toBe(1);
  });

  it("un jeton présenté par un autre compte est déplacé (le téléphone a changé d'utilisateur)", async () => {
    await enregistrerAppareil(ctx(rachid, "GARDIEN"), { token: TOKEN_A, plateforme: "ANDROID" });
    const rows = await admin.appareilPush.findMany({ where: { token: TOKEN_A } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.utilisateurId).toBe(rachid);
    // Retour à Amina pour la suite.
    await enregistrerAppareil(ctx(amina), { token: TOKEN_A, plateforme: "ANDROID" });
    await enregistrerAppareil(ctx(rachid, "GARDIEN"), { token: TOKEN_B, plateforme: "IOS" });
  });

  it("lecture des jetons du destinataire : même copropriété oui, autre copropriété non", async () => {
    // Rachid (gardien) envoie une notification à Amina → il lit ses jetons.
    const vus = await withTenant(ctx(rachid, "GARDIEN"), (db) => tokensPushDe(db, amina));
    expect(vus).toEqual([TOKEN_A]);
    // Un membre d'une autre copropriété ne voit rien (RLS m19).
    const caches = await withTenant(ctx(etranger, "PROPRIETAIRE", coproAutre), (db) => tokensPushDe(db, amina));
    expect(caches).toEqual([]);
  });

  it("retrait : ses propres appareils uniquement", async () => {
    expect((await retirerAppareil(ctx(amina), TOKEN_B)).supprime).toBe(false);
    expect((await retirerAppareil(ctx(rachid, "GARDIEN"), TOKEN_B)).supprime).toBe(true);
    expect(await admin.appareilPush.count({ where: { token: TOKEN_B } })).toBe(0);
  });
});

describe("M19 — transport FCM v1 (fetch simulé)", () => {
  let serviceAccount: string;
  beforeAll(async () => {
    const { privateKey } = await generateKeyPair("RS256", { modulusLength: 2048 });
    serviceAccount = JSON.stringify({
      project_id: "syndicup-test",
      client_email: "fcm@syndicup-test.iam.gserviceaccount.com",
      private_key: await exportPKCS8(privateKey),
      token_uri: "https://oauth2.googleapis.com/token",
    });
  });

  function fauxFetch(reponses: Record<string, (body: string) => { status: number; json: unknown }>) {
    const appels: Array<{ url: string; body: string }> = [];
    const f = async (url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      appels.push({ url, body });
      const r = reponses[url.includes("oauth2") ? "oauth" : "send"]!(body);
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { "Content-Type": "application/json" } });
    };
    return { f, appels };
  }

  it("sans appareil : EN_ATTENTE honnête, aucun appel réseau", async () => {
    const { f, appels } = fauxFetch({});
    const t = fcmTransport(serviceAccount, f);
    const r = await t.envoyer({ destinataire: { utilisateurId: amina, email: null, telephone: null, tokensPush: [] }, titre: "T", corps: "C", langue: "FR" });
    expect(r.statut).toBe("EN_ATTENTE");
    expect(appels).toHaveLength(0);
  });

  it("OAuth2 puis un envoi par appareil ; jeton UNREGISTERED remonté pour suppression", async () => {
    const { f, appels } = fauxFetch({
      oauth: () => ({ status: 200, json: { access_token: "ya29.test", expires_in: 3600 } }),
      send: (body) =>
        body.includes("mort")
          ? { status: 404, json: { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } } }
          : { status: 200, json: { name: "projects/syndicup-test/messages/1" } },
    });
    const t = fcmTransport(serviceAccount, f);
    const r = await t.envoyer({
      destinataire: { utilisateurId: amina, email: null, telephone: null, tokensPush: ["jeton-vivant-0123456789", "jeton-mort-0123456789"] },
      titre: "Visiteur en attente",
      corps: "Omar Sbai demande l'accès",
      langue: "FR",
      templateCode: "VISITE_NOUVELLE",
      donnees: { visite_id: "v1" },
    });
    expect(r.statut).toBe("ENVOYE");
    expect(r.tokensInvalides).toEqual(["jeton-mort-0123456789"]);
    expect(appels[0]!.url).toContain("oauth2");
    expect(appels[0]!.body).toContain("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer");
    const envoi = JSON.parse(appels[1]!.body) as { message: { token: string; data: Record<string, string>; notification: { title: string } } };
    expect(envoi.message.token).toBe("jeton-vivant-0123456789");
    expect(envoi.message.data.template_code).toBe("VISITE_NOUVELLE");
    expect(envoi.message.data.visite_id).toBe("v1");
    expect(envoi.message.notification.title).toBe("Visiteur en attente");
    // Le jeton OAuth est mis en cache : 1 appel token + 2 envois.
    expect(appels).toHaveLength(3);
  });

  it("tous les envois refusés → ECHOUE", async () => {
    const { f } = fauxFetch({
      oauth: () => ({ status: 200, json: { access_token: "ya29.test", expires_in: 3600 } }),
      send: () => ({ status: 500, json: { error: { status: "INTERNAL" } } }),
    });
    const t = fcmTransport(serviceAccount, f);
    const r = await t.envoyer({ destinataire: { utilisateurId: amina, email: null, telephone: null, tokensPush: ["jeton-0123456789abcdef"] }, titre: "T", corps: "C", langue: "AR" });
    expect(r.statut).toBe("ECHOUE");
    expect(r.tokensInvalides).toBeUndefined();
  });
});
