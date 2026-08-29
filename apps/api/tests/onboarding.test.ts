/**
 * Tests unitaires M2 : machine à états du compte (Partie 5.2), validation des payloads
 * d'invitation (Partie 5.3 — lot_id obligatoire/interdit selon rôle), génération de code.
 * Le flux HTTP complet (OTP, invite/accept, RLS invitation) est couvert par un test manuel
 * contre Supabase local documenté dans docs/ROADMAP_BACKLOG.md — à automatiser (mock GoTrue ou
 * conteneur dédié) quand le besoin de non-régression CI se fera sentir.
 */
import { describe, expect, it } from "vitest";
import { canTransition, assertTransition } from "../lib/auth/account-state";
import { invitationCreateSchema } from "../lib/auth/schemas";
import {
  genererCode,
  creerInvitation,
  assertPeutViserLeRole,
  PermissionRefuseeError,
} from "../lib/auth/invitations";

describe("Machine à états du compte (Partie 5.2)", () => {
  it("autorise INVITE → EN_VALIDATION → ACTIF", () => {
    expect(canTransition("INVITE", "EN_VALIDATION")).toBe(true);
    expect(canTransition("EN_VALIDATION", "ACTIF")).toBe(true);
  });

  it("autorise INVITE → ACTIF directement (identité déjà vérifiée avant accept)", () => {
    expect(canTransition("INVITE", "ACTIF")).toBe(true);
  });

  it("interdit tout depuis ANONYMISE (terminal)", () => {
    expect(canTransition("ANONYMISE", "ACTIF")).toBe(false);
    expect(() => assertTransition("ANONYMISE", "ACTIF")).toThrow(/interdite/);
  });

  it("interdit EN_VALIDATION → SUSPENDU (pas de compte à suspendre avant ACTIF)", () => {
    expect(canTransition("EN_VALIDATION", "SUSPENDU")).toBe(false);
  });

  it("autorise réactivation DESACTIVE → ACTIF et anonymisation DESACTIVE → ANONYMISE", () => {
    expect(canTransition("DESACTIVE", "ACTIF")).toBe(true);
    expect(canTransition("DESACTIVE", "ANONYMISE")).toBe(true);
  });
});

describe("Validation invitation (Partie 5.3)", () => {
  it("rejette lot_id pour un rôle rattaché à la copropriété (GARDIEN)", () => {
    const result = invitationCreateSchema.safeParse({
      role_cible: "GARDIEN",
      canal: "SMS",
      lot_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("accepte GARDIEN sans lot_id", () => {
    const result = invitationCreateSchema.safeParse({ role_cible: "GARDIEN", canal: "SMS" });
    expect(result.success).toBe(true);
  });

  it("exige lot_id pour PROPRIETAIRE", () => {
    const result = invitationCreateSchema.safeParse({ role_cible: "PROPRIETAIRE", canal: "EMAIL" });
    expect(result.success).toBe(false);
  });

  it("accepte PROPRIETAIRE avec lot_id", () => {
    const result = invitationCreateSchema.safeParse({
      role_cible: "PROPRIETAIRE",
      canal: "EMAIL",
      lot_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un rôle non invitable (SUPER_ADMIN — anti auto-élévation)", () => {
    const result = invitationCreateSchema.safeParse({ role_cible: "SUPER_ADMIN", canal: "EMAIL" });
    expect(result.success).toBe(false);
  });
});

describe("Génération de code d'invitation (Partie 5.1)", () => {
  it("génère un code de 8 caractères sans caractères ambigus", () => {
    const code = genererCode();
    expect(code).toHaveLength(8);
    expect(code).not.toMatch(/[O0I1]/);
  });

  it("génère des codes distincts", () => {
    const codes = new Set(Array.from({ length: 50 }, () => genererCode()));
    expect(codes.size).toBe(50);
  });
});

describe("Frontière de responsabilité : le rôle SYNDIC n'est attribuable que par le super admin", () => {
  const base = { utilisateurId: "00000000-0000-4000-8000-000000000001", coproprieteId: "00000000-0000-4000-8000-000000000002" };

  it("refuse à un SYNDIC d'inviter un SYNDIC (403 avant toute écriture)", async () => {
    await expect(
      creerInvitation({ ...base, role: "SYNDIC" }, { role_cible: "SYNDIC", canal: "WHATSAPP", lot_id: null })
    ).rejects.toBeInstanceOf(PermissionRefuseeError);
  });

  it("laisse un SYNDIC inviter les autres rôles (la garde ne bloque que SYNDIC)", () => {
    // Aucune base ici : on vérifie seulement que la garde ne lève pas pour GARDIEN.
    expect(() => assertPeutViserLeRole({ ...base, role: "SYNDIC" }, "GARDIEN")).not.toThrow();
  });

  it("autorise le SUPER_ADMIN à viser SYNDIC", () => {
    expect(() => assertPeutViserLeRole({ ...base, role: "SUPER_ADMIN" }, "SYNDIC")).not.toThrow();
  });
});
