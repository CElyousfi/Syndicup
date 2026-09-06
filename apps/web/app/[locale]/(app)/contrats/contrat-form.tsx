"use client";

import { useActionState, useMemo, useState } from "react";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { Field, Input, Select, Textarea, Checkbox } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Banner } from "../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { BudgetPoste, ContratDetail, Periodicite, TypeContrat } from "../../../../lib/api/types";
import { creerContrat, modifierContrat } from "./actions";

export interface OptionRef { id: string; libelle: string }
const TYPES: TypeContrat[] = ["ASSURANCE_IMMEUBLE", "ASSURANCE_RC", "ASCENSEUR", "NETTOYAGE", "GARDIENNAGE", "JARDINAGE", "DERATISATION", "EAU", "ELECTRICITE", "INTERNET", "SYNDIC_PROFESSIONNEL", "TRAVAUX", "AUTRE"];
const PERIODICITES: Periodicite[] = ["MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PONCTUELLE"];

/** Formulaire de contrat (création + modification). Les assurances portent un bloc « police » ; les fichiers sont téléversés par l'action. */
export function ContratForm({ dict, locale, postes, prestataires, resolutions, seuilAg, contrat }: { dict: Dict; locale: Locale; postes: BudgetPoste[]; prestataires: OptionRef[]; resolutions: OptionRef[]; seuilAg: string | null; contrat?: ContratDetail }) {
  const [state, action] = useActionState(contrat ? modifierContrat : creerContrat, IDLE);
  const c = dict.contrats;
  const e = dict.enumsContrats;
  const [type, setType] = useState<TypeContrat>(contrat?.type ?? "NETTOYAGE");
  const [dateFin, setDateFin] = useState(contrat?.dateFin?.slice(0, 10) ?? "");
  const estAssurance = type.startsWith("ASSURANCE");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const postesTries = useMemo(() => postes.slice().sort((a, b) => a.ordre - b.ordre), [postes]);
  const det = contrat?.detailsAssuranceJson ?? null;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {contrat ? <input type="hidden" name="contrat_id" value={contrat.id} /> : null}
      <Card>
        <SectionHeader title={c.libelle} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={c.type} htmlFor="type" required error={fieldError(state, "type")}>
            <Select id="type" name="type" required value={type} onChange={(ev) => setType(ev.target.value as TypeContrat)}>
              {TYPES.map((t) => <option key={t} value={t}>{e.typeContrat[t]}</option>)}
            </Select>
          </Field>
          <Field label={c.libelle} htmlFor="libelle" required error={fieldError(state, "libelle")}>
            <Input id="libelle" name="libelle" required maxLength={200} defaultValue={contrat?.libelle ?? ""} />
          </Field>
          <Field label={c.reference} htmlFor="reference" hint={c.referenceAide} optionalLabel={dict.common.optional} error={fieldError(state, "reference")}>
            <Input id="reference" name="reference" maxLength={120} dir="ltr" defaultValue={contrat?.reference ?? ""} className="text-start" />
          </Field>
          <Field label={c.prestataire} htmlFor="prestataire_id" optionalLabel={dict.common.optional} error={fieldError(state, "prestataire_id")}>
            <Select id="prestataire_id" name="prestataire_id" defaultValue={contrat?.prestataireId ?? ""}>
              <option value="">{c.aucunPrestataire}</option>
              {prestataires.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label={c.notes} htmlFor="notes" optionalLabel={dict.common.optional}>
            <Textarea id="notes" name="notes" rows={3} maxLength={4000} defaultValue={contrat?.notes ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title={c.echeancier} subtitle={c.echeancierAide} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={c.dateDebut} htmlFor="date_debut" required error={fieldError(state, "date_debut")}>
            <Input id="date_debut" name="date_debut" type="date" required dir="ltr" defaultValue={contrat?.dateDebut.slice(0, 10) ?? aujourdhui} className="tnum text-start" />
          </Field>
          <Field label={c.dateFin} htmlFor="date_fin" hint={c.dateFinAide} optionalLabel={dict.common.optional} error={fieldError(state, "date_fin")}>
            <Input id="date_fin" name="date_fin" type="date" dir="ltr" value={dateFin} onChange={(ev) => setDateFin(ev.target.value)} className="tnum text-start" />
          </Field>
          <Field label={c.periodicite} htmlFor="periodicite" required error={fieldError(state, "periodicite")}>
            <Select id="periodicite" name="periodicite" required defaultValue={contrat?.periodicite ?? "MENSUELLE"}>
              {PERIODICITES.map((p) => <option key={p} value={p}>{e.periodicite[p]}</option>)}
            </Select>
          </Field>
          <Field label={`${c.montantPeriode} (${dict.common.mad})`} htmlFor="montant_periode" hint={c.montantPeriodeAide} optionalLabel={dict.common.optional} error={fieldError(state, "montant_periode")}>
            <Input id="montant_periode" name="montant_periode" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" defaultValue={contrat?.montantPeriode ?? ""} className="tnum text-start" />
          </Field>
          <Field label={c.preavis} htmlFor="preavis_jours" hint={c.preavisAide} optionalLabel={dict.common.optional} error={fieldError(state, "preavis_jours")}>
            <Input id="preavis_jours" name="preavis_jours" type="number" min={0} max={730} dir="ltr" defaultValue={contrat?.preavisJours ?? ""} className="tnum text-start" />
          </Field>
          <div className="flex items-end pb-1">
            <Checkbox name="tacite" label={c.tacite} hint={c.taciteAide} defaultChecked={contrat?.tacite ?? false} disabled={dateFin === ""} />
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title={c.poste} subtitle={c.posteAide} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={c.poste} htmlFor="budget_poste_id" optionalLabel={dict.common.optional} error={fieldError(state, "budget_poste_id")}>
            <Select id="budget_poste_id" name="budget_poste_id" defaultValue={contrat?.budgetPosteId ?? ""}>
              <option value="">{c.horsPoste}</option>
              {postesTries.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </Select>
          </Field>
          <Field label={c.resolutionAg} htmlFor="resolution_ag_id" hint={seuilAg ? `${c.seuilAg} : ${seuilAg} ${dict.common.mad}` : c.seuilNonConfigure} optionalLabel={dict.common.optional} error={fieldError(state, "resolution_ag_id")}>
            <Select id="resolution_ag_id" name="resolution_ag_id" defaultValue={contrat?.resolutionAgId ?? ""}>
              <option value="">{dict.common.none}</option>
              {resolutions.map((r) => <option key={r.id} value={r.id}>{r.libelle}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      {estAssurance ? (
        <Card>
          <SectionHeader title={c.assurance} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={c.assureur} htmlFor="assureur" required error={fieldError(state, "details_assurance")}>
              <Input id="assureur" name="assureur" required maxLength={200} defaultValue={det?.assureur ?? ""} />
            </Field>
            <Field label={c.numeroPolice} htmlFor="numero_police" required>
              <Input id="numero_police" name="numero_police" required maxLength={100} dir="ltr" defaultValue={det?.numero_police ?? ""} className="text-start" />
            </Field>
            <Field label={`${c.franchise} (${dict.common.mad})`} htmlFor="franchise" optionalLabel={dict.common.optional}>
              <Input id="franchise" name="franchise" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" defaultValue={det?.franchise ?? ""} className="tnum text-start" />
            </Field>
            <Field label={`${c.capitalAssure} (${dict.common.mad})`} htmlFor="capital_assure" optionalLabel={dict.common.optional}>
              <Input id="capital_assure" name="capital_assure" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" defaultValue={det?.capital_assure ?? ""} className="tnum text-start" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label={c.garanties} htmlFor="garanties" hint={c.garantiesAide} optionalLabel={dict.common.optional}>
              <Textarea id="garanties" name="garanties" rows={3} defaultValue={(det?.garanties ?? []).join("\n")} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label={c.attestation} htmlFor="attestation_fichier" hint={c.attestationAide} optionalLabel={dict.common.optional} error={fieldError(state, "attestation_fichier")}>
              <Input id="attestation_fichier" name="attestation_fichier" type="file" accept="image/*,application/pdf" />
            </Field>
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title={c.documentSigne} subtitle={c.documentSigneAide} />
        <div className="mt-4">
          <Field label={c.documentSigne} htmlFor="document_fichier" optionalLabel={dict.common.optional} error={fieldError(state, "document_fichier")}>
            <Input id="document_fichier" name="document_fichier" type="file" accept="image/*,application/pdf" />
          </Field>
          {contrat?.document ? <p className="mt-2 text-[12px] text-soft">{contrat.document.nom}</p> : null}
        </div>
      </Card>

      {!contrat ? <Banner variant="info">{c.nouveauAide}</Banner> : null}
      <FormAlert state={state} />
      <div className="flex justify-end"><SubmitButton>{contrat ? dict.common.save : c.nouveau}</SubmitButton></div>
    </form>
  );
}
