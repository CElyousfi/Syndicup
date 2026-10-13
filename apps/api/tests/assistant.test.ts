/**
 * Dari (assistant) — logique pure : carte des écrans par rôle, repères déterministes, prompt
 * sans identifiants, lecture défensive de la sortie du modèle, chaîne de modèles Groq.
 */
import { describe, expect, it, vi } from "vitest";
import { ECRANS, ecranDuChemin, ecransPour, lienEcran } from "../lib/assistant/ecrans";
import { construireInsights, formatDate, formatMontant, suggestionsPour } from "../lib/assistant/insights";
import { construirePrompt, donneesPourModele, lireSortie } from "../lib/assistant";
import { AssistantIndisponibleError, AssistantNonConfigureError, completerChat } from "../lib/assistant/groq";
import { assistantMessagesSchema } from "../lib/assistant/schemas";
import type { WidgetSnapshot } from "../lib/users/widget-compose";

// Logique pure : le chargement de l'instantané (Prisma) est couvert par les tests du widget.
vi.mock("../lib/users/widget", () => ({ instantaneWidget: vi.fn(), PermissionRefuseeError: class extends Error {} }));

const vide = (role: string): WidgetSnapshot => ({
  genere_le: "2026-10-13T09:00:00.000Z",
  role,
  copropriete: { id: "0198aaaa-bbbb-7ccc-8ddd-eeeeffff0000", nom: "Résidence Les Palmiers" },
  charges: null,
  ag: null,
  residence: null,
  affichage: null,
  gardien: null,
});
const NOW = new Date("2026-10-13T09:00:00.000Z");

describe("carte des écrans", () => {
  it("clés uniques et chemins absolus", () => {
    expect(new Set(ECRANS.map((e) => e.cle)).size).toBe(ECRANS.length);
    for (const e of ECRANS) {
      expect(e.web.startsWith("/")).toBe(true);
      if (e.mobile) expect(e.mobile.startsWith("/")).toBe(true);
    }
  });

  it("filtre par rôle : un locataire ne voit ni les appels de fonds ni l'AG", () => {
    const cles = ecransPour("LOCATAIRE").map((e) => e.cle);
    expect(cles).toContain("payer");
    expect(cles).not.toContain("appels_de_fonds");
    expect(cles).not.toContain("ag");
    expect(lienEcran("appels_de_fonds", "LOCATAIRE", "fr")).toBeNull();
    expect(lienEcran("inexistant", "SYNDIC", "fr")).toBeNull();
  });

  it("lien localisé, chemins web et mobile distincts", () => {
    expect(lienEcran("payer", "PROPRIETAIRE", "ar")).toEqual({ cle: "payer", libelle: "أداء رسومي", web: "/finances/payer", mobile: "/payer" });
  });

  it("retrouve l'écran ouvert depuis un chemin web localisé ou mobile, sous-routes comprises", () => {
    expect(ecranDuChemin("/fr/finances/payer", "PROPRIETAIRE")?.cle).toBe("payer");
    expect(ecranDuChemin("/payer", "PROPRIETAIRE")?.cle).toBe("payer");
    expect(ecranDuChemin("/ar/incidents/0198aaaa", "LOCATAIRE")?.cle).toBe("incidents");
    expect(ecranDuChemin("/fr/finances/appels-de-fonds", "LOCATAIRE")).toBeNull();
  });
});

describe("repères (insights)", () => {
  it("formatage sans float : groupes de milliers, deux décimales, devise", () => {
    expect(formatMontant("12500.5", "fr")).toBe("12 500,50 MAD");
    expect(formatMontant("0.1", "ar")).toBe("0,10 درهم");
    expect(formatDate("2026-11-05T00:00:00.000Z")).toBe("05/11/2026");
  });

  it("résident en retard : attention + écran payer", () => {
    const s = vide("PROPRIETAIRE");
    s.charges = { solde_du: "2400.00", nb_lots: 1, lot_id: null, prochaine_echeance: "2026-10-01", prochain_montant: "1200.00", taux_paye: 0.5, nb_quittances: 2 };
    const [premier] = construireInsights(s, "fr", NOW);
    expect(premier!.niveau).toBe("attention");
    expect(premier!.texte).toContain("2 400,00 MAD");
    expect(premier!.ecran?.cle).toBe("payer");
  });

  it("charges à jour → succès, classé après l'attention", () => {
    const s = vide("PROPRIETAIRE");
    s.charges = { solde_du: "0.00", nb_lots: 1, lot_id: null, prochaine_echeance: null, prochain_montant: null, taux_paye: 1, nb_quittances: 4 };
    s.affichage = { non_lues: 1, annonces: [{ id: "a", titre: "Coupure d'eau", categorie: "URGENCE", urgent: true, publie_le: null, lu: false }] };
    const out = construireInsights(s, "fr", NOW);
    expect(out.map((i) => i.cle)).toEqual(["annonce_urgente", "charges_a_jour"]);
  });

  it("syndic : SLA dépassé et recouvrement faible ; jamais d'écran hors rôle", () => {
    const s = vide("SYNDIC");
    s.residence = { taux_recouvrement: 0.62, impaye_total: "48000.00", incidents_ouverts: 5, incidents_sla_depasse: 2, reservations_a_valider: 1, recouvrement_6: [] };
    const out = construireInsights(s, "fr", NOW);
    expect(out.slice(0, 2).map((i) => i.cle)).toEqual(["incidents_sla", "recouvrement"]);
    expect(out[1]!.texte).toContain("62 %");
    const g = vide("GARDIEN");
    g.gardien = { visites_en_attente: 1, arrivees_lcd_aujourdhui: 0, departs_lcd_aujourdhui: 0, incidents_ouverts: 0 };
    expect(construireInsights(g, "ar", NOW)[0]!.ecran?.cle).toBe("visites");
  });

  it("suggestions par famille de rôle et par langue", () => {
    expect(suggestionsPour("SYNDIC", "fr")[0]).toMatch(/situation/);
    expect(suggestionsPour("GARDIEN", "ar").length).toBeGreaterThan(0);
  });
});

