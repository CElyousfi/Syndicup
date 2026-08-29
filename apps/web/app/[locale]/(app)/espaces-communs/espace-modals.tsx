"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { Field, Input, Select, Switch } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Banner } from "../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import { creerEspace, modifierEspace, reserverEspace } from "./actions";
import type { EspaceCommun } from "../../../../lib/api/types";
import { IconPlus, IconCalendar } from "../../../../components/ui/icons";

export function CreerEspaceModal({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(creerEspace, IDLE);
  const e = dict.espaces;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {e.nouveau}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={e.nouveau} closeLabel={dict.common.close}>
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
            <Field label={e.nom} htmlFor="e_nom" required error={fieldError(state, "nom")}>
              <Input id="e_nom" name="nom" required maxLength={200} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={e.type} htmlFor="e_type" hint={e.typeHint} required>
                <Input id="e_type" name="type" required maxLength={80} />
              </Field>
              <Field label={e.capacite} htmlFor="e_capacite" optionalLabel={dict.common.optional}>
                <Input id="e_capacite" name="capacite" type="number" min={1} className="tnum" />
              </Field>
            </div>
            <Switch name="reservable" label={e.reservable} defaultChecked />
            <Switch
              name="validation_automatique"
              label={e.validationAuto}
              hint={e.validationManuelle}
            />
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

/** G2 — réservation d'un créneau : le conflit est détecté par le serveur (422). */
export function ReserverModal({
  dict,
  locale,
  espaceId,
  espaceNom,
  mesLots,
}: {
  dict: Dict;
  locale: Locale;
  espaceId: string;
  espaceNom: string;
  mesLots: Array<{ id: string; numero: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reserverEspace, IDLE);
  const e = dict.espaces;

  const succes =
    state.status === "success" ? (state.data as { statut: string }).statut : null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconCalendar width={15} height={15} />
        {e.reserver}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={fill(e.reserverTitre, { nom: espaceNom })}
        closeLabel={dict.common.close}
      >
        {succes ? (
          <div className="space-y-4">
            <Banner variant={succes === "CONFIRMEE" ? "ok" : "info"}>
              {succes === "CONFIRMEE" ? e.reservationConfirmee : e.reservationEnAttente}
            </Banner>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="espace_id" value={espaceId} />
            <Field label={e.pourLot} htmlFor="r_lot" required>
              <Select id="r_lot" name="lot_id" required defaultValue={mesLots[0]?.id ?? ""}>
                {mesLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.numero}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={e.dateDebut}
                htmlFor="r_debut"
                required
                error={fieldError(state, "date_debut")}
              >
                <Input id="r_debut" name="date_debut" type="datetime-local" required />
              </Field>
              <Field
                label={e.dateFin}
                htmlFor="r_fin"
                required
                error={fieldError(state, "date_fin")}
              >
                <Input id="r_fin" name="date_fin" type="datetime-local" required />
              </Field>
            </div>
            <Field label={e.nombreInvites} htmlFor="r_invites" optionalLabel={dict.common.optional}>
              <Input id="r_invites" name="nombre_invites" type="number" min={0} className="tnum" />
            </Field>
            {state.status === "error" && state.code === "UNPROCESSABLE_ENTITY" ? (
              <Banner variant="warn">{e.creneauPris}</Banner>
            ) : (
              <FormAlert state={state} />
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{e.reserver}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function ModifierEspaceModal({
  dict,
  locale,
  espace,
}: {
  dict: Dict;
  locale: Locale;
  espace: Pick<EspaceCommun, "id" | "nom" | "type" | "capacite" | "reservable" | "validationAutomatique">;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(modifierEspace, IDLE);
  const e = dict.espaces;
  const g = dict.gestion;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {g.modifier}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={g.espaceModifier} subtitle={espace.nom} closeLabel={dict.common.close}>
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
            <input type="hidden" name="espace_id" value={espace.id} />
            <Field label={e.nom} htmlFor={`m_nom_${espace.id}`} required error={fieldError(state, "nom")}>
              <Input id={`m_nom_${espace.id}`} name="nom" required maxLength={200} defaultValue={espace.nom} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={e.type} htmlFor={`m_type_${espace.id}`} hint={e.typeHint} required>
                <Input id={`m_type_${espace.id}`} name="type" required maxLength={80} defaultValue={espace.type} />
              </Field>
              <Field label={e.capacite} htmlFor={`m_cap_${espace.id}`} optionalLabel={dict.common.optional}>
                <Input
                  id={`m_cap_${espace.id}`}
                  name="capacite"
                  type="number"
                  min={1}
                  className="tnum"
                  defaultValue={espace.capacite ?? ""}
                />
              </Field>
            </div>
            <Switch name="reservable" label={e.reservable} defaultChecked={espace.reservable} />
            <Switch
              name="validation_automatique"
              label={e.validationAuto}
              hint={e.validationManuelle}
              defaultChecked={espace.validationAutomatique}
            />
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
