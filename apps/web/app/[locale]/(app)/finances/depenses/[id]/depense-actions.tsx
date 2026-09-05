"use client";

import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../../../components/ui/modal";
import { Field, Input, Select, Textarea } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Button } from "../../../../../../components/ui/button";
import { IDLE, fieldError, type FormState } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import type { DepenseDetail, StatutFacture } from "../../../../../../lib/api/types";
import { formatMAD } from "../../../../../../lib/format";
import { IconCamera, IconPlus } from "../../../../../../components/ui/icons";
import { soumettreDepense, approuverDepense, rejeterDepense, payerDepense, annulerDepense, ajouterFacture, changerStatutFacture } from "../actions";

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button>
      <SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton>
    </div>
  );
}

function Succes({ dict, message, onClose }: { dict: Dict; message: string; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-strong">{message}</p>
      <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>{dict.common.close}</Button></div>
    </div>
  );
}

type Props = { dict: Dict; locale: Locale; depense: DepenseDetail };

export function SoumettreModal({ dict, locale, depense }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(soumettreDepense, IDLE);
  const d = dict.depenses;
  return (
    <>
      <Button onClick={() => setOpen(true)}>{d.soumettre}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={d.soumettreTitre} subtitle={depense.libelle} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={d.soumise} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="depense_id" value={depense.id} />
            <p className="text-sm text-body">{d.soumettreCorps}</p>
            {depense.seuil_non_configure ? <p className="text-[13px] text-soft">{d.seuilNonConfigureCorps}</p> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={d.soumettre} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function DeciderModals({ dict, locale, depense }: Props) {
  const [open, setOpen] = useState<null | "approuver" | "rejeter">(null);
  const [stateA, actionA] = useActionState(approuverDepense, IDLE);
  const [stateR, actionR] = useActionState(rejeterDepense, IDLE);
  const d = dict.depenses;
  const montant = formatMAD(depense.montantTtc, locale);
  return (
    <>
      <Button onClick={() => setOpen("approuver")}>{d.approuver}</Button>
      <Button variant="dangerGhost" onClick={() => setOpen("rejeter")}>{d.rejeter}</Button>
      <Modal open={open === "approuver"} onClose={() => setOpen(null)} title={d.approuverTitre} subtitle={depense.libelle} closeLabel={dict.common.close}>
        {stateA.status === "success" ? <Succes dict={dict} message={d.approuvee} onClose={() => setOpen(null)} /> : (
          <form action={actionA} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="depense_id" value={depense.id} />
            <p className="text-sm text-body">{fill(d.approuverCorps, { libelle: depense.libelle, montant })}</p>
            <FormAlert state={stateA} />
            <Pied dict={dict} onCancel={() => setOpen(null)} label={d.approuver} />
          </form>
        )}
      </Modal>
      <Modal open={open === "rejeter"} onClose={() => setOpen(null)} title={d.rejeterTitre} subtitle={depense.libelle} closeLabel={dict.common.close}>
        {stateR.status === "success" ? <Succes dict={dict} message={d.rejetee} onClose={() => setOpen(null)} /> : (
          <form action={actionR} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="depense_id" value={depense.id} />
            <Field label={d.rejeterMotif} htmlFor="motif_rejet" hint={d.rejeterMotifAide} required error={fieldError(stateR, "motif")}>
              <Textarea id="motif_rejet" name="motif" rows={3} required maxLength={1000} />
            </Field>
            <FormAlert state={stateR} />
            <Pied dict={dict} onCancel={() => setOpen(null)} label={d.rejeter} danger />
          </form>
        )}
      </Modal>
    </>
  );
}

export function PayerModal({ dict, locale, depense }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(payerDepense, IDLE);
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  const [methode, setMethode] = useState<"VIREMENT" | "CHEQUE" | "ESPECES">("VIREMENT");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{d.payer}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={d.payerTitre} subtitle={`${depense.libelle} · ${formatMAD(depense.montantTtc, locale)}`} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <Succes dict={dict} message={`${d.payee}${(state as Extract<FormState, { status: "success" }>).data && (state.data as { source?: string }).source === "FONDS_RESERVE" ? ` ${d.payeeReserve}` : ""}`} onClose={() => setOpen(false)} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="depense_id" value={depense.id} />
            <p className="text-sm text-body">{d.payerCorps}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={d.methode} htmlFor="methode" required>
                <Select id="methode" name="methode" required value={methode} onChange={(ev) => setMethode(ev.target.value as typeof methode)}>
                  {(Object.keys(e.methodePaiementDepense) as Array<keyof typeof e.methodePaiementDepense>).map((m) => (
                    <option key={m} value={m}>{e.methodePaiementDepense[m]}</option>
                  ))}
                </Select>
              </Field>
              <Field label={d.datePaiement} htmlFor="date_paiement" required error={fieldError(state, "date_paiement")}>
                <Input id="date_paiement" name="date_paiement" type="date" required dir="ltr" defaultValue={aujourdhui} className="tnum text-start" />
              </Field>
            </div>
            <Field label={d.reference} htmlFor="reference" hint={d.referenceAide} required={methode !== "ESPECES"} optionalLabel={methode === "ESPECES" ? dict.common.optional : undefined} error={fieldError(state, "reference")}>
              <Input id="reference" name="reference" dir="ltr" required={methode !== "ESPECES"} maxLength={120} className="text-start" />
            </Field>
            <Field label={d.justificatif} htmlFor="justificatif" hint={d.justificatifAide} optionalLabel={dict.common.optional} error={fieldError(state, "justificatif")}>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink hover:bg-hover">
                  <IconCamera width={16} height={16} />
                  {d.prendrePhoto}
                  <input type="file" name="justificatif" accept="image/*" capture="environment" className="sr-only" />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink hover:bg-hover">
                  <IconPlus width={16} height={16} />
                  {d.choisirFichier}
                  <input id="justificatif" type="file" name="justificatif" accept="image/*,application/pdf" className="sr-only" />
                </label>
              </div>
            </Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={d.payer} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function AnnulerModal({ dict, locale, depense }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(annulerDepense, IDLE);
  const d = dict.depenses;
  return (
    <>
      <Button variant="dangerGhost" onClick={() => setOpen(true)}>{d.annuler}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={d.annulerTitre} subtitle={depense.libelle} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={d.annulee} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="depense_id" value={depense.id} />
            <IrreversibleNotice>{d.annulerCorps}</IrreversibleNotice>
            <Field label={d.annulerMotif} htmlFor="motif_annulation">
              <Textarea id="motif_annulation" name="motif" rows={2} maxLength={1000} />
            </Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={d.annuler} danger />
          </form>
        )}
      </Modal>
    </>
  );
}

export function AjouterFactureModal({ dict, locale, depense }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(ajouterFacture, IDLE);
  const d = dict.depenses;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={16} height={16} />
        {d.ajouterFacture}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={d.ajouterFacture} subtitle={depense.libelle} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={d.factureAjoutee} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="depense_id" value={depense.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={d.numeroFacture} htmlFor="f_numero" optionalLabel={dict.common.optional}>
                <Input id="f_numero" name="numero" dir="ltr" maxLength={80} className="text-start" />
              </Field>
              <Field label={`${d.montantTtc} (${dict.common.mad})`} htmlFor="f_montant" required error={fieldError(state, "montant_ttc")}>
                <Input id="f_montant" name="montant_ttc" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" required defaultValue={depense.montantTtc} className="tnum text-start" />
              </Field>
              <Field label={d.dateFacture} htmlFor="f_date" required error={fieldError(state, "date_facture")}>
                <Input id="f_date" name="date_facture" type="date" required dir="ltr" defaultValue={depense.dateDepense.slice(0, 10)} className="tnum text-start" />
              </Field>
              <Field label={d.dateEcheance} htmlFor="f_echeance" optionalLabel={dict.common.optional} error={fieldError(state, "date_echeance")}>
                <Input id="f_echeance" name="date_echeance" type="date" dir="ltr" className="tnum text-start" />
              </Field>
            </div>
            <Field label={d.fichierFacture} htmlFor="f_fichier" required error={fieldError(state, "fichier")}>
              <Input id="f_fichier" name="fichier" type="file" required accept="image/*,application/pdf" className="file:me-3 file:rounded-btn file:border-0 file:bg-action-tint file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-action" />
            </Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={dict.common.add} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function StatutFactureForm({ dict, locale, depenseId, factureId, statut }: { dict: Dict; locale: Locale; depenseId: string; factureId: string; statut: StatutFacture }) {
  const [state, action] = useActionState(changerStatutFacture, IDLE);
  const d = dict.depenses;
  const cibles: Array<{ statut: StatutFacture; label: string; variant?: "secondary" | "dangerGhost" | "ghost" }> = [];
  if (statut === "RECUE") cibles.push({ statut: "VERIFIEE", label: d.marquerVerifiee, variant: "secondary" });
  if (statut !== "CONTESTEE" && statut !== "REGLEE") cibles.push({ statut: "CONTESTEE", label: d.marquerContestee, variant: "dangerGhost" });
  if (statut === "CONTESTEE") cibles.push({ statut: "VERIFIEE", label: d.marquerVerifiee, variant: "secondary" });
  if (statut !== "REGLEE") cibles.push({ statut: "REGLEE", label: d.marquerReglee, variant: "ghost" });
  if (cibles.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {cibles.map((c) => (
        <form key={c.statut} action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="depense_id" value={depenseId} />
          <input type="hidden" name="facture_id" value={factureId} />
          <input type="hidden" name="statut" value={c.statut} />
          <SubmitButton variant={c.variant ?? "ghost"} size="sm">{c.label}</SubmitButton>
        </form>
      ))}
      {state.status === "error" ? <FormAlert state={state} /> : null}
    </div>
  );
}
