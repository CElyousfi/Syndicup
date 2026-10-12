/**
 * Push par niveau (Master Spec 13.4) : classification des templates, heures calmes, préférences,
 * et corps FCM (Android canal / importance / écran verrouillé ; iOS interruption-level / son /
 * badge / fil / catégorie d'actions ; silencieux = données seules + content-available).
 */
import { describe, expect, it } from "vitest";
import { CANAUX_ANDROID, actionsPush, categorieIos, dansHeuresCalmes, filPush, livraisonPush, niveauPush } from "../lib/notifications/push-niveaux";
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

  it("corps FCM : Android données seules (l'app affiche : boutons, résidence, image) ; iOS time-sensitive / son / badge / fil par résidence / catégorie ; sans son = pas de sound", () => {
    const rendu = render("INCIDENT_URGENCE_MAXIMALE", "FR", { categorie: "Fuite", localisation: "Hall" });
    const m = construireMessageFcm("tok", {
      destinataire: { utilisateurId: "u", email: null, telephone: null, tokensPush: ["tok"] },
      titre: rendu.titre, corps: rendu.corps, langue: "FR", templateCode: "INCIDENT_URGENCE_MAXIMALE",
      donnees: { incident_id: "i1", notification_id: "n1", copropriete_id: "c1", prestataire_tel: "0600000000" },
      push: { niveau: "URGENT", badge: 3, son: true, interruption: "time-sensitive", canalAndroid: "syndicup_urgent", fil: "incidents", cleRegroupement: "incident:i1" },
    }) as { android: { priority: string; collapse_key?: string; notification?: Record<string, unknown> }; apns: { headers: Record<string, string>; payload: { aps: Record<string, unknown> } }; data: Record<string, string>; notification?: { title: string } };
    expect(m.android.priority).toBe("high");
    expect(m.android.collapse_key).toBe("incident:i1");
    // Android : aucune bannière système — l'app la construit (actions, regroupement par résidence, image).
    expect(m.notification).toBeUndefined();
    expect(m.android.notification).toBeUndefined();
    expect(m.apns.headers).toMatchObject({ "apns-priority": "10", "apns-push-type": "alert", "apns-collapse-id": "incident:i1" });
    expect(m.apns.payload.aps).toMatchObject({ badge: 3, sound: "default", "interruption-level": "time-sensitive", "thread-id": "copro:c1", category: "SYNDICUP_APPELER", "mutable-content": 1, alert: { title: rendu.titre } });
    expect(m.data).toMatchObject({ niveau: "URGENT", canal_android: "syndicup_urgent", fil: "incidents", badge: "3", son: "1", notification_id: "n1", incident_id: "i1", template_code: "INCIDENT_URGENCE_MAXIMALE", langue: "FR", cle_regroupement: "incident:i1", titre: rendu.titre });
    expect(JSON.parse((m.apns.payload as unknown as { payload: string }).payload).incident_id).toBe("i1");

    const discret = construireMessageFcm("tok", {
      destinataire: { utilisateurId: "u", email: null, telephone: null }, titre: "T", corps: "C", langue: "AR", templateCode: "PV_DISPONIBLE",
      push: { niveau: "INFO", badge: 1, son: false, interruption: "passive", canalAndroid: "syndicup_info", fil: "ag" },
    }) as { data: Record<string, string>; apns: { payload: { aps: Record<string, unknown> } } };
    expect(discret.data).toMatchObject({ canal_android: "syndicup_info", son: "0" });
    expect(discret.apns.payload.aps.sound).toBeUndefined();
    expect(discret.apns.payload.aps["thread-id"]).toBe("ag");
    expect(discret.apns.payload.aps.category).toBe("SYNDICUP_VOIR");
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

  it("boutons d'action par template : porte, argent, séance, prestataire, défaut", () => {
    expect(actionsPush("VISITE_NOUVELLE", { visite_id: "v1" })).toEqual(["AUTORISER", "REFUSER"]);
    expect(actionsPush("VISITE_NOUVELLE")).toEqual(["VOIR", "MARQUER_LU"]);
    expect(actionsPush("APPEL_DE_FONDS_EMIS")).toEqual(["PAYER", "VOIR"]);
    expect(actionsPush("IMPAYE_N3")).toEqual(["PAYER", "VOIR"]);
    expect(actionsPush("AG_OUVERTE", { ag_id: "a" })).toEqual(["VOTER", "VOIR"]);
    expect(actionsPush("INCIDENT_STATUT_CHANGE", { prestataire_tel: "06" })).toEqual(["APPELER", "VOIR"]);
    expect(actionsPush("INCIDENT_STATUT_CHANGE")).toEqual(["VOIR", "MARQUER_LU"]);
    expect(categorieIos(["PAYER", "VOIR"])).toBe("SYNDICUP_PAYER");
  });
});
