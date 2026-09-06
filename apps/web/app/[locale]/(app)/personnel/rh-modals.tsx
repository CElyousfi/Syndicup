"use client";

import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../components/ui/modal";
import { Field, Input, Select, Textarea } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Banner } from "../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { Conge, FichePaie, PersonnelRh, PostePersonnel, StatutPersonnel, StatutPresence, TypeConge, TypeContratTravail } from "../../../../lib/api/types";
import { formatDate, formatMAD } from "../../../../lib/format";
import { IconPlus } from "../../../../components/ui/icons";
import { modifierDossier, lireCnss, preparerFiche, validerFiche, payerFiche, demanderConge, deciderConge, annulerConge, saisirPresences, pointer, evaluer } from "./rh-actions";

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}
function Succes({ dict, message, onClose, lien }: { dict: Dict; message: string; onClose: () => void; lien?: { href: string; label: string } }) {
  return <div className="space-y-4"><p className="text-sm text-ink-strong">{message}</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{dict.common.close}</Button>{lien ? <a href={lien.href} className="inline-flex h-10 items-center rounded-btn bg-ink px-4 text-[13px] font-medium text-white">{lien.label}</a> : null}</div></div>;
}
const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;
const POSTES: PostePersonnel[] = ["GARDIEN", "AGENT_ENTRETIEN", "JARDINIER", "AGENT_SECURITE", "AUTRE"];
const CONTRATS: TypeContratTravail[] = ["CDI", "CDD", "ANAPEC", "STAGE", "AUTRE"];
const STATUTS: StatutPersonnel[] = ["PRE_EMBAUCHE", "PRESENT", "ABSENT", "REMPLACE", "PARTI"];

