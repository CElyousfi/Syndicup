/**
 * Hook GoTrue « Send SMS » (apps/api/lib/auth/send-sms-hook.ts) : vérification de signature
 * Standard Webhooks (HMAC-SHA256 sur `${id}.${timestamp}.${corps brut}`, fenêtre de fraîcheur,
 * plusieurs signatures espacées), extraction stricte du payload, message OTP en GSM-7 pur (un
 * seul segment), et transport Infobip (fetch simulé — aucun appel réseau réel). La route elle-
 * même est testée via ses fonctions pures : `withApiHandler`/Next ne s'y prête pas facilement
 * hors serveur réel, la logique métier (tout ce qui peut se tromper) est ici.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifierSignatureHook,
  extrairePayload,
  messageOtp,
  masquerTelephone,
  envoyerSmsInfobip,
  SignatureInvalideError,
  PayloadInvalideError,
} from "../lib/auth/send-sms-hook";

const SECRET = "v1,whsec_Wts02lRc6mOAv4Z2KfifE4j9syWcLvzXdxvThlI4WRQ=";
const KEY = Buffer.from(SECRET.replace("v1,whsec_", ""), "base64");

function signer(id: string, timestamp: string, body: string, key = KEY): string {
  return "v1," + createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

describe("send-sms-hook — signature Standard Webhooks", () => {
  it("accepte une signature valide, rejette un corps modifié, un id/timestamp différent, ou une signature d'un autre secret", () => {
    const now = Date.now();
    const ts = String(Math.floor(now / 1000));
    const body = JSON.stringify({ user: { id: "u1", phone: "212621431215" }, sms: { otp: "123456" } });
    const sig = signer("msg_1", ts, body);
    expect(() => verifierSignatureHook(body, { id: "msg_1", timestamp: ts, signature: sig }, SECRET, now)).not.toThrow();

    expect(() => verifierSignatureHook(body + "x", { id: "msg_1", timestamp: ts, signature: sig }, SECRET, now)).toThrow(SignatureInvalideError);
    expect(() => verifierSignatureHook(body, { id: "msg_2", timestamp: ts, signature: sig }, SECRET, now)).toThrow(SignatureInvalideError);
    const autreCle = Buffer.from("autre-secret-1234567890123456789012", "utf8").toString("base64");
    const sigAutreSecret = signer("msg_1", ts, body, Buffer.from(autreCle, "base64"));
    expect(() => verifierSignatureHook(body, { id: "msg_1", timestamp: ts, signature: sigAutreSecret }, SECRET, now)).toThrow(SignatureInvalideError);
  });

  it("rejette un timestamp hors fenêtre de fraîcheur (rejeu) et des en-têtes manquants", () => {
    const now = Date.now();
    const body = "{}";
    const vieux = String(Math.floor(now / 1000) - 3600); // 1h dans le passé
    const sig = signer("msg_1", vieux, body);
    expect(() => verifierSignatureHook(body, { id: "msg_1", timestamp: vieux, signature: sig }, SECRET, now)).toThrow(/fraîcheur/);
    expect(() => verifierSignatureHook(body, { id: null, timestamp: String(Math.floor(now / 1000)), signature: sig }, SECRET, now)).toThrow(SignatureInvalideError);
  });

  it("accepte l'une des signatures d'une liste espacée (rotation de secret)", () => {
    const now = Date.now();
    const ts = String(Math.floor(now / 1000));
    const body = "{}";
    const bonneSig = signer("msg_1", ts, body);
    const combinees = `v1,${Buffer.from("mauvaise").toString("base64")} ${bonneSig}`;
    expect(() => verifierSignatureHook(body, { id: "msg_1", timestamp: ts, signature: combinees }, SECRET, now)).not.toThrow();
  });
});

describe("send-sms-hook — payload et message", () => {
  it("extrait { telephone, otp } d'un payload GoTrue valide ; rejette otp/phone manquants ou mal formés", () => {
    expect(extrairePayload({ user: { id: "u1", phone: "212621431215" }, sms: { otp: "654321" } })).toEqual({ telephone: "212621431215", otp: "654321" });
    expect(() => extrairePayload({ user: { id: "u1", phone: "212621431215" }, sms: { otp: "abc" } })).toThrow(PayloadInvalideError);
    expect(() => extrairePayload({ user: { id: "u1" }, sms: { otp: "654321" } })).toThrow(PayloadInvalideError);
    expect(() => extrairePayload(null)).toThrow(PayloadInvalideError);
  });

  it("le message OTP est en GSM-7 pur (aucun caractère hors table de base, un seul segment SMS)", () => {
    const msg = messageOtp("123456");
    expect(msg).toContain("123456");
    // Table GSM-7 de base (approximation stricte suffisante ici : ASCII imprimable, pas d'accent).
    expect(/^[\x20-\x7E]*$/.test(msg)).toBe(true);
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it("masque un numéro pour les logs (ne garde que les 2 derniers chiffres)", () => {
    expect(masquerTelephone("212621431215")).toBe("**********15");
    expect(masquerTelephone("12")).toBe("**");
  });
});

describe("send-sms-hook — transport Infobip (fetch simulé)", () => {
  const config = { baseUrl: "y4e81j.api.infobip.com", apiKey: "test-key" };

  it("POST /sms/3/messages avec Authorization: App <clé>, numéro sans '+', texte exact ; PENDING/DELIVERED = ok", async () => {
    const appels: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      appels.push({ url, init });
      return new Response(JSON.stringify({ bulkId: "b1", messages: [{ messageId: "m1", status: { groupName: "PENDING" }, destination: "212621431215" }] }), { status: 200 });
    }) as typeof fetch;
    const r = await envoyerSmsInfobip("+212621431215", "Code SyndicUp : 123456. Ne le partagez avec personne.", config, fetchImpl);
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect(appels[0]!.url).toBe("https://y4e81j.api.infobip.com/sms/3/messages");
    expect((appels[0]!.init.headers as Record<string, string>).Authorization).toBe("App test-key");
    const body = JSON.parse(appels[0]!.init.body as string);
    expect(body.messages[0].destinations[0].to).toBe("212621431215");
    expect(body.messages[0].content.text).toContain("123456");
    expect(body.messages[0].sender).toBeUndefined();
  });

  it("ajoute 'sender' quand un expéditeur (compte d'essai) est configuré", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ messages: [{ status: { groupName: "PENDING" } }] }), { status: 200 })) as typeof fetch;
    let capture: string | undefined;
    const spy = (async (url: string, init: RequestInit) => {
      capture = init.body as string;
      return fetchImpl(url, init);
    }) as typeof fetch;
    await envoyerSmsInfobip("212621431215", "x", { ...config, expediteur: "447491163443" }, spy);
    expect(JSON.parse(capture!).messages[0].sender).toBe("447491163443");
  });

  it("statut HTTP non-2xx → échoué avec le détail Infobip", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ requestError: { serviceException: { text: "INVALID_LOGIN_CREDENTIALS" } } }), { status: 401 })) as typeof fetch;
    const r = await envoyerSmsInfobip("212621431215", "x", config, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("INVALID_LOGIN_CREDENTIALS");
  });

  it("200 HTTP mais message rejeté (groupe ni PENDING ni DELIVERED) → échoué", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ messages: [{ status: { groupName: "REJECTED", description: "Invalid destination address" } }] }), { status: 200 })) as typeof fetch;
    const r = await envoyerSmsInfobip("212621431215", "x", config, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("Invalid destination address");
  });

  it("erreur réseau → échoué, jamais d'exception qui remonte", async () => {
    const fetchImpl = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
    const r = await envoyerSmsInfobip("212621431215", "x", config, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("ECONNREFUSED");
  });
});
