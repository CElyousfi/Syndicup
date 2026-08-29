/**
 * Formatage d'affichage — AUCUN calcul monétaire ici (CLAUDE.md §1.1 : jamais d'arithmétique
 * côté client). On ne fait que parser des chaînes décimales de l'API pour les présenter :
 * `1 250,00 MAD`, chiffres tabulaires gérés par la classe CSS `.tnum`.
 */
import type { Locale } from "./i18n";

/** "1250.5" | "1250" | "1250.00" → "1 250,00" (séparateur fin insécable). */
export function formatMontant(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const negative = value.startsWith("-");
  const abs = negative ? value.slice(1) : value;
  const [intPartRaw = "0", decPart = ""] = abs.split(".");
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  const dec = (decPart + "00").slice(0, 2);
  return `${negative ? "−" : ""}${grouped},${dec}`;
}

export function formatMAD(value: string | null | undefined, locale: Locale): string {
  if (value === null || value === undefined || value === "") return "—";
  const montant = formatMontant(value);
  return locale === "ar" ? `${montant} د.م.` : `${montant} MAD`;
}

/** Nombre entier "1000" → "1 000" (tantièmes, compteurs). */
export function formatEntier(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const s = String(value).split(".")[0] ?? "0";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
}

/** Ratio "0.5" → "50 %". */
export function formatPourcent(ratio: string | number | null | undefined): string {
  if (ratio === null || ratio === undefined || ratio === "") return "—";
  const n = typeof ratio === "number" ? ratio : Number.parseFloat(ratio);
  if (Number.isNaN(n)) return "—";
  return `${Math.round(n * 1000) / 10}\u202f%`;
}

const INTL_LOCALE: Record<Locale, string> = { fr: "fr-MA", ar: "ar-MA" };

export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
  }).format(d);
}

export function formatDateCourte(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    numberingSystem: "latn",
  }).format(d);
}

export function formatDateHeure(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
  }).format(d);
}

export function formatHeure(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
  }).format(d);
}

/** Période "2026-01" → "janvier 2026". */
export function formatPeriode(periode: string, locale: Locale): string {
  const [y, m] = periode.split("-");
  if (!y || !m) return periode;
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
  }).format(d);
}

/** Téléphone +212612345678 → +212 6 12 34 56 78 (affichage). */
export function formatTelephone(tel: string | null | undefined): string {
  if (!tel) return "—";
  const m = tel.match(/^\+?212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (m) return `+212 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
  return tel;
}

export function nomComplet(u: { nom?: string | null; prenom?: string | null } | null | undefined): string | null {
  if (!u) return null;
  const s = [u.prenom, u.nom].filter(Boolean).join(" ");
  return s || null;
}

/** Nombre de jours (calendaires) entre maintenant et une date ISO — négatif si passée. */
export function joursRestants(iso: string): number {
  const cible = new Date(iso);
  const debutCible = Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), cible.getUTCDate());
  const now = new Date();
  const debutNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((debutCible - debutNow) / 86_400_000);
}
