import { describe, it, expect } from "vitest";
import { composerResume } from "../lib/notifications/resume-matin-compose";
import type { WidgetSnapshot } from "../lib/users/widget-compose";

const base: WidgetSnapshot = { genere_le: "", role: "PROPRIETAIRE", copropriete: { id: "c", nom: "Al Manar" }, charges: null, ag: null, residence: null, affichage: null, gardien: null };
const now = new Date("2026-10-12T07:00:00.000Z");

describe("composerResume", () => {
  it("rien à dire → null (pas de push vide)", () => {
    expect(composerResume(base, "FR", now)).toBeNull();
    expect(composerResume({ ...base, charges: { solde_du: "0.00", nb_lots: 1, lot_id: "l", prochaine_echeance: null, prochain_montant: null, taux_paye: 1, nb_quittances: 2 }, affichage: { non_lues: 0, annonces: [] } }, "FR", now)).toBeNull();
  });
  it("propriétaire : charges dues avec échéance relative, AG dans la semaine, annonces non lues — FR et AR", () => {
    const s: WidgetSnapshot = {
      ...base,
      charges: { solde_du: "1750.00", nb_lots: 1, lot_id: "l", prochaine_echeance: "2026-10-15", prochain_montant: "750.00", taux_paye: 0.4, nb_quittances: 1 },
      ag: { id: "a", type: "ORDINAIRE", date_ag: "2026-10-14T18:00:00.000Z", statut: "CONVOQUEE", nb_resolutions: 3, nb_votees: 0 },
      affichage: { non_lues: 2, annonces: [] },
    };
    const fr = composerResume(s, "FR", now)!;
    expect(fr).toContain("Charges dues");
    expect(fr).toContain("échéance dans 3 j");
    expect(fr).toContain("Assemblée générale dans 2 jours.");
    expect(fr).toContain("2 annonce(s) non lue(s).");
    const ar = composerResume(s, "AR", now)!;
    expect(ar).toContain("الرسوم المستحقة");
    expect(ar).toContain("الجمع العام خلال 2 أيام.");
  });
  it("syndic et gardien : incidents hors délai, réservations, visiteurs, arrivées", () => {
    const syndic = composerResume({ ...base, residence: { taux_recouvrement: 0.82, impaye_total: "12500.00", incidents_ouverts: 4, incidents_sla_depasse: 1, reservations_a_valider: 2, recouvrement_6: [] } }, "FR", now)!;
    expect(syndic).toContain("4 incident(s) ouvert(s), 1 hors délai.");
    expect(syndic).toContain("2 réservation(s) à valider.");
    expect(syndic).toContain("recouvrement 82 %");
    const gardien = composerResume({ ...base, gardien: { visites_en_attente: 1, arrivees_lcd_aujourdhui: 2, departs_lcd_aujourdhui: 0, incidents_ouverts: 0 } }, "FR", now)!;
    expect(gardien).toBe("1 visiteur(s) en attente. Aujourd'hui : 2 arrivée(s), 0 départ(s).");
  });
});
