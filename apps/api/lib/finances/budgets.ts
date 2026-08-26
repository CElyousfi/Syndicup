/**
 * M12 — CRUD budgets AG (Master Spec Partie 2.2, Doc A §3.2).
 *
 * Le budget est le prérequis de la génération d'appels de fonds (Partie 6.2 étape 1 : un
 * budget ACTIF doit couvrir l'exercice). Cycle : PROPOSE → (VOTE) → ACTIF → REMPLACE.
 *   - PROPOSE : modifiable par le syndic ;
 *   - ACTIF : figé — un seul par (copropriété, exercice), index partiel
 *     budget_ag_actif_unique_par_exercice ;
 *   - REMPLACE : ancien ACTIF supplanté par un budget rectificatif (Doc A §3.2
 *     "Dépassement budget en cours d'année") — activé dans la même transaction.
 * Le lien ag_id trace la résolution AG qui a voté le budget (nullable tant que l'AG n'est
 * pas encore gérée dans la plateforme pour cet exercice).
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import { withTenantIdempotent } from "../http/idempotency";
import type { TenantContext } from "../tenant/context";
import { money } from "../money";
import { ecrireAuditLog } from "../audit/audit";
import type { BudgetAgCreateInput, BudgetAgUpdateInput } from "./schemas";
import {
  PermissionRefuseeError,
  RessourceIntrouvableError,
  ContrainteMetierError,
} from "./finances";

export async function listerBudgets(ctx: TenantContext, page: number, limit: number) {
  if (can("finances.lire_budget", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter les budgets.");
  }
  return withTenant(ctx, async (db) => {
    const [total, rows] = await Promise.all([
      db.budgetAg.count({ where: { coproprieteId: ctx.coproprieteId } }),
      db.budgetAg.findMany({
        where: { coproprieteId: ctx.coproprieteId },
        orderBy: [{ exercice: "desc" }, { creeLe: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, rows };
  });
}

export async function obtenirBudget(ctx: TenantContext, budgetId: string) {
  if (can("finances.lire_budget", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter les budgets.");
  }
  const budget = await withTenant(ctx, (db) =>
    db.budgetAg.findUnique({ where: { id: budgetId } })
  );
  if (!budget || budget.coproprieteId !== ctx.coproprieteId) {
    throw new RessourceIntrouvableError("Budget introuvable.");
  }
  return budget;
}

export async function creerBudget(ctx: TenantContext, input: BudgetAgCreateInput) {
  if (can("finances.gerer_budget", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut créer un budget (Doc A §3.2).");
  }
  return withTenant(ctx, async (db) => {
    if (input.ag_id) {
      const ag = await db.assembleeGenerale.findUnique({ where: { id: input.ag_id } });
      if (!ag) throw new RessourceIntrouvableError("AG référencée introuvable.");
    }
    const budget = await db.budgetAg.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        exercice: input.exercice,
        montantTotal: money(input.montant_total).toString(),
        agId: input.ag_id ?? null,
        statut: "PROPOSE",
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "BUDGET_CREE",
      entite: "budget_ag",
      entiteId: budget.id,
      apres: { exercice: budget.exercice, montant_total: budget.montantTotal.toString() },
    });
    return budget;
  });
}

export async function modifierBudget(
  ctx: TenantContext,
  budgetId: string,
  input: BudgetAgUpdateInput
) {
  if (can("finances.gerer_budget", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut modifier un budget.");
  }
  return withTenant(ctx, async (db) => {
    const budget = await db.budgetAg.findUnique({ where: { id: budgetId } });
    if (!budget) throw new RessourceIntrouvableError("Budget introuvable.");
    if (budget.statut !== "PROPOSE") {
      throw new ContrainteMetierError(
        "Seul un budget PROPOSE est modifiable — un budget voté ou actif est figé (créer un budget rectificatif)."
      );
    }
    if (input.ag_id) {
      const ag = await db.assembleeGenerale.findUnique({ where: { id: input.ag_id } });
      if (!ag) throw new RessourceIntrouvableError("AG référencée introuvable.");
    }
    const maj = await db.budgetAg.update({
      where: { id: budgetId },
      data: {
        ...(input.montant_total !== undefined
          ? { montantTotal: money(input.montant_total).toString() }
          : {}),
        ...(input.ag_id !== undefined ? { agId: input.ag_id } : {}),
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "BUDGET_MODIFIE",
      entite: "budget_ag",
      entiteId: budgetId,
      avant: { montant_total: budget.montantTotal.toString() },
      apres: { montant_total: maj.montantTotal.toString() },
    });
    return maj;
  });
}

/**
 * Active un budget. Si un ACTIF existe déjà pour (copropriété, exercice), il passe REMPLACE
 * dans la même transaction (budget rectificatif — Doc A §3.2) : l'index partiel
 * budget_ag_actif_unique_par_exercice garantit qu'on ne peut jamais avoir deux ACTIF.
 */
export async function activerBudget(ctx: TenantContext, budgetId: string, idempotencyKey?: string) {
  if (can("finances.gerer_budget", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut activer un budget.");
  }
  return withTenantIdempotent(
    ctx,
    { cle: idempotencyKey, endpoint: "POST /finances/budgets/:id/activer", payload: { budgetId } },
    async (db) => {
      const budget = await db.budgetAg.findUnique({ where: { id: budgetId } });
      if (!budget) throw new RessourceIntrouvableError("Budget introuvable.");
      if (budget.statut === "ACTIF") return budget; // déjà actif — no-op
      if (budget.statut === "REMPLACE") {
        throw new ContrainteMetierError("Un budget REMPLACE ne peut pas être réactivé.");
      }

      const actifExistant = await db.budgetAg.findFirst({
        where: {
          coproprieteId: ctx.coproprieteId,
          exercice: budget.exercice,
          statut: "ACTIF",
          id: { not: budgetId },
        },
      });
      if (actifExistant) {
        await db.budgetAg.update({ where: { id: actifExistant.id }, data: { statut: "REMPLACE" } });
        await ecrireAuditLog(db, {
          coproprieteId: ctx.coproprieteId,
          acteurId: ctx.utilisateurId,
          action: "BUDGET_REMPLACE",
          entite: "budget_ag",
          entiteId: actifExistant.id,
          avant: { statut: "ACTIF" },
          apres: { statut: "REMPLACE", remplace_par: budgetId },
        });
      }

      const actif = await db.budgetAg.update({ where: { id: budgetId }, data: { statut: "ACTIF" } });
      await ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "BUDGET_ACTIVE",
        entite: "budget_ag",
        entiteId: budgetId,
        avant: { statut: budget.statut },
        apres: { statut: "ACTIF" },
      });
      return actif;
    }
  );
}
