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
import { StockageIndisponibleError } from "../lib/storage/erreurs";
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

  it("upload-url documents : types d'images, PDF et bureautique acceptés ; le reste refusé", () => {
    for (const t of ["image/jpeg", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/csv"]) {
      expect(documentUploadUrlSchema.safeParse({ nom_fichier: "a", content_type: t }).success).toBe(true);
    }
    for (const t of ["text/html", "application/x-msdownload", "application/octet-stream", "image/svg+xml"]) {
      expect(documentUploadUrlSchema.safeParse({ nom_fichier: "a", content_type: t }).success).toBe(false);
    }
  });
});
