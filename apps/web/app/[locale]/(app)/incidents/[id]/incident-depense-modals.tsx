"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../../components/ui/modal";
import { Field, Input, Select, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import { IconButton } from "../../../../../components/ui/pressable";
import { IDLE, fieldError } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { BudgetPoste } from "../../../../../lib/api/types";
import { IconPlus } from "../../../../../components/ui/icons";
import { creerDepenseDepuisIncident, evaluerPrestataire } from "../../finances/depenses/actions";
import { ActionModal } from "../../../../../components/ui/action-modal";
import { formKey, formValue } from "../../../../../lib/form-values";
import { MoneyInput } from "../../../../../components/ui/money-input";

export function CreerDepenseIncidentModal({ dict, locale, incidentId, postes }: { dict: Dict; locale: Locale; incidentId: string; postes: BudgetPoste[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(creerDepenseDepuisIncident, IDLE);
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {d.depuisIncident}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={d.depuisIncident} subtitle={d.depuisIncidentAide} closeLabel={dict.common.close}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="incident_id" value={incidentId} />
          <Field label={d.libelle} htmlFor="di_libelle" optionalLabel={dict.common.optional}>
            <Input id="di_libelle" name="libelle" maxLength={200} defaultValue={formValue(state, "libelle")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`${d.montantHt} (${dict.common.mad})`} htmlFor="di_ht" optionalLabel={dict.common.optional} error={fieldError(state, "montant_ht")}>
              <MoneyInput id="di_ht" name="montant_ht" invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(state, "montant_ht")} />
            </Field>
            <Field label={`${d.tva} (${dict.common.mad})`} htmlFor="di_tva" optionalLabel={dict.common.optional} error={fieldError(state, "tva")}>
              <MoneyInput id="di_tva" name="tva" invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(state, "tva")} />
            </Field>
            <Field label={`${d.montantTtc} (${dict.common.mad})`} htmlFor="di_ttc" required error={fieldError(state, "montant_ttc")}>
              <MoneyInput id="di_ttc" name="montant_ttc" required invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(state, "montant_ttc")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={d.poste} htmlFor="di_poste" optionalLabel={dict.common.optional} error={fieldError(state, "budget_poste_id")}>
              <Select key={formKey(state, "budget_poste_id")} id="di_poste" name="budget_poste_id" defaultValue={formValue(state, "budget_poste_id", "")}>
                <option value="">{d.horsPoste}</option>
                {postes.map((p) => (
                  <option key={p.id} value={p.id}>{p.libelle} · {e.categorieDepense[p.categorie]}</option>
                ))}
              </Select>
            </Field>
            <Field label={d.source} htmlFor="di_source" required>
              <Select key={formKey(state, "source")} id="di_source" name="source" defaultValue={formValue(state, "source", "COMPTE_COURANT")}>
                {(Object.keys(e.sourceFinancement) as Array<keyof typeof e.sourceFinancement>).map((s) => (
                  <option key={s} value={s}>{e.sourceFinancement[s]}</option>
                ))}
              </Select>
            </Field>
          </div>
          <FormAlert state={state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
            <SubmitButton>{dict.common.create}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function EvaluerPrestataireModal({ dict, locale, incidentId, prestataireNom }: { dict: Dict; locale: Locale; incidentId: string; prestataireNom: string }) {
  const [note, setNote] = useState(0);
  const d = dict.depenses;
  return (
    <ActionModal
        action={evaluerPrestataire}
        title={d.evaluerTitre}
        subtitle={prestataireNom}
        closeLabel={dict.common.close}
        success={{ message: d.evalue }}
        trigger={(open) => <Button variant="secondary" size="sm" onClick={open}>{d.evaluer}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="incident_id" value={incidentId} />
            <input type="hidden" name="note" value={note} />
            <p className="text-sm text-body">{d.evaluerCorps}</p>
            <Field label={d.note} htmlFor="note_etoiles" required error={fieldError(state, "note")}>
              <div id="note_etoiles" role="radiogroup" aria-label={d.note} className="flex gap-1" dir="ltr">
                {[1, 2, 3, 4, 5].map((n) => (
                  <IconButton
                    key={n}
                    tone="none"
                    role="radio"
                    aria-checked={note === n}
                    label={`${n}/5`}
                    onClick={() => setNote(n)}
                    className={`size-11 text-[24px] leading-none ${n <= note ? "text-warn" : "text-hairline-strong hover:text-warn"}`}
                  >
                    ★
                  </IconButton>
                ))}
              </div>
            </Field>
            <Field label={d.commentaire} htmlFor="note_commentaire" optionalLabel={dict.common.optional}>
              <Textarea id="note_commentaire" name="commentaire" rows={3} maxLength={1000} defaultValue={formValue(state, "commentaire")} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>{dict.common.cancel}</Button>
              <SubmitButton disabled={note === 0}>{dict.common.send}</SubmitButton>
            </div>
          </form>
        )}
      </ActionModal>
  );
}
