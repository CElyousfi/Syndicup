import { describe, it, expect } from "vitest";
import { etatAgSeance, etatAppelDeFonds, etatIncident } from "../lib/notifications/activites-compose";
import { construireMessageActivite } from "../lib/notifications/transports/fcm";

describe("activités en direct — états", () => {
  it("séance : résolution courante, votants, finalisées", () => {
    const e = etatAgSeance({ statut: "EN_COURS", ordre: 2, nbResolutions: 5, nbFinalisees: 1, texte: "Approbation des comptes", nbVotants: 7, resultat: null });
    expect(e).toMatchObject({ statut: "EN_COURS", ordre: "2", nb_resolutions: "5", nb_finalisees: "1", nb_votants: "7", resultat: "" });
  });
  it("appel de fonds : reste et progression, jamais négatif", () => {
    expect(etatAppelDeFonds({ montantDu: "1000.00", montantPaye: "250.00", statut: "PARTIEL", periode: "2026-10", echeance: "2026-10-31" })).toMatchObject({ reste: "750.00", progression: "0.2500" });
    expect(etatAppelDeFonds({ montantDu: "1000.00", montantPaye: "1200.00", statut: "PAYE", periode: "2026-10", echeance: "2026-10-31" })).toMatchObject({ reste: "0.00", progression: "1.0000" });
  });
  it("incident : étape sur 3", () => {
    expect(etatIncident({ statut: "EN_COURS", categorie: "PLOMBERIE", sousCategorie: "Fuite", prestataireNom: "Aqua" })).toMatchObject({ etape: "1", nb_etapes: "3", prestataire: "Aqua" });
    expect(etatIncident({ statut: "RESOLU", categorie: "PLOMBERIE", sousCategorie: "Fuite" }).etape).toBe("2");
  });
});

describe("message FCM d'activité", () => {
  it("iOS : push-type liveactivity, content-state, end + dismissal", () => {
    const m = construireMessageActivite({ token: "act", plateforme: "IOS" }, { type: "AG_SEANCE", objetId: "ag1", etat: { statut: "CLOTUREE" }, fin: true, titre: "Séance terminée", corps: "3 résolutions." }) as { apns: { live_activity_token: string; headers: Record<string, string>; payload: { aps: Record<string, unknown> } } };
    expect(m.apns.live_activity_token).toBe("act");
    expect(m.apns.headers["apns-push-type"]).toBe("liveactivity");
    expect(m.apns.payload.aps.event).toBe("end");
    expect(m.apns.payload.aps["content-state"]).toMatchObject({ statut: "CLOTUREE", titre: "Séance terminée" });
    expect(m.apns.payload.aps["dismissal-date"]).toBeTypeOf("number");
  });
  it("Android : données seules, silencieux, état JSON", () => {
    const m = construireMessageActivite({ token: "fcm", plateforme: "ANDROID" }, { type: "INCIDENT", objetId: "i1", etat: { etape: "1" }, fin: false, titre: "T", corps: "C" }) as { data: Record<string, string>; android: Record<string, unknown>; apns?: unknown };
    expect(m.apns).toBeUndefined();
    expect(m.data).toMatchObject({ activite_type: "INCIDENT", activite_objet_id: "i1", activite_fin: "0", niveau: "SILENCIEUX" });
    expect(JSON.parse(m.data.activite_etat!).etape).toBe("1");
    expect(m.android.collapse_key).toBe("activite:i1");
  });
});
