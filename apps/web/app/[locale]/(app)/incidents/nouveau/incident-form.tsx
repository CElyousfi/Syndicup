"use client";

import { useActionState, useState } from "react";
import { Pressable } from "../../../../../components/ui/pressable";
import { Field, Input, Select, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Banner } from "../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../lib/i18n";
import { PhotoPicker } from "../../../../../components/incidents/photo-picker";
import { CategorieGlyphe } from "../../../../../components/incidents/categorie-icon";
import type { CategorieIncident, PartieIncident, UrgenceIncident } from "../../../../../lib/api/types";
import { signalerIncident } from "../actions";

/** F2 — formulaire guidé : catégories illustrées, aide commune/privative, garde-fou urgence. */
export function IncidentForm({
  dict,
  locale,
  lots,
  sejours = [],
  sejourInitial,
  emplacements = [],
}: {
  dict: Dict;
  locale: Locale;
  lots: Array<{ id: string; numero: string }>;
  /** M15 — séjours de location courte durée en cours (vide = sélecteur masqué). */
  sejours?: Array<{ id: string; lotId: string; libelle: string }>;
  sejourInitial?: string;
  /** M23 — emplacements (parking / cave commune) visibles : « véhicule sur ma place ». */
  emplacements?: Array<{ id: string; code: string; type: string }>;
}) {
  const i = dict.incidents;
  const [state, action] = useActionState(signalerIncident, IDLE);
  const [sejourId, setSejourId] = useState(
    sejourInitial && sejours.some((s) => s.id === sejourInitial) ? sejourInitial : ""
  );
  const sejourChoisi = sejours.find((s) => s.id === sejourId);
  const [categorie, setCategorie] = useState<CategorieIncident>("PLOMBERIE");
  const [urgence, setUrgence] = useState<UrgenceIncident>("NORMALE");
  const [partie, setPartie] = useState<PartieIncident>("COMMUNE");

  const categories = Object.keys(dict.enums.categorieIncident) as CategorieIncident[];
  // Tuiles sélectionnables (Wise) : greige au repos, lime une fois choisies.
  const tuile = (actif: boolean) =>
    `su-btn rounded-[18px] transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-2 ${
      actif ? "bg-cta text-ink" : "bg-tile text-ink-strong hover:bg-wash-strong"
    }`;
  const legende = "mb-3 text-[14px] font-semibold text-ink";

  return (
    <form action={action} className="max-w-2xl space-y-8">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="categorie" value={categorie} />
      <input type="hidden" name="partie" value={partie} />
      <input type="hidden" name="urgence" value={urgence} />

      {/* Catégorie */}
      <fieldset>
        <legend className={legende}>{i.categorie}</legend>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {categories.map((c) => (
            <Pressable
              key={c}
              type="button"
              onClick={() => setCategorie(c)}
              aria-pressed={categorie === c}
              className={`flex min-h-[60px] items-center gap-3 px-3 py-2.5 text-start text-[14px] font-semibold ${tuile(categorie === c)}`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface" aria-hidden>
                <CategorieGlyphe categorie={c} size={22} />
              </span>
              <span className="min-w-0 leading-snug">{dict.enums.categorieIncident[c]}</span>
            </Pressable>
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
        <legend className="mb-1 text-[14px] font-semibold text-ink">{i.partie}</legend>
        <p className="mb-3 text-[13px] text-soft">{i.partieAide}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {(["COMMUNE", "PRIVATIVE"] as PartieIncident[]).map((pa) => (
            <Pressable
              key={pa}
              type="button"
              onClick={() => setPartie(pa)}
              aria-pressed={partie === pa}
              className={`min-h-[52px] px-3 py-2.5 text-[14px] font-semibold ${tuile(partie === pa)}`}
            >
              {dict.enums.partie[pa]}
            </Pressable>
          ))}
        </div>
      </fieldset>

      {/* Urgence */}
      <fieldset>
        <legend className={legende}>{i.urgence}</legend>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {(["NORMALE", "URGENTE", "URGENCE_MAXIMALE"] as UrgenceIncident[]).map((u) => (
            <Pressable
              key={u}
              type="button"
              onClick={() => setUrgence(u)}
              aria-pressed={urgence === u}
              className={`su-btn min-h-[60px] rounded-[18px] px-4 py-3 text-start transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-2 ${
                urgence === u
                  ? u === "URGENCE_MAXIMALE"
                    ? "bg-danger-tint shadow-[inset_0_0_0_2px_var(--color-danger)]"
                    : "bg-surface shadow-[inset_0_0_0_2px_var(--color-link)]"
                  : "bg-tile hover:bg-wash-strong"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`size-2.5 shrink-0 rounded-full ${
                    u === "URGENCE_MAXIMALE" ? "bg-danger" : u === "URGENTE" ? "bg-warn" : "bg-link"
                  }`}
                  aria-hidden
                />
                <span
                  className={`block text-[14px] font-semibold ${
                    urgence === u && u === "URGENCE_MAXIMALE" ? "text-danger" : "text-ink"
                  }`}
                >
                  {dict.enums.urgence[u]}
                </span>
              </span>
              <span className="mt-1 block text-[12px] text-soft">
                {dict.enums.urgenceSla[u]}
              </span>
            </Pressable>
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
          <Select
            id="lot_id"
            name="lot_id"
            key={sejourChoisi?.lotId ?? "libre"}
            defaultValue={sejourChoisi?.lotId ?? ""}
          >
            <option value="">{dict.common.none}</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.numero}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {sejours.length > 0 ? (
        <Field
          label={i.lierSejour}
          htmlFor="sejour_id"
          hint={i.lierSejourAide}
          optionalLabel={dict.common.optional}
          error={fieldError(state, "sejour_id")}
        >
          <Select id="sejour_id" name="sejour_id" value={sejourId} onChange={(e) => setSejourId(e.target.value)}>
            <option value="">{dict.common.none}</option>
            {sejours.map((s) => (
              <option key={s.id} value={s.id}>
                {s.libelle}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {categorie === "PARKING" && emplacements.length > 0 ? (
        <Field label={i.emplacementConcerne} htmlFor="emplacement_id" hint={i.emplacementConcerneAide} optionalLabel={dict.common.optional} error={fieldError(state, "emplacement_id")}>
          <Select id="emplacement_id" name="emplacement_id" defaultValue="">
            <option value="">{dict.common.none}</option>
            {emplacements.map((x) => (
              <option key={x.id} value={x.id}>
                {x.code} · {dict.enumsParkings.typeEmplacement[x.type as keyof typeof dict.enumsParkings.typeEmplacement] ?? x.type}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {categorie === "PARKING" ? (
        <Field label={i.immatriculationSignalee} htmlFor="immatriculation_signalee" hint={i.immatriculationSignaleeAide} optionalLabel={dict.common.optional} error={fieldError(state, "immatriculation_signalee")}>
          <Input id="immatriculation_signalee" name="immatriculation_signalee" maxLength={24} placeholder="12345-A-6" dir="ltr" className="font-mono uppercase text-start" />
        </Field>
      ) : null}

      <FormAlert state={state} />

      <div className="flex justify-end border-t border-hairline pt-6">
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
