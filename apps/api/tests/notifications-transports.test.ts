/**
 * Tests M12 — transports de notification & templates FR/AR (Master Spec Partie 7.3) :
 * rendu bilingue, code inconnu explicite, statut honnête EN_ATTENTE via noop (jamais de faux
 * ENVOYE), la langue du destinataire (langue_preferee) pilote le rendu.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disconnectTenantDb, withTenant } from "../lib/tenant/db";
import type { TenantContext } from "../lib/tenant/context";
import { render, templateExiste, TemplateInconnuError } from "../lib/notifications/templates";
import { transportPour, _resetTransports } from "../lib/notifications/transports";
import { envoyerNotification } from "../lib/notifications/notifications";

const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

let coproId: string;
let syndicId: string;
let residentArabeId: string;

const ctxSyndic = (): TenantContext => ({
  utilisateurId: syndicId,
  coproprieteId: coproId,
  role: "SYNDIC",
});

beforeAll(async () => {
  const copro = await admin.copropriete.create({
    data: {
      nom: "Résidence Transports",
      adresse: "2 rue Canal",
      ville: "Fès",
      typeResidence: "IMMEUBLE_COLLECTIF",
      nbLots: 1,
    },
  });
  coproId = copro.id;
  const [s, r] = await Promise.all([
    admin.utilisateur.create({ data: { email: "syndic-tr@test.local", statutCompte: "ACTIF" } }),
    admin.utilisateur.create({
      data: {
        email: "resident-ar@test.local",
        telephone: "+212600000888",
        languePreferee: "AR",
        statutCompte: "ACTIF",
      },
    }),
  ]);
  syndicId = s.id;
  residentArabeId = r.id;
  await admin.roleUtilisateur.createMany({
    data: [
      { utilisateurId: syndicId, coproprieteId: coproId, role: "SYNDIC" },
      { utilisateurId: residentArabeId, coproprieteId: coproId, role: "PROPRIETAIRE" },
    ],
  });
});

afterAll(async () => {
  await admin.notification.deleteMany({ where: { coproprieteId: coproId } });
  await admin.roleUtilisateur.deleteMany({ where: { coproprieteId: coproId } });
  await admin.utilisateur.deleteMany({ where: { id: { in: [syndicId, residentArabeId] } } });
  await admin.copropriete.deleteMany({ where: { id: coproId } });
  await admin.$disconnect();
  await disconnectTenantDb();
});

describe("Registre de templates FR/AR (Partie 7.3)", () => {
  it("rend FR et AR avec interpolation {{param}}", () => {
    const fr = render("AG_CONVOCATION", "FR", { date_ag: "2026-09-15" });
    expect(fr.corps).toContain("2026-09-15");
    const ar = render("AG_CONVOCATION", "AR", { date_ag: "2026-09-15" });
    expect(ar.corps).toContain("2026-09-15");
    expect(ar.corps).not.toBe(fr.corps);
  });

  it("échoue explicitement sur un code inconnu (jamais de fallback silencieux)", () => {
    expect(() => render("CODE_INEXISTANT", "FR")).toThrow(TemplateInconnuError);
    expect(templateExiste("IMPAYE_N3")).toBe(true);
    expect(templateExiste("CODE_INEXISTANT")).toBe(false);
  });

  it("couvre tous les paliers d'escalade N1–N6 + variantes syndic N4–N6", () => {
    for (const n of [1, 2, 3, 4, 5, 6]) expect(templateExiste(`IMPAYE_N${n}`)).toBe(true);
    for (const n of [4, 5, 6]) expect(templateExiste(`IMPAYE_N${n}_SYNDIC`)).toBe(true);
  });
});

describe("Transports (noop par défaut — statut honnête)", () => {
  it("sans fournisseur configuré, le transport est noop et retourne EN_ATTENTE", async () => {
    _resetTransports();
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const resultat = await transportPour("EMAIL").envoyer({
      destinataire: { utilisateurId: syndicId, email: "x@y.z", telephone: null },
      titre: "t",
      corps: "c",
      langue: "FR",
    });
    expect(resultat.statut).toBe("EN_ATTENTE");
    vi.restoreAllMocks();
  });

  it("envoyerNotification écrit le statut RETOURNÉ par le transport (EN_ATTENTE en dev)", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await withTenant(ctxSyndic(), (db) =>
      envoyerNotification(db, {
        coproprieteId: coproId,
        utilisateurId: residentArabeId,
        templateCode: "AG_CONVOCATION",
        canal: "PUSH",
        contenuJson: { date_ag: "2026-09-15" },
      })
    );
    vi.restoreAllMocks();
    const row = await admin.notification.findFirst({
      where: { coproprieteId: coproId, utilisateurId: residentArabeId },
    });
    expect(row).not.toBeNull();
    expect(row!.statutEnvoi).toBe("EN_ATTENTE"); // honnête : rien n'a réellement été envoyé
  });
});
