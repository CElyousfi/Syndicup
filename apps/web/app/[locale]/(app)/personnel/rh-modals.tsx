"use client";

import { useActionState } from "react";
import { ActionModal } from "../../../../components/ui/action-modal";
import { ConfirmAction } from "../../../../components/ui/confirm-action";
import { IrreversibleNotice } from "../../../../components/ui/irreversible-notice";
import { Field, Input, Select, Textarea } from "../../../../components/ui/field";
import { MoneyInput } from "../../../../components/ui/money-input";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button, ButtonLink } from "../../../../components/ui/button";
import { Banner } from "../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../lib/forms";
import { formKey, formValue } from "../../../../lib/form-values";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import type { Conge, FichePaie, PersonnelRh, PostePersonnel, StatutPersonnel, StatutPresence, TypeConge, TypeContratTravail } from "../../../../lib/api/types";
import { formatDate, formatMAD } from "../../../../lib/format";
import { IconPlus } from "../../../../components/ui/icons";
import { modifierDossier, lireCnss, preparerFiche, validerFiche, payerFiche, demanderConge, deciderConge, annulerConge, saisirPresences, pointer, evaluer } from "./rh-actions";

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onCancel}>{danger ? dict.common.close : dict.common.cancel}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}
const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;
const POSTES: PostePersonnel[] = ["GARDIEN", "AGENT_ENTRETIEN", "JARDINIER", "AGENT_SECURITE", "AUTRE"];
const CONTRATS: TypeContratTravail[] = ["CDI", "CDD", "ANAPEC", "STAGE", "AUTRE"];
const STATUTS: StatutPersonnel[] = ["PRE_EMBAUCHE", "PRESENT", "ABSENT", "REMPLACE", "PARTI"];

