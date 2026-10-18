import { describe, expect, it, vi } from "vitest";
import { fr } from "../i18n/fr";

const COPRO = "11111111-2222-4333-8444-555555555555";

vi.mock("../session", () => ({
  readSession: async () => ({ accessToken: "t", refreshToken: "r", coproprieteId: COPRO }),
}));
vi.mock("../request-info", () => ({
  requestLocale: async () => "fr",
  requestDict: async () => fr,
  loginHref: async () => "/fr/connexion",
}));

const { cleIdempotence, echecIdempotent, fichiersDejaEnvoyes } = await import("../forms-server");
const { ISSUES_INCONNUES } = await import("../forms");

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function fd(entrees: Array<[string, string]>): FormData {
  const f = new FormData();
  for (const [k, v] of entrees) f.append(k, v);
  return f;
}

describe("cleIdempotence", () => {
  it("reprend la clé du formulaire si c'est un UUID", () => {
    expect(cleIdempotence(fd([["idempotency_key", UUID]]))).toBe(UUID);
  });
  it("tire une clé neuve sinon", () => {
    const cle = cleIdempotence(fd([["idempotency_key", "pas-une-cle"]]));
    expect(cle).not.toBe("pas-une-cle");
    expect(cle).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("issues inconnues", () => {
  it("409 CONFLICT garde la clé (jamais renouvelée)", () => {
    expect(ISSUES_INCONNUES.has("CONFLICT")).toBe(true);
    expect(ISSUES_INCONNUES.has("NETWORK")).toBe(true);
    expect(ISSUES_INCONNUES.has("VALIDATION_ERROR")).toBe(false);
  });
});

describe("fichiersDejaEnvoyes — chemins revalidés, jamais pris tels quels", () => {
  const bon = `${COPRO}/documents/${UUID}-facture.pdf`;
  it("retient un chemin de la copropriété et du module", async () => {
    expect(await fichiersDejaEnvoyes(fd([["envoye_chemin", bon], ["envoye_nom", "facture.pdf"]]), "documents", 1)).toEqual([
      { chemin: bon, nom: "facture.pdf" },
    ]);
  });
  it.each([
    [`99999999-2222-4333-8444-555555555555/documents/${UUID}-x.pdf`, "autre copropriété"],
    [`${COPRO}/incidents/${UUID}-x.pdf`, "autre module"],
    [`${COPRO}/documents/../incidents/${UUID}-x.pdf`, "traversée"],
    [`${COPRO}/documents/x.pdf`, "sans uuid"],
    [`${COPRO}/documents/${UUID}-a/b.pdf`, "sous-dossier"],
    [`${COPRO}/documents/${UUID}-é.pdf`, "nom non assaini"],
  ])("ignore %s (%s)", async (chemin) => {
    expect(await fichiersDejaEnvoyes(fd([["envoye_chemin", chemin], ["envoye_nom", "x"]]), "documents", 1)).toEqual([]);
  });
  it("borne le nombre de fichiers", async () => {
    const c = (i: number) => `${COPRO}/incidents/${UUID}-photo${i}.jpg`;
    const entrees: Array<[string, string]> = [];
    for (let i = 0; i < 8; i++) entrees.push(["envoye_chemin", c(i)], ["envoye_nom", `p${i}.jpg`]);
    expect(await fichiersDejaEnvoyes(fd(entrees), "incidents", 5)).toHaveLength(5);
  });
});

describe("echecIdempotent", () => {
  const envoyes = [{ chemin: `${COPRO}/documents/${UUID}-a.pdf`, nom: "a.pdf" }];
  it("issue inconnue : renvoie les fichiers déjà envoyés", async () => {
    const etat = await echecIdempotent({ error: { code: "INTERNAL_ERROR", message: "boom" }, status: 500 }, fd([]), envoyes);
    expect(etat.status === "error" && etat.envoyes).toEqual(envoyes);
  });
  it("409 : issue incertaine (« peut-être déjà enregistrée »), fichiers gardés", async () => {
    const etat = await echecIdempotent({ error: { code: "CONFLICT", message: "clé rejouée" }, status: 409 }, fd([]), envoyes);
    expect(etat.status).toBe("error");
    if (etat.status !== "error") return;
    expect(etat.message).toBe(fr.formulaires.peutEtreEnregistre.message);
    expect(etat.action).toBe("refresh");
    expect(etat.envoyes).toEqual(envoyes);
  });
  it("refus certain : rien n'est renvoyé (nouvel envoi, nouvelle clé)", async () => {
    const etat = await echecIdempotent({ error: { code: "VALIDATION_ERROR", message: "x" }, status: 400 }, fd([]), envoyes);
    expect(etat.status === "error" && etat.envoyes).toBeUndefined();
  });
});
