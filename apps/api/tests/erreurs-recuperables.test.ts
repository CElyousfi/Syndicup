/**
 * Tests unitaires (sans DB) — erreurs récupérables de l'API :
 *   - withApiHandler : Prisma P2025 → 404, P2002 non mappé → 409 sans texte Postgres,
 *     stockage indisponible → 503 + Retry-After ;
 *   - idempotence : course P2002 sur le claim → rejeu de la réponse gagnante (meta.rejouee)
 *     ou 409 si elle reste en cours ; rejeu séquentiel → meta.rejouee ;
 *   - fail() : références de spec retirées des messages utilisateur ;
 *   - map d'erreurs Zod française (messages de schéma explicites préservés) ;
 *   - Retry-After : fenêtre Upstash restante réelle, 503 Dari = 20 s ;
 *   - flux SSE : X-Request-Id + enveloppe standard avant l'ouverture du flux.
 *
 * Le client Prisma est remplacé par un double (vi.mock de lib/tenant/db) : aucune base requise.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { z } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const fauxDb = vi.hoisted(() => ({
  idempotencyKey: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../lib/tenant/db", () => ({
  withTenant: async (_ctx: unknown, fn: (db: unknown) => unknown) => fn(fauxDb),
  withActeur: async (_id: unknown, _role: unknown, fn: (db: unknown) => unknown) => fn(fauxDb),
  pingDatabase: async () => undefined,
  disconnectTenantDb: async () => undefined,
}));

const assistant = vi.hoisted(() => {
  class AssistantIndisponibleError extends Error {}
  class AssistantNonConfigureError extends Error {}
  return { AssistantIndisponibleError, AssistantNonConfigureError, repondre: vi.fn() };
});
vi.mock("../lib/assistant", () => assistant);

// Supabase Storage simulé : chaque test choisit la réponse de createSignedUrl.
const storage = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      getBucket: async () => ({ data: { id: "documents" }, error: null }),
      createBucket: async () => ({ data: null, error: null }),
      from: () => ({ createSignedUrl: storage.createSignedUrl }),
    },
  }),
}));

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("../lib/observability/sentry", () => sentry);

const tenant = vi.hoisted(() => ({ surcharge: null as null | (() => Promise<unknown>) }));
vi.mock("../lib/http/request-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/http/request-context")>();
  return {
    ...actual,
    tenantFromRequest: (req: Request) => (tenant.surcharge ? tenant.surcharge() : actual.tenantFromRequest(req)),
  };
});

import { withApiHandler } from "../lib/http/handler";
import { ok, fail, nettoyerMessage } from "../lib/http/respond";
import { withTenantIdempotent, IdempotencyConflitError } from "../lib/http/idempotency";
import { StockageIndisponibleError, estPanneStockage } from "../lib/storage/erreurs";
import { creerUrlSignee } from "../lib/storage/supabase-storage";
import { upstashRateLimiter, secondesAvantFinFenetre } from "../lib/rate-limit/upstash";
import { enforceRateLimit } from "../lib/rate-limit/apply";
import { _resetMemoryRateLimiter } from "../lib/rate-limit/memory";
import { documentUploadUrlSchema } from "../lib/documents/schemas";
import { messageErreurLigne } from "../lib/import/erreurs-ligne";
import { POST as assistantPOST } from "../app/v1/assistant/messages/route";
import { GET as streamGET } from "../app/v1/notifications/stream/route";
import type { TenantContext } from "../lib/tenant/context";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const req = (headers: Record<string, string> = {}) => new Request("http://localhost:3001/v1/test", { method: "POST", headers });

function erreurPrisma(code: string, meta?: Record<string, unknown>) {
  return new PrismaClientKnownRequestError(`Invalid \`prisma.x.update()\` invocation: duplicate key value violates unique constraint "x_pkey"`, {
    code,
    clientVersion: "6.19.3",
    meta,
  });
}

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockReturnValue(true); // logs JSON silencieux
  fauxDb.idempotencyKey.findUnique.mockReset();
  fauxDb.idempotencyKey.create.mockReset();
  fauxDb.idempotencyKey.update.mockReset();
  tenant.surcharge = null;
  sentry.captureException.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("withApiHandler — erreurs Prisma récupérables", () => {
  it("P2025 (élément disparu) → 404 NOT_FOUND, message utilisateur, X-Request-Id", async () => {
    const res = await withApiHandler(() => {
      throw erreurPrisma("P2025", { cause: "Record to update not found." });
    })(req(), undefined);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Cet élément n'existe plus. Actualisez la page.");
    expect(res.headers.get("x-request-id")).toBe(body.meta.request_id);
  });

  it("P2025 laisse une trace : warn structuré avec méthode, chemin et modèle", async () => {
    const write = vi.mocked(process.stdout.write);
    write.mockClear();
    await withApiHandler(() => {
      throw erreurPrisma("P2025", { modelName: "Lot" });
    })(req(), undefined);
    const lignes = write.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, unknown>);
    const trace = lignes.find((l) => String(l.message).includes("P2025"));
    expect(trace).toBeDefined();
    expect(trace!.niveau).toBe("warn");
    expect(trace!.methode).toBe("POST");
    expect(trace!.url).toBe("/v1/test");
    expect(trace!.modele).toBe("Lot");
    expect(trace!.request_id).toMatch(UUID_RE);
  });

  it("P2002 non traité par le domaine → 409 CONFLICT sans texte Postgres ni code Prisma", async () => {
    const res = await withApiHandler(() => {
      throw erreurPrisma("P2002", { target: ["copropriete_id", "numero"] });
    })(req(), undefined);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("Cette valeur existe déjà. Modifiez-la puis réessayez.");
    expect(JSON.stringify(body)).not.toMatch(/P2002|violates|constraint|numero/);
  });

  it("autre erreur Prisma (P2003…) → reste un 500 enveloppé (pas de mapping large)", async () => {
    const res = await withApiHandler(() => {
      throw erreurPrisma("P2003");
    })(req(), undefined);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
  });

  it("stockage indisponible → 503 SERVICE_UNAVAILABLE + Retry-After, sans le détail fournisseur", async () => {
    const res = await withApiHandler(() => {
      throw new StockageIndisponibleError("URL signée : fetch failed ECONNRESET");
    })(req(), undefined);
    expect(res.status).toBe(503);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    const body = await res.json();
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.error.message).toMatch(/stockage des fichiers est momentanément indisponible/);
    expect(body.error.message).not.toMatch(/ECONNRESET/);
    expect(sentry.captureException).toHaveBeenCalledTimes(1); // la panne alerte quand même
  });
});

describe("Stockage — seules les pannes deviennent 503", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stockage.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "cle-de-test";
    storage.createSignedUrl.mockReset();
    sentry.captureException.mockReset();
  });
  const viaHandler = () => withApiHandler(async () => ok({ url: await creerUrlSignee("c/documents/x.pdf") }))(req(), undefined);

  it("objet absent (HTTP 400, statusCode « 404 ») → PAS un 503 : 500 enveloppé + Sentry", async () => {
    storage.createSignedUrl.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("Object not found"), { name: "StorageApiError", status: 400, statusCode: "404" }),
    });
    const res = await viaHandler();
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("HTTP 404 franc → PAS un 503", async () => {
    storage.createSignedUrl.mockResolvedValue({ data: null, error: Object.assign(new Error("Not found"), { status: 404, statusCode: "404" }) });
    expect((await viaHandler()).status).toBe(500);
  });

  it("HTTP 503 du fournisseur → 503 SERVICE_UNAVAILABLE + Retry-After + Sentry", async () => {
    storage.createSignedUrl.mockResolvedValue({ data: null, error: Object.assign(new Error("Service Unavailable"), { status: 503, statusCode: "503" }) });
    const res = await viaHandler();
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("10");
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("échec réseau (StorageUnknownError, aucun statut) → 503", async () => {
    storage.createSignedUrl.mockResolvedValue({ data: null, error: Object.assign(new Error("fetch failed"), { name: "StorageUnknownError" }) });
    expect((await viaHandler()).status).toBe(503);
  });

  it("classification : 429 et 5xx = panne ; 4xx = non", () => {
    expect(estPanneStockage({ status: 429 })).toBe(true);
    expect(estPanneStockage({ status: 502 })).toBe(true);
    expect(estPanneStockage({ status: 400, statusCode: "500" })).toBe(false); // 4xx HTTP l'emporte
    expect(estPanneStockage({ status: 403, statusCode: "403" })).toBe(false);
    expect(estPanneStockage({ status: 400, statusCode: "InvalidKey" })).toBe(false);
    expect(estPanneStockage(new Error("fetch failed"))).toBe(true);
  });
});

describe("Idempotence — course concurrente et rejeu", () => {
  const ctx: TenantContext = {
    utilisateurId: "0198c0de-0000-7000-8000-000000000001",
    coproprieteId: "0198c0de-0000-7000-8000-000000000002",
    role: "SYNDIC",
  };
  const cle = "0198c0de-0000-7000-8000-0000000000aa";
  const payload = { periode: "2026-03" };
  // Hash réel du payload : on le récupère depuis l'appel create du premier passage.
  async function hashDuPayload(): Promise<string> {
    fauxDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    fauxDb.idempotencyKey.create.mockResolvedValueOnce({});
    fauxDb.idempotencyKey.update.mockResolvedValueOnce({});
    await withTenantIdempotent(ctx, { cle, endpoint: "POST /t", payload }, async () => ({ id: "x" }));
    const h = fauxDb.idempotencyKey.create.mock.calls[0]![0].data.payloadHash as string;
    fauxDb.idempotencyKey.findUnique.mockReset();
    fauxDb.idempotencyKey.create.mockReset();
    fauxDb.idempotencyKey.update.mockReset();
    return h;
  }

  it("P2002 sur le claim (course perdue) → rejoue la réponse de la gagnante + meta.rejouee", async () => {
    const payloadHash = await hashDuPayload();
    fauxDb.idempotencyKey.findUnique
      .mockResolvedValueOnce(null) // lecture avant claim : la gagnante n'a pas encore commité
      .mockResolvedValueOnce({ payloadHash, statut: "TERMINE", reponseJson: { id: "gagnante" } });
    fauxDb.idempotencyKey.create.mockRejectedValueOnce(erreurPrisma("P2002", { target: ["cle", "endpoint"] }));
    const metier = vi.fn(async () => ({ id: "perdante" }));

    const res = await withApiHandler(async () =>
      ok(await withTenantIdempotent(ctx, { cle, endpoint: "POST /t", payload }, metier), { status: 201 })
    )(req(), undefined);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ id: "gagnante" });
    expect(body.meta.rejouee).toBe(true);
    expect(metier).not.toHaveBeenCalled(); // aucune seconde écriture métier
  });

  it("P2002 sur le claim et gagnante toujours en cours → 409 CONFLICT (jamais 500)", async () => {
    const payloadHash = await hashDuPayload();
    fauxDb.idempotencyKey.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ payloadHash, statut: "EN_COURS", reponseJson: null });
    fauxDb.idempotencyKey.create.mockRejectedValueOnce(erreurPrisma("P2002"));

    const res = await withApiHandler(async () =>
      ok(await withTenantIdempotent(ctx, { cle, endpoint: "POST /t", payload }, async () => ({})))
    )(req(), undefined);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toMatch(/Requête identique déjà en cours/);
  });

  it("rejeu séquentiel (TERMINE, même payload) → meta.rejouee: true ; requête neuve → pas de rejouee", async () => {
    const payloadHash = await hashDuPayload();
    fauxDb.idempotencyKey.findUnique.mockResolvedValueOnce({ payloadHash, statut: "TERMINE", reponseJson: { id: "stocke" } });
    const rejeu = await withApiHandler(async () =>
      ok(await withTenantIdempotent(ctx, { cle, endpoint: "POST /t", payload }, async () => ({ id: "neuf" })))
    )(req(), undefined);
    expect((await rejeu.json()).meta.rejouee).toBe(true);

    fauxDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    fauxDb.idempotencyKey.create.mockResolvedValueOnce({});
    fauxDb.idempotencyKey.update.mockResolvedValueOnce({});
    const neuve = await withApiHandler(async () =>
      ok(await withTenantIdempotent(ctx, { cle, endpoint: "POST /t", payload }, async () => ({ id: "neuf" })))
    )(req(), undefined);
    const body = await neuve.json();
    expect(body.data).toEqual({ id: "neuf" });
    expect(body.meta.rejouee).toBeUndefined();
  });

  it("même clé + payload différent → IdempotencyConflitError (409)", async () => {
    fauxDb.idempotencyKey.findUnique.mockResolvedValueOnce({ payloadHash: "autre", statut: "TERMINE", reponseJson: {} });
    await expect(
      withTenantIdempotent(ctx, { cle, endpoint: "POST /t", payload }, async () => ({}))
    ).rejects.toBeInstanceOf(IdempotencyConflitError);
  });

  it("une erreur métier n'est jamais confondue avec la course (pas de relecture)", async () => {
    fauxDb.idempotencyKey.findUnique.mockResolvedValueOnce(null);
    fauxDb.idempotencyKey.create.mockResolvedValueOnce({});
    await expect(
      withTenantIdempotent(ctx, { cle, endpoint: "POST /t", payload }, async () => {
        throw erreurPrisma("P2002"); // doublon métier dans le callback, pas sur le claim
      })
    ).rejects.toMatchObject({ code: "P2002" });
    expect(fauxDb.idempotencyKey.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe("fail() — références de spec retirées du message utilisateur", () => {
  const cas: Array<[string, string]> = [
    ["Déjà inscrit — connectez-vous (Partie 5.5).", "Déjà inscrit — connectez-vous."],
    ["Seul le syndic peut créer un lot (Doc A §1).", "Seul le syndic peut créer un lot."],
    ["Seul le syndic peut générer un appel de fonds (Partie 6.2).", "Seul le syndic peut générer un appel de fonds."],
    ["Créneau déjà réservé ou en attente de validation pour cet espace (Doc A §7.2).", "Créneau déjà réservé ou en attente de validation pour cet espace."],
    [
      "Seul le syndic paie une dépense (le conseil contrôle, il ne paie pas — Doc A §8).",
      "Seul le syndic paie une dépense (le conseil contrôle, il ne paie pas).",
    ],
    [
      "Seul le syndic modifie le régime de location courte durée (décision d'AG, Doc A §10.2).",
      "Seul le syndic modifie le régime de location courte durée (décision d'AG).",
    ],
    [
      "Paramètres de paie non configurés (CNSS, AMO, IR, SMIG…) : renseignez-les dans Paramètres → Paie avant de valider (LEGAL_QUESTIONS_BRIEF §11).",
      "Paramètres de paie non configurés (CNSS, AMO, IR, SMIG…) : renseignez-les dans Paramètres → Paie avant de valider.",
    ],
    [
      "Délai légal de convocation non configuré (docs/LEGAL_QUESTIONS_BRIEF.md §1) — impossible de vérifier le délai minimum avant confirmation juridique.",
      "Délai légal de convocation non configuré — impossible de vérifier le délai minimum avant confirmation juridique.",
    ],
    [
      "Le montant de période (5000.00 MAD) dépasse le seuil 3000.00 MAD : liez une résolution d'AG ADOPTEE avant d'activer (Doc A §8, brief §10).",
      "Le montant de période (5000.00 MAD) dépasse le seuil 3000.00 MAD : liez une résolution d'AG ADOPTEE avant d'activer.",
    ],
    [
      "transfert bloqué (dette_reprise_acquereur=true, Master Spec Partie 5.4 étape 2).",
      "transfert bloqué (dette_reprise_acquereur=true).",
    ],
    [
      "Majorité requise non configurée (config_json.majorite_approbation_comptes) — LEGAL_QUESTIONS_BRIEF §9 ; précisez type_majorite.",
      "Majorité requise non configurée (config_json.majorite_approbation_comptes) ; précisez type_majorite.",
    ],
    ["Plaque AB-123 inconnue : véhicule extérieur — procédure fourrière selon le règlement (Doc A §4.2).", "Plaque AB-123 inconnue : véhicule extérieur — procédure fourrière selon le règlement."],
  ];
  for (const [brut, attendu] of cas) {
    it(`« ${brut.slice(0, 60)}… »`, () => {
      expect(nettoyerMessage(brut)).toBe(attendu);
    });
  }

  it("message sans référence : inchangé (octet pour octet)", () => {
    const m = "Lot introuvable.";
    expect(nettoyerMessage(m)).toBe(m);
    expect(nettoyerMessage("Seuil de 100 % (inclus).")).toBe("Seuil de 100 % (inclus).");
  });

  it("« Partie » et « § » du vocabulaire métier ne sont jamais retirés", () => {
    for (const m of [
      "Bâtiment B — Partie 2 non attribuée.",
      "Contraire au règlement (§ 4.2 du règlement de copropriété).",
      "(§ 4.2 du règlement de copropriété)",
      "Délai non respecté (art. 16 §2 de la loi 18-00).",
      "(art. 16 §2 de la loi 18-00)",
      "Voir la Partie 3 du règlement intérieur.",
      "Les parties communes (Partie 2 et 3 du règlement) sont concernées.",
    ]) {
      expect(nettoyerMessage(m)).toBe(m);
    }
  });

  it("parenthèse ne contenant que « Partie <n> » (une ou plusieurs) → retirée", () => {
    expect(nettoyerMessage("Déjà inscrit — connectez-vous (Partie 5.5).")).toBe("Déjà inscrit — connectez-vous.");
    expect(nettoyerMessage("Accès refusé (Partie 4.2 / 4.4).")).toBe("Accès refusé.");
    expect(nettoyerMessage("Accès refusé (Partie 4.2, Partie 1.6).")).toBe("Accès refusé.");
  });

  it("forme préfixée « Master Spec Partie » dans une parenthèse mixte → seule la référence part", () => {
    expect(nettoyerMessage("lot_id interdit pour le rôle GARDIEN (rattaché à la copropriété, Master Spec Partie 5.3).")).toBe(
      "lot_id interdit pour le rôle GARDIEN (rattaché à la copropriété)."
    );
    expect(nettoyerMessage("Aucun budget_ag ACTIF pour l'exercice 2026 — impossible de générer l'appel de fonds (Master Spec Partie 6.2 étape 1).")).toBe(
      "Aucun budget_ag ACTIF pour l'exercice 2026 — impossible de générer l'appel de fonds."
    );
    expect(nettoyerMessage("seul un compte DESACTIVE est anonymisable (machine à états, Master Spec Partie 5.2).")).toBe(
      "seul un compte DESACTIVE est anonymisable (machine à états)."
    );
  });

  it("fail() nettoie le message ET les messages de champs", async () => {
    const body = await fail("FORBIDDEN", "Seul le syndic peut créer un budget (Doc A §3.2).", {
      montant: "Montant requis (Partie 1.7.1).",
    }).json();
    expect(body.error.message).toBe("Seul le syndic peut créer un budget.");
    expect(body.error.fields.montant).toBe("Montant requis.");
  });
});

describe("Zod — messages par défaut en français", () => {
  const s = z.object({
    email: z.string().email(),
    id: z.string().uuid(),
    nom: z.string().min(1),
    code: z.string().min(3).max(5),
    n: z.number().int().min(1).max(10),
    liste: z.array(z.string()).min(1),
    role: z.enum(["SYNDIC", "PROPRIETAIRE"]),
    quand: z.date(),
    re: z.string().regex(/^A/),
    perso: z.string().regex(/^B/, "Message de schéma conservé."),
  });
  const champs = (v: unknown) => {
    const r = s.safeParse(v);
    if (r.success) throw new Error("devait échouer");
    return Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
  };

  it("champ absent → « Champ obligatoire. »", () => {
    expect(champs({}).email).toBe("Champ obligatoire.");
  });

  it("formats, bornes, enum, date, regex — en français ; message explicite intact", () => {
    const f = champs({
      email: "x",
      id: "pas-un-uuid",
      nom: "",
      code: "abcdefg",
      n: 50,
      liste: [],
      role: "ADMIN",
      quand: new Date("invalide"),
      re: "zz",
      perso: "zz",
    });
    expect(f.email).toBe("Adresse e-mail invalide.");
    expect(f.id).toBe("Identifiant invalide.");
    expect(f.nom).toBe("Champ obligatoire.");
    expect(f.code).toBe("Doit contenir au plus 5 caractères.");
    expect(f.n).toBe("Doit être inférieur ou égal à 10.");
    expect(f.liste).toBe("Sélectionnez au moins un élément.");
    expect(f.role).toBe("Valeur non autorisée. Valeurs possibles : SYNDIC, PROPRIETAIRE.");
    expect(f.quand).toBe("Date invalide.");
    expect(f.re).toBe("Format invalide.");
    expect(f.perso).toBe("Message de schéma conservé.");
  });

  it("type invalide et minimums", () => {
    const f = champs({ email: 3, code: "a", n: 0 });
    expect(f.email).toBe("Valeur invalide : un texte est attendu.");
    expect(f.code).toBe("Doit contenir au moins 3 caractères.");
    expect(f.n).toBe("Doit être supérieur ou égal à 1.");
  });
});

describe("Retry-After", () => {
  it("Upstash : temps restant réel de la fenêtre fixe, pas la fenêtre complète", () => {
    const fenetre = 10 * 60_000;
    const debut = Math.floor(1_760_000_000_000 / fenetre) * fenetre;
    expect(secondesAvantFinFenetre(debut + 9 * 60_000, fenetre)).toBe(60);
    expect(secondesAvantFinFenetre(debut + fenetre - 200, fenetre)).toBe(1);
    expect(secondesAvantFinFenetre(debut, fenetre)).toBe(600);
  });

  it("Upstash : un refus renvoie le reste de la fenêtre courante", async () => {
    const fenetre = 60_000;
    const debut = Math.floor(1_760_000_000_000 / fenetre) * fenetre;
    vi.spyOn(Date, "now").mockReturnValue(debut + 45_000);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([{ result: 31 }, { result: 0 }]));
    const d = await upstashRateLimiter("https://u.example", "t").limit("k", { max: 30, windowMs: fenetre });
    expect(d).toEqual({ allowed: false, retryAfterSec: 15 });
  });

  it("enforceRateLimit : header Retry-After = délai du limiteur et message qui le dit", async () => {
    _resetMemoryRateLimiter();
    const r = new Request("http://x/y", { headers: { "x-forwarded-for": "9.9.9.9" } });
    const opts = { max: 1, windowMs: 30_000 };
    expect(await enforceRateLimit(r, "rr", opts)).toBeNull();
    const res = (await enforceRateLimit(r, "rr", opts))!;
    expect(res.status).toBe(429);
    const s = Number(res.headers.get("retry-after"));
    expect(s).toBeGreaterThanOrEqual(29);
    expect(s).toBeLessThanOrEqual(30);
    expect((await res.json()).error.message).toMatch(/réessayez dans (29|30) s\./);
  });

  it("Dari saturé → 503 SERVICE_UNAVAILABLE + Retry-After: 20", async () => {
    tenant.surcharge = async () => ({
      utilisateurId: "0198c0de-0000-7000-8000-000000000003",
      coproprieteId: "0198c0de-0000-7000-8000-000000000004",
      role: "PROPRIETAIRE",
    });
    assistant.repondre.mockRejectedValueOnce(new assistant.AssistantIndisponibleError("saturé"));
    const res = await assistantPOST(
      new Request("http://localhost/v1/assistant/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", contenu: "Combien je dois ?" }] }),
      }),
      undefined
    );
    const body = await res.json();
    // Si le schéma de requête évolue, ce test doit rester sur le chemin 503.
    expect(body.error?.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("20");
  });
});

describe("Flux SSE /notifications/stream — avant ouverture", () => {
  it("sans jeton → 401 enveloppé + X-Request-Id", async () => {
    const res = await streamGET(new Request("http://localhost/v1/notifications/stream"), undefined);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(res.headers.get("x-request-id")).toMatch(UUID_RE);
    expect(res.headers.get("x-request-id")).toBe(body.meta.request_id);
  });

  it("erreur non auth avant le flux → enveloppe standard (pas un 500 Next brut)", async () => {
    tenant.surcharge = async () => {
      throw new Error("base injoignable");
    };
    const res = await streamGET(new Request("http://localhost/v1/notifications/stream"), undefined);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(res.headers.get("x-request-id")).toBe(body.meta.request_id);
  });
});

describe("Messages propres — import et documents", () => {
  it("rapport de ligne d'import : champ nommé, jamais P2002 / violates", () => {
    const m = messageErreurLigne(erreurPrisma("P2002", { target: ["copropriete_id", "numero"] }), "LOTS_PROPRIETAIRES");
    expect(m).toBe("Valeur déjà présente dans la copropriété (N° lot) : corrigez le doublon ou supprimez la ligne.");
    expect(m).not.toMatch(/P2002|violates|copropriete_id/);
  });

  it("rapport de ligne d'import : trigger tantièmes traduit, sans UUID", () => {
    const brut = new Error(
      'db error: ERROR: Somme des tantièmes de la copropriété 0198c0de-0000-7000-8000-000000000002 (1060.00) dépasse le total défini au règlement (1000.00) — Master Spec Partie 2.4.'
    );
    const m = messageErreurLigne(brut, "LOTS_PROPRIETAIRES");
    expect(m).toBe("La somme des tantièmes (1060.00) dépasserait le total défini au règlement (1000.00). Corrigez les tantièmes du lot ou le total du règlement.");
  });

  it("upload-url documents : images, vidéos, PDF, bureautique, RTF, ZIP acceptés ; le reste refusé", () => {
    for (const t of [
      "image/jpeg",
      "image/gif",
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/vnd.oasis.opendocument.presentation",
      "application/rtf",
      "application/zip",
      "text/csv",
      "Application/PDF; charset=binary",
    ]) {
      expect(documentUploadUrlSchema.safeParse({ nom_fichier: "a", content_type: t }).success).toBe(true);
    }
    for (const t of ["text/html", "application/x-msdownload", "application/octet-stream", "image/svg+xml"]) {
      expect(documentUploadUrlSchema.safeParse({ nom_fichier: "a", content_type: t }).success).toBe(false);
    }
  });
});
