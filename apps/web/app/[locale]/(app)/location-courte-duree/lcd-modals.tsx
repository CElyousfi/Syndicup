"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { Field, Input, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Banner } from "../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import { IconPlus } from "../../../../components/ui/icons";
import { confirmerArrivee, confirmerDepart, declarerLot } from "./actions";

/** Déclaration d'un lot en LCD par son propriétaire (ou le syndic au nom d'un propriétaire). */
export function DeclarerLotModal({
  dict,
  locale,
  lots,
  ouvertInitialement = false,
}: {
  dict: Dict;
  locale: Locale;
  lots: Array<{ id: string; numero: string }>;
  ouvertInitialement?: boolean;
}) {
  const [open, setOpen] = useState(ouvertInitialement);
  const [state, action] = useActionState(declarerLot, IDLE);
  const l = dict.lcd;
  const statut =
    state.status === "success" ? (state.data as { statut: string } | undefined)?.statut : null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {l.declarerLot}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={l.declarerLotTitre}
        subtitle={l.declarerLotAide}
        closeLabel={dict.common.close}
      >
        {state.status === "success" ? (
          <div className="space-y-4">
            <Banner variant={statut === "VALIDEE" ? "ok" : "info"}>
              {statut === "VALIDEE" ? l.declaree : l.declareeEnAttente}
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
            <Field label={l.lot} htmlFor="d_lot" required error={fieldError(state, "lot_id")}>
              <Select id="d_lot" name="lot_id" required defaultValue={lots[0]?.id ?? ""}>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.numero}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={l.plateformes}
              htmlFor="d_plateformes"
              hint={l.plateformesAide}
              optionalLabel={dict.common.optional}
              error={fieldError(state, "plateformes")}
            >
              <Input id="d_plateformes" name="plateformes" maxLength={200} placeholder="Airbnb, Booking" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={l.contactUrgenceNom}
                htmlFor="d_cu_nom"
                optionalLabel={dict.common.optional}
                error={fieldError(state, "contact_urgence_nom")}
              >
                <Input id="d_cu_nom" name="contact_urgence_nom" maxLength={120} />
              </Field>
              <Field
                label={l.contactUrgenceTelephone}
                htmlFor="d_cu_tel"
                optionalLabel={dict.common.optional}
                error={fieldError(state, "contact_urgence_telephone")}
              >
                <Input id="d_cu_tel" name="contact_urgence_telephone" type="tel" dir="ltr" maxLength={20} />
              </Field>
            </div>
            <Field
              label={l.dateDebut}
              htmlFor="d_debut"
              optionalLabel={dict.common.optional}
              error={fieldError(state, "date_debut")}
            >
              <Input id="d_debut" name="date_debut" type="date" className="tnum" />
            </Field>
            <Field
              label={l.gestionnaireId}
              htmlFor="d_gest"
              hint={l.gestionnaireIdAide}
              optionalLabel={dict.common.optional}
              error={fieldError(state, "gestionnaire_id")}
            >
              <Input id="d_gest" name="gestionnaire_id" dir="ltr" className="font-mono text-[13px]" />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{l.declarerLot}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/** Gardien / syndic — confirme l'arrivée (nombre de voyageurs constaté facultatif). */
export function ConfirmerArriveeForm({
  dict,
  locale,
  sejourId,
  nbVoyageurs,
  size = "sm",
}: {
  dict: Dict;
  locale: Locale;
  sejourId: string;
  nbVoyageurs: number;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(confirmerArrivee, IDLE);
  const l = dict.lcd;

  if (state.status === "success") {
    return <p className="text-[13px] font-medium text-ok">{l.arriveeConfirmee}</p>;
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        {l.confirmerArrivee}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={l.confirmerArrivee} closeLabel={dict.common.close}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="sejour_id" value={sejourId} />
          <Field
            label={l.nbVoyageursConstate}
            htmlFor={`arr_${sejourId}`}
            optionalLabel={dict.common.optional}
            error={fieldError(state, "nb_voyageurs_constate")}
          >
            <Input
              id={`arr_${sejourId}`}
              name="nb_voyageurs_constate"
              type="number"
              min={0}
              max={50}
              defaultValue={nbVoyageurs}
              className="tnum"
            />
          </Field>
          <FormAlert state={state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{dict.common.confirm}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Gardien / syndic — confirme le départ : un clic, transition unique EN_COURS → TERMINE. */
export function ConfirmerDepartForm({
  dict,
  locale,
  sejourId,
  size = "sm",
}: {
  dict: Dict;
  locale: Locale;
  sejourId: string;
  size?: "sm" | "md";
}) {
  const [state, action] = useActionState(confirmerDepart, IDLE);
  const l = dict.lcd;

  if (state.status === "success") {
    return <p className="text-[13px] font-medium text-ok">{l.departConfirme}</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="sejour_id" value={sejourId} />
        <SubmitButton size={size} variant="secondary">
          {l.confirmerDepart}
        </SubmitButton>
      </form>
      {state.status === "error" ? <p className="text-[12px] text-danger">{state.message}</p> : null}
    </div>
  );
}
