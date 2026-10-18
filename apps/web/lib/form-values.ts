/**
 * Saisie conservée après un échec — React 19 réinitialise un `<form action={…}>` une fois
 * l'action terminée : sans relais, un refus serveur (montant invalide, conflit, réseau…) vidait
 * tout le formulaire. L'action renvoie la saisie dans `state.values` (lib/forms-server.ts), les
 * champs la relisent comme valeur initiale :
 *
 *   <Input name="titre" defaultValue={formValue(state, "titre", incident?.titre ?? "")} />
 *   <Select key={formKey(state, "type")} name="type" defaultValue={formValue(state, "type", "A")}>
 *   <Checkbox name="urgent" defaultChecked={formChecked(state, "urgent", false)} />
 *
 * Module PUR, client-compatible : ni cookies, ni React.
 */
import type { FormState, FormValues } from "./forms";

/** Noms jamais renvoyés au navigateur : secrets, identifiants bancaires et pièces d'identité. */
const SENSIBLE = /(mot_de_passe|password|passe|secret|token|jeton|otp|rib|cnss|piece_identite|cin\b|carte)/i;
/** Au-delà, la saisie n'est pas renvoyée (texte collé par erreur) — l'erreur reste affichée. */
const LONGUEUR_MAX = 10_000;

/**
 * Saisie d'un FormData → chaînes conservables. Ignore les fichiers, les champs internes de
 * Next (`$ACTION_…`) et les noms sensibles.
 */
export function collectValues(fd: FormData): FormValues {
  const out: FormValues = {};
  for (const [nom, valeur] of fd.entries()) {
    if (typeof valeur !== "string") continue;
    if (nom.startsWith("$") || SENSIBLE.test(nom)) continue;
    if (valeur.length > LONGUEUR_MAX) continue;
    const deja = out[nom];
    if (deja === undefined) out[nom] = valeur;
    else out[nom] = Array.isArray(deja) ? [...deja, valeur] : [deja, valeur];
  }
  return out;
}

function valuesOf(state: FormState): FormValues | undefined {
  return state.status === "error" ? state.values : undefined;
}

/** Valeur soumise (première si répétée), sinon la valeur initiale. */
export function formValue(state: FormState, name: string, fallback: string | number | null | undefined = ""): string {
  const v = valuesOf(state)?.[name];
  if (v !== undefined) return Array.isArray(v) ? (v[0] ?? "") : v;
  return fallback === null || fallback === undefined ? "" : String(fallback);
}

/** Toutes les valeurs soumises d'un nom répété (cases multiples), sinon les valeurs initiales. */
export function formValues(state: FormState, name: string, fallback: readonly string[] = []): string[] {
  const values = valuesOf(state);
  if (!values) return [...fallback];
  const v = values[name];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Case cochée ? Après un échec, une case absente du FormData était décochée. `value` : pour un
 * groupe de cases de même nom, la valeur de CETTE case.
 */
export function formChecked(state: FormState, name: string, fallback: boolean, value?: string): boolean {
  const values = valuesOf(state);
  if (!values) return fallback;
  const v = values[name];
  if (v === undefined) return false;
  if (value === undefined) return true;
  return Array.isArray(v) ? v.includes(value) : v === value;
}

/**
 * Clé d'un `<select>` non contrôlé : React n'applique pas un nouveau `defaultValue` à un select
 * déjà monté — la clé le remonte quand la valeur soumise change.
 */
export function formKey(state: FormState, name: string): string {
  const v = valuesOf(state)?.[name];
  return v === undefined ? "initial" : `v:${Array.isArray(v) ? v.join("|") : v}`;
}
