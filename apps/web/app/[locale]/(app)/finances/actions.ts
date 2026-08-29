"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type {
  AppelDeFonds,
  BudgetAg,
  Contestation,
  PaiementCibleResult,
  PaiementFifoResult,
} from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

export async function creerBudget(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const res = await apiFetch<BudgetAg>("/finances/budgets", {
    method: "POST",
    body: {
      exercice: champ(fd, "exercice"),
      montant_total: champ(fd, "montant_total"),
      ag_id: agId === "" ? null : agId,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/finances/budgets`);
  return success();
}

export async function modifierBudget(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const res = await apiFetch<BudgetAg>(`/finances/budgets/${champ(fd, "budget_id")}`, {
    method: "PATCH",
    body: {
      montant_total: champ(fd, "montant_total"),
      ...(agId !== "" ? { ag_id: agId } : {}),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/finances/budgets`);
  return success();
}

/** Activation de budget — irréversible pour l'ancien budget ACTIF (→ REMPLACE). */
export async function activerBudget(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<BudgetAg>(`/finances/budgets/${champ(fd, "budget_id")}/activer`, {
    method: "POST",
    idempotent: true,
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/finances/budgets`);
  return success();
}

export async function genererAppelDeFonds(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<AppelDeFonds>("/finances/appels-de-fonds", {
    method: "POST",
    idempotent: true,
    body: {
      periode: champ(fd, "periode"),
      type: champ(fd, "type"),
      montant_total: champ(fd, "montant_total"),
      date_echeance: champ(fd, "date_echeance"),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/finances/appels-de-fonds`);
  return success(undefined, { id: res.data.id });
}

/**
 * D4 — deux modes exclusifs. Réponses de shapes différentes :
 * ciblé → { paiement, statut, quittance } · FIFO → { lot_id, montant, affectations, quittance }.
 */
export async function enregistrerPaiement(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const mode = champ(fd, "mode");
  const payeur = champ(fd, "payeur_utilisateur_id");
  const commun = {
    montant: champ(fd, "montant"),
    methode: champ(fd, "methode"),
    ...(payeur ? { payeur_utilisateur_id: payeur } : {}),
  };
  const body =
    mode === "fifo"
      ? { lot_id: champ(fd, "lot_id"), ...commun }
      : {
          appel_de_fonds_lot_id: champ(fd, "appel_de_fonds_lot_id"),
          accepter_trop_percu: fd.get("accepter_trop_percu") === "on",
          ...commun,
        };

  const res = await apiFetch<PaiementCibleResult | PaiementFifoResult>("/finances/paiements", {
    method: "POST",
    idempotent: true,
    body,
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/finances/appels-de-fonds`);
  revalidatePath(`/${locale}/lots`);

  if (mode === "fifo") {
    const d = res.data as PaiementFifoResult;
    return success(undefined, {
      mode: "fifo",
      affectations: d.affectations,
      quittanceId: d.quittance?.id ?? null,
    });
  }
  const d = res.data as PaiementCibleResult;
  return success(undefined, {
    mode: "cible",
    statut: d.statut,
    quittanceId: d.quittance?.id ?? null,
  });
}

/** Contestation d'une ligne — résidents uniquement (l'API refuse le syndic). */
export async function contesterLigne(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Contestation>("/finances/contestations", {
    method: "POST",
    body: {
      appel_de_fonds_lot_id: champ(fd, "appel_de_fonds_lot_id"),
      motif: champ(fd, "motif"),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/lots`);
  return success();
}

export async function repondreContestation(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Contestation>(
    `/finances/contestations/${champ(fd, "contestation_id")}/reponse`,
    {
      method: "POST",
      body: {
        statut: champ(fd, "statut"),
        reponse_syndic: champ(fd, "reponse_syndic"),
      },
    }
  );
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/finances/contestations`);
  return success();
}