describe("prompt et sortie du modèle", () => {
  it("le contexte envoyé au modèle ne contient ni identifiant ni nom de résidence", () => {
    const s = vide("PROPRIETAIRE");
    s.ag = { id: "0198bbbb-bbbb-7ccc-8ddd-eeeeffff0000", type: "ORDINAIRE", date_ag: "2026-11-20T18:00:00.000Z", statut: "CONVOQUEE", nb_resolutions: 6, nb_votees: 0 };
    const json = JSON.stringify(donneesPourModele(s));
    expect(json).not.toMatch(/0198/);
    expect(json).not.toContain("Palmiers");
    const prompt = construirePrompt("PROPRIETAIRE", "fr", s, "/fr/finances/payer");
    expect(prompt).toContain("ÉCRAN OUVERT : payer");
    expect(prompt).not.toContain("appels_de_fonds —"); // écran hors rôle absent de la carte
  });

  it("JSON valide : écrans revalidés par rôle, dédoublonnés, 3 au plus", () => {
    const out = lireSortie('{"reponse":"Allez sur Payer.","ecrans":["payer","payer","appels_de_fonds","incidents","documents","ag"]}', "LOCATAIRE", "fr");
    expect(out.reponse).toBe("Allez sur Payer.");
    expect(out.ecrans.map((e) => e.cle)).toEqual(["payer", "incidents", "documents"]);
  });

  it("sortie non JSON : repli sur le texte, aucun écran", () => {
    expect(lireSortie("Bonjour ! Je peux vous aider.", "SYNDIC", "fr")).toEqual({ reponse: "Bonjour ! Je peux vous aider.", ecrans: [] });
  });
});

describe("payload", () => {
  it("dernier message de l'utilisateur, page au format chemin", () => {
    expect(assistantMessagesSchema.safeParse({ messages: [{ role: "user", contenu: "Bonjour" }] }).success).toBe(true);
    expect(assistantMessagesSchema.safeParse({ messages: [{ role: "assistant", contenu: "Bonjour" }] }).success).toBe(false);
    expect(assistantMessagesSchema.safeParse({ messages: [{ role: "user", contenu: "x" }], page: "javascript:alert(1)" }).success).toBe(false);
    expect(assistantMessagesSchema.safeParse({ messages: [], langue: "fr" }).success).toBe(false);
  });
});

describe("chaîne de modèles Groq", () => {
  const ok = (contenu: string) => new Response(JSON.stringify({ choices: [{ message: { content: contenu } }] }), { status: 200 });

  it("sans clé : non configuré", async () => {
    await expect(completerChat([], { cle: "" })).rejects.toBeInstanceOf(AssistantNonConfigureError);
  });

  it("modèle saturé (429) → modèle suivant", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 429 })).mockResolvedValueOnce(ok('{"reponse":"ok","ecrans":[]}'));
    const r = await completerChat([{ role: "user", content: "q" }], { cle: "k", fetchImpl: f as unknown as typeof fetch, modeles: ["a", "b"] });
    expect(r.modele).toBe("b");
    expect(f).toHaveBeenCalledTimes(2);
    const corps = JSON.parse((f.mock.calls[1]![1] as RequestInit).body as string);
    expect(corps.response_format).toEqual({ type: "json_object" });
  });

  it("tous saturés → indisponible", async () => {
    const f = vi.fn().mockImplementation(async () => new Response("{}", { status: 503 }));
    await expect(completerChat([], { cle: "k", fetchImpl: f as unknown as typeof fetch, modeles: ["a", "b"] })).rejects.toBeInstanceOf(AssistantIndisponibleError);
  });
});
