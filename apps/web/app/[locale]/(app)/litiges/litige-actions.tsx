"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { IrreversibleNotice } from "../../../../components/ui/irreversible-notice";
import { Field, Input, Select, Textarea } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import { cloturerLitige, declarerLitige, escaladerLitige } from "./actions";
import { celebrate } from "../../../../lib/success";
import { IconPlus } from "../../../../components/ui/icons";
import { ActionModal } from "../../../../components/ui/action-modal";
import { formKey, formValue } from "../../../../lib/form-values";

export function DeclarerLitigeModal({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(declarerLitige, IDLE);
  const li = dict.litiges;

  // Action majeure : le litige déclaré s'annonce en écran de succès plein (comme le mobile).
  useEffect(() => {
    if (state.status !== "success") return;
    setOpen(false);
    celebrate({ titre: li.declare, illustration: "ok-general" });
  }, [state, li.declare]);

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
              <Input id="li_type" name="type" required maxLength={120} defaultValue={formValue(state, "type")} />
            </Field>
            <Field
              label={li.description}
              htmlFor="li_description"
              hint={li.descriptionHint}
              required
              error={fieldError(state, "description")}
            >
              <Textarea id="li_description" name="description" required minLength={3} rows={5} maxLength={5000} defaultValue={formValue(state, "description")} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
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
  const li = dict.litiges;
  const libelle = dict.enums.escaladeLitige[niveauCible];

  return (
    <ActionModal
        action={escaladerLitige}
        title={li.escaladerTitre}
        closeLabel={dict.common.close}
        success={{ message: li.escalade }}
        trigger={(open) => <Button variant="secondary" size="sm" onClick={open}>
        {li.escalader}
      </Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="litige_id" value={litigeId} />
            <IrreversibleNotice>
              {fill(li.escaladerCorps, { niveau: libelle })}
            </IrreversibleNotice>
            <Field label={li.escaladeMotif} htmlFor="esc_motif" required>
              <Textarea id="esc_motif" name="motif" required minLength={3} rows={3} maxLength={2000} defaultValue={formValue(state, "motif")} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {dict.common.close}
              </Button>
              <SubmitButton variant="danger">{li.escalader}</SubmitButton>
            </div>
          </form>
        )}
      </ActionModal>
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
  const li = dict.litiges;

  return (
    <ActionModal
        action={cloturerLitige}
        title={li.cloturerTitre}
        closeLabel={dict.common.close}
        success={{ message: li.cloture }}
        trigger={(open) => <Button variant="ghost" size="sm" onClick={open}>
        {li.cloturer}
      </Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="litige_id" value={litigeId} />
            <Field label={li.cloturerStatut} htmlFor="cl_statut" hint={li.cloturerAide} required>
              <Select key={formKey(state, "statut")} id="cl_statut" name="statut" defaultValue={formValue(state, "statut", "RESOLU")} required>
                <option value="RESOLU">{dict.enums.statutLitige.RESOLU}</option>
                <option value="CLOS">{dict.enums.statutLitige.CLOS}</option>
              </Select>
            </Field>
            <Field label={li.cloturerMotif} htmlFor="cl_motif" required>
              <Textarea id="cl_motif" name="motif" required minLength={3} rows={3} maxLength={2000} defaultValue={formValue(state, "motif")} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {dict.common.close}
              </Button>
              <SubmitButton>{li.cloturer}</SubmitButton>
            </div>
          </form>
        )}
      </ActionModal>
  );
}
