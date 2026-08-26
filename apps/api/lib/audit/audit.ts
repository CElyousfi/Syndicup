/**
 * Écriture d'`audit_log` — CLAUDE.md §1 non-négociable n°2 : toute action à valeur probante
 * (changement de propriétaire, etc.) est journalisée de façon immuable. Append-only strict :
 * jamais d'UPDATE/DELETE, bloqué au niveau du rôle Postgres `application_role` (migration M4),
 * pas seulement laissé à la discipline du code applicatif.
 */
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "../tenant/db";

export async function ecrireAuditLog(
  db: TenantDb,
  params: {
    coproprieteId: string;
    acteurId: string | null;
    action: string;
    entite: string;
    entiteId: string;
    avant?: Prisma.InputJsonValue;
    apres?: Prisma.InputJsonValue;
    ip?: string | null;
  }
) {
  return db.auditLog.create({
    data: {
      coproprieteId: params.coproprieteId,
      acteurId: params.acteurId,
      action: params.action,
      entite: params.entite,
      entiteId: params.entiteId,
      avantJson: params.avant,
      apresJson: params.apres,
      ip: params.ip ?? null,
    },
  });
}