export function DossierModal({ dict, locale, personnel, loges }: { dict: Dict; locale: Locale; personnel: PersonnelRh; loges: { id: string; numero: string }[] }) {
  const pe = dict.personnel;
  const e = dict.enumsPersonnelRh;
  const h = personnel.horairesJson ?? {};
  return (
    <ActionModal
      action={modifierDossier}
      title={pe.modifierDossier}
      wide
      closeLabel={dict.common.close}
      success={{ message: pe.dossierMaj }}
      trigger={(open) => <Button variant="secondary" onClick={open}>{pe.modifierDossier}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={personnel.id} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={pe.poste} htmlFor="poste" required error={fieldError(state, "poste")}><Select key={formKey(state, "poste")} id="poste" name="poste" defaultValue={formValue(state, "poste", personnel.poste)}>{POSTES.map((p) => <option key={p} value={p}>{e.poste[p]}</option>)}</Select></Field>
            <Field label={pe.statut} htmlFor="statut" hint={pe.departAide} error={fieldError(state, "statut")}><Select key={formKey(state, "statut")} id="statut" name="statut" defaultValue={formValue(state, "statut", personnel.statut)}>{STATUTS.map((s) => <option key={s} value={s}>{dict.enums.statutPersonnel[s]}</option>)}</Select></Field>
            <Field label={pe.logement} htmlFor="logement_lot_id" error={fieldError(state, "logement_lot_id")}><Select key={formKey(state, "logement_lot_id")} id="logement_lot_id" name="logement_lot_id" defaultValue={formValue(state, "logement_lot_id", personnel.logementLotId ?? "__none__")}><option value="__none__">{pe.aucuneLoge}</option>{loges.map((l) => <option key={l.id} value={l.id}>{l.numero}</option>)}</Select></Field>
            <Field label={pe.typeContrat} htmlFor="type_contrat" optionalLabel={dict.common.optional} error={fieldError(state, "type_contrat")}><Select key={formKey(state, "type_contrat")} id="type_contrat" name="type_contrat" defaultValue={formValue(state, "type_contrat", personnel.typeContrat ?? "")}><option value="">{dict.common.none}</option>{CONTRATS.map((c) => <option key={c} value={c}>{e.typeContratTravail[c]}</option>)}</Select></Field>
            <Field label={pe.dateEmbauche} htmlFor="date_embauche" optionalLabel={dict.common.optional} error={fieldError(state, "date_embauche")}><Input id="date_embauche" name="date_embauche" type="date" dir="ltr" defaultValue={formValue(state, "date_embauche", personnel.dateEmbauche?.slice(0, 10) ?? "")} className="tnum text-start" /></Field>
            <Field label={pe.dateFinContrat} htmlFor="date_fin_contrat" optionalLabel={dict.common.optional} error={fieldError(state, "date_fin_contrat")}><Input id="date_fin_contrat" name="date_fin_contrat" type="date" dir="ltr" defaultValue={formValue(state, "date_fin_contrat", personnel.dateFinContrat?.slice(0, 10) ?? "")} className="tnum text-start" /></Field>
            <Field label={`${pe.salaireBrut} (${dict.common.mad})`} htmlFor="salaire_brut_mensuel" optionalLabel={dict.common.optional} error={fieldError(state, "salaire_brut_mensuel")}><MoneyInput id="salaire_brut_mensuel" name="salaire_brut_mensuel" invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(state, "salaire_brut_mensuel", personnel.salaireBrutMensuel ?? "")} /></Field>
            {/* N° CNSS : donnée sensible, jamais renvoyée au navigateur après un échec. */}
            <Field label={pe.cnss} htmlFor="numero_cnss" hint={personnel.numeroCnssMasque ?? pe.cnssNonRenseigne} optionalLabel={dict.common.optional} error={fieldError(state, "numero_cnss")}><Input id="numero_cnss" name="numero_cnss" inputMode="numeric" dir="ltr" pattern="\d{6,12}" placeholder="••••" className="tnum text-start" /></Field>
            <Field label={pe.contactUrgence} htmlFor="contact_urgence" optionalLabel={dict.common.optional} error={fieldError(state, "contact_urgence")}><Input id="contact_urgence" name="contact_urgence" defaultValue={formValue(state, "contact_urgence", personnel.contactUrgence ?? "")} /></Field>
          </div>
          <div>
            <p className="text-sm font-medium text-ink-strong">{pe.horaires}</p>
            <p className="mb-2 text-[12px] text-soft">{pe.horairesAide}</p>
            <div className="grid gap-1.5">
              {JOURS.map((j) => (
                <div key={j} className="grid grid-cols-5 items-center gap-2 text-[13px]">
                  <span className="text-body">{e.jour[j]}</span>
                  {[1, 2].map((i) => (
                    <div key={i} className="col-span-2 flex items-center gap-1">
                      <Input name={`${j}_debut_${i}`} type="time" dir="ltr" defaultValue={formValue(state, `${j}_debut_${i}`, h[j]?.[i - 1]?.debut ?? "")} className="!h-9 tnum text-start" />
                      <span className="icon-flip text-faint">→</span>
                      <Input name={`${j}_fin_${i}`} type="time" dir="ltr" defaultValue={formValue(state, `${j}_fin_${i}`, h[j]?.[i - 1]?.fin ?? "")} className="!h-9 tnum text-start" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <Field label={pe.contratTravail} htmlFor="contrat_fichier" hint={pe.contratTravailAide} optionalLabel={dict.common.optional} error={fieldError(state, "contrat_fichier")}><Input id="contrat_fichier" name="contrat_fichier" type="file" accept="image/*,application/pdf" /></Field>
          <Field label={pe.notes} htmlFor="notes" optionalLabel={dict.common.optional} error={fieldError(state, "notes")}><Textarea id="notes" name="notes" rows={2} maxLength={4000} defaultValue={formValue(state, "notes", personnel.notes ?? "")} /></Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={dict.common.save} />
        </form>
      )}
    </ActionModal>
  );
}

export function CnssButton({ dict, personnelId }: { dict: Dict; personnelId: string }) {
  const [state, action] = useActionState(lireCnss, IDLE);
  const pe = dict.personnel;
  if (state.status === "success") return <span className="tnum font-mono text-sm text-ink" dir="ltr">{(state.data as { numero_cnss: string | null }).numero_cnss ?? pe.cnssNonRenseigne}</span>;
  return <form action={action} className="inline-flex items-center gap-2"><input type="hidden" name="personnel_id" value={personnelId} /><SubmitButton variant="secondary" size="sm">{pe.cnssAfficher}</SubmitButton>{state.status === "error" ? <FormAlert state={state} /> : null}</form>;
}

export function PreparerFicheModal({ dict, locale, personnel, periodeDefaut }: { dict: Dict; locale: Locale; personnel: PersonnelRh; periodeDefaut: string }) {
  const pe = dict.personnel;
  return (
    <ActionModal
      action={preparerFiche}
      title={pe.preparerFicheTitre}
      closeLabel={dict.common.close}
      success={{ message: pe.fichePreparee, illustration: "ok-general" }}
      trigger={(open) => <Button onClick={open}><IconPlus width={16} height={16} />{pe.preparerFiche}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={personnel.id} />
          <p className="text-sm text-body">{pe.preparerFicheAide}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={pe.periode} htmlFor="periode" required error={fieldError(state, "periode")}><Input id="periode" name="periode" type="month" required dir="ltr" defaultValue={formValue(state, "periode", periodeDefaut)} className="tnum text-start" /></Field>
            <Field label={`${pe.brut} (${dict.common.mad})`} htmlFor="brut" hint={personnel.salaireBrutMensuel ?? undefined} optionalLabel={dict.common.optional} error={fieldError(state, "brut")}><MoneyInput id="brut" name="brut" invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(state, "brut", personnel.salaireBrutMensuel ?? "")} /></Field>
            <Field label={`${pe.primes} (${dict.common.mad})`} htmlFor="primes" optionalLabel={dict.common.optional} error={fieldError(state, "primes")}><MoneyInput id="primes" name="primes" invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(state, "primes")} /></Field>
            <Field label={`${pe.retenues} (${dict.common.mad})`} htmlFor="retenues" optionalLabel={dict.common.optional} error={fieldError(state, "retenues")}><MoneyInput id="retenues" name="retenues" invalidMessage={dict.formulaires.montantInvalide} defaultValue={formValue(state, "retenues")} /></Field>
            <Field label={pe.joursAbsence} htmlFor="jours_absence_injustifiee" hint={pe.joursAbsenceAide} optionalLabel={dict.common.optional} error={fieldError(state, "jours_absence_injustifiee")}><Input id="jours_absence_injustifiee" name="jours_absence_injustifiee" type="number" min={0} max={31} dir="ltr" className="tnum text-start" defaultValue={formValue(state, "jours_absence_injustifiee")} /></Field>
          </div>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={pe.preparerFiche} />
        </form>
      )}
    </ActionModal>
  );
}

export function ValiderFicheModal({ dict, locale, fiche }: { dict: Dict; locale: Locale; fiche: FichePaie }) {
  const pe = dict.personnel;
  return (
    <ActionModal
      action={validerFiche}
      title={pe.validerFicheTitre}
      subtitle={`${fiche.periode} · ${formatMAD(fiche.net, locale)}`}
      closeLabel={dict.common.close}
      success={{
        message: pe.ficheValidee,
        next: (close, s) => {
          const depenseId = (s.data as { depense_id?: string } | undefined)?.depense_id;
          return depenseId ? <SuccesDepense dict={dict} href={`/${locale}/finances/depenses/${depenseId}`} onClick={close} /> : null;
        },
      }}
      trigger={(open) => <Button size="sm" onClick={open}>{pe.validerFiche}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={fiche.personnelId} /><input type="hidden" name="fiche_id" value={fiche.id} />
          <IrreversibleNotice>{pe.validerFicheCorps}</IrreversibleNotice>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={pe.validerFiche} />
        </form>
      )}
    </ActionModal>
  );
}

