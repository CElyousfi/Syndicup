/**
 * Messages Zod par défaut en français — installés une seule fois (z.setErrorMap) dès que
 * lib/http/respond.ts est chargé, c'est-à-dire par toute route de l'API.
 *
 * Seuls les messages PAR DÉFAUT sont traduits : un message explicite posé dans un schéma
 * (`.min(1, "Nom requis.")`, `.regex(re, "Image ou PDF uniquement.")`) reste prioritaire —
 * Zod v3 n'appelle la map globale que lorsqu'aucun message de schéma n'existe.
 */
import { z, ZodIssueCode, type ZodErrorMap } from "zod";

const TYPES: Record<string, string> = {
  string: "un texte",
  number: "un nombre",
  integer: "un nombre entier",
  float: "un nombre",
  bigint: "un nombre entier",
  boolean: "vrai ou faux",
  date: "une date",
  array: "une liste",
  object: "un objet",
  null: "vide",
};

const FORMATS: Record<string, string> = {
  email: "Adresse e-mail invalide.",
  url: "Adresse web (URL) invalide.",
  uuid: "Identifiant invalide.",
  cuid: "Identifiant invalide.",
  cuid2: "Identifiant invalide.",
  ulid: "Identifiant invalide.",
  nanoid: "Identifiant invalide.",
  regex: "Format invalide.",
  datetime: "Date et heure invalides (format ISO 8601 attendu).",
  date: "Date invalide (format AAAA-MM-JJ attendu).",
  time: "Heure invalide (format HH:MM attendu).",
  duration: "Durée invalide.",
  ip: "Adresse IP invalide.",
  cidr: "Plage d'adresses IP invalide.",
  base64: "Contenu base64 invalide.",
  base64url: "Contenu base64 invalide.",
  jwt: "Jeton invalide.",
  emoji: "Emoji invalide.",
};

function n(v: number | bigint): string {
  return typeof v === "bigint" ? v.toString() : String(v);
}

function pluriel(v: number | bigint, singulier: string, plurielMot: string): string {
  return Number(v) > 1 ? plurielMot : singulier;
}

export const zodErrorMapFr: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === "undefined") return { message: "Champ obligatoire." };
      return { message: `Valeur invalide : ${TYPES[issue.expected] ?? issue.expected} est attendu.` };
    case ZodIssueCode.invalid_literal:
      return { message: `Valeur attendue : ${JSON.stringify(issue.expected)}.` };
    case ZodIssueCode.unrecognized_keys:
      return { message: `Champ(s) non reconnu(s) : ${issue.keys.join(", ")}.` };
    case ZodIssueCode.invalid_union:
    case ZodIssueCode.invalid_union_discriminator:
      return { message: "Valeur invalide." };
    case ZodIssueCode.invalid_enum_value:
      return { message: `Valeur non autorisée. Valeurs possibles : ${issue.options.join(", ")}.` };
    case ZodIssueCode.invalid_date:
      return { message: "Date invalide." };
    case ZodIssueCode.invalid_string: {
      const v = issue.validation;
      if (typeof v === "string") return { message: FORMATS[v] ?? "Format invalide." };
      if ("includes" in v) return { message: `Doit contenir « ${v.includes} ».` };
      if ("startsWith" in v) return { message: `Doit commencer par « ${v.startsWith} ».` };
      if ("endsWith" in v) return { message: `Doit se terminer par « ${v.endsWith} ».` };
      return { message: "Format invalide." };
    }
    case ZodIssueCode.too_small: {
      const m = issue.minimum;
      switch (issue.type) {
        case "string":
          if (issue.exact) return { message: `Doit contenir exactement ${n(m)} ${pluriel(m, "caractère", "caractères")}.` };
          if (Number(m) === 1 && issue.inclusive) return { message: "Champ obligatoire." };
          return { message: `Doit contenir au moins ${n(m)} ${pluriel(m, "caractère", "caractères")}.` };
        case "array":
        case "set":
          if (issue.exact) return { message: `Doit contenir exactement ${n(m)} ${pluriel(m, "élément", "éléments")}.` };
          if (Number(m) === 1 && issue.inclusive) return { message: "Sélectionnez au moins un élément." };
          return { message: `Doit contenir au moins ${n(m)} ${pluriel(m, "élément", "éléments")}.` };
        case "number":
        case "bigint":
          if (issue.exact) return { message: `Doit être égal à ${n(m)}.` };
          return { message: issue.inclusive ? `Doit être supérieur ou égal à ${n(m)}.` : `Doit être supérieur à ${n(m)}.` };
        case "date":
          return { message: `La date doit être postérieure ${issue.inclusive ? "ou égale " : ""}au ${new Date(Number(m)).toISOString().slice(0, 10)}.` };
      }
      break;
    }
    case ZodIssueCode.too_big: {
      const m = issue.maximum;
      switch (issue.type) {
        case "string":
          if (issue.exact) return { message: `Doit contenir exactement ${n(m)} ${pluriel(m, "caractère", "caractères")}.` };
          return { message: `Doit contenir au plus ${n(m)} ${pluriel(m, "caractère", "caractères")}.` };
        case "array":
        case "set":
          if (issue.exact) return { message: `Doit contenir exactement ${n(m)} ${pluriel(m, "élément", "éléments")}.` };
          return { message: `Doit contenir au plus ${n(m)} ${pluriel(m, "élément", "éléments")}.` };
        case "number":
        case "bigint":
          if (issue.exact) return { message: `Doit être égal à ${n(m)}.` };
          return { message: issue.inclusive ? `Doit être inférieur ou égal à ${n(m)}.` : `Doit être inférieur à ${n(m)}.` };
        case "date":
          return { message: `La date doit être antérieure ${issue.inclusive ? "ou égale " : ""}au ${new Date(Number(m)).toISOString().slice(0, 10)}.` };
      }
      break;
    }
    case ZodIssueCode.not_multiple_of:
      return { message: `Doit être un multiple de ${n(issue.multipleOf)}.` };
    case ZodIssueCode.not_finite:
      return { message: "Doit être un nombre fini." };
    case ZodIssueCode.invalid_intersection_types:
    case ZodIssueCode.invalid_arguments:
    case ZodIssueCode.invalid_return_type:
      return { message: "Valeur invalide." };
    case ZodIssueCode.custom:
      return { message: ctx.defaultError === "Invalid input" ? "Valeur invalide." : ctx.defaultError };
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(zodErrorMapFr);
