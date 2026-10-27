/**
 * Set d'illustrations de marque « SyndicUp » v1 (oct. 2026) — planches plates à grain doux,
 * personnages sans visage, palette verte. Mêmes identifiants que le mobile
 * (apps/mobile/lib/core/widgets/su_art.dart) et le site vitrine : `su_<ID>_<slug>`.
 *
 * Fichiers : public/illustrations/su/su_<ID>_<slug>_<S|C>.webp (+ `@2x`).
 *   S = scène carrée, fond crème (fold, onboarding, affiches) ;
 *   C = découpe sur fond transparent, rognée (cartes, états vides, erreurs).
 * `AVAILABLE` liste ce qui est livré : une planche absente rend le repli, jamais une image cassée.
 * Pour en ajouter une : déposer les 2 (ou 4) fichiers, ajouter l'ID ci-dessous.
 */
export type SuArtId =
  | "A01" | "A02" | "A03" | "A04" | "A05" | "A06" | "A07" | "A08" | "A09"
  | "E01" | "E02" | "E03" | "E04" | "E05" | "E06" | "E07" | "E08" | "E09" | "E10" | "E11" | "E12" | "E13" | "E14" | "E15" | "E16" | "E17" | "E18" | "E19" | "E20" | "E21"
  | "S01" | "S02" | "S03" | "S04" | "S05" | "S06" | "S07" | "S08" | "S09" | "S10" | "S11" | "S12" | "S13"
  | "D01" | "D02" | "D03" | "D04" | "D05" | "D06" | "D07" | "D08" | "D09" | "D10" | "D11" | "D12"
  | "F01" | "F02" | "F03" | "F04" | "F05" | "F06" | "F07" | "F08" | "F09" | "F10" | "F11" | "F12" | "F13" | "F14" | "F15" | "F16" | "F17" | "F18" | "F19" | "F20"
  | "R01" | "R02" | "R03" | "R04" | "R05" | "R06"
  | "W01" | "W02" | "W03"
  | "N01" | "N02" | "N03" | "N04" | "N05" | "N06" | "N07" | "N08" | "N09" | "N10"
  | "P01" | "P02" | "P03" | "P04" | "P05"
  | "Q01" | "Q02" | "Q03" | "Q04" | "Q05" | "Q06" | "Q07" | "Q08" | "Q09" | "Q10";

export const SU_ART: Record<SuArtId, string> = {
  A01: "welcome", A02: "invitation-qr", A03: "login", A04: "biometric", A05: "password-forgot", A06: "password-reset-done", A07: "email-sent", A08: "update-required", A09: "set-password-first-time",
  E01: "no-residences", E02: "no-lots", E03: "no-incidents", E04: "no-ag", E05: "no-documents", E06: "no-notifications", E07: "no-visitors", E08: "no-reservations", E09: "no-contracts", E10: "no-expenses", E11: "no-staff", E12: "no-fund-calls", E13: "no-announcements", E14: "no-search-results", E15: "no-messages-assistant", E16: "no-tasks", E17: "no-budget", E18: "no-residents-connected", E19: "no-stays", E20: "no-disputes", E21: "no-parking",
  S01: "payment-recorded", S02: "vote-cast", S03: "ag-convened", S04: "incident-resolved", S05: "document-uploaded", S06: "invitation-sent", S07: "double-validation", S08: "annexes-generated", S09: "migration-done", S10: "trial-started", S11: "done-general", S12: "reservation-confirmed", S13: "visitor-registered",
  D01: "offline", D02: "session-expired", D03: "access-suspended", D04: "forbidden", D05: "generic-error", D06: "maintenance", D07: "loading", D08: "payment-overdue-reminder", D09: "renewal-due", D10: "grace-period", D11: "no-connection-for-vote", D12: "delete-confirm",
  F01: "charges-and-fund-calls", F02: "twelve-annexes", F03: "general-assembly", F04: "incidents-maintenance", F05: "caretaker-and-visitors", F06: "documents-proof", F07: "multi-residence-cabinet", F08: "residents-app", F09: "migration-import", F10: "trial-30-days", F11: "double-validation-feature", F12: "arabic-and-french", F13: "caretaker-tools", F14: "promoter-handover", F15: "morning-summary", F16: "reminders", F17: "security-hosting", F18: "common-spaces", F19: "budget-vote", F20: "recovery-rate",
  R01: "role-volunteer-syndic", R02: "role-cabinet", R03: "role-coowner", R04: "role-promoter", R05: "role-caretaker", R06: "role-resident-senior",
  W01: "hero-serenity", W02: "hero-cabinet", W03: "hero-residents",
  N01: "glyph-payment", N02: "glyph-vote", N03: "glyph-incident", N04: "glyph-visitor", N05: "glyph-document", N06: "glyph-ag", N07: "glyph-morning", N08: "glyph-reminder", N09: "glyph-residence", N10: "glyph-lift",
  P01: "poster-ag", P02: "poster-announcement", P03: "poster-onboarding", P04: "poster-security", P05: "poster-transparency",
  Q01: "quick-payment", Q02: "quick-fund-call", Q03: "quick-invitation", Q04: "quick-incident", Q05: "quick-stay", Q06: "quick-reservation", Q07: "quick-ag", Q08: "quick-visitor", Q09: "quick-residence", Q10: "quick-pay",
};

