"use server";

import { redirect } from "next/navigation";
import { apiPublic } from "../../../../lib/api/client";
import { writeTokens } from "../../../../lib/session";
import { destinationApresConnexion } from "../../../../lib/bootstrap";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import { getDict, isLocale } from "../../../../lib/i18n";
import type { SessionTokens } from "../../../../lib/api/types";

/** Chemin de retour sûr (même origine) après connexion — ex. /invitation/{code}. */
function nextSur(formData: FormData): string | null {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/** Téléphone marocain saisi librement (06…, +2126…, 002126…) → +2126XXXXXXXX. */
function normaliserTelephone(brut: string): string | null {
  const chiffres = brut.replace(/[^\d+]/g, "");
  let t = chiffres;
  if (t.startsWith("00212")) t = `+212${t.slice(5)}`;
  else if (t.startsWith("212")) t = `+${t}`;
  else if (t.startsWith("0") && t.length === 10) t = `+212${t.slice(1)}`;
  if (/^\+2126\d{8}$/.test(t) || /^\+2127\d{8}$/.test(t)) return t;
  return null;
}

export async function demanderOtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = String(formData.get("locale") ?? "fr");
  const dict = getDict(isLocale(locale) ? locale : "fr");
  const telephone = normaliserTelephone(String(formData.get("telephone") ?? ""));
  if (!telephone) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: dict.auth.invalidPhone,
      fields: { telephone: dict.auth.invalidPhone },
    };
  }
  const res = await apiPublic("/auth/otp/request", { method: "POST", body: { telephone } });
  if (!res.ok) return fromApiError(res);
  const next = nextSur(formData);
  redirect(
    `/${locale}/connexion/code?tel=${encodeURIComponent(telephone)}${
      next ? `&next=${encodeURIComponent(next)}` : ""
    }`
  );
}

export async function verifierOtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = String(formData.get("locale") ?? "fr");
  const telephone = String(formData.get("telephone") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const res = await apiPublic<SessionTokens>("/auth/otp/verify", {
    method: "POST",
    body: { telephone, code },
  });
  if (!res.ok) return fromApiError(res);
  await writeTokens(res.data);
  const next = nextSur(formData);
  const loc = isLocale(locale) ? locale : "fr";
  redirect(next ? `/${loc}${next}` : await destinationApresConnexion(loc, res.data.access_token));
}

export async function connexionEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = String(formData.get("locale") ?? "fr");
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");
  const res = await apiPublic<SessionTokens>("/auth/login", {
    method: "POST",
    body: { email, mot_de_passe: motDePasse },
  });
  if (!res.ok) return fromApiError(res);
  await writeTokens(res.data);
  const next = nextSur(formData);
  const loc = isLocale(locale) ? locale : "fr";
  redirect(next ? `/${loc}${next}` : await destinationApresConnexion(loc, res.data.access_token));
}

/** Renvoi de code depuis l'écran OTP (sans quitter la page). */
export async function renvoyerOtp(_prev: FormState, formData: FormData): Promise<FormState> {
  const telephone = String(formData.get("telephone") ?? "");
  const res = await apiPublic("/auth/otp/request", { method: "POST", body: { telephone } });
  if (!res.ok) return fromApiError(res);
  return success();
}
