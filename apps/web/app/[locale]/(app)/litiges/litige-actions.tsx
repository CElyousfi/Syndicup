"use client";

import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../components/ui/modal";
import { Field, Input, Select, Textarea } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import { cloturerLitige, declarerLitige, escaladerLitige } from "./actions";
import { IconPlus } from "../../../../components/ui/icons";

export function DeclarerLitigeModal({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(declarerLitige, IDLE);
  const li = dict.litiges;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {li.declarer}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={li.declarer} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{li.declare}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <Field label={li.type} htmlFor="li_type" hint={li.typeHint} required error={fieldError(state, "type")}>
              <Input id="li_type" name="type" required maxLength={120} />
            </Field>
            <Field
              label={li.description}
              htmlFor="li_description"
              hint={li.descriptionHint}
              required
              error={fieldError(state, "description")}
            >
              <Textarea id="li_description" name="description" required minLength={3} rows={5} maxLength={5000} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{li.declarer}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function EscaladerModal({
  dict,
  locale,
  litigeId,
  niveauCible,
}: {
  dict: Dict;
  locale: Locale;
  litigeId: string;
  niveauCible: "1" | "2";
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(escaladerLitige, IDLE);
  const li = dict.litiges;
  const libelle = dict.enums.escaladeLitige[niveauCible];

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {li.escalader}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={li.escaladerTitre} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{li.escalade}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="litige_id" value={litigeId} />
            <IrreversibleNotice>
              {fill(li.escaladerCorps, { niveau: libelle })}
            </IrreversibleNotice>
            <Field label={li.escaladeMotif} htmlFor="esc_motif" required>
              <Textarea id="esc_motif" name="motif" required minLength={3} rows={3} maxLength={2000} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton variant="danger">{li.escalader}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function CloturerLitigeModal({
  dict,
  locale,
  litigeId,
}: {
  dict: Dict;
  locale: Locale;
  litigeId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cloturerLitige, IDLE);
  const li = dict.litiges;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {li.cloturer}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={li.cloturerTitre} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{li.cloture}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="litige_id" value={litigeId} />
            <Field label={li.cloturerStatut} htmlFor="cl_statut" hint={li.cloturerAide} required>
              <Select id="cl_statut" name="statut" defaultValue="RESOLU" required>
                <option value="RESOLU">{dict.enums.statutLitige.RESOLU}</option>
                <option value="CLOS">{dict.enums.statutLitige.CLOS}</option>
              </Select>
            </Field>
            <Field label={li.cloturerMotif} htmlFor="cl_motif" required>
              <Textarea id="cl_motif" name="motif" required minLength={3} rows={3} maxLength={2000} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{li.cloturer}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
