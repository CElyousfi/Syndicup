"use client";

import { ActionModal } from "../../../../../components/ui/action-modal";
import { IrreversibleNotice } from "../../../../../components/ui/irreversible-notice";
import { Field, Input, Select } from "../../../../../components/ui/field";
import { MoneyInput } from "../../../../../components/ui/money-input";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import { fieldError } from "../../../../../lib/forms";
import { formKey, formValue } from "../../../../../lib/form-values";
import { fill, type Dict, type Locale } from "../../../../../lib/i18n";
import type { BudgetAg } from "../../../../../lib/api/types";
import { creerBudget, modifierBudget, activerBudget } from "../actions";
import { IconPlus } from "../../../../../components/ui/icons";

interface AgOption {
  id: string;
  libelle: string;
}

export function CreerBudgetModal({
  dict,
  locale,
  ags,
  exerciceSuggere,
  ouvertInitialement = false,
}: {
  dict: Dict;
  locale: Locale;
  ags: AgOption[];
  exerciceSuggere: string;
  ouvertInitialement?: boolean;
}) {
  const f = dict.finances;
  return (
    <ActionModal
      action={creerBudget}
      title={f.creerBudget}
      closeLabel={dict.common.close}
      defaultOpen={ouvertInitialement}
      success={{ message: dict.formulaires.succes.budgetCree }}
      trigger={(open) => (
        <Button onClick={open}>
          <IconPlus width={16} height={16} />
          {f.creerBudget}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.exercice} htmlFor="exercice" required error={fieldError(state, "exercice")}>
              <Input
                id="exercice"
                name="exercice"
                dir="ltr"
                inputMode="numeric"
                pattern="\d{4}"
                defaultValue={formValue(state, "exercice", exerciceSuggere)}
                required
                className="tnum text-start"
              />
            </Field>
            <Field
              label={`${f.montantVote} (${dict.common.mad})`}
              htmlFor="montant_total"
              hint={f.montantAide}
              required
              error={fieldError(state, "montant_total")}
            >
              <MoneyInput id="montant_total" name="montant_total" required invalidMessage={dict.formulaires.montantInvalide} ambiguousMessage={dict.formulaires.montantAmbigu} orLabel={dict.formulaires.ou} defaultValue={formValue(state, "montant_total")} />
            </Field>
          </div>
          <Field label={f.agLiee} htmlFor="ag_id" optionalLabel={dict.common.optional} error={fieldError(state, "ag_id")}>
            <Select key={formKey(state, "ag_id")} id="ag_id" name="ag_id" defaultValue={formValue(state, "ag_id")}>
              <option value="">{dict.common.none}</option>
              {ags.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                </option>
              ))}
            </Select>
          </Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={dict.common.create} />
        </form>
      )}
    </ActionModal>
  );
}

export function ModifierBudgetModal({
  dict,
  locale,
  budget,
  ags,
}: {
  dict: Dict;
  locale: Locale;
  budget: BudgetAg;
  ags: AgOption[];
}) {
  const f = dict.finances;
  return (
    <ActionModal
      action={modifierBudget}
      title={f.modifierBudget}
      subtitle={budget.exercice}
      closeLabel={dict.common.close}
      success={{ message: dict.formulaires.succes.budgetModifie, closeAndToast: true }}
      trigger={(open) => (
        <Button variant="ghost" size="sm" onClick={open}>
          {dict.common.modify}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="budget_id" value={budget.id} />
          <Field label={`${f.montantVote} (${dict.common.mad})`} htmlFor="m_montant_total" required error={fieldError(state, "montant_total")}>
            <MoneyInput id="m_montant_total" name="montant_total" required invalidMessage={dict.formulaires.montantInvalide} ambiguousMessage={dict.formulaires.montantAmbigu} orLabel={dict.formulaires.ou} defaultValue={formValue(state, "montant_total", budget.montantTotal)} />
          </Field>
          <Field label={f.agLiee} htmlFor="m_ag_id" optionalLabel={dict.common.optional} error={fieldError(state, "ag_id")}>
            <Select key={formKey(state, "ag_id")} id="m_ag_id" name="ag_id" defaultValue={formValue(state, "ag_id", budget.agId ?? "")}>
              <option value="">{dict.common.none}</option>
              {ags.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                </option>
              ))}
            </Select>
          </Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={dict.common.save} />
        </form>
      )}
    </ActionModal>
  );
}

/** Activation — confirmation : un budget ACTIF du même exercice passera REMPLACE (irréversible). */
export function ActiverBudgetModal({
  dict,
  locale,
  budget,
}: {
  dict: Dict;
  locale: Locale;
  budget: BudgetAg;
}) {
  const f = dict.finances;
  return (
    <ActionModal
      action={activerBudget}
      title={fill(f.activerBudgetTitre, { exercice: budget.exercice })}
      closeLabel={dict.common.close}
      success={{ message: dict.formulaires.succes.budgetActive, closeAndToast: true }}
      trigger={(open) => (
        <Button variant="secondary" size="sm" onClick={open}>
          {f.activerBudget}
        </Button>
      )}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="budget_id" value={budget.id} />
          <IrreversibleNotice>{fill(f.activerBudgetCorps, { exercice: budget.exercice })}</IrreversibleNotice>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={fill(f.activerBudgetTitre, { exercice: budget.exercice })} danger />
        </form>
      )}
    </ActionModal>
  );
}

function Pied({
  dict,
  onCancel,
  label,
  danger = false,
}: {
  dict: Dict;
  onCancel: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onCancel}>
        {dict.common.close}
      </Button>
      <SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton>
    </div>
  );
}
