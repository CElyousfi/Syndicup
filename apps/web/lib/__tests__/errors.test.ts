import { describe, expect, it } from "vitest";
import { actionFor, describeError, formatRetryAfter, normalizeCode, shortRef, stripSpecRefs } from "../errors";
import { fr } from "../i18n/fr";
import { ar } from "../i18n/ar";
import * as ui from "../i18n/errors-ui-fr";
import * as uiAr from "../i18n/errors-ui-ar";

/** Codes de apps/api/lib/http/respond.ts (ErrorCode) — copie volontaire : un nouveau code côté
 *  API qui n'arrive pas au dictionnaire fait échouer ce test. */
const CODES_API = [
  "VALIDATION_ERROR", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "UNPROCESSABLE_ENTITY",
  "RATE_LIMITED", "INTERNAL_ERROR", "NOT_IMPLEMENTED", "SERVICE_UNAVAILABLE",
  "LCD_REGIME_NON_DEFINI", "LCD_INTERDITE", "LCD_PARAMETRE_NON_CONFIGURE", "LCD_GESTIONNAIRE_REQUIS",
  "LCD_DECLARATION_NON_VALIDEE", "LCD_QUOTA_NUITS_DEPASSE", "LCD_DELAI_DECLARATION", "LCD_VOYAGEURS_MAX",
  "LCD_SEJOUR_CHEVAUCHEMENT", "DEPENSE_STATUT_INVALIDE", "DEPENSE_APPROBATION_CONSEIL_REQUISE",
  "DEPENSE_RESERVE_RESOLUTION_REQUISE", "FONDS_RESERVE_INSUFFISANT", "BUDGET_TOTAL_DERIVE_DES_POSTES",
  "BUDGET_POSTE_UTILISE", "INCIDENT_NON_RESOLU", "INCIDENT_DEJA_EVALUE", "JUSTIFICATIF_STATUT_INVALIDE",
  "JUSTIFICATIF_PREUVE_REQUISE", "JUSTIFICATIF_PARAMETRE_NON_CONFIGURE", "RAPPORT_STATUT_INVALIDE",
  "RAPPORT_PARAMETRE_NON_CONFIGURE", "CONTRAT_STATUT_INVALIDE", "CONTRAT_RESOLUTION_AG_REQUISE",
  "CONTRAT_ECHEANCE_STATUT_INVALIDE", "PAIE_PARAMETRES_NON_CONFIGURES", "PAIE_STATUT_INVALIDE",
  "CONGE_STATUT_INVALIDE", "CONGE_SOLDE_INSUFFISANT", "PERSONNEL_STATUT_INVALIDE", "ANNONCE_STATUT_INVALIDE",
  "COMMENTAIRES_DESACTIVES", "SONDAGE_STATUT_INVALIDE", "SONDAGE_DEJA_REPONDU", "SONDAGE_CHOIX_INVALIDE",
  "TACHE_STATUT_INVALIDE", "TACHE_ASSIGNEE_INVALIDE", "EMPLACEMENT_STATUT_INVALIDE", "EMPLACEMENT_CODE_EXISTANT",
  "EMPLACEMENT_NON_VISITEUR", "ATTRIBUTION_CHEVAUCHEMENT", "IMMATRICULATION_EXISTANTE", "IMMATRICULATION_INCONNUE",
  "BADGE_STATUT_INVALIDE", "BADGE_IDENTIFIANT_EXISTANT", "IMPORT_FICHIER_ILLISIBLE", "IMPORT_STATUT_INVALIDE",
  "DEMO_INTERDIT", "CABINET_STATUT_INVALIDE", "MANDAT_EXISTANT", "MANDAT_STATUT_INVALIDE", "CONFLIT_SYNDIC",
];

describe("dictionnaire d'erreurs", () => {
  it("couvre chaque code de l'API, en FR et en AR, avec un titre et un corps non vides", () => {
    for (const code of [...CODES_API, "NETWORK", "UNEXPECTED"]) {
      for (const d of [fr, ar]) {
        const entry = (d.errors.codes as Record<string, { title: string; body: string } | undefined>)[code];
        expect(entry, `${code} manquant`).toBeDefined();
        expect(entry!.title.length).toBeGreaterThan(0);
        expect(entry!.body.length).toBeGreaterThan(0);
      }
    }
  });

  it("l'arabe ne recopie jamais le français", () => {
    for (const code of Object.keys(fr.errors.codes)) {
      const k = code as keyof typeof fr.errors.codes;
      expect(ar.errors.codes[k].title).not.toBe(fr.errors.codes[k].title);
    }
  });
});

