"use server";

import { redirect } from "next/navigation";
import { apiFetch, apiPublic } from "../api/client";
import { clearSession, readInvitationJeton, readSession, writeCoproprieteId, writeTokens } from "../session";
import { fromApiError, type FormState } from "../forms";
import { isLocale } from "../i18n";
import type {
  InviteAcceptResult,
  InviteInscriptionResult,
  Profil,
  SessionTokens,
} from "../api/types";

export async function seDeconnecter(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "fr");
  await clearSession();
  redirect(`/${isLocale(locale) ? locale : "fr"}/connexion`);
}

/** Sélection de la copropriété active (A4) — vérifiée contre les rôles réels du profil. */
export async function choisirCopropriete(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "fr");
  const coproId = String(formData.get("copropriete_id") ?? "");
  const loc = isLocale(locale) ? locale : "fr";

  const me = await apiFetch<Profil>("/users/me");
  if (!me.ok) redirect(`/${loc}/connexion`);
  const autorise = (me.data.roles ?? []).some((r) => r.actif && r.copropriete_id === coproId);
  if (!autorise) redirect(`/${loc}/choisir-copropriete`);

  await writeCoproprieteId(coproId);
  redirect(`/${loc}/tableau-de-bord`);
}

/**
 * Inscription par invitation — le geste unique après scan du QR / saisie du code : compte +
 * identité + accès à la copropriété, puis session ouverte. Code à usage unique côté base.
 */
export async function inscrireParInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const langueBrute = String(formData.get("langue_preferee") ?? "FR");
  const langue = langueBrute === "AR" ? "AR" : "FR";

  const res = await apiPublic<InviteInscriptionResult>("/auth/invite/inscription", {
    method: "POST",
    body: {
      code: String(formData.get("code") ?? "").trim().toUpperCase(),
      email: String(formData.get("email") ?? "").trim(),
      mot_de_passe: String(formData.get("mot_de_passe") ?? ""),
      prenom: String(formData.get("prenom") ?? "").trim(),
      nom: String(formData.get("nom") ?? "").trim(),
      langue_preferee: langue,
      jeton: (await readInvitationJeton()) ?? undefined,
    },
  });
  if (!res.ok) return fromApiError(res);

  await writeTokens({
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_in: res.data.expires_in,
  });
  await writeCoproprieteId(res.data.copropriete_id);

  const locFinale = langue === "AR" ? "ar" : "fr";
  if (res.data.statut_compte === "EN_VALIDATION") redirect(`/${locFinale}/compte/validation`);
  redirect(`/${locFinale}/tableau-de-bord?bienvenue=1`);
}

/**
 * Acceptation d'invitation (A3) — nécessite une session (Bearer), pas encore de rôle.
 * Le code est à usage unique (statut ACCEPTEE côté base : toute réutilisation renvoie 409).
 * L'invité renseigne ses informations dans le même geste : elles sont enregistrées sur son
 * profil juste après l'acceptation (le rôle vient d'être attribué → contexte tenant valide).
 */
export async function accepterInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = String(formData.get("locale") ?? "fr");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const langueBrute = String(formData.get("langue_preferee") ?? "").trim();
  const langue = langueBrute === "AR" || langueBrute === "FR" ? langueBrute : null;
  const loc = isLocale(locale) ? locale : "fr";

  const session = await readSession();
  if (!session.accessToken) {
    redirect(`/${loc}/connexion?next=${encodeURIComponent(`/invitation/${code}`)}`);
  }

  const res = await apiFetch<InviteAcceptResult>("/auth/invite/accept", {
    method: "POST",
    body: { code, jeton: (await readInvitationJeton()) ?? undefined },
  });
  if (!res.ok) return fromApiError(res);

  // Le rôle vient d'être attribué : le jeton courant ne le porte pas encore (les claims
  // sont calculés à l'émission). On rafraîchit AVANT toute navigation, sinon l'application
  // verrait un utilisateur « sans rôle » et le renverrait à la connexion.
  if (session.refreshToken) {
    const frais = await apiPublic<SessionTokens>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: session.refreshToken },
    });
    if (frais.ok) await writeTokens(frais.data);
  }

  await writeCoproprieteId(res.data.copropriete_id);

  // Informations de l'invité — best-effort : l'accès est déjà acquis, un échec ici ne doit
  // pas bloquer ; le profil reste modifiable à tout moment depuis « Mon profil ».
  const infos: Record<string, string> = {};
  if (prenom) infos.prenom = prenom;
  if (nom) infos.nom = nom;
  if (langue) infos.langue_preferee = langue;
  if (Object.keys(infos).length > 0) {
    await apiFetch("/users/me", {
      method: "PATCH",
      body: infos,
      coproprieteId: res.data.copropriete_id,
    });
  }

  const locFinale = langue === "AR" ? "ar" : langue === "FR" ? "fr" : loc;
  if (res.data.statut_compte === "EN_VALIDATION") redirect(`/${locFinale}/compte/validation`);
  redirect(`/${locFinale}/tableau-de-bord`);
}
