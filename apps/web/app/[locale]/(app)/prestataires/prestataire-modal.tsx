"use client";

import { Field, Input, Textarea } from "../../../../components/ui/field";
import { Switch } from "../../../../components/ui/toggle";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { fieldError, type FormState } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import { creerPrestataire } from "../incidents/actions";
import { modifierPrestataire } from "./actions";
import type { Prestataire } from "../../../../lib/api/types";
import { IconPlus } from "../../../../components/ui/icons";
import { ActionModal } from "../../../../components/ui/action-modal";
import { formChecked, formValue } from "../../../../lib/form-values";

/** Champs de la fiche fournisseur (M16) — partagés création / modification. */
function FicheFournisseur({
  dict,
  state,
  prefix,
  valeurs,
}: {
  dict: Dict;
  state: FormState;
  prefix: string;
  valeurs?: Partial<Pick<Prestataire, "telephone" | "email" | "ice" | "rc" | "adresse" | "notes" | "ribMasque">>;
}) {
  const d = dict.depenses;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={d.telephone} htmlFor={`${prefix}_tel`} error={fieldError(state, "telephone")} optionalLabel={dict.common.optional}>
          <Input id={`${prefix}_tel`} name="telephone" dir="ltr" inputMode="tel" defaultValue={formValue(state, "telephone", valeurs?.telephone ?? "")} className="text-start" />
        </Field>
        <Field label={d.email} htmlFor={`${prefix}_email`} error={fieldError(state, "email")} optionalLabel={dict.common.optional}>
          <Input id={`${prefix}_email`} name="email" type="email" dir="ltr" defaultValue={formValue(state, "email", valeurs?.email ?? "")} className="text-start" />
        </Field>
        <Field label={d.ice} htmlFor={`${prefix}_ice`} error={fieldError(state, "ice")} optionalLabel={dict.common.optional}>
          <Input id={`${prefix}_ice`} name="ice" dir="ltr" inputMode="numeric" pattern="[0-9]{15}" defaultValue={formValue(state, "ice", valeurs?.ice ?? "")} className="tnum text-start" />
        </Field>
        <Field label={d.rc} htmlFor={`${prefix}_rc`} error={fieldError(state, "rc")} optionalLabel={dict.common.optional}>
          <Input id={`${prefix}_rc`} name="rc" defaultValue={formValue(state, "rc", valeurs?.rc ?? "")} />
        </Field>
      </div>
      <Field label={d.adresse} htmlFor={`${prefix}_adresse`} optionalLabel={dict.common.optional}>
        <Input id={`${prefix}_adresse`} name="adresse" defaultValue={formValue(state, "adresse", valeurs?.adresse ?? "")} />
      </Field>
      <Field
        label={valeurs?.ribMasque ? `${d.rib} · ${valeurs.ribMasque}` : d.rib}
        htmlFor={`${prefix}_rib`}
        hint={d.ribAide}
        error={fieldError(state, "rib")}
        optionalLabel={dict.common.optional}
      >
        <Input id={`${prefix}_rib`} name="rib" dir="ltr" inputMode="numeric" pattern="[0-9 ]{24,30}" autoComplete="off" placeholder="007 780 0000123456789012 45" className="tnum text-start" />
      </Field>
      <Field label={d.notes} htmlFor={`${prefix}_notes`} optionalLabel={dict.common.optional}>
        <Textarea id={`${prefix}_notes`} name="notes" rows={2} maxLength={2000} defaultValue={formValue(state, "notes", valeurs?.notes ?? "")} />
      </Field>
    </>
  );
}

export function PrestataireModal({ dict, locale }: { dict: Dict; locale: Locale }) {
  const i = dict.incidents;

  return (
    <ActionModal
        action={creerPrestataire}
        title={i.nouveauPrestataire}
        wide
        closeLabel={dict.common.close}
        success={{ message: dict.common.updated }}
        trigger={(open) => <Button onClick={open}>
        <IconPlus width={16} height={16} />
        {i.nouveauPrestataire}
      </Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={i.nom} htmlFor="p_nom" required error={fieldError(state, "nom")}>
                <Input id="p_nom" name="nom" required maxLength={200} defaultValue={formValue(state, "nom")} />
              </Field>
              <Field label={i.specialite} htmlFor="p_specialite" required error={fieldError(state, "specialite")}>
                <Input id="p_specialite" name="specialite" required maxLength={120} defaultValue={formValue(state, "specialite")} />
              </Field>
            </div>
            <FicheFournisseur dict={dict} state={state} prefix="p" />
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
                className="font-mono text-[13px] text-start" defaultValue={formValue(state, "utilisateur_id")} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.create}</SubmitButton>
            </div>
          </form>
        )}
      </ActionModal>
  );
}

export function ModifierPrestataireModal({
  dict,
  locale,
  prestataire,
  size = "sm",
}: {
  dict: Dict;
  locale: Locale;
  prestataire: Pick<Prestataire, "id" | "nom" | "specialite" | "contact" | "actif"> &
    Partial<Pick<Prestataire, "telephone" | "email" | "ice" | "rc" | "adresse" | "notes" | "ribMasque">>;
  size?: "sm" | "md";
}) {
  const i = dict.incidents;
  const g = dict.gestion;
  const id = prestataire.id;

  return (
    <ActionModal
        action={modifierPrestataire}
        title={g.prestataireModifier}
        subtitle={prestataire.nom}
        wide
        closeLabel={dict.common.close}
        success={{ message: dict.common.updated }}
        trigger={(open) => <Button variant="secondary" size={size} onClick={open}>
        {g.modifier}
      </Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="prestataire_id" value={id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={i.nom} htmlFor={`mp_nom_${id}`} required error={fieldError(state, "nom")}>
                <Input id={`mp_nom_${id}`} name="nom" required maxLength={200} defaultValue={formValue(state, "nom", prestataire.nom)} />
              </Field>
              <Field label={i.specialite} htmlFor={`mp_spec_${id}`} required error={fieldError(state, "specialite")}>
                <Input id={`mp_spec_${id}`} name="specialite" required maxLength={120} defaultValue={formValue(state, "specialite", prestataire.specialite)} />
              </Field>
            </div>
            <Field label={i.contact} htmlFor={`mp_contact_${id}`} error={fieldError(state, "contact")} optionalLabel={dict.common.optional}>
              <Input id={`mp_contact_${id}`} name="contact" maxLength={200} defaultValue={formValue(state, "contact", prestataire.contact)} dir="ltr" className="text-start" />
            </Field>
            <FicheFournisseur dict={dict} state={state} prefix={`mp_${id}`} valeurs={prestataire} />
            <Switch name="actif" label={i.actif} defaultChecked={formChecked(state, "actif", prestataire.actif)} />
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
