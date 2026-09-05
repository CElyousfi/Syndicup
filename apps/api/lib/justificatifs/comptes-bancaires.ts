/**
 * Comptes bancaires de la copropriété — M17. Stockés dans `copropriete.comptes_bancaires_json`
 * (`[{ libelle, banque, rib }]`). Tout membre lit banque + RIB masqué (écran « Payer par virement » :
 * le résident choisit le compte bénéficiaire) ; le syndic gère la liste et lit le RIB complet
 * (chaque lecture est auditée RIB_CONSULTE). Le RIB complet n'est JAMAIS dans une réponse de liste.
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { compteBancaireSchema, type ComptesBancairesUpdateInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}

type Compte = z.infer<typeof compteBancaireSchema>;

export function masquerRibCopro(rib: string): string {
  return `•••• ${rib.slice(-4)}`;
}

export async function lireComptes(db: TenantDb, coproprieteId: string): Promise<Compte[]> {
  const copro = await db.copropriete.findUnique({ where: { id: coproprieteId }, select: { comptesBancairesJson: true } });
  if (!copro) throw new IntrouvableError("Copropriété introuvable.");
  const parsed = z.array(compteBancaireSchema).safeParse(copro.comptesBancairesJson ?? []);
  return parsed.success ? parsed.data : [];
}

export function presenterComptes(comptes: Compte[]) {
  return comptes.map((c, index) => ({ index, libelle: c.libelle, banque: c.banque, rib_masque: masquerRibCopro(c.rib) }));
}

export async function listerComptesBancaires(ctx: TenantContext, coproprieteId: string) {
  if (can("coproprietes.comptes_bancaires.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  if (coproprieteId !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") throw new IntrouvableError("Copropriété introuvable.");
  return withTenant(ctx, async (db) => presenterComptes(await lireComptes(db, coproprieteId)));
}

export async function remplacerComptesBancaires(ctx: TenantContext, coproprieteId: string, input: ComptesBancairesUpdateInput) {
  if (can("coproprietes.comptes_bancaires.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic gère les comptes bancaires de la copropriété.");
  if (coproprieteId !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") throw new IntrouvableError("Copropriété introuvable.");
  return withTenant(ctx, async (db) => {
    const avant = await lireComptes(db, coproprieteId);
    await db.copropriete.update({ where: { id: coproprieteId }, data: { comptesBancairesJson: input.comptes as Prisma.InputJsonValue } });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "COMPTES_BANCAIRES_MODIFIES",
      entite: "copropriete",
      entiteId: coproprieteId,
      // Jamais un RIB complet dans l'audit.
      avant: presenterComptes(avant) as Prisma.InputJsonValue,
      apres: presenterComptes(input.comptes) as Prisma.InputJsonValue,
    });
    return presenterComptes(input.comptes);
  });
}

export async function lireRibCompte(ctx: TenantContext, coproprieteId: string, index: number) {
  if (can("coproprietes.comptes_bancaires.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic consulte le RIB complet.");
  if (coproprieteId !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") throw new IntrouvableError("Copropriété introuvable.");
  return withTenant(ctx, async (db) => {
    const comptes = await lireComptes(db, coproprieteId);
    const compte = comptes[index];
    if (!compte) throw new IntrouvableError("Compte bancaire introuvable.");
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "RIB_CONSULTE", entite: "copropriete", entiteId: coproprieteId, apres: { index, libelle: compte.libelle } });
    return { index, libelle: compte.libelle, banque: compte.banque, rib: compte.rib };
  });
}
