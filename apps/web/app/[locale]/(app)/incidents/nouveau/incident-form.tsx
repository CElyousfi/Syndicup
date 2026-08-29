"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Banner } from "../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../lib/i18n";
import { PhotoPicker } from "../../../../../components/incidents/photo-picker";
import type { CategorieIncident, PartieIncident, UrgenceIncident } from "../../../../../lib/api/types";
import { signalerIncident } from "../actions";

/** F2 — formulaire guidé : catégories illustrées, aide commune/privative, garde-fou urgence. */
export function IncidentForm({
  dict,
  locale,
  lots,
}: {
  dict: Dict;
  locale: Locale;
  lots: Array<{ id: string; numero: string }>;
}) {
  const i = dict.incidents;
  const [state, action] = useActionState(signalerIncident, IDLE);
  const [categorie, setCategorie] = useState<CategorieIncident>("PLOMBERIE");
  const [urgence, setUrgence] = useState<UrgenceIncident>("NORMALE");
  const [partie, setPartie] = useState<PartieIncident>("COMMUNE");

  const categories = Object.keys(dict.enums.categorieIncident) as CategorieIncident[];

  return (
    <form action={action} className="card max-w-2xl space-y-6 p-5 sm:p-7">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="categorie" value={categorie} />
      <input type="hidden" name="partie" value={partie} />
      <input type="hidden" name="urgence" value={urgence} />

      {/* Catégorie */}
      <fieldset>
        <legend className="mb-2.5 text-[13px] font-medium text-ink-strong">{i.categorie}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategorie(c)}
              aria-pressed={categorie === c}
              className={`min-h-11 rounded-field border px-3 py-2.5 text-start text-[13px] font-medium transition-colors ${
                categorie === c
                  ? "border-action bg-action-wash text-action"
                  : "border-hairline text-body hover:border-hairline-strong hover:bg-hover"
              }`}
            >
              {dict.enums.categorieIncident[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label={i.sousCategorie}
        htmlFor="sous_categorie"
        hint={i.sousCategorieHint}
        required
        error={fieldError(state, "sous_categorie")}
      >
        <Input id="sous_categorie" name="sous_categorie" required maxLength={120} />
      </Field>

      {/* Partie commune / privative */}
      <fieldset>
        <legend className="mb-1 text-[13px] font-medium text-ink-strong">{i.partie}</legend>
        <p className="mb-2.5 text-[13px] text-soft">{i.partieAide}</p>
        <div className="grid grid-cols-2 gap-2">
          {(["COMMUNE", "PRIVATIVE"] as PartieIncident[]).map((pa) => (
            <button
              key={pa}
              type="button"
              onClick={() => setPartie(pa)}
              aria-pressed={partie === pa}
              className={`min-h-11 rounded-field border px-3 py-2.5 text-[13px] font-medium transition-colors ${
                partie === pa
                  ? "border-action bg-action-wash text-action"
                  : "border-hairline text-body hover:border-hairline-strong hover:bg-hover"
              }`}
            >
              {dict.enums.partie[pa]}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Urgence */}
      <fieldset>
        <legend className="mb-2.5 text-[13px] font-medium text-ink-strong">{i.urgence}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["NORMALE", "URGENTE", "URGENCE_MAXIMALE"] as UrgenceIncident[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUrgence(u)}
              aria-pressed={urgence === u}
              className={`min-h-11 rounded-field border px-3 py-3 text-start transition-colors ${
                urgence === u
                  ? u === "URGENCE_MAXIMALE"
                    ? "border-danger bg-danger-tint"
                    : "border-action bg-action-wash"
                  : "border-hairline hover:border-hairline-strong hover:bg-hover"
              }`}
            >
              <span
                className={`block text-[13px] font-semibold ${
                  urgence === u && u === "URGENCE_MAXIMALE"
                    ? "text-danger"
                    : urgence === u
                      ? "text-action"
                      : "text-ink-strong"
                }`}
              >
                {dict.enums.urgence[u]}
              </span>
              <span className="mt-0.5 block text-[12px] text-soft">
                {dict.enums.urgenceSla[u]}
              </span>
            </button>
          ))}
        </div>
        {urgence === "URGENCE_MAXIMALE" ? (
          <Banner variant="danger" className="mt-3">
            {i.urgenceMaxAide}
          </Banner>
        ) : null}
      </fieldset>

      <Field
        label={i.description}
        htmlFor="description"
        hint={i.descriptionHint}
        optionalLabel={dict.common.optional}
      >
        <Textarea id="description" name="description" rows={4} maxLength={5000} />
      </Field>

      {/* Photos — caméra directe ou galerie, compressées côté client. */}
      <PhotoPicker
        name="photos"
        labels={{
          photos: i.photos,
          aide: i.photosAide,
          prendre: i.prendrePhoto,
          galerie: i.choisirGalerie,
          retirer: (n) => fill(i.retirerPhoto, { n }),
        }}
      />

      {lots.length > 0 ? (
        <Field
          label={i.lotConcerne}
          htmlFor="lot_id"
          hint={i.lotConcerneAide}
          optionalLabel={dict.common.optional}
        >
          <Select id="lot_id" name="lot_id" defaultValue="">
            <option value="">{dict.common.none}</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.numero}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <FormAlert state={state} />

      <div className="flex justify-end border-t border-hairline pt-5">
        <SubmitButton
          size="lg"
          className="w-full sm:w-auto"
          variant={urgence === "URGENCE_MAXIMALE" ? "danger" : "primary"}
        >
          {i.signaler}
        </SubmitButton>
      </div>
    </form>
  );
}
