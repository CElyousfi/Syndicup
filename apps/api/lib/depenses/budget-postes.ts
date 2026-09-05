/**
 * Postes budgétaires — M16 (Doc A §10.2 « détail budget par poste visible dans l'app », §3.7
 * dépassement par poste). Invariant budget_ag.montant_total = Σ montant_prevu : tenu par le trigger
 * `budget_poste_recalculer_total` (migration m16), vérifié ici après chaque écriture et testé.
 * Budget ACTIF : lignes modifiables par le syndic seulement, avec audit
 * BUDGET_POSTE_MODIFIE_APRES_ACTIVATION (le rapport M18 montre la révision).
 */
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { money, toApiString } from "../money";
import type { ErrorCode } from "../http/respond";
import type { BudgetPosteCreateInput, BudgetPosteUpdateInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class BudgetPosteError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

async function chargerBudget(db: TenantDb, ctx: TenantContext, budgetId: string) {
  const budget = await db.budgetAg.findUnique({ where: { id: budgetId } });
  if (!budget || budget.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Budget introuvable.");
  return budget;
}

/** Vérifie l'invariant après écriture (le trigger l'a maintenu — sinon on le dit, jamais silencieusement). */
export async function assertInvariantTotal(db: TenantDb, budgetId: string) {
  const [budget, agg] = await Promise.all([
    db.budgetAg.findUniqueOrThrow({ where: { id: budgetId }, select: { montantTotal: true } }),
    db.budgetPoste.aggregate({ where: { budgetAgId: budgetId }, _sum: { montantPrevu: true } }),
  ]);
  const somme = money(agg._sum.montantPrevu ?? 0);
  if (!money(budget.montantTotal).equals(somme)) {
    throw new Error(`Invariant budget violé : montant_total=${toApiString(budget.montantTotal)} ≠ Σ postes=${toApiString(somme)}.`);
  }
  return budget.montantTotal;
}

export async function listerPostes(ctx: TenantContext, budgetId: string) {
  if (can("finances.lire_budget", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter les postes du budget.");
  return withTenant(ctx, async (db) => {
    const budget = await chargerBudget(db, ctx, budgetId);
    const postes = await db.budgetPoste.findMany({ where: { budgetAgId: budgetId }, orderBy: [{ ordre: "asc" }, { creeLe: "asc" }] });
    return { budget, postes };
  });
}

function assertBudgetModifiable(budget: { statut: string }) {
  if (budget.statut === "REMPLACE") {
    throw new BudgetPosteError("DEPENSE_STATUT_INVALIDE", "Un budget REMPLACE est figé : ses postes ne se modifient plus.");
  }
}

async function auditPoste(db: TenantDb, ctx: TenantContext, budget: { id: string; statut: string }, action: string, posteId: string, avant: unknown, apres: unknown) {
  await ecrireAuditLog(db, {
    coproprieteId: ctx.coproprieteId,
    acteurId: ctx.utilisateurId,
    action,
    entite: "budget_poste",
    entiteId: posteId,
    avant: avant as Prisma.InputJsonValue,
    apres: apres as Prisma.InputJsonValue,
  });
  // Ligne d'un budget déjà ACTIF touchée : révision tracée séparément (rapport de gestion M18).
  if (budget.statut === "ACTIF") {
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "BUDGET_POSTE_MODIFIE_APRES_ACTIVATION",
      entite: "budget_ag",
      entiteId: budget.id,
      apres: { poste_id: posteId, operation: action } as Prisma.InputJsonValue,
    });
  }
}

export async function creerPoste(ctx: TenantContext, budgetId: string, input: BudgetPosteCreateInput) {
  if (can("finances.gerer_budget", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic gère les postes du budget.");
  return withTenant(ctx, async (db) => {
    const budget = await chargerBudget(db, ctx, budgetId);
    assertBudgetModifiable(budget);
    let poste;
    try {
      poste = await db.budgetPoste.create({
        data: {
          budgetAgId: budgetId,
          categorie: input.categorie,
          libelle: input.libelle,
          montantPrevu: money(input.montant_prevu).toString(),
          ordre: input.ordre ?? (await db.budgetPoste.count({ where: { budgetAgId: budgetId } })) + 1,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new BudgetPosteError("CONFLICT", "Un poste avec cette catégorie et ce libellé existe déjà dans ce budget.");
      }
      throw e;
    }
    await auditPoste(db, ctx, budget, "BUDGET_POSTE_CREE", poste.id, undefined, { categorie: poste.categorie, libelle: poste.libelle, montant_prevu: toApiString(poste.montantPrevu) });
    const montantTotal = await assertInvariantTotal(db, budgetId);
    return { poste, montant_total: toApiString(montantTotal) };
  });
}

export async function modifierPoste(ctx: TenantContext, budgetId: string, posteId: string, input: BudgetPosteUpdateInput) {
  if (can("finances.gerer_budget", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic gère les postes du budget.");
  return withTenant(ctx, async (db) => {
    const budget = await chargerBudget(db, ctx, budgetId);
    assertBudgetModifiable(budget);
    const avant = await db.budgetPoste.findUnique({ where: { id: posteId } });
    if (!avant || avant.budgetAgId !== budgetId) throw new IntrouvableError("Poste introuvable.");
    let poste;
    try {
      poste = await db.budgetPoste.update({
        where: { id: posteId },
        data: {
          ...(input.categorie !== undefined ? { categorie: input.categorie } : {}),
          ...(input.libelle !== undefined ? { libelle: input.libelle } : {}),
          ...(input.montant_prevu !== undefined ? { montantPrevu: money(input.montant_prevu).toString() } : {}),
          ...(input.ordre !== undefined ? { ordre: input.ordre } : {}),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new BudgetPosteError("CONFLICT", "Un poste avec cette catégorie et ce libellé existe déjà dans ce budget.");
      }
      throw e;
    }
    await auditPoste(
      db, ctx, budget, "BUDGET_POSTE_MODIFIE", posteId,
      { categorie: avant.categorie, libelle: avant.libelle, montant_prevu: toApiString(avant.montantPrevu) },
      { categorie: poste.categorie, libelle: poste.libelle, montant_prevu: toApiString(poste.montantPrevu) }
    );
    const montantTotal = await assertInvariantTotal(db, budgetId);
    return { poste, montant_total: toApiString(montantTotal) };
  });
}

export async function supprimerPoste(ctx: TenantContext, budgetId: string, posteId: string) {
  if (can("finances.gerer_budget", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic gère les postes du budget.");
  return withTenant(ctx, async (db) => {
    const budget = await chargerBudget(db, ctx, budgetId);
    assertBudgetModifiable(budget);
    const poste = await db.budgetPoste.findUnique({ where: { id: posteId } });
    if (!poste || poste.budgetAgId !== budgetId) throw new IntrouvableError("Poste introuvable.");
    const utilise = await db.depense.count({ where: { budgetPosteId: posteId } });
    if (utilise > 0) {
      throw new BudgetPosteError("BUDGET_POSTE_UTILISE", `${utilise} dépense(s) référencent ce poste : rattachez-les à un autre poste avant de le supprimer.`);
    }
    const nb = await db.budgetPoste.count({ where: { budgetAgId: budgetId } });
    if (nb <= 1) {
      throw new BudgetPosteError("UNPROCESSABLE_ENTITY", "Un budget conserve au moins une ligne : modifiez-la plutôt que de la supprimer.");
    }
    await db.budgetPoste.delete({ where: { id: posteId } });
    await auditPoste(db, ctx, budget, "BUDGET_POSTE_SUPPRIME", posteId, { categorie: poste.categorie, libelle: poste.libelle, montant_prevu: toApiString(poste.montantPrevu) }, undefined);
    const montantTotal = await assertInvariantTotal(db, budgetId);
    return { id: posteId, montant_total: toApiString(montantTotal) };
  });
}