describe("pièces client (errors-ui-*.ts) = dictionnaire complet", () => {
  it.each([
    ["fr", fr, ui.errorActionsFr, ui.boundaryFr, ui.viewerFr, ui.staleFr, ui.referenceFr],
    ["ar", ar, uiAr.errorActionsAr, uiAr.boundaryAr, uiAr.viewerAr, uiAr.staleAr, uiAr.referenceAr],
  ] as const)("%s", (_l, d, actions, boundary, viewer, stale, reference) => {
    expect(d.errors.actions).toEqual(actions);
    expect(d.errors.boundary).toEqual(boundary);
    expect(d.errors.viewer).toEqual(viewer);
    expect(d.errors.stale).toEqual(stale);
    expect({ reference: d.errors.reference, referenceCopy: d.errors.referenceCopy, referenceCopied: d.errors.referenceCopied }).toEqual(reference);
  });
});

describe("describeError", () => {
  it("traduit un code métier connu dans la langue demandée", () => {
    const f = describeError({ code: "LCD_QUOTA_NUITS_DEPASSE", message: "Quota annuel dépassé : 90 nuit(s)…" }, "fr");
    expect(f.title).toBe(fr.errors.codes.LCD_QUOTA_NUITS_DEPASSE.title);
    const a = describeError({ code: "LCD_QUOTA_NUITS_DEPASSE", message: "Quota annuel dépassé" }, "ar");
    expect(a.title).toBe(ar.errors.codes.LCD_QUOTA_NUITS_DEPASSE.title);
    expect(a.body).not.toMatch(/Quota/);
  });

  it("propose « Actualiser » pour tout *_STATUT_INVALIDE, même inconnu du dictionnaire", () => {
    expect(describeError({ code: "DEPENSE_STATUT_INVALIDE" }, "fr").action).toBe("refresh");
    expect(describeError({ code: "DEPENSE_STATUT_INVALIDE" }, "fr").actionLabel).toBe("Actualiser");
    const inconnu = describeError({ code: "VEHICULE_STATUT_INVALIDE", message: "x" }, "ar");
    expect(inconnu.action).toBe("refresh");
    expect(inconnu.actionLabel).toBe(ar.errors.actions.refresh);
  });

  it("session expirée → Se reconnecter ; réseau → Réessayer", () => {
    expect(describeError({ code: "UNAUTHENTICATED" }, "fr").action).toBe("relogin");
    expect(describeError({ code: "UNAUTHENTICATED" }, "fr").actionLabel).toBe("Se reconnecter");
    const net = describeError({ code: "INTERNAL_ERROR", status: 0 }, "fr");
    expect(net.code).toBe("NETWORK");
    expect(net.action).toBe("retry");
    expect(net.title).toBe(fr.errors.codes.NETWORK.title);
  });

  it("RATE_LIMITED + Retry-After → « réessayez dans X »", () => {
    expect(describeError({ code: "RATE_LIMITED", retryAfter: 30 }, "fr").body).toContain("Réessayez dans 30 s.");
    expect(describeError({ code: "RATE_LIMITED", retryAfter: 125 }, "fr").body).toContain("Réessayez dans 3 min.");
    expect(describeError({ code: "RATE_LIMITED", retryAfter: 120 }, "ar").body).toContain("2 دقيقة");
    expect(describeError({ code: "RATE_LIMITED" }, "fr").body).not.toContain("Réessayez dans");
  });

  it("422/409 génériques : message serveur nettoyé en FR, texte générique en AR", () => {
    const msg = "Un syndic actif existe déjà pour cette copropriété (Partie 2.4).";
    const f = describeError({ code: "CONFLICT", message: msg }, "fr");
    expect(f.body).toBe("Un syndic actif existe déjà pour cette copropriété.");
    const a = describeError({ code: "CONFLICT", message: msg }, "ar");
    expect(a.body).toBe(ar.errors.codes.CONFLICT.body);
    const u = describeError({ code: "UNPROCESSABLE_ENTITY", message: "Créneau déjà réservé pour cet espace (Doc A §7.2)." }, "fr");
    expect(u.body).toBe("Créneau déjà réservé pour cet espace.");
  });

  it("code inconnu : serveur en FR (nettoyé), générique en AR ; 5xx inconnu = erreur interne", () => {
    expect(describeError({ code: "NOUVEAU_CODE", message: "Règle X (Doc A §3.1)." }, "fr").body).toBe("Règle X.");
    expect(describeError({ code: "NOUVEAU_CODE", message: "Règle X." }, "ar").body).toBe(ar.errors.codes.UNPROCESSABLE_ENTITY.body);
    expect(describeError({ code: "BIZARRE", status: 502 }, "fr").title).toBe(fr.errors.codes.INTERNAL_ERROR.title);
  });

  it("référence courte = 8 premiers caractères du request_id", () => {
    expect(describeError({ code: "INTERNAL_ERROR", requestId: "1a2b3c4d-5e6f-7a8b-9c0d" }, "fr").reference).toBe("1a2b3c4d");
    expect(shortRef(undefined)).toBeUndefined();
    expect(shortRef("ab-cd-ef-gh-ij")).toBe("abcdefgh");
  });

  it("paramètre non configuré = bannière légale, action « contacter le syndic »", () => {
    const d = describeError({ code: "PAIE_PARAMETRES_NON_CONFIGURES" }, "fr");
    expect(d.legalGate).toBe(true);
    expect(d.action).toBe("contact");
    expect(describeError({ code: "UNPROCESSABLE_ENTITY", message: "Délai non configuré — confirmation juridique requise" }, "fr").legalGate).toBe(true);
    expect(describeError({ code: "UNPROCESSABLE_ENTITY", message: "Autre règle" }, "fr").legalGate).toBe(false);
  });
});

