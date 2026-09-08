/**
 * Push par niveau (Master Spec 13.4) : classification des templates, heures calmes, préférences,
 * et corps FCM (Android canal / importance / écran verrouillé ; iOS interruption-level / son /
 * badge / fil / catégorie d'actions ; silencieux = données seules + content-available).
 */
import { describe, expect, it } from "vitest";
import { CANAUX_ANDROID, dansHeuresCalmes, filPush, livraisonPush, niveauPush } from "../lib/notifications/push-niveaux";
import { construireMessageFcm } from "../lib/notifications/transports/fcm";
import { render, templateExiste } from "../lib/notifications/templates";
import { preferencesPushDe } from "../lib/notifications/notifications";

const casa = (h: number, m = 0) => {
  // Construit un instant dont l'heure de Casablanca vaut h:m (UTC+1 en septembre 2026).
  const d = new Date(Date.UTC(2026, 8, 8, h - 1, m));
  return d;
};

describe("push — niveaux, heures calmes, préférences", () => {
  it("classe chaque template : URGENT (sécurité / argent / porte), INFO (documents, récapitulatifs), NORMAL par défaut", () => {
    expect(niveauPush("INCIDENT_URGENCE_MAXIMALE")).toBe("URGENT");
    expect(niveauPush("VISITE_NOUVELLE")).toBe("URGENT");
    expect(niveauPush("IMPAYE_N4")).toBe("URGENT");
    expect(niveauPush("PV_DISPONIBLE")).toBe("INFO");
    expect(niveauPush("COMMUNICATION_DIGEST")).toBe("INFO");
    expect(niveauPush("APPEL_DE_FONDS_EMIS")).toBe("NORMAL");
    expect(niveauPush("TEMPLATE_INCONNU")).toBe("NORMAL");
    // Tous les templates connus ont un fil de regroupement.
    for (const code of ["AG_CONVOCATION", "APPEL_DE_FONDS_EMIS", "INCIDENT_NOUVEAU", "VISITE_NOUVELLE", "ANNONCE_PUBLIEE", "TACHE_ASSIGNEE", "CONTRAT_EXPIRE", "PAIE_A_VALIDER", "MANDAT_PROPOSE", "RESERVATION_NOUVELLE"]) {
      expect(templateExiste(code)).toBe(true);
      expect(filPush(code)).not.toBe("general");
    }
    expect(filPush("APPEL_DE_FONDS_EMIS")).toBe("finances");
    expect(filPush("LCD_ARRIVEE_AUJOURDHUI")).toBe("acces");
  });

  it("heures calmes : plage passant minuit, bornes, plage vide", () => {
    const hc = { debut: "22:00", fin: "07:00" };
    expect(dansHeuresCalmes(hc, casa(23))).toBe(true);
    expect(dansHeuresCalmes(hc, casa(3, 30))).toBe(true);
    expect(dansHeuresCalmes(hc, casa(7))).toBe(false);
    expect(dansHeuresCalmes(hc, casa(12))).toBe(false);
    expect(dansHeuresCalmes({ debut: "13:00", fin: "14:00" }, casa(13, 30))).toBe(true);
    expect(dansHeuresCalmes({ debut: "08:00", fin: "08:00" }, casa(8))).toBe(false);
    expect(dansHeuresCalmes(null, casa(23))).toBe(false);
  });

  it("livraison : URGENT ignore préférences et heures calmes ; NORMAL sans son la nuit ; INFO désactivable ; préférences lues avec défauts sûrs", () => {
    const prefs = preferencesPushDe({ push_normal: true, push_info: false, push_son: true, heures_calmes: { debut: "22:00", fin: "07:00" } });
    const urgentNuit = livraisonPush("VISITE_NOUVELLE", prefs, casa(2));
    expect(urgentNuit).toMatchObject({ niveau: "URGENT", livrer: true, son: true, interruption: "time-sensitive", canalAndroid: CANAUX_ANDROID.URGENT });
    const normalNuit = livraisonPush("APPEL_DE_FONDS_EMIS", prefs, casa(2));
    expect(normalNuit).toMatchObject({ niveau: "NORMAL", livrer: true, son: false, interruption: "passive", canalAndroid: CANAUX_ANDROID.INFO });
    const normalJour = livraisonPush("APPEL_DE_FONDS_EMIS", prefs, casa(10));
    expect(normalJour).toMatchObject({ son: true, interruption: "active", canalAndroid: CANAUX_ANDROID.NORMAL });
    expect(livraisonPush("PV_DISPONIBLE", prefs, casa(10))).toMatchObject({ niveau: "INFO", livrer: false, son: false, interruption: "passive" });
    expect(livraisonPush("APPEL_DE_FONDS_EMIS", preferencesPushDe({ push_son: false }), casa(10)).son).toBe(false);
    expect(preferencesPushDe(null)).toEqual({ push_normal: true, push_info: true, push_son: true, heures_calmes: null });
    expect(preferencesPushDe({ heures_calmes: { debut: 22 } }).heures_calmes).toBeNull();
  });

  it("corps FCM : Android canal / PRIORITY_MAX / PUBLIC / compteur ; iOS time-sensitive / son / badge / fil / catégorie ; sans son = pas de sound", () => {
    const rendu = render("INCIDENT_URGENCE_MAXIMALE", "FR", { categorie: "Fuite", localisation: "Hall" });
    const m = construireMessageFcm("tok", {
      destinataire: { utilisateurId: "u", email: null, telephone: null, tokensPush: ["tok"] },
      titre: rendu.titre, corps: rendu.corps, langue: "FR", templateCode: "INCIDENT_URGENCE_MAXIMALE",
      donnees: { incident_id: "i1", notification_id: "n1" },
      push: { niveau: "URGENT", badge: 3, son: true, interruption: "time-sensitive", canalAndroid: "syndicup_urgent", fil: "incidents", cleRegroupement: "incident:i1" },
    }) as { android: { priority: string; collapse_key?: string; notification: Record<string, unknown> }; apns: { headers: Record<string, string>; payload: { aps: Record<string, unknown> } }; data: Record<string, string>; notification: { title: string } };
    expect(m.android.priority).toBe("high");
    expect(m.android.collapse_key).toBe("incident:i1");
    expect(m.android.notification).toMatchObject({ channel_id: "syndicup_urgent", notification_priority: "PRIORITY_MAX", visibility: "PUBLIC", notification_count: 3, sound: "default", tag: "incident:i1", click_action: "FLUTTER_NOTIFICATION_CLICK" });
    expect(m.apns.headers).toMatchObject({ "apns-priority": "10", "apns-push-type": "alert", "apns-collapse-id": "incident:i1" });
    expect(m.apns.payload.aps).toMatchObject({ badge: 3, sound: "default", "interruption-level": "time-sensitive", "thread-id": "incidents", category: "SYNDICUP_NOTIFICATION", alert: { title: rendu.titre } });
    expect(m.data).toMatchObject({ niveau: "URGENT", canal_android: "syndicup_urgent", fil: "incidents", badge: "3", son: "1", notification_id: "n1", incident_id: "i1", template_code: "INCIDENT_URGENCE_MAXIMALE", langue: "FR" });

    const discret = construireMessageFcm("tok", {
      destinataire: { utilisateurId: "u", email: null, telephone: null }, titre: "T", corps: "C", langue: "AR", templateCode: "PV_DISPONIBLE",
      push: { niveau: "INFO", badge: 1, son: false, interruption: "passive", canalAndroid: "syndicup_info", fil: "ag" },
    }) as { android: { notification: Record<string, unknown> }; apns: { payload: { aps: Record<string, unknown> } } };
    expect(discret.android.notification).toMatchObject({ channel_id: "syndicup_info", notification_priority: "PRIORITY_DEFAULT", default_sound: false });
    expect(discret.android.notification.sound).toBeUndefined();
    expect(discret.apns.payload.aps.sound).toBeUndefined();
    expect(discret.apns.payload.aps["interruption-level"]).toBe("passive");
  });

  it("silencieux : données seules, content-available, badge, priorité basse — aucune bannière", () => {
    const m = construireMessageFcm("tok", {
      destinataire: { utilisateurId: "u", email: null, telephone: null }, titre: "", corps: "", langue: "FR", templateCode: "BADGE_SYNC",
      push: { niveau: "SILENCIEUX", badge: 0, son: false, interruption: "passive", canalAndroid: "syndicup_silencieux", fil: "general", silencieux: true },
    }) as Record<string, unknown> & { apns: { headers: Record<string, string>; payload: { aps: Record<string, unknown> } }; android: Record<string, unknown> };
    expect(m.notification).toBeUndefined();
    expect(m.android).toEqual({ priority: "normal" });
    expect(m.apns.headers).toEqual({ "apns-priority": "5", "apns-push-type": "background" });
    expect(m.apns.payload.aps).toEqual({ "content-available": 1, badge: 0 });
  });
});
