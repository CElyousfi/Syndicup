"use client";

import { Field, Select, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { StatutIncident } from "../../../../../lib/api/types";
import { assignerIncident, changerStatutIncident } from "../actions";
import { ActionModal } from "../../../../../components/ui/action-modal";
import { formKey, formValue } from "../../../../../lib/form-values";

export function ChangerStatutModal({
  dict,
  locale,
  incidentId,
  statutActuel,
}: {
  dict: Dict;
  locale: Locale;
  incidentId: string;
  statutActuel: StatutIncident;
}) {
  const i = dict.incidents;

  return (
    <ActionModal
        action={changerStatutIncident}
        title={i.changerStatut}
        closeLabel={dict.common.close}
        success={{ message: i.statutChange }}
        trigger={(open) => <Button variant="secondary" onClick={open}>
        {i.changerStatut}
      </Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="incident_id" value={incidentId} />
            <Field label={i.statut} htmlFor="statut" required>
              <Select key={formKey(state, "statut")} id="statut" name="statut" defaultValue={formValue(state, "statut", statutActuel)} required>
                {(Object.keys(dict.enums.statutIncident) as StatutIncident[]).map((s) => (
                  <option key={s} value={s}>
                    {dict.enums.statutIncident[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={i.commentaire}
              htmlFor="commentaire"
              hint={i.commentaireHint}
              optionalLabel={dict.common.optional}
            >
              <Textarea id="commentaire" name="commentaire" rows={3} maxLength={2000} defaultValue={formValue(state, "commentaire")} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.save}</SubmitButton>
            </div>
          </form>
        )}
      </ActionModal>
  );
}

export function AssignerModal({
  dict,
  locale,
  incidentId,
  prestataires,
}: {
  dict: Dict;
  locale: Locale;
  incidentId: string;
  prestataires: Array<{ id: string; nom: string; specialite: string; actif: boolean }>;
}) {
  const i = dict.incidents;

  return (
    <ActionModal
        action={assignerIncident}
        title={i.assigner}
        subtitle={i.assignerAide}
        closeLabel={dict.common.close}
        success={{ message: dict.common.updated }}
        trigger={(open) => <Button onClick={open}>{i.assigner}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="incident_id" value={incidentId} />
            <Field label={i.prestataires} htmlFor="prestataire_id" required>
              <Select key={formKey(state, "prestataire_id")} id="prestataire_id" name="prestataire_id" required defaultValue={formValue(state, "prestataire_id")}>
                {prestataires.map((pr) => (
                  <option key={pr.id} value={pr.id} disabled={!pr.actif}>
                    {pr.nom} — {pr.specialite}
                    {pr.actif ? "" : ` (${i.inactif})`}
                  </option>
                ))}
              </Select>
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{i.assigner}</SubmitButton>
            </div>
          </form>
        )}
      </ActionModal>
  );
}
