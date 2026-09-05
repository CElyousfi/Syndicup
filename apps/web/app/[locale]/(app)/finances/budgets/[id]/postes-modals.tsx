"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../../../components/ui/modal";
import { Field, Input, Select } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Button } from "../../../../../../components/ui/button";
import { ConfirmDelete } from "../../../../../../components/ui/confirm-delete";
import { IDLE, fieldError } from "../../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../../lib/i18n";
import type { BudgetPoste, CategorieDepense } from "../../../../../../lib/api/types";
import { IconPlus } from "../../../../../../components/ui/icons";
import { creerPoste, modifierPoste, supprimerPoste } from "../../depenses/actions";

function Champs({ dict, state, prefix, poste }: { dict: Dict; state: ReturnType<typeof useActionState<typeof IDLE, FormData>>[0]; prefix: string; poste?: BudgetPoste }) {
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  return (
    <>
      <Field label={d.categorie} htmlFor={`${prefix}_cat`} required error={fieldError(state, "categorie")}>
        <Select id={`${prefix}_cat`} name="categorie" required defaultValue={poste?.categorie ?? "ENTRETIEN_COURANT"}>
          {(Object.keys(e.categorieDepense) as CategorieDepense[]).map((c) => (
            <option key={c} value={c}>{e.categorieDepense[c]}</option>
          ))}
        </Select>
      </Field>
      <Field label={d.poste_libelle} htmlFor={`${prefix}_lib`} required error={fieldError(state, "libelle")}>
        <Input id={`${prefix}_lib`} name="libelle" required maxLength={120} defaultValue={poste?.libelle ?? ""} />
      </Field>
      <Field label={`${d.montantPrevu} (${dict.common.mad})`} htmlFor={`${prefix}_mt`} required error={fieldError(state, "montant_prevu")}>
        <Input id={`${prefix}_mt`} name="montant_prevu" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" required defaultValue={poste?.montantPrevu ?? ""} className="tnum text-start" />
      </Field>
    </>
  );
}

function Pied({ dict, onCancel, label }: { dict: Dict; onCancel: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button>
      <SubmitButton>{label}</SubmitButton>
    </div>
  );
}

function Succes({ dict, onClose }: { dict: Dict; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-strong">{dict.common.updated}</p>
      <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>{dict.common.close}</Button></div>
    </div>
  );
}

export function AjouterPosteModal({ dict, locale, budgetId, actif }: { dict: Dict; locale: Locale; budgetId: string; actif: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(creerPoste, IDLE);
  const d = dict.depenses;
  return (
    <>
      <Button onClick={() => setOpen(true)}><IconPlus width={16} height={16} />{d.ajouterPoste}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={d.ajouterPoste} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="budget_id" value={budgetId} />
            <Champs dict={dict} state={state} prefix="np" />
            {actif ? <p className="text-[13px] text-soft">{d.posteModifieApresActivation}</p> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={dict.common.add} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function ModifierPosteModal({ dict, locale, budgetId, poste, actif }: { dict: Dict; locale: Locale; budgetId: string; poste: BudgetPoste; actif: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(modifierPoste, IDLE);
  const d = dict.depenses;
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>{dict.common.modify}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={d.modifierPoste} subtitle={poste.libelle} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="budget_id" value={budgetId} />
            <input type="hidden" name="poste_id" value={poste.id} />
            <Champs dict={dict} state={state} prefix={`mp_${poste.id}`} poste={poste} />
            {actif ? <p className="text-[13px] text-soft">{d.posteModifieApresActivation}</p> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={dict.common.save} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function SupprimerPosteBouton({ dict, locale, budgetId, poste }: { dict: Dict; locale: Locale; budgetId: string; poste: BudgetPoste }) {
  return <ConfirmDelete dict={dict} locale={locale} action={supprimerPoste} champs={{ budget_id: budgetId, poste_id: poste.id }} nom={poste.libelle} titre={dict.depenses.supprimerPoste} />;
}
