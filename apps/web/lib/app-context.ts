/**
 * Contexte applicatif d'une requête authentifiée — résolu CÔTÉ SERVEUR (jamais par masquage
 * client, brief §2.5) et mémoïsé par requête : layout et page partagent les mêmes fetchs.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { apiFetch } from "./api/client";
import { readSession } from "./session";
import { getDict, isLocale, type Dict, type Locale } from "./i18n";
import type { Cabinet, Copropriete, Profil, RoleType } from "./api/types";

/**
 * Rôle applicatif : un rôle de copropriété, ou `MEMBRE_CABINET` (M25) pour un membre d'un cabinet
 * sans aucun rôle de copropriété — il n'accède qu'à l'espace cabinet et à son profil.
 */
export type RoleApp = RoleType | "MEMBRE_CABINET";

export interface AppContext {
  locale: Locale;
  dict: Dict;
  profil: Profil;
  /** Rôle principal dans la copropriété active (priorité descendante), ou `MEMBRE_CABINET`. */
  role: RoleApp;
  /** Tous les rôles actifs dans la copropriété active. */
  roles: RoleType[];
  copropriete: Copropriete | null;
  coproprietes: Copropriete[];
  coproprieteId: string | null;
  /** M25 — cabinets dont l'utilisateur est membre (vide pour la plupart des comptes). */
  cabinets: Cabinet[];
}

const PRIORITE: RoleType[] = [
  "SUPER_ADMIN",
  "SYNDIC",
  "CONSEIL_SYNDICAL",
  "SYNDIC_COMPTABLE",
  "PROPRIETAIRE",
  "INDIVISAIRE",
  "PERSONNE_MORALE_REPRESENTANT",
  "GESTIONNAIRE_LCD",
  "LOCATAIRE",
  "GARDIEN",
  "PRESTATAIRE",
];

export const getAppContext = cache(async (localeRaw: string): Promise<AppContext> => {
  const locale: Locale = isLocale(localeRaw) ? localeRaw : "fr";
  const dict = getDict(locale);

  const [me, coprosRes, session, cabinetsRes] = await Promise.all([
    apiFetch<Profil>("/users/me"),
    apiFetch<Copropriete[]>("/coproprietes"),
    readSession(),
    apiFetch<Cabinet[]>("/cabinets"),
  ]);
  const cabinets = cabinetsRes.ok ? cabinetsRes.data : [];

  if (!me.ok) {
    if (me.status === 404) redirect(`/${locale}/compte/sans-acces`);
    redirect(`/${locale}/connexion`);
  }
  if (me.data.statut_compte === "SUSPENDU") redirect(`/${locale}/compte/suspendu`);

  const rolesActifs = (me.data.roles ?? []).filter((r) => r.actif);
  const estSuperAdmin = rolesActifs.some((r) => r.role === "SUPER_ADMIN");
  if (rolesActifs.length === 0) {
    // M25 — membre d'un cabinet sans rôle de copropriété : espace cabinet seul.
    if (cabinets.length > 0) {
      return { locale, dict, profil: me.data, role: "MEMBRE_CABINET", roles: [], copropriete: null, coproprietes: [], coproprieteId: null, cabinets };
    }
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
    cabinets,
  };
});

/** Garde de page : 403 visuel si le rôle n'est pas dans la liste (le serveur API re-vérifie). */
export function exigerRole(ctx: AppContext, autorises: RoleType[]): void {
  if (!autorises.some((r) => ctx.roles.includes(r))) {
    redirect(`/${ctx.locale}/tableau-de-bord`);
  }
}
