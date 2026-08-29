/**
 * Aiguillage post-authentification : où envoyer l'utilisateur une fois les jetons posés.
 * Résolu côté serveur (jamais par masquage client — CLAUDE.md, brief §2.5).
 */
import { apiFetch } from "./api/client";
import { writeCoproprieteId } from "./session";
import type { Profil } from "./api/types";
import type { Locale } from "./i18n";

export async function destinationApresConnexion(
  locale: Locale,
  accessToken?: string
): Promise<string> {
  const me = await apiFetch<Profil>("/users/me", { accessToken });

  if (!me.ok) {
    // Compte authentifié mais sans profil (404) ou sans aucun rôle (401 « JWT sans rôle ») :
    // c'est un invité qui n'a pas encore accepté son invitation — on l'amène directement à
    // la saisie / au scan de son code, jamais en boucle sur la connexion.
    if (me.status === 404 || me.status === 401) return `/${locale}/invitation`;
    return `/${locale}/connexion`;
  }

  if (me.data.statut_compte === "SUSPENDU") return `/${locale}/compte/suspendu`;

  const rolesActifs = (me.data.roles ?? []).filter((r) => r.actif);
  const coproIds = [...new Set(rolesActifs.map((r) => r.copropriete_id))];

  // Opérateur plateforme : atterrissage direct sur la console (/admin), contexte posé
  // sur sa copropriété d'ancrage — il basculera ensuite librement.
  const superAdmin = rolesActifs.find((r) => r.role === "SUPER_ADMIN");
  if (superAdmin) {
    await writeCoproprieteId(superAdmin.copropriete_id);
    return `/${locale}/admin`;
  }

  if (coproIds.length === 0) {
    return me.data.statut_compte === "EN_VALIDATION"
      ? `/${locale}/compte/validation`
      : `/${locale}/compte/sans-acces`;
  }
  if (coproIds.length === 1) {
    await writeCoproprieteId(coproIds[0]!);
    return `/${locale}/tableau-de-bord`;
  }
  return `/${locale}/choisir-copropriete`;
}
