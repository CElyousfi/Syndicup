"use client";

import { useActionState, useMemo, useState } from "react";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Field, Input, Select, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { IDLE, fieldError } from "../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../lib/i18n";
import type { BudgetPoste, Depense, CategorieDepense, SourceFinancement } from "../../../../../lib/api/types";
import { postesPourCategorie } from "../../../../../lib/depenses";
import { creerDepense, modifierDepense } from "./actions";

export interface OptionRef {
  id: string;
  libelle: string;
}

/**
 * Formulaire de dépense (création + modification). Le TTC fait foi ; HT/TVA sont facultatifs et
 * doivent sommer au TTC (l'API refuse sinon). Le poste est filtré par catégorie (cohérence imposée).
 */
export function DepenseForm({
  dict,
  locale,
  postes,
  prestataires,
  resolutions,
  tvaDefaut,
  depense,
}: {
  dict: Dict;
  locale: Locale;
  postes: BudgetPoste[];
  prestataires: OptionRef[];
  resolutions: OptionRef[];
  tvaDefaut: string | null;
  depense?: Depense;
}) {
  const [state, action] = useActionState(depense ? modifierDepense : creerDepense, IDLE);
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  const [categorie, setCategorie] = useState<CategorieDepense>(depense?.categorie ?? "ENTRETIEN_COURANT");
  const [source, setSource] = useState<SourceFinancement>(depense?.source ?? "COMPTE_COURANT");
  const [ht, setHt] = useState(depense?.montantHt ?? "");
  const [tva, setTva] = useState(depense?.tva ?? "");
  const postesFiltres = useMemo(() => postesPourCategorie(postes, categorie), [postes, categorie]);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  // Aide à la saisie (jamais un calcul métier) : TVA proposée depuis le HT au taux par défaut.
  const proposerTva = () => {
    if (!tvaDefaut || !/^\d+(\.\d{1,2})?$/.test(ht)) return;
    const centimesHt = BigInt(Math.round(Number(ht) * 100));
    const centimesTva = (centimesHt * BigInt(Math.round(Number(tvaDefaut) * 100))) / 10000n;
    setTva(`${centimesTva / 100n}.${String(centimesTva % 100n).padStart(2, "0")}`);
  };
  const ttcSuggere = /^\d+(\.\d{1,2})?$/.test(ht) && /^\d+(\.\d{1,2})?$/.test(tva)
    ? (() => {
        const c = BigInt(Math.round(Number(ht) * 100)) + BigInt(Math.round(Number(tva) * 100));
        return `${c / 100n}.${String(c % 100n).padStart(2, "0")}`;
      })()
    : undefined;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {depense ? <input type="hidden" name="depense_id" value={depense.id} /> : null}

      <Card>
        <SectionHeader title={d.libelle} />
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={d.libelle} htmlFor="libelle" required error={fieldError(state, "libelle")}>
              <Input id="libelle" name="libelle" required maxLength={200} defaultValue={depense?.libelle ?? ""} />
            </Field>
            <Field label={d.date} htmlFor="date_depense" required error={fieldError(state, "date_depense")}>
              <Input id="date_depense" name="date_depense" type="date" required dir="ltr" defaultValue={depense?.dateDepense.slice(0, 10) ?? aujourdhui} className="tnum text-start" />
            </Field>
            <Field label={d.categorie} htmlFor="categorie" required error={fieldError(state, "categorie")}>
              <Select id="categorie" name="categorie" required value={categorie} onChange={(ev) => setCategorie(ev.target.value as CategorieDepense)}>
                {(Object.keys(e.categorieDepense) as CategorieDepense[]).map((c) => (
                  <option key={c} value={c}>{e.categorieDepense[c]}</option>
                ))}
              </Select>
            </Field>
            <Field label={d.poste} htmlFor="budget_poste_id" hint={d.posteAide} optionalLabel={dict.common.optional} error={fieldError(state, "budget_poste_id")}>
              <Select id="budget_poste_id" name="budget_poste_id" defaultValue={depense?.budgetPosteId ?? ""}>
                <option value="">{d.horsPoste}</option>
                {postesFiltres.map((p) => (
                  <option key={p.id} value={p.id}>{p.libelle}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={d.description} htmlFor="description" optionalLabel={dict.common.optional}>
            <Textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={depense?.description ?? ""} />
          </Field>
          <Field label={d.prestataire} htmlFor="prestataire_id" optionalLabel={dict.common.optional} error={fieldError(state, "prestataire_id")}>
            <Select id="prestataire_id" name="prestataire_id" defaultValue={depense?.prestataireId ?? ""}>
              <option value="">{d.aucunPrestataire}</option>
              {prestataires.map((p) => (
                <option key={p.id} value={p.id}>{p.libelle}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title={d.montantTtc} subtitle={d.montantsAide} />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label={`${d.montantHt} (${dict.common.mad})`} htmlFor="montant_ht" optionalLabel={dict.common.optional} error={fieldError(state, "montant_ht")}>
            <Input id="montant_ht" name="montant_ht" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" value={ht} onChange={(ev) => setHt(ev.target.value)} onBlur={proposerTva} className="tnum text-start" />
          </Field>
          <Field label={`${d.tva} (${dict.common.mad})`} htmlFor="tva" hint={tvaDefaut ? fill(d.tvaDefaut, { taux: tvaDefaut }) : undefined} optionalLabel={dict.common.optional} error={fieldError(state, "tva")}>
            <Input id="tva" name="tva" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" value={tva} onChange={(ev) => setTva(ev.target.value)} className="tnum text-start" />
          </Field>
          <Field label={`${d.montantTtc} (${dict.common.mad})`} htmlFor="montant_ttc" required error={fieldError(state, "montant_ttc")}>
            <Input id="montant_ttc" name="montant_ttc" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" required key={ttcSuggere ?? "libre"} defaultValue={ttcSuggere ?? depense?.montantTtc ?? ""} className="tnum text-start" />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title={d.source} subtitle={d.sourceAide} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={d.source} htmlFor="source" required error={fieldError(state, "source")}>
            <Select id="source" name="source" required value={source} onChange={(ev) => setSource(ev.target.value as SourceFinancement)}>
              {(Object.keys(e.sourceFinancement) as SourceFinancement[]).map((s) => (
                <option key={s} value={s}>{e.sourceFinancement[s]}</option>
              ))}
            </Select>
          </Field>
          <Field label={d.resolutionAg} htmlFor="resolution_ag_id" hint={d.resolutionAgAide} optionalLabel={source === "FONDS_RESERVE" ? undefined : dict.common.optional} error={fieldError(state, "resolution_ag_id")}>
            <Select id="resolution_ag_id" name="resolution_ag_id" defaultValue={depense?.resolutionAgId ?? ""}>
              <option value="">{dict.common.none}</option>
              {resolutions.map((r) => (
                <option key={r.id} value={r.id}>{r.libelle}</option>
              ))}
            </Select>
          </Field>
        </div>
        {source === "FONDS_RESERVE" && resolutions.length === 0 ? (
          <Banner variant="legal" className="mt-4">{d.sourceAide}</Banner>
        ) : null}
      </Card>

      {!depense ? (
        <Card>
          <SectionHeader title={d.facture} subtitle={d.fichierFacture} />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label={d.numeroFacture} htmlFor="facture_numero" optionalLabel={dict.common.optional}>
              <Input id="facture_numero" name="facture_numero" dir="ltr" maxLength={80} className="text-start" />
            </Field>
            <Field label={d.dateFacture} htmlFor="facture_date" optionalLabel={dict.common.optional}>
              <Input id="facture_date" name="facture_date" type="date" dir="ltr" className="tnum text-start" />
            </Field>
            <Field label={d.dateEcheance} htmlFor="facture_echeance" optionalLabel={dict.common.optional}>
              <Input id="facture_echeance" name="facture_echeance" type="date" dir="ltr" className="tnum text-start" />
            </Field>
          </div>
          <Field label={d.fichierFacture} htmlFor="facture_fichier" optionalLabel={dict.common.optional} error={fieldError(state, "facture_fichier")}>
            <Input id="facture_fichier" name="facture_fichier" type="file" accept="image/*,application/pdf" className="file:me-3 file:rounded-btn file:border-0 file:bg-action-tint file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-action" />
          </Field>
        </Card>
      ) : null}

      <FormAlert state={state} />
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={depense ? `/${locale}/finances/depenses/${depense.id}` : `/${locale}/finances/depenses`} variant="secondary">
          {dict.common.cancel}
        </ButtonLink>
        <SubmitButton>{depense ? dict.common.save : dict.common.create}</SubmitButton>
      </div>
    </form>
  );
}
