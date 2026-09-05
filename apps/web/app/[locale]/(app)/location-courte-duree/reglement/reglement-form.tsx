"use client";

import { useActionState, useState } from "react";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Checkbox, Field, Input, Select } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Banner } from "../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { LcdReglement, RegimeLcd } from "../../../../../lib/api/types";
import { mettreAJourReglement } from "../actions";

const REGIMES: RegimeLcd[] = ["NON_DEFINI", "AUTORISEE", "ENCADREE", "INTERDITE"];

/** Régime + paramètres ENCADREE : les champs vides restent NULL (jamais de valeur devinée). */
export function ReglementForm({
  dict,
  locale,
  reglement,
  resolutions,
}: {
  dict: Dict;
  locale: Locale;
  reglement: LcdReglement;
  resolutions: Array<{ id: string; label: string }>;
}) {
  const l = dict.lcd;
  const [state, action] = useActionState(mettreAJourReglement, IDLE);
  const [regime, setRegime] = useState<RegimeLcd>(reglement.regimeLcd);
  const params = reglement.parametresLcdJson;

  return (
    <form action={action} className="max-w-2xl space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="regime_lcd" value={regime} />

      <Card>
        <SectionHeader title={l.choisirRegime} subtitle={l.regimeAide} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {REGIMES.map((r) => {
            const actif = regime === r;
            const danger = r === "INTERDITE";
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRegime(r)}
                aria-pressed={actif}
                className={`min-h-11 rounded-field border px-3 py-3 text-start transition-colors ${
                  actif
                    ? danger
                      ? "border-danger bg-danger-tint"
                      : "border-action bg-action-wash"
                    : "border-hairline hover:border-hairline-strong hover:bg-hover"
                }`}
              >
                <span
                  className={`block text-[13px] font-semibold ${
                    actif ? (danger ? "text-danger" : "text-action") : "text-ink-strong"
                  }`}
                >
                  {dict.enums.regimeLcd[r]}
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-soft">
                  {l.regimeDescriptions[r]}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {regime === "ENCADREE" ? (
        <Card>
          <SectionHeader title={l.parametres} subtitle={l.parametresAide} />
          <div className="mt-4 space-y-4">
            <Checkbox
              name="declaration_prealable_obligatoire"
              label={l.declarationPrealable}
              defaultChecked={params?.declaration_prealable_obligatoire ?? true}
            />
            <Checkbox
              name="gestionnaire_obligatoire_si_proprietaire_absent"
              label={l.gestionnaireObligatoire}
              defaultChecked={params?.gestionnaire_obligatoire_si_proprietaire_absent ?? false}
            />
            <Checkbox
              name="contact_gardien_obligatoire"
              label={l.contactGardien}
              defaultChecked={params?.contact_gardien_obligatoire ?? false}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label={l.delaiDeclaration}
                htmlFor="r_delai"
                hint={l.delaiDeclarationAide}
                optionalLabel={dict.common.optional}
                error={fieldError(state, "parametres_lcd_json.delai_declaration_heures")}
              >
                <Input
                  id="r_delai"
                  name="delai_declaration_heures"
                  type="number"
                  min={0}
                  max={720}
                  defaultValue={params?.delai_declaration_heures ?? ""}
                  className="tnum"
                />
              </Field>
              <Field
                label={l.nuitsMax}
                htmlFor="r_nuits"
                optionalLabel={dict.common.optional}
                error={fieldError(state, "parametres_lcd_json.nb_nuits_max_par_an")}
              >
                <Input
                  id="r_nuits"
                  name="nb_nuits_max_par_an"
                  type="number"
                  min={1}
                  max={366}
                  defaultValue={params?.nb_nuits_max_par_an ?? ""}
                  className="tnum"
                />
              </Field>
              <Field
                label={l.voyageursMax}
                htmlFor="r_voyageurs"
                optionalLabel={dict.common.optional}
                error={fieldError(state, "parametres_lcd_json.nb_voyageurs_max_par_lot")}
              >
                <Input
                  id="r_voyageurs"
                  name="nb_voyageurs_max_par_lot"
                  type="number"
                  min={1}
                  max={50}
                  defaultValue={params?.nb_voyageurs_max_par_lot ?? ""}
                  className="tnum"
                />
              </Field>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title={l.agResolution} subtitle={l.agResolutionAide} />
        <div className="mt-4">
          {resolutions.length > 0 ? (
            <Field label={l.agResolutionLiee} htmlFor="r_res" optionalLabel={dict.common.optional} error={fieldError(state, "ag_resolution_id")}>
              <Select id="r_res" name="ag_resolution_id" defaultValue={reglement.regimeLcdAgResolutionId ?? ""}>
                <option value="">{dict.common.none}</option>
                {resolutions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label={l.agResolutionLiee} htmlFor="r_res" optionalLabel={dict.common.optional} error={fieldError(state, "ag_resolution_id")}>
              <Input
                id="r_res"
                name="ag_resolution_id"
                dir="ltr"
                className="font-mono text-[13px]"
                defaultValue={reglement.regimeLcdAgResolutionId ?? ""}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </Field>
          )}
          {reglement.agResolution ? (
            <p className="mt-2 text-[13px] text-soft">{reglement.agResolution.texte}</p>
          ) : null}
        </div>
      </Card>

      {state.status === "success" ? <Banner variant="ok">{l.reglementEnregistre}</Banner> : <FormAlert state={state} />}

      <div className="flex justify-end">
        <SubmitButton size="lg" variant={regime === "INTERDITE" ? "danger" : "primary"}>
          {dict.common.save}
        </SubmitButton>
      </div>
    </form>
  );
}
