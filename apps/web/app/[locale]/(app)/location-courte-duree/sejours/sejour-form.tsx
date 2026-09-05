"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Banner } from "../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { LcdSejour, TypePieceIdentite } from "../../../../../lib/api/types";
import { dateInput } from "../../../../../lib/lcd";
import { declarerSejour, modifierSejour } from "../actions";

const PIECES: TypePieceIdentite[] = ["CIN", "PASSEPORT", "TITRE_SEJOUR", "AUTRE"];

/**
 * Déclaration / modification d'un séjour. Données voyageur minimales (CNDP) : jamais le numéro
 * complet de la pièce — 4 caractères au plus. Les refus métier (422/409 : quota de nuits, délai,
 * chevauchement…) arrivent de l'API avec leur message et s'affichent dans FormAlert.
 */
export function SejourForm({
  dict,
  locale,
  lots,
  lotInitial,
  sejour,
}: {
  dict: Dict;
  locale: Locale;
  lots: Array<{ id: string; numero: string }>;
  lotInitial?: string;
  /** Séjour existant (PREVU) → mode modification. */
  sejour?: LcdSejour;
}) {
  const l = dict.lcd;
  const [state, action] = useActionState(sejour ? modifierSejour : declarerSejour, IDLE);
  const lotChoisi = lotInitial && lots.some((x) => x.id === lotInitial) ? lotInitial : lots[0]?.id;

  return (
    <form action={action} className="card max-w-2xl space-y-6 p-5 sm:p-7">
      <input type="hidden" name="locale" value={locale} />
      {sejour ? <input type="hidden" name="sejour_id" value={sejour.id} /> : null}

      {sejour ? (
        <div className="rounded-xl border border-hairline bg-ground px-4 py-3 text-sm text-body">
          {l.lot} <span className="font-semibold text-ink">{sejour.lot?.numero ?? "—"}</span>
        </div>
      ) : (
        <Field label={l.lotSejour} htmlFor="s_lot" hint={l.lotSejourAide} required error={fieldError(state, "lot_id")}>
          <Select id="s_lot" name="lot_id" required defaultValue={lotChoisi ?? ""}>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.numero}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={l.dateArrivee} htmlFor="s_arrivee" required error={fieldError(state, "date_arrivee")}>
          <Input id="s_arrivee" name="date_arrivee" type="date" required className="tnum" defaultValue={dateInput(sejour?.dateArrivee)} />
        </Field>
        <Field label={l.dateDepart} htmlFor="s_depart" required error={fieldError(state, "date_depart")}>
          <Input id="s_depart" name="date_depart" type="date" required className="tnum" defaultValue={dateInput(sejour?.dateDepart)} />
        </Field>
        <Field label={l.heureArrivee} htmlFor="s_heure" optionalLabel={dict.common.optional} error={fieldError(state, "heure_arrivee_prevue")}>
          <Input id="s_heure" name="heure_arrivee_prevue" type="time" className="tnum" defaultValue={sejour?.heureArriveePrevue ?? ""} />
        </Field>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-[13px] font-semibold text-ink">{l.voyageurPrincipal}</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <Field label={l.voyageurNom} htmlFor="s_nom" required error={fieldError(state, "voyageur_principal_nom")}>
            <Input id="s_nom" name="voyageur_principal_nom" required maxLength={120} defaultValue={sejour?.voyageurPrincipalNom ?? ""} />
          </Field>
          <Field label={l.nbVoyageurs} htmlFor="s_nb" required error={fieldError(state, "nb_voyageurs")}>
            <Input id="s_nb" name="nb_voyageurs" type="number" min={1} max={50} required className="tnum" defaultValue={sejour?.nbVoyageurs ?? 1} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={l.voyageurTelephone} htmlFor="s_tel" optionalLabel={dict.common.optional} error={fieldError(state, "voyageur_telephone")}>
            <Input id="s_tel" name="voyageur_telephone" type="tel" dir="ltr" maxLength={20} defaultValue={sejour?.voyageurTelephone ?? ""} />
          </Field>
          <Field label={l.voyageurNationalite} htmlFor="s_nat" hint={l.voyageurNationaliteAide} optionalLabel={dict.common.optional} error={fieldError(state, "voyageur_nationalite")}>
            <Input id="s_nat" name="voyageur_nationalite" dir="ltr" maxLength={3} className="uppercase" placeholder="MA" defaultValue={sejour?.voyageurNationalite ?? ""} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-[13px] font-semibold text-ink">{l.pieceIdentite}</legend>
        <Banner variant="legal">{l.pieceIdentiteAide}</Banner>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={l.pieceIdentiteType} htmlFor="s_piece" optionalLabel={dict.common.optional} error={fieldError(state, "piece_identite_type")}>
            <Select id="s_piece" name="piece_identite_type" defaultValue={sejour?.pieceIdentiteType ?? ""}>
              <option value="">{dict.common.none}</option>
              {PIECES.map((t) => (
                <option key={t} value={t}>
                  {dict.enums.typePieceIdentite[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={l.pieceIdentiteFin} htmlFor="s_fin" optionalLabel={dict.common.optional} error={fieldError(state, "piece_identite_fin")}>
            <Input id="s_fin" name="piece_identite_fin" dir="ltr" maxLength={4} pattern="[A-Za-z0-9]{1,4}" className="font-mono uppercase" defaultValue={sejour?.pieceIdentiteFin ?? ""} />
          </Field>
        </div>
        <Field label={l.plaqueVehicule} htmlFor="s_plaque" optionalLabel={dict.common.optional} error={fieldError(state, "plaque_vehicule")}>
          <Input id="s_plaque" name="plaque_vehicule" dir="ltr" maxLength={20} className="uppercase" defaultValue={sejour?.plaqueVehicule ?? ""} />
        </Field>
      </fieldset>

      <FormAlert state={state} />

      <div className="flex justify-end border-t border-hairline pt-5">
        <SubmitButton size="lg" className="w-full sm:w-auto">
          {sejour ? dict.common.save : l.declarerSejour}
        </SubmitButton>
      </div>
    </form>
  );
}