export function DossierModal({ dict, locale, personnel, loges }: { dict: Dict; locale: Locale; personnel: PersonnelRh; loges: { id: string; numero: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(modifierDossier, IDLE);
  const pe = dict.personnel;
  const e = dict.enumsPersonnelRh;
  const h = personnel.horairesJson ?? {};
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{pe.modifierDossier}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={pe.modifierDossier} wide closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={pe.dossierMaj} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={personnel.id} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={pe.poste} htmlFor="poste" required><Select id="poste" name="poste" defaultValue={personnel.poste}>{POSTES.map((p) => <option key={p} value={p}>{e.poste[p]}</option>)}</Select></Field>
              <Field label={pe.statut} htmlFor="statut" hint={pe.departAide}><Select id="statut" name="statut" defaultValue={personnel.statut}>{STATUTS.map((s) => <option key={s} value={s}>{dict.enums.statutPersonnel[s]}</option>)}</Select></Field>
              <Field label={pe.logement} htmlFor="logement_lot_id"><Select id="logement_lot_id" name="logement_lot_id" defaultValue={personnel.logementLotId ?? "__none__"}><option value="__none__">{pe.aucuneLoge}</option>{loges.map((l) => <option key={l.id} value={l.id}>{l.numero}</option>)}</Select></Field>
              <Field label={pe.typeContrat} htmlFor="type_contrat" optionalLabel={dict.common.optional}><Select id="type_contrat" name="type_contrat" defaultValue={personnel.typeContrat ?? ""}><option value="">{dict.common.none}</option>{CONTRATS.map((c) => <option key={c} value={c}>{e.typeContratTravail[c]}</option>)}</Select></Field>
              <Field label={pe.dateEmbauche} htmlFor="date_embauche" optionalLabel={dict.common.optional} error={fieldError(state, "date_embauche")}><Input id="date_embauche" name="date_embauche" type="date" dir="ltr" defaultValue={personnel.dateEmbauche?.slice(0, 10) ?? ""} className="tnum text-start" /></Field>
              <Field label={pe.dateFinContrat} htmlFor="date_fin_contrat" optionalLabel={dict.common.optional} error={fieldError(state, "date_fin_contrat")}><Input id="date_fin_contrat" name="date_fin_contrat" type="date" dir="ltr" defaultValue={personnel.dateFinContrat?.slice(0, 10) ?? ""} className="tnum text-start" /></Field>
              <Field label={`${pe.salaireBrut} (${dict.common.mad})`} htmlFor="salaire_brut_mensuel" optionalLabel={dict.common.optional} error={fieldError(state, "salaire_brut_mensuel")}><Input id="salaire_brut_mensuel" name="salaire_brut_mensuel" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" defaultValue={personnel.salaireBrutMensuel ?? ""} className="tnum text-start" /></Field>
              <Field label={pe.cnss} htmlFor="numero_cnss" hint={personnel.numeroCnssMasque ?? pe.cnssNonRenseigne} optionalLabel={dict.common.optional} error={fieldError(state, "numero_cnss")}><Input id="numero_cnss" name="numero_cnss" inputMode="numeric" dir="ltr" pattern="\d{6,12}" placeholder="••••" className="tnum text-start" /></Field>
              <Field label={pe.contactUrgence} htmlFor="contact_urgence" optionalLabel={dict.common.optional}><Input id="contact_urgence" name="contact_urgence" defaultValue={personnel.contactUrgence ?? ""} /></Field>
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
                        <Input name={`${j}_debut_${i}`} type="time" dir="ltr" defaultValue={h[j]?.[i - 1]?.debut ?? ""} className="!h-9 tnum text-start" />
                        <span className="text-faint">→</span>
                        <Input name={`${j}_fin_${i}`} type="time" dir="ltr" defaultValue={h[j]?.[i - 1]?.fin ?? ""} className="!h-9 tnum text-start" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <Field label={pe.contratTravail} htmlFor="contrat_fichier" hint={pe.contratTravailAide} optionalLabel={dict.common.optional}><Input id="contrat_fichier" name="contrat_fichier" type="file" accept="image/*,application/pdf" /></Field>
            <Field label={pe.notes} htmlFor="notes" optionalLabel={dict.common.optional}><Textarea id="notes" name="notes" rows={2} maxLength={4000} defaultValue={personnel.notes ?? ""} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={dict.common.save} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function CnssButton({ dict, personnelId }: { dict: Dict; personnelId: string }) {
  const [state, action] = useActionState(lireCnss, IDLE);
  const pe = dict.personnel;
  if (state.status === "success") return <span className="tnum font-mono text-sm text-ink" dir="ltr">{(state.data as { numero_cnss: string | null }).numero_cnss ?? pe.cnssNonRenseigne}</span>;
  return <form action={action} className="inline-flex items-center gap-2"><input type="hidden" name="personnel_id" value={personnelId} /><SubmitButton variant="secondary" size="sm">{pe.cnssAfficher}</SubmitButton>{state.status === "error" ? <FormAlert state={state} /> : null}</form>;
}

export function PreparerFicheModal({ dict, locale, personnel, periodeDefaut }: { dict: Dict; locale: Locale; personnel: PersonnelRh; periodeDefaut: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(preparerFiche, IDLE);
  const pe = dict.personnel;
  return (
    <>
      <Button onClick={() => setOpen(true)}><IconPlus width={16} height={16} />{pe.preparerFiche}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={pe.preparerFicheTitre} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={pe.fichePreparee} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={personnel.id} />
            <p className="text-sm text-body">{pe.preparerFicheAide}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={pe.periode} htmlFor="periode" required error={fieldError(state, "periode")}><Input id="periode" name="periode" type="month" required dir="ltr" defaultValue={periodeDefaut} className="tnum text-start" /></Field>
              <Field label={`${pe.brut} (${dict.common.mad})`} htmlFor="brut" hint={personnel.salaireBrutMensuel ?? undefined} optionalLabel={dict.common.optional} error={fieldError(state, "brut")}><Input id="brut" name="brut" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" defaultValue={personnel.salaireBrutMensuel ?? ""} className="tnum text-start" /></Field>
              <Field label={`${pe.primes} (${dict.common.mad})`} htmlFor="primes" optionalLabel={dict.common.optional}><Input id="primes" name="primes" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" className="tnum text-start" /></Field>
              <Field label={`${pe.retenues} (${dict.common.mad})`} htmlFor="retenues" optionalLabel={dict.common.optional}><Input id="retenues" name="retenues" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" className="tnum text-start" /></Field>
              <Field label={pe.joursAbsence} htmlFor="jours_absence_injustifiee" hint={pe.joursAbsenceAide} optionalLabel={dict.common.optional}><Input id="jours_absence_injustifiee" name="jours_absence_injustifiee" type="number" min={0} max={31} dir="ltr" className="tnum text-start" /></Field>
            </div>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={pe.preparerFiche} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function ValiderFicheModal({ dict, locale, fiche }: { dict: Dict; locale: Locale; fiche: FichePaie }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(validerFiche, IDLE);
  const pe = dict.personnel;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{pe.validerFiche}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={pe.validerFicheTitre} subtitle={`${fiche.periode} · ${formatMAD(fiche.net, locale)}`} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={pe.ficheValidee} onClose={() => setOpen(false)} lien={(state.data as { depense_id?: string })?.depense_id ? { href: `/${locale}/finances/depenses/${(state.data as { depense_id: string }).depense_id}`, label: pe.voirDepense } : undefined} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={fiche.personnelId} /><input type="hidden" name="fiche_id" value={fiche.id} />
            <IrreversibleNotice>{pe.validerFicheCorps}</IrreversibleNotice>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={pe.validerFiche} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function PayerFicheModal({ dict, locale, fiche }: { dict: Dict; locale: Locale; fiche: FichePaie }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(payerFiche, IDLE);
  const pe = dict.personnel;
  const d = dict.depenses;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{pe.payerFiche}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={pe.payerFicheTitre} subtitle={`${fiche.periode} · ${formatMAD(fiche.net, locale)}`} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={pe.fichePayee} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={fiche.personnelId} /><input type="hidden" name="fiche_id" value={fiche.id} />
            <p className="text-sm text-body">{pe.payerFicheCorps}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={d.methode} htmlFor="methode" required><Select id="methode" name="methode" defaultValue="VIREMENT">{(["VIREMENT", "CHEQUE", "ESPECES"] as const).map((m) => <option key={m} value={m}>{dict.enumsDepenses.methodePaiementDepense[m]}</option>)}</Select></Field>
              <Field label={d.datePaiement} htmlFor="date_paiement" required error={fieldError(state, "date_paiement")}><Input id="date_paiement" name="date_paiement" type="date" required dir="ltr" defaultValue={new Date().toISOString().slice(0, 10)} className="tnum text-start" /></Field>
              <Field label={d.reference} htmlFor="reference" optionalLabel={dict.common.optional} error={fieldError(state, "reference")}><Input id="reference" name="reference" dir="ltr" className="text-start" /></Field>
              <Field label={dict.justificatifs.preuve} htmlFor="preuve" optionalLabel={dict.common.optional}><Input id="preuve" name="preuve" type="file" accept="image/*,application/pdf" /></Field>
            </div>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={pe.payerFiche} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function DemanderCongeModal({ dict, locale, personnelId, remplacants, auNom }: { dict: Dict; locale: Locale; personnelId?: string; remplacants: { id: string; nom: string }[]; auNom: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(demanderConge, IDLE);
  const pe = dict.personnel;
  const types: TypeConge[] = ["ANNUEL", "MALADIE", "SANS_SOLDE", "EXCEPTIONNEL"];
  return (
    <>
      <Button variant={auNom ? "secondary" : "primary"} onClick={() => setOpen(true)}><IconPlus width={16} height={16} />{pe.demanderConge}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={pe.demanderCongeTitre} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={pe.congeDemande} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />{personnelId ? <input type="hidden" name="personnel_id" value={personnelId} /> : null}
            <p className="text-sm text-body">{pe.demanderCongeAide}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={pe.typeConge} htmlFor="type_conge" required><Select id="type_conge" name="type" defaultValue="ANNUEL">{types.map((t) => <option key={t} value={t}>{dict.enumsPersonnelRh.typeConge[t]}</option>)}</Select></Field>
              <Field label={pe.nbJours} htmlFor="nb_jours" optionalLabel={dict.common.optional}><Input id="nb_jours" name="nb_jours" inputMode="decimal" dir="ltr" pattern="\d{1,3}(\.5)?" className="tnum text-start" /></Field>
              <Field label={pe.dateDebut} htmlFor="date_debut" required error={fieldError(state, "date_debut")}><Input id="date_debut" name="date_debut" type="date" required dir="ltr" className="tnum text-start" /></Field>
              <Field label={pe.dateFin} htmlFor="date_fin" required error={fieldError(state, "date_fin")}><Input id="date_fin" name="date_fin" type="date" required dir="ltr" className="tnum text-start" /></Field>
            </div>
            <Field label={pe.motif} htmlFor="motif" optionalLabel={dict.common.optional}><Textarea id="motif" name="motif" rows={2} maxLength={1000} /></Field>
            {auNom && remplacants.length ? <Field label={pe.remplacant} htmlFor="remplacant_personnel_id" optionalLabel={dict.common.optional}><Select id="remplacant_personnel_id" name="remplacant_personnel_id" defaultValue=""><option value="">{pe.aucunRemplacant}</option>{remplacants.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</Select></Field> : null}
            <Field label={pe.certificat} htmlFor="certificat" optionalLabel={dict.common.optional}><Input id="certificat" name="certificat" type="file" accept="image/*,application/pdf" /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={pe.demanderConge} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function DeciderCongeButtons({ dict, locale, conge, remplacants }: { dict: Dict; locale: Locale; conge: Conge; remplacants: { id: string; nom: string }[] }) {
  const [open, setOpen] = useState<null | "approuver" | "refuser">(null);
  const [state, action] = useActionState(deciderConge, IDLE);
  const pe = dict.personnel;
  if (state.status === "success") return <span className="text-[12px] text-ok">{(state.data as { statut: string }).statut === "APPROUVE" ? pe.congeApprouve : pe.congeRefuse}</span>;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button size="sm" onClick={() => setOpen("approuver")}>{pe.approuverConge}</Button>
      <Button size="sm" variant="dangerGhost" onClick={() => setOpen("refuser")}>{pe.refuserConge}</Button>
      <Modal open={open !== null} onClose={() => setOpen(null)} title={open === "refuser" ? pe.refuserCongeTitre : pe.approuverConge} subtitle={`${conge.personnel.nom ?? ""} · ${formatDate(conge.dateDebut, locale)} → ${formatDate(conge.dateFin, locale)} · ${conge.nbJours} j`} closeLabel={dict.common.close}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="conge_id" value={conge.id} /><input type="hidden" name="decision" value={open ?? "approuver"} />
          {open === "refuser" ? <Field label={pe.motifRefus} htmlFor="motif_refus" required error={fieldError(state, "motif_refus")}><Textarea id="motif_refus" name="motif_refus" rows={3} required maxLength={1000} /></Field> : (
            <Field label={pe.remplacant} htmlFor="remplacant_personnel_id" optionalLabel={dict.common.optional}><Select id="remplacant_personnel_id" name="remplacant_personnel_id" defaultValue={conge.remplacant?.id ?? ""}><option value="">{pe.aucunRemplacant}</option>{remplacants.filter((r) => r.id !== conge.personnelId).map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</Select></Field>
          )}
          <FormAlert state={state} />
          <Pied dict={dict} onCancel={() => setOpen(null)} label={open === "refuser" ? pe.refuserConge : pe.approuverConge} danger={open === "refuser"} />
        </form>
      </Modal>
    </div>
  );
}

export function AnnulerCongeBouton({ dict, locale, congeId }: { dict: Dict; locale: Locale; congeId: string }) {
  const [state, action] = useActionState(annulerConge, IDLE);
  const pe = dict.personnel;
  if (state.status === "success") return <span className="text-[12px] text-soft">{pe.congeAnnule}</span>;
  return <form action={action} className="inline-flex flex-col items-end gap-1"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="conge_id" value={congeId} /><SubmitButton variant="dangerGhost" size="sm">{pe.annulerConge}</SubmitButton>{state.status === "error" ? <FormAlert state={state} /> : null}</form>;
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
          <label key={j} className="flex items-center justify-between gap-2 rounded-field border border-hairline px-2.5 py-1.5 text-[13px]">
            <span className="tnum text-body">{formatDate(j, locale)}</span>
            <select name={`p_${j}`} defaultValue={existantes[j] ?? ""} className="h-8 rounded-btn border border-hairline-strong bg-surface px-2 text-[12.5px]">
              <option value="">—</option>
              {statuts.map((s) => <option key={s} value={s}>{dict.enumsPersonnelRh.statutPresence[s]}</option>)}
            </select>
          </label>
        ))}
      </div>
      <FormAlert state={state} />
      <div className="flex items-center justify-end gap-3">{state.status === "success" ? <span className="text-[13px] text-ok">{pe.presencesEnregistrees}</span> : null}<SubmitButton>{pe.saisirPresences}</SubmitButton></div>
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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(evaluer, IDLE);
  const pe = dict.personnel;
  return (
    <>
      <Button onClick={() => setOpen(true)}><IconPlus width={16} height={16} />{pe.evaluer}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={pe.evaluerTitre} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={pe.evalue} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="personnel_id" value={personnelId} />
            <p className="text-sm text-body">{pe.evaluerAide}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={pe.periode} htmlFor="periode_ev" required error={fieldError(state, "periode")}><Input id="periode_ev" name="periode" required dir="ltr" defaultValue={periodeDefaut} className="tnum text-start" /></Field>
              <Field label={pe.note} htmlFor="note" required error={fieldError(state, "note")}><Select id="note" name="note" defaultValue="4">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</Select></Field>
            </div>
            <Field label={pe.commentaire} htmlFor="commentaire_ev" optionalLabel={dict.common.optional}><Textarea id="commentaire_ev" name="commentaire" rows={3} maxLength={2000} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={pe.evaluer} />
          </form>
        )}
      </Modal>
    </>
  );
}
