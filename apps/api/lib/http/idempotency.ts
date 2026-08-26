/**
 * Idempotence générique — Master Spec Partie 3.1 / principe non négociable 1.7.3 :
 * header `Idempotency-Key` obligatoire sur toute écriture financière ou à valeur probante.
 *
 *   - rejeu même clé + même payload (statut TERMINE) → réponse stockée renvoyée à l'identique
 *     (le résultat porte `rejouee: true` pour que la route ajoute meta.rejouee) ;
 *   - même clé + payload différent → 409 CONFLICT (règle du contrat) ;
 *   - même clé en cours de traitement (requête concurrente) → 409 CONFLICT.
 *
 * S'utilise À L'INTÉRIEUR de la transaction withTenant du service appelant : le claim et la
 * réponse stockée partagent la transaction de l'écriture métier — un rollback annule les deux.
 * Les idempotences métier existantes (unique (copropriete_id, periode, type) sur appel_de_fonds,
 * unique reference_cmi sur paiement) restent en place : elles protègent le domaine, cette couche
 * protège le transport (retry client/mobile/sync_queue).
 */
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { withTenant, type TenantDb } from "../tenant/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class IdempotencyKeyManquanteError extends Error {}
export class IdempotencyConflitError extends Error {}

/** Extrait et valide le header Idempotency-Key. 400 VALIDATION_ERROR côté route si invalide. */
export function readIdempotencyKey(req: Request): string {
  const cle = req.headers.get("idempotency-key");
  if (!cle || !UUID_RE.test(cle)) {
    throw new IdempotencyKeyManquanteError(
      "Header Idempotency-Key obligatoire (UUID) sur cette écriture."
    );
  }
  return cle.toLowerCase();
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

type Db = TenantDb;

/**
 * Exécute `fn` sous protection d'idempotence. Rejeu (même clé + même payload, TERMINE) :
 * renvoie la réponse stockée — même forme que `fn()` après sérialisation JSON, donc la
 * réponse HTTP rejouée est identique octet pour octet. Si `cle` est undefined (appel interne,
 * tests service) : exécute `fn` directement sans protection.
 */
export async function withIdempotency<T>(
  ctx: TenantContext,
  db: Db,
  opts: { cle: string | undefined; endpoint: string; payload: unknown },
  fn: () => Promise<T>
): Promise<T> {
  if (!opts.cle) return fn();
  const payloadHash = hashPayload(opts.payload);

  const existante = await db.idempotencyKey.findUnique({
    where: { cle_endpoint: { cle: opts.cle, endpoint: opts.endpoint } },
  });
  if (existante) {
    if (existante.payloadHash !== payloadHash) {
      throw new IdempotencyConflitError(
        "Cette Idempotency-Key a déjà été utilisée avec un payload différent."
      );
    }
    if (existante.statut === "TERMINE") {
      return existante.reponseJson as T;
    }
    throw new IdempotencyConflitError("Requête identique déjà en cours de traitement.");
  }

  await db.idempotencyKey.create({
    data: {
      cle: opts.cle,
      endpoint: opts.endpoint,
      coproprieteId: ctx.coproprieteId,
      utilisateurId: ctx.utilisateurId,
      payloadHash,
    },
  });

  const data = await fn();

  await db.idempotencyKey.update({
    where: { cle_endpoint: { cle: opts.cle, endpoint: opts.endpoint } },
    data: {
      statut: "TERMINE",
      reponseStatus: 201,
      // Round-trip JSON : sérialise les Decimal/Date en chaînes — exactement ce que
      // Response.json produira — pour que le rejeu soit identique octet pour octet.
      reponseJson: JSON.parse(JSON.stringify(data ?? null)) as Prisma.InputJsonValue,
    },
  });

  return data;
}

/**
 * withTenant + withIdempotency en un seul appel — remplace `withTenant(ctx, cb)` dans un
 * service à protéger, sans changer la forme du callback : le claim, l'écriture métier et la
 * réponse stockée partagent la même transaction.
 */
export function withTenantIdempotent<T>(
  ctx: TenantContext,
  opts: { cle: string | undefined; endpoint: string; payload: unknown },
  cb: (db: Db) => Promise<T>
): Promise<T> {
  return withTenant(ctx, (db) => withIdempotency(ctx, db, opts, () => cb(db)));
}