/** Lien vers la dépense de paie créée à la validation (renvoyé par l'action). */
function SuccesDepense({ dict, href, onClick }: { dict: Dict; href: string; onClick: () => void }) {
  return (
    <ButtonLink href={href} onClick={onClick}>
      {dict.personnel.voirDepense}
    </ButtonLink>
  );
}

export function PayerFicheModal({ dict, locale, fiche }: { dict: Dict; locale: Locale; fiche: FichePaie }) {
  const pe = dict.personnel;
  const d = dict.depenses;
  return (
    <ActionModal
      action={payerFiche}
      title={pe.payerFicheTitre}
      subtitle={`${fiche.periode} · ${formatMAD(fiche.net, locale)}`}
      closeLabel={dict.common.close}
      success={{ message: pe.fichePayee, illustration: "ok-paiement", moment: "payment" }}
      trigger={(open) => <Button size="sm" onClick={open}>{pe.payerFiche}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={fiche.personnelId} /><input type="hidden" name="fiche_id" value={fiche.id} />
          <p className="text-sm text-body">{pe.payerFicheCorps}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={d.methode} htmlFor="methode" required error={fieldError(state, "methode")}><Select key={formKey(state, "methode")} id="methode" name="methode" defaultValue={formValue(state, "methode", "VIREMENT")}>{(["VIREMENT", "CHEQUE", "ESPECES"] as const).map((m) => <option key={m} value={m}>{dict.enumsDepenses.methodePaiementDepense[m]}</option>)}</Select></Field>
            <Field label={d.datePaiement} htmlFor="date_paiement" required error={fieldError(state, "date_paiement")}><Input id="date_paiement" name="date_paiement" type="date" required dir="ltr" defaultValue={formValue(state, "date_paiement", new Date().toISOString().slice(0, 10))} className="tnum text-start" /></Field>
            <Field label={d.reference} htmlFor="reference" optionalLabel={dict.common.optional} error={fieldError(state, "reference")}><Input id="reference" name="reference" dir="ltr" className="text-start" defaultValue={formValue(state, "reference")} /></Field>
            <Field label={dict.justificatifs.preuve} htmlFor="preuve" optionalLabel={dict.common.optional} error={fieldError(state, "preuve")}><Input id="preuve" name="preuve" type="file" accept="image/*,application/pdf" /></Field>
          </div>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={pe.payerFiche} />
        </form>
      )}
    </ActionModal>
  );
}

