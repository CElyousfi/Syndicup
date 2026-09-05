/**
 * Contexte tenant — dérivé exclusivement du JWT Supabase vérifié (lib/tenant/jwt.ts), jamais
 * d'un paramètre libre côté client (CLAUDE.md §1.8, Master Spec Partie 1.6 / 4.4).
 */
import type { Role } from "../auth/permissions";

export interface TenantContext {
  utilisateurId: string;
  coproprieteId: string;
  role: Role;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLES: readonly Role[] = [
  "SUPER_ADMIN",
  "SYNDIC",
  "CONSEIL_SYNDICAL",
  "PROPRIETAIRE",
  "LOCATAIRE",
  "INDIVISAIRE",
  "GARDIEN",
  "PRESTATAIRE",
  "PERSONNE_MORALE_REPRESENTANT",
  "GESTIONNAIRE_LCD",
];

/**
 * Validation défensive avant toute injection dans le contexte RLS (set_config). Lève si le
 * contexte est malformé — jamais de défaut silencieux (CLAUDE.md §1.5).
 */
export function assertValidTenantContext(ctx: TenantContext): void {
  if (!UUID_RE.test(ctx.utilisateurId)) {
    throw new Error("TenantContext invalide : utilisateurId n'est pas un UUID.");
  }
  if (!UUID_RE.test(ctx.coproprieteId)) {
    throw new Error("TenantContext invalide : coproprieteId n'est pas un UUID.");
  }
  if (!ROLES.includes(ctx.role)) {
    throw new Error(`TenantContext invalide : role inconnu "${ctx.role}".`);
  }
}
