"use client";

import { ActionModal } from "../../../../../../components/ui/action-modal";
import { Field, Input, Select } from "../../../../../../components/ui/field";
import { MoneyInput } from "../../../../../../components/ui/money-input";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Button } from "../../../../../../components/ui/button";
import { ConfirmDelete } from "../../../../../../components/ui/confirm-delete";
import { fieldError, type FormState } from "../../../../../../lib/forms";
import { formKey, formValue } from "../../../../../../lib/form-values";
import type { Dict, Locale } from "../../../../../../lib/i18n";
import type { BudgetPoste, CategorieDepense } from "../../../../../../lib/api/types";
import { IconPlus } from "../../../../../../components/ui/icons";
import { creerPoste, modifierPoste, supprimerPoste } from "../../depenses/actions";

function Champs({ dict, state, prefix, poste }: { dict: Dict; state: FormState; prefix: string; poste?: BudgetPoste }) {
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  return (
    <>
      <Field label={d.categorie} htmlFor={`${prefix}_cat`} required error={fieldError(state, "categorie")}>
        <Select key={formKey(state, "categorie")} id={`${prefix}_cat`} name="categorie" required defaultValue={formValue(state, "categorie", poste?.categorie ?? "ENTRETIEN_COURANT")}>
          {(Object.keys(e.categorieDepense) as CategorieDepense[]).map((c) => (
            <option key={c} value={c}>{e.categorieDepense[c]}</option>
          ))}
        </Select>
      </Field>
      <Field label={d.poste_libelle} htmlFor={`${prefix}_lib`} required error={fieldError(state, "libelle")}>
        <Input id={`${prefix}_lib`} name="libelle" required maxLength={120} defaultValue={formValue(state, "libelle", poste?.libelle ?? "")} />
      </Field>
      <Field label={`${d.montantPrevu} (${dict.common.mad})`} htmlFor={`${prefix}_mt`} required error={fieldError(state, "montant_prevu")}>
        <MoneyInput id={`${prefix}_mt`} name="montant_prevu" required invalidMessage={dict.formulaires.montantInvalide} ambiguousMessage={dict.formulaires.montantAmbigu} orLabel={dict.formulaires.ou} defaultValue={formValue(state, "montant_prevu", poste?.montantPrevu ?? "")} />
      </Field>
    </>
  );
}

function Pied({ dict, onCancel, label }: { dict: Dict; onCancel: () => void; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onCancel}>{dict.common.close}</Button>
      <SubmitButton>{label}</SubmitButton>
    </div>
  );
}

export function AjouterPosteModal({ dict, locale, budgetId, actif }: { dict: Dict; locale: Locale; budgetId: string; actif: boolean }) {
  const d = dict.depenses;
  return (
    <ActionModal
      action={creerPoste}
      title={d.ajouterPoste}
      closeLabel={dict.common.close}
      success={{ message: dict.formulaires.succes.posteAjoute }}
      trigger={(open) => <Button onClick={open}><IconPlus width={16} height={16} />{d.ajouterPoste}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="budget_id" value={budgetId} />
          <Champs dict={dict} state={state} prefix="np" />
          {actif ? <p className="text-[13px] text-soft">{d.posteModifieApresActivation}</p> : null}
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={d.ajouterPoste} />
        </form>
      )}
    </ActionModal>
  );
}

export function ModifierPosteModal({ dict, locale, budgetId, poste, actif }: { dict: Dict; locale: Locale; budgetId: string; poste: BudgetPoste; actif: boolean }) {
  const d = dict.depenses;
  return (
    <ActionModal
      action={modifierPoste}
      title={d.modifierPoste}
      subtitle={poste.libelle}
      closeLabel={dict.common.close}
      success={{ message: dict.formulaires.succes.posteModifie, closeAndToast: true }}
      trigger={(open) => <Button variant="ghost" size="sm" onClick={open}>{dict.common.modify}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="budget_id" value={budgetId} />
          <input type="hidden" name="poste_id" value={poste.id} />
          <Champs dict={dict} state={state} prefix={`mp_${poste.id}`} poste={poste} />
          {actif ? <p className="text-[13px] text-soft">{d.posteModifieApresActivation}</p> : null}
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={dict.common.save} />
        </form>
      )}
    </ActionModal>
  );
}

export function SupprimerPosteBouton({ dict, locale, budgetId, poste }: { dict: Dict; locale: Locale; budgetId: string; poste: BudgetPoste }) {
  return <ConfirmDelete dict={dict} locale={locale} action={supprimerPoste} champs={{ budget_id: budgetId, poste_id: poste.id }} nom={poste.libelle} titre={dict.depenses.supprimerPoste} label={dict.depenses.supprimerPoste} succes={dict.formulaires.succes.posteSupprime} />;
}
