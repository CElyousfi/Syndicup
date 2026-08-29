"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../../components/ui/modal";
import { Field, Select, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button } from "../../../../../components/ui/button";
import { IDLE } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { StatutIncident } from "../../../../../lib/api/types";
import { assignerIncident, changerStatutIncident } from "../actions";

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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(changerStatutIncident, IDLE);
  const i = dict.incidents;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {i.changerStatut}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={i.changerStatut} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{i.statutChange}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="incident_id" value={incidentId} />
            <Field label={i.statut} htmlFor="statut" required>
              <Select id="statut" name="statut" defaultValue={statutActuel} required>
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
              <Textarea id="commentaire" name="commentaire" rows={3} maxLength={2000} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.save}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(assignerIncident, IDLE);
  const i = dict.incidents;

  return (
    <>
      <Button onClick={() => setOpen(true)}>{i.assigner}</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={i.assigner}
        subtitle={i.assignerAide}
        closeLabel={dict.common.close}
      >
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{dict.common.updated}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="incident_id" value={incidentId} />
            <Field label={i.prestataires} htmlFor="prestataire_id" required>
              <Select id="prestataire_id" name="prestataire_id" required>
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
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{i.assigner}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
