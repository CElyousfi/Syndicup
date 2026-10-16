/** Garde minimale pour les routes opérateur sans accès base (ex. simulation de tarif). */
import type { TenantContext } from "../tenant/context";
import { PermissionRefuseeError } from "./abonnements";

export function exigerOperateurSeul(ctx: TenantContext) {
  if (ctx.role !== "SUPER_ADMIN") throw new PermissionRefuseeError("Console opérateur : réservée au super_admin.");
}
