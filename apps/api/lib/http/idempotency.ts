/**
 * Idempotence générique — Master Spec Partie 3.1 / principe non négociable 1.7.3 :
 * header `Idempotency-Key` obligatoire sur toute écriture financière ou à valeur probante.
 *
 *   - rejeu même clé + même payload (statut TERMINE) → réponse stockée renvoyée à l'identique
 *     (le résultat porte `rejouee: true` pour que la route ajoute meta.rejouee) ;
 *   - même clé + payload différent → 409 CONFLICT (règle du contrat) ;
 *   - même clé en cours de traitement (requête concurrente) → 409 CONFLICT ;
 *   - deux requêtes concurrentes qui posent la même clé au même instant : la perdante reçoit
 *     P2002 sur l'INSERT du claim → relecture dans une transaction neuve puis rejeu de la
 *     réponse de la gagnante (ou 409 si elle n'est toujours pas terminée) — jamais un 500.
 * Tout rejeu marque la requête (meta.rejouee: true dans l'enveloppe de succès).
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
import { withTenant, type TenantDb, type TenantTxOptions } from "../tenant/db";
import { codePrisma } from "./prisma-errors";
import { marquerRejeuIdempotent } from "./request-context-storage";

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

/**
 * Variante OPTIONNELLE : header absent → undefined (exécution sans protection, comme un appel
 * interne) ; header présent mais invalide → rejet explicite (400), jamais ignoré en silence.
 * Réservée aux routes dont des clients en production n'envoient pas encore la clé (anciennes
 * builds mobiles, Server Actions web) — documentée `IdempotencyKeyOptionnelle` dans openapi.
 */
export function readIdempotencyKeyOptionnelle(req: Request): string | undefined {
  if (!req.headers.has("idempotency-key")) return undefined;
  return readIdempotencyKey(req);
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

const MESSAGE_EN_COURS =
  "Requête identique déjà en cours de traitement. Patientez quelques secondes puis actualisez.";

/**
 * Course perdue sur le claim (P2002 sur la clé primaire idempotency_key) — interne : levée hors
 * de la transaction avortée, rattrapée par withTenantIdempotent (et mappée en 409 par le
 * handler si un appelant utilise withIdempotency directement).
 */
export class IdempotencyCourseError extends IdempotencyConflitError {}

/** Ligne existante : rejeu de la réponse stockée (TERMINE, même payload) ou 409. */
function rejouerOuRefuser<T>(
  ligne: { payloadHash: string; statut: string; reponseJson: unknown },
  payloadHash: string
): T {
  if (ligne.payloadHash !== payloadHash) {
    throw new IdempotencyConflitError(
      "Cette Idempotency-Key a déjà été utilisée pour une requête différente. Générez une nouvelle clé pour cette opération."
    );
  }
  if (ligne.statut === "TERMINE") {
    marquerRejeuIdempotent();
    return ligne.reponseJson as T;
  }
  throw new IdempotencyConflitError(MESSAGE_EN_COURS);
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
  if (existante) return rejouerOuRefuser<T>(existante, payloadHash);

  try {
    await db.idempotencyKey.create({
      data: {
        cle: opts.cle,
        endpoint: opts.endpoint,
        coproprieteId: ctx.coproprieteId,
        utilisateurId: ctx.utilisateurId,
        payloadHash,
      },
    });
  } catch (e) {
    // Course : une requête concurrente a posé la même clé entre notre lecture et notre INSERT.
    // Postgres a fait attendre l'INSERT jusqu'à son commit, puis levé la violation d'unicité
    // (P2002) ; notre transaction est désormais avortée — withTenantIdempotent relit la ligne
    // dans une transaction neuve et rejoue la réponse stockée.
    if (codePrisma(e) === "P2002") throw new IdempotencyCourseError(MESSAGE_EN_COURS);
    throw e;
  }

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
export async function withTenantIdempotent<T>(
  ctx: TenantContext,
  opts: { cle: string | undefined; endpoint: string; payload: unknown },
  cb: (db: Db) => Promise<T>,
  /** Délais de transaction (facultatif, défauts Prisma sinon) — voir withTenant. */
  txOptions?: TenantTxOptions
): Promise<T> {
  try {
    return await withTenant(ctx, (db) => withIdempotency(ctx, db, opts, () => cb(db)), txOptions);
  } catch (e) {
    if (!(e instanceof IdempotencyCourseError) || !opts.cle) throw e;
    return reprendreApresCourse<T>(ctx, { ...opts, cle: opts.cle });
  }
}

/** Attentes successives (ms) avant de relire la clé gagnante d'une course — ~1 s au total. */
const ATTENTES_COURSE_MS = [0, 150, 300, 500];

/**
 * Après une course perdue : relit la ligne de la requête gagnante (transaction neuve). Elle est
 * normalement déjà TERMINE (claim et réponse partagent la transaction du gagnant) → rejeu à
 * l'identique ; sinon on patiente brièvement, puis 409 « déjà en cours » si elle ne l'est pas.
 */
async function reprendreApresCourse<T>(
  ctx: TenantContext,
  opts: { cle: string; endpoint: string; payload: unknown }
): Promise<T> {
  const payloadHash = hashPayload(opts.payload);
  for (const attente of ATTENTES_COURSE_MS) {
    if (attente > 0) await new Promise((r) => setTimeout(r, attente));
    const ligne = await withTenant(ctx, (db) =>
      db.idempotencyKey.findUnique({
        where: { cle_endpoint: { cle: opts.cle, endpoint: opts.endpoint } },
      })
    );
    if (ligne && (ligne.payloadHash !== payloadHash || ligne.statut === "TERMINE")) {
      return rejouerOuRefuser<T>(ligne, payloadHash);
    }
  }
  throw new IdempotencyConflitError(MESSAGE_EN_COURS);
}