export function DemanderCongeModal({ dict, locale, personnelId, remplacants, auNom }: { dict: Dict; locale: Locale; personnelId?: string; remplacants: { id: string; nom: string }[]; auNom: boolean }) {
  const pe = dict.personnel;
  const types: TypeConge[] = ["ANNUEL", "MALADIE", "SANS_SOLDE", "EXCEPTIONNEL"];
  return (
    <ActionModal
      action={demanderConge}
      title={pe.demanderCongeTitre}
      closeLabel={dict.common.close}
      success={{ message: pe.congeDemande, illustration: "ok-general" }}
      trigger={(open) => <Button variant={auNom ? "secondary" : "primary"} onClick={open}><IconPlus width={16} height={16} />{pe.demanderConge}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />{personnelId ? <input type="hidden" name="personnel_id" value={personnelId} /> : null}
          <p className="text-sm text-body">{pe.demanderCongeAide}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={pe.typeConge} htmlFor="type_conge" required error={fieldError(state, "type")}><Select key={formKey(state, "type")} id="type_conge" name="type" defaultValue={formValue(state, "type", "ANNUEL")}>{types.map((t) => <option key={t} value={t}>{dict.enumsPersonnelRh.typeConge[t]}</option>)}</Select></Field>
            <Field label={pe.nbJours} htmlFor="nb_jours" optionalLabel={dict.common.optional} error={fieldError(state, "nb_jours")}><Input id="nb_jours" name="nb_jours" inputMode="decimal" dir="ltr" pattern="\d{1,3}([.,]5)?" className="tnum text-start" defaultValue={formValue(state, "nb_jours")} /></Field>
            <Field label={pe.dateDebut} htmlFor="date_debut" required error={fieldError(state, "date_debut")}><Input id="date_debut" name="date_debut" type="date" required dir="ltr" className="tnum text-start" defaultValue={formValue(state, "date_debut")} /></Field>
            <Field label={pe.dateFin} htmlFor="date_fin" required error={fieldError(state, "date_fin")}><Input id="date_fin" name="date_fin" type="date" required dir="ltr" className="tnum text-start" defaultValue={formValue(state, "date_fin")} /></Field>
          </div>
          <Field label={pe.motif} htmlFor="motif" optionalLabel={dict.common.optional} error={fieldError(state, "motif")}><Textarea id="motif" name="motif" rows={2} maxLength={1000} defaultValue={formValue(state, "motif")} /></Field>
          {auNom && remplacants.length ? <Field label={pe.remplacant} htmlFor="remplacant_personnel_id" optionalLabel={dict.common.optional}><Select key={formKey(state, "remplacant_personnel_id")} id="remplacant_personnel_id" name="remplacant_personnel_id" defaultValue={formValue(state, "remplacant_personnel_id")}><option value="">{pe.aucunRemplacant}</option>{remplacants.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</Select></Field> : null}
          <Field label={pe.certificat} htmlFor="certificat" optionalLabel={dict.common.optional} error={fieldError(state, "certificat")}><Input id="certificat" name="certificat" type="file" accept="image/*,application/pdf" /></Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={pe.demanderConge} />
        </form>
      )}
    </ActionModal>
  );
}