describe("stripSpecRefs", () => {
  it.each([
    ["Un syndic actif existe déjà (Partie 2.4).", "Un syndic actif existe déjà."],
    ["Seul le syndic gère les contrats (Doc A §8).", "Seul le syndic gère les contrats."],
    ["Liez une résolution d'AG ADOPTEE avant d'activer (Doc A §8, brief §10).", "Liez une résolution d'AG ADOPTEE avant d'activer."],
    ["Renseignez-les dans Paramètres → Paie avant de valider (LEGAL_QUESTIONS_BRIEF §11).", "Renseignez-les dans Paramètres → Paie avant de valider."],
    ["Majorité non configurée (config_json.majorite_approbation_comptes) — LEGAL_QUESTIONS_BRIEF §9 ; précisez le type.", "Majorité non configurée ; précisez le type."],
    ["Le syndic doit renseigner les paramètres du règlement (PUT /lcd/reglement).", "Le syndic doit renseigner les paramètres du règlement."],
    ["Décaissement lié à une résolution (Doc A §3.6) — ou urgence autorisée.", "Décaissement lié à une résolution — ou urgence autorisée."],
    ["Message sans référence.", "Message sans référence."],
    // Vocabulaire métier : « Partie » / « § » seuls restent (même règle que l'API, #15).
    ["Partie 2 non attribuée à un lot.", "Partie 2 non attribuée à un lot."],
    ["Article 12 § 3 du règlement.", "Article 12 § 3 du règlement."],
    ["Quota atteint — Master Spec Partie 4.2.", "Quota atteint."],
  ])("%s", (entree, attendu) => {
    expect(stripSpecRefs(entree)).toBe(attendu);
  });
});

describe("aides", () => {
  it("normalizeCode : status 0 = NETWORK", () => {
    expect(normalizeCode({ code: "INTERNAL_ERROR", status: 0 })).toBe("NETWORK");
    expect(normalizeCode({ code: "", status: 500 })).toBe("UNEXPECTED");
  });
  it("actionFor", () => {
    expect(actionFor("NOT_FOUND")).toBe("refresh");
    expect(actionFor("FORBIDDEN")).toBe("contact");
    expect(actionFor("VALIDATION_ERROR")).toBe("none");
  });
  it("formatRetryAfter arrondit au supérieur, jamais 0", () => {
    expect(formatRetryAfter(0, "fr")).toBe("1 s");
    expect(formatRetryAfter(58.2, "fr")).toBe("59 s");
    expect(formatRetryAfter(59.2, "fr")).toBe("1 min");
    expect(formatRetryAfter(61, "fr")).toBe("2 min");
  });
});
