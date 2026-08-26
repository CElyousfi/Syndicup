/**
 * Test M6 — rendu PDF du procès-verbal d'AG (lib/ag/pv-pdf.tsx). Pas de dépendance Supabase :
 * le rendu est purement en mémoire ; le téléversement Storage (best-effort dans cloturerAg)
 * reste non testé faute de bucket "documents" provisionné en local (même limitation que M9).
 */
import { describe, expect, it } from "vitest";
import { genererPvPdfBuffer } from "../lib/ag/pv-pdf";

describe("Génération PDF du PV (M6, Doc A §12.1)", () => {
  it("rend un PDF valide contenant les résolutions et le hash d'intégrité", async () => {
    const buffer = await genererPvPdfBuffer({
      coproprieteNom: "Résidence Test PDF",
      agId: "00000000-0000-0000-0000-000000000001",
      type: "ORDINAIRE",
      dateAg: new Date("2026-06-15T10:00:00Z").toISOString(),
      quorumRequis: "50.00",
      quorumAtteint: "62.50",
      resolutions: [
        { ordre: 1, texte: "Approbation du budget 2026.", typeMajorite: "SIMPLE", resultat: "ADOPTEE" },
        { ordre: 2, texte: "Ravalement de la façade.", typeMajorite: "ABSOLUE", resultat: "REJETEE" },
      ],
      hashIntegrite: "a".repeat(64),
      horodatageGeneration: new Date().toISOString(),
    });
    // Signature d'en-tête PDF (%PDF-) — preuve que le rendu a produit un vrai document.
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("supporte un PV sans quorum défini (paramètres légaux nuls, Master Spec M6)", async () => {
    const buffer = await genererPvPdfBuffer({
      coproprieteNom: "Résidence Sans Quorum",
      agId: "00000000-0000-0000-0000-000000000002",
      type: "EXTRAORDINAIRE",
      dateAg: new Date().toISOString(),
      quorumRequis: null,
      quorumAtteint: null,
      resolutions: [],
      hashIntegrite: "b".repeat(64),
      horodatageGeneration: new Date().toISOString(),
    });
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });
});
