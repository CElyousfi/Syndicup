"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { Field, Input, Switch } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import { creerPrestataire } from "../incidents/actions";
import { modifierPrestataire } from "./actions";
import type { Prestataire } from "../../../../lib/api/types";
import { IconPlus } from "../../../../components/ui/icons";

export function PrestataireModal({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(creerPrestataire, IDLE);
  const i = dict.incidents;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {i.nouveauPrestataire}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={i.nouveauPrestataire} closeLabel={dict.common.close}>
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
            <Field label={i.nom} htmlFor="p_nom" required error={fieldError(state, "nom")}>
              <Input id="p_nom" name="nom" required maxLength={200} />
            </Field>
            <Field label={i.specialite} htmlFor="p_specialite" required error={fieldError(state, "specialite")}>
              <Input id="p_specialite" name="specialite" required maxLength={120} />
            </Field>
            <Field label={i.contact} htmlFor="p_contact" required error={fieldError(state, "contact")}>
              <Input id="p_contact" name="contact" dir="ltr" required maxLength={200} className="text-start" />
            </Field>
            <Field
              label={dict.lots.utilisateur}
              htmlFor="p_utilisateur"
              hint={dict.lots.utilisateurIdAide}
              optionalLabel={dict.common.optional}
            >
              <Input
                id="p_utilisateur"
                name="utilisateur_id"
                dir="ltr"
                pattern="[0-9a-fA-F-]{36}"
                className="font-mono text-[13px] text-start"
              />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.create}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function ModifierPrestataireModal({
  dict,
  locale,
  prestataire,
}: {
  dict: Dict;
  locale: Locale;
  prestataire: Pick<Prestataire, "id" | "nom" | "specialite" | "contact" | "actif">;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(modifierPrestataire, IDLE);
  const i = dict.incidents;
  const g = dict.gestion;
  const id = prestataire.id;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {g.modifier}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={g.prestataireModifier} subtitle={prestataire.nom} closeLabel={dict.common.close}>
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
            <input type="hidden" name="prestataire_id" value={id} />
            <Field label={i.nom} htmlFor={`mp_nom_${id}`} required error={fieldError(state, "nom")}>
              <Input id={`mp_nom_${id}`} name="nom" required maxLength={200} defaultValue={prestataire.nom} />
            </Field>
            <Field label={i.specialite} htmlFor={`mp_spec_${id}`} required error={fieldError(state, "specialite")}>
              <Input id={`mp_spec_${id}`} name="specialite" required maxLength={120} defaultValue={prestataire.specialite} />
            </Field>
            <Field label={i.contact} htmlFor={`mp_contact_${id}`} required error={fieldError(state, "contact")}>
              <Input id={`mp_contact_${id}`} name="contact" required maxLength={200} defaultValue={prestataire.contact} dir="ltr" />
            </Field>
            <Switch name="actif" label={i.actif} defaultChecked={prestataire.actif} />
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
