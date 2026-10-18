"use server";

import { redirect } from "next/navigation";
import { apiPublic } from "../../../../lib/api/client";
import { writeTokens } from "../../../../lib/session";
import { destinationApresConnexion } from "../../../../lib/bootstrap";
import { success, type FormState } from "../../../../lib/forms";
import { fromApiError } from "../../../../lib/forms-server";
import { getDict, isLocale } from "../../../../lib/i18n";
import type { SessionTokens } from "../../../../lib/api/types";

/** Chemin de retour sûr (même origine) après connexion — ex. /invitation/{code}. */
function nextSur(formData: FormData): string | null {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function connexionEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = String(formData.get("locale") ?? "fr");
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");
  const rester = formData.get("rester") === "1";
  const res = await apiPublic<SessionTokens>("/auth/login", {
    method: "POST",
    body: { email, mot_de_passe: motDePasse },
  });
  if (!res.ok) return fromApiError(res, formData);
  await writeTokens(res.data, { rester });
  const next = nextSur(formData);
  const loc = isLocale(locale) ? locale : "fr";
  redirect(next ? `/${loc}${next}` : await destinationApresConnexion(loc, res.data.access_token));
}

/** Mot de passe oublié : réponse identique que l'adresse existe ou non. */
export async function motDePasseOublie(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = String(formData.get("locale") ?? "fr");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const res = await apiPublic("/auth/password/forgot", {
    method: "POST",
    body: { email, langue: isLocale(locale) ? locale : "fr" },
  });
  if (!res.ok) return fromApiError(res, formData);
  return success(undefined, { email });
}

/** Réinitialisation depuis le lien reçu : pose le mot de passe et ouvre la session. */
export async function reinitialiserMotDePasse(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = String(formData.get("locale") ?? "fr");
  const dict = getDict(isLocale(locale) ? locale : "fr");
  const tokenHash = String(formData.get("token_hash") ?? "");
  const mdp = String(formData.get("mot_de_passe") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (mdp.length < 8) {
    return { status: "error", code: "VALIDATION_ERROR", message: dict.auth.passwordTooShort, fields: { mot_de_passe: dict.auth.passwordTooShort } };
  }
  if (mdp !== confirmation) {
    return { status: "error", code: "VALIDATION_ERROR", message: dict.auth.passwordMismatch, fields: { confirmation: dict.auth.passwordMismatch } };
  }
  const res = await apiPublic<SessionTokens>("/auth/password/reset", {
    method: "POST",
    body: { token_hash: tokenHash, mot_de_passe: mdp },
  });
  if (!res.ok) return fromApiError(res, formData);
  await writeTokens(res.data, { rester: true });
  const loc = isLocale(locale) ? locale : "fr";
  redirect(await destinationApresConnexion(loc, res.data.access_token));
}