export function DeciderCongeButtons({ dict, locale, conge, remplacants }: { dict: Dict; locale: Locale; conge: Conge; remplacants: { id: string; nom: string }[] }) {
  const pe = dict.personnel;
  const sous = `${conge.personnel.nom ?? ""} · ${formatDate(conge.dateDebut, locale)} → ${formatDate(conge.dateFin, locale)} · ${conge.nbJours} j`;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <ActionModal
        action={deciderConge}
        title={pe.approuverConge}
        subtitle={sous}
        closeLabel={dict.common.close}
        success={{ message: pe.congeApprouve, closeAndToast: true }}
        trigger={(open) => <Button size="sm" onClick={open}>{pe.approuverConge}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="conge_id" value={conge.id} /><input type="hidden" name="decision" value="approuver" />
            <Field label={pe.remplacant} htmlFor="remplacant_personnel_id" optionalLabel={dict.common.optional} error={fieldError(state, "remplacant_personnel_id")}><Select key={formKey(state, "remplacant_personnel_id")} id="remplacant_personnel_id" name="remplacant_personnel_id" defaultValue={formValue(state, "remplacant_personnel_id", conge.remplacant?.id ?? "")}><option value="">{pe.aucunRemplacant}</option>{remplacants.filter((r) => r.id !== conge.personnelId).map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</Select></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={pe.approuverConge} />
          </form>
        )}
      </ActionModal>
      <ActionModal
        action={deciderConge}
        title={pe.refuserCongeTitre}
        subtitle={sous}
        closeLabel={dict.common.close}
        success={{ message: pe.congeRefuse, closeAndToast: true }}
        trigger={(open) => <Button size="sm" variant="dangerGhost" onClick={open}>{pe.refuserConge}</Button>}
      >
        {({ state, formAction, close }) => (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="conge_id" value={conge.id} /><input type="hidden" name="decision" value="refuser" />
            <Field label={pe.motifRefus} htmlFor="motif_refus" required error={fieldError(state, "motif_refus")}><Textarea id="motif_refus" name="motif_refus" rows={3} required maxLength={1000} defaultValue={formValue(state, "motif_refus")} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={close} label={pe.refuserConge} danger />
          </form>
        )}
      </ActionModal>
    </div>
  );
}

/** Annuler sa demande — confirmée : la demande annulée ne se rétablit pas (historique RH). */
export function AnnulerCongeBouton({ dict, locale, congeId, debut, fin }: { dict: Dict; locale: Locale; congeId: string; debut?: string; fin?: string }) {
  const pe = dict.personnel;
  const f = dict.formulaires.confirmer;
  return (
    <ConfirmAction
      action={annulerConge}
      fields={{ locale, conge_id: congeId }}
      triggerLabel={pe.annulerConge}
      title={f.congeAnnulerTitre}
      question={debut && fin ? fill(f.congeAnnulerQuestion, { debut: formatDate(debut, locale), fin: formatDate(fin, locale) }) : undefined}
      consequence={f.congeAnnulerConsequence}
      irreversible
      confirmLabel={f.congeAnnulerConfirmer}
      closeLabel={dict.common.close}
      success={pe.congeAnnule}
    />
  );
}