/** Planches livrées dans public/illustrations/su (scène S + découpe C, 1x + @2x). */
export const SU_ART_AVAILABLE: ReadonlySet<SuArtId> = new Set<SuArtId>(["A01", "E01", "D01", "P03"]);

export function suArtAvailable(id: SuArtId): boolean {
  return SU_ART_AVAILABLE.has(id);
}

/** Chemins public : `{ src, srcSet }` pour la découpe (défaut) ou la scène. */
export type SuArtVariant = "C" | "S" | "P";

/** Variante quand un écran demande l'illustration par son nom historique : scène pour
 *  l'onboarding et les folds (W, F), affiche pour P, découpe pour le reste. */
export function suArtDefaultVariant(id: SuArtId): SuArtVariant {
  const k = id[0];
  return k === "P" ? "P" : k === "W" || k === "F" ? "S" : "C";
}

/** Chemins public : `{ src, srcSet }` pour la découpe (défaut), la scène ou l'affiche (1600×1000). */
export function suArtSrc(id: SuArtId, variant: SuArtVariant = "C"): { src: string; srcSet: string } {
  const base = `/illustrations/su/su_${id}_${SU_ART[id]}_${variant}`;
  return { src: `${base}.webp`, srcSet: variant === "P" ? `${base}.webp 1x` : `${base}.webp 1x, ${base}@2x.webp 2x` };
}

/**
 * Noms historiques de <Illustration name="…"> → planche du set. Les écrans qui demandent
 * `offline` ou `empty-lots` reçoivent la nouvelle illustration dès qu'elle est livrée, sans
 * changer de code. (Mêmes correspondances que SuArt.legacy côté mobile.)
 */
export const SU_ART_LEGACY: Record<string, SuArtId> = {
  "welcome-hero": "A01",
  offline: "D01",
  "ob-1-residence": "W01",
  "ob-2-charges": "F01",
  "ob-3-incident": "F04",
  "ob-4-ag": "F03",
  "empty-residences": "E01",
  "empty-lots": "E02",
  "empty-incidents": "E03",
  "empty-ag": "E04",
  "empty-documents": "E05",
  "empty-notifications": "E06",
  "empty-visites": "E07",
  "empty-reservations": "E08",
  "empty-personnel": "E11",
  "empty-appels": "E12",
  "empty-annonces": "E13",
  "empty-search": "E14",
  "empty-taches": "E16",
  "empty-lcd": "E19",
  "empty-litiges": "E20",
  "empty-parkings": "E21",
  "ok-paiement": "S01",
  "ok-vote": "S02",
  "ok-incident": "S04",
  "ok-invitation": "S06",
  "ok-general": "S11",
  "ok-reservation": "S12",
  "ok-visiteur": "S13",
  "poster-ag": "P01",
  "poster-annonce": "P02",
  "poster-onboarding": "P03",
  "poster-securite": "P04",
  "poster-transparence": "P05",
  "quick-paiement": "Q01",
  "quick-appel": "Q02",
  "quick-invitation": "Q03",
  "quick-incident": "Q04",
  "quick-sejour": "Q05",
  "quick-reservation": "Q06",
  "quick-ag": "Q07",
  "quick-visiteur": "Q08",
  "quick-copropriete": "Q09",
  "quick-payer": "Q10",
};

/** La planche du set qui remplace un nom historique, si livrée. */
export function suArtFor(name: string): SuArtId | null {
  const id = SU_ART_LEGACY[name];
  return id && suArtAvailable(id) ? id : null;
}
