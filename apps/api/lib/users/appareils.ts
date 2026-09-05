/**
 * M19 — Appareils push (Master Spec Partie 13.4). Un jeton FCM est rattaché à UN compte à la
 * fois : enregistrer un jeton déjà connu sous un autre compte le déplace (le téléphone a changé
 * d'utilisateur — l'ancien compte ne doit plus rien recevoir). La preuve de possession est le
 * jeton lui-même (`app.push_token`, policy RLS m19).
 */
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import type { AppareilPushCreateInput } from "./schemas";

function appareilPublic(a: {
  id: string;
  plateforme: string;
  langue: string;
  versionApp: string | null;
  creeLe: Date;
  dernierVuLe: Date;
}) {
  return {
    id: a.id,
    plateforme: a.plateforme,
    langue: a.langue,
    version_app: a.versionApp,
    cree_le: a.creeLe,
    dernier_vu_le: a.dernierVuLe,
  };
}

/** Autorise, pour la transaction courante, la suppression des rattachements de ce jeton. */
export async function presenterJetonPush(db: TenantDb, token: string): Promise<void> {
  await db.$executeRaw`SELECT set_config('app.push_token', ${token}, true)`;
}

/** POST /users/me/appareils — idempotent : même jeton → même ligne (dernier_vu_le rafraîchi). */
export async function enregistrerAppareil(ctx: TenantContext, input: AppareilPushCreateInput) {
  return withTenant(ctx, async (db) => {
    await presenterJetonPush(db, input.token);
    // Le jeton appartenait à un autre compte sur ce téléphone : on retire l'ancien rattachement.
    await db.appareilPush.deleteMany({
      where: { token: input.token, NOT: { utilisateurId: ctx.utilisateurId } },
    });
    const a = await db.appareilPush.upsert({
      where: { token: input.token },
      create: {
        utilisateurId: ctx.utilisateurId,
        token: input.token,
        plateforme: input.plateforme,
        langue: input.langue ?? "FR",
        versionApp: input.version_app ?? null,
      },
      update: {
        plateforme: input.plateforme,
        ...(input.langue ? { langue: input.langue } : {}),
        versionApp: input.version_app ?? null,
        dernierVuLe: new Date(),
      },
    });
    return appareilPublic(a);
  });
}

/** DELETE /users/me/appareils/{token} — déconnexion / désinstallation. */
export async function retirerAppareil(ctx: TenantContext, token: string): Promise<{ supprime: boolean }> {
  return withTenant(ctx, async (db) => {
    const r = await db.appareilPush.deleteMany({ where: { token, utilisateurId: ctx.utilisateurId } });
    return { supprime: r.count > 0 };
  });
}

/** Jetons d'un destinataire (lecture sous la policy m19 : même copropriété ou soi-même). */
export async function tokensPushDe(db: TenantDb, utilisateurId: string): Promise<string[]> {
  const rows = await db.appareilPush.findMany({ where: { utilisateurId }, select: { token: true } });
  return rows.map((r) => r.token);
}

/** Retire les jetons refusés définitivement par FCM (UNREGISTERED / INVALID_ARGUMENT). */
export async function retirerTokensInvalides(db: TenantDb, tokens: string[]): Promise<void> {
  for (const t of tokens) {
    await presenterJetonPush(db, t);
    await db.appareilPush.deleteMany({ where: { token: t } });
  }
}