export function PresencesForm({ dict, locale, personnelId, jours, existantes }: { dict: Dict; locale: Locale; personnelId: string; jours: string[]; existantes: Record<string, StatutPresence> }) {
  const [state, action] = useActionState(saisirPresences, IDLE);
  const pe = dict.personnel;
  const statuts: StatutPresence[] = ["PRESENT", "ABSENT", "CONGE", "MALADIE"];
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={personnelId} />
      <p className="text-[13px] text-soft">{pe.saisirPresencesAide}</p>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {jours.map((j) => (
          <label key={j} className="flex items-center justify-between gap-2 rounded-[14px] bg-surface px-3 py-1.5 text-[13px]">
            <span className="tnum text-body">{formatDate(j, locale)}</span>
            <Select key={formKey(state, `p_${j}`)} name={`p_${j}`} defaultValue={formValue(state, `p_${j}`, existantes[j] ?? "")} className="!h-8 w-auto !appearance-auto !rounded-full !px-2.5 !text-[12.5px] font-medium">
              <option value="">—</option>
              {statuts.map((s) => <option key={s} value={s}>{dict.enumsPersonnelRh.statutPresence[s]}</option>)}
            </Select>
          </label>
        ))}
      </div>
      <FormAlert state={state} />
      <div className="flex items-center justify-end gap-3">{state.status === "success" ? <span className="text-[13px] font-semibold text-ok">{pe.presencesEnregistrees}</span> : null}<SubmitButton>{pe.saisirPresences}</SubmitButton></div>
    </form>
  );
}

export function PointerBouton({ dict, locale, personnelId, dejaPointe }: { dict: Dict; locale: Locale; personnelId: string; dejaPointe: boolean }) {
  const [state, action] = useActionState(pointer, IDLE);
  const pe = dict.personnel;
  if (dejaPointe || state.status === "success") return <Banner variant="ok">{pe.pointe}</Banner>;
  return <form action={action} className="space-y-2"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={personnelId} /><SubmitButton>{pe.pointer}</SubmitButton>{state.status === "error" ? <FormAlert state={state} /> : null}</form>;
}

export function EvaluerModal({ dict, locale, personnelId, periodeDefaut }: { dict: Dict; locale: Locale; personnelId: string; periodeDefaut: string }) {
  const pe = dict.personnel;
  return (
    <ActionModal
      action={evaluer}
      title={pe.evaluerTitre}
      closeLabel={dict.common.close}
      success={{ message: pe.evalue }}
      trigger={(open) => <Button onClick={open}><IconPlus width={16} height={16} />{pe.evaluer}</Button>}
    >
      {({ state, formAction, close }) => (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={personnelId} />
          <p className="text-sm text-body">{pe.evaluerAide}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={pe.periode} htmlFor="periode_ev" required error={fieldError(state, "periode")}><Input id="periode_ev" name="periode" required dir="ltr" defaultValue={formValue(state, "periode", periodeDefaut)} className="tnum text-start" /></Field>
            <Field label={pe.note} htmlFor="note" required error={fieldError(state, "note")}><Select key={formKey(state, "note")} id="note" name="note" defaultValue={formValue(state, "note", "4")}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</Select></Field>
          </div>
          <Field label={pe.commentaire} htmlFor="commentaire_ev" optionalLabel={dict.common.optional} error={fieldError(state, "commentaire")}><Textarea id="commentaire_ev" name="commentaire" rows={3} maxLength={2000} defaultValue={formValue(state, "commentaire")} /></Field>
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={close} label={pe.evaluer} />
        </form>
      )}
    </ActionModal>
  );
}
