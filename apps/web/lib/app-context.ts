/**
 * Contexte applicatif d'une requête authentifiée — résolu CÔTÉ SERVEUR (jamais par masquage
 * client, brief §2.5) et mémoïsé par requête : layout et page partagent les mêmes fetchs.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { apiFetch } from "./api/client";
import { readSession } from "./session";
import { getDict, isLocale, type Dict, type Locale } from "./i18n";
import type { Copropriete, Profil, RoleType } from "./api/types";

export interface AppContext {
  locale: Locale;
  dict: Dict;
  profil: Profil;
  /** Rôle principal dans la copropriété active (priorité descendante). */
  role: RoleType;
  /** Tous les rôles actifs dans la copropriété active. */
  roles: RoleType[];
  copropriete: Copropriete | null;
  coproprietes: Copropriete[];
  coproprieteId: string | null;
}

const PRIORITE: RoleType[] = [
  "SUPER_ADMIN",
  "SYNDIC",
  "CONSEIL_SYNDICAL",
  "PROPRIETAIRE",
  "INDIVISAIRE",
  "PERSONNE_MORALE_REPRESENTANT",
  "LOCATAIRE",
  "GARDIEN",
  "PRESTATAIRE",
];

export const getAppContext = cache(async (localeRaw: string): Promise<AppContext> => {
  const locale: Locale = isLocale(localeRaw) ? localeRaw : "fr";
  const dict = getDict(locale);

  const [me, coprosRes, session] = await Promise.all([
    apiFetch<Profil>("/users/me"),
    apiFetch<Copropriete[]>("/coproprietes"),
    readSession(),
  ]);

  if (!me.ok) {
    if (me.status === 404) redirect(`/${locale}/compte/sans-acces`);
    redirect(`/${locale}/connexion`);
  }
  if (me.data.statut_compte === "SUSPENDU") redirect(`/${locale}/compte/suspendu`);

  const rolesActifs = (me.data.roles ?? []).filter((r) => r.actif);
  const estSuperAdmin = rolesActifs.some((r) => r.role === "SUPER_ADMIN");
  if (rolesActifs.length === 0) {
    redirect(
      me.data.statut_compte === "EN_VALIDATION"
        ? `/${locale}/compte/validation`
        : `/${locale}/compte/sans-acces`
    );
  }

  const coproprietes = coprosRes.ok ? coprosRes.data : [];
  let coproprieteId = session.coproprieteId;
  const coproIds = [...new Set(rolesActifs.map((r) => r.copropriete_id))];

  if (!coproprieteId || (!estSuperAdmin && !coproIds.includes(coproprieteId))) {
    if (coproIds.length === 1) coproprieteId = coproIds[0]!;
    else redirect(`/${locale}/choisir-copropriete`);
  }

  const rolesIci = rolesActifs
    .filter((r) => r.copropriete_id === coproprieteId)
    .map((r) => r.role);
  if (estSuperAdmin && !rolesIci.includes("SUPER_ADMIN")) rolesIci.push("SUPER_ADMIN");
  const role = PRIORITE.find((r) => rolesIci.includes(r)) ?? rolesIci[0] ?? "LOCATAIRE";

  return {
    locale,
    dict,
    profil: me.data,
    role,
    roles: rolesIci,
    copropriete: coproprietes.find((c) => c.id === coproprieteId) ?? null,
    coproprietes,
    coproprieteId,
  };
});

/** Garde de page : 403 visuel si le rôle n'est pas dans la liste (le serveur API re-vérifie). */
export function exigerRole(ctx: AppContext, autorises: RoleType[]): void {
  if (!autorises.some((r) => ctx.roles.includes(r))) {
    redirect(`/${ctx.locale}/tableau-de-bord`);
  }
}
