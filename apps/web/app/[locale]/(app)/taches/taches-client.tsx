"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Modal, IrreversibleNotice } from "../../../../components/ui/modal";
import { Field, Input, Select, Textarea, Checkbox } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import type { ChecklistItem, PrioriteTache, StatutTache, TacheDetail } from "../../../../lib/api/types";
import { IconPlus } from "../../../../components/ui/icons";
import { assignerTache, basculerEtape, changerStatut, commenterTache, creerTache, modifierTache } from "./actions";

export type AssigneeOption = { id: string; nom: string; role: string };
const PRIORITES: PrioriteTache[] = ["BASSE", "NORMALE", "HAUTE", "CRITIQUE"];
const STATUTS: StatutTache[] = ["A_FAIRE", "EN_COURS", "BLOQUEE", "TERMINEE", "ANNULEE"];

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}
function Succes({ dict, message, onClose }: { dict: Dict; message: string; onClose: () => void }) {
  return <div className="space-y-4"><p className="text-sm text-ink-strong">{message}</p><div className="flex justify-end"><Button variant="secondary" onClick={onClose}>{dict.common.close}</Button></div></div>;
}

export function TacheForm({ dict, locale, assignees, tache }: { dict: Dict; locale: Locale; assignees: AssigneeOption[]; tache?: TacheDetail }) {
  const [state, action] = useActionState(tache ? modifierTache : creerTache, IDLE);
  const t = dict.taches;
  const e = dict.enumsTaches;
  const [etapes, setEtapes] = useState<ChecklistItem[]>(tache?.checklist ?? []);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {tache ? <input type="hidden" name="tache_id" value={tache.id} /> : null}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label={t.titreChamp} htmlFor="titre" required error={fieldError(state, "titre")}><Input id="titre" name="titre" required maxLength={200} defaultValue={tache?.titre ?? ""} /></Field></div>
          <Field label={t.assignee} htmlFor="assignee_id" hint={t.assigneeAide} error={fieldError(state, "assignee_id")}>
            <Select id="assignee_id" name="assignee_id" defaultValue={tache?.assignee?.id ?? ""}><option value="">{t.nonAssignee}</option>{assignees.map((a) => <option key={a.id} value={a.id}>{a.nom} · {dict.roles[a.role as keyof typeof dict.roles] ?? a.role}</option>)}</Select>
          </Field>
          <Field label={t.priorite} htmlFor="priorite" required><Select id="priorite" name="priorite" defaultValue={tache?.priorite ?? "NORMALE"}>{PRIORITES.map((p) => <option key={p} value={p}>{e.priorite[p]}</option>)}</Select></Field>
          <Field label={t.echeance} htmlFor="date_echeance" optionalLabel={dict.common.optional} error={fieldError(state, "date_echeance")}><Input id="date_echeance" name="date_echeance" type="date" dir="ltr" defaultValue={tache?.dateEcheance ?? ""} className="tnum text-start" /></Field>
          <Field label={t.recurrence} htmlFor="recurrence" hint={t.recurrenceAide}><Select id="recurrence" name="recurrence" defaultValue={tache?.recurrence?.frequence ?? ""}><option value="">{t.aucuneRecurrence}</option>{(["MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE"] as const).map((f) => <option key={f} value={f}>{e.frequence[f]}</option>)}</Select></Field>
        </div>
        <div className="mt-4"><Field label={t.description} htmlFor="description" optionalLabel={dict.common.optional}><Textarea id="description" name="description" rows={4} maxLength={8000} defaultValue={tache?.description ?? ""} /></Field></div>
        <div className="mt-4">
          <p className="text-sm font-medium text-ink-strong">{t.checklist}</p>
          <p className="mb-2 text-[12px] text-soft">{t.checklistAide}</p>
          <div className="space-y-2">
            {etapes.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="checkbox" name={`etape_fait_${i + 1}`} defaultChecked={it.fait} className="size-4 accent-[#4c6c5a]" />
                <Input name={`etape_${i + 1}`} defaultValue={it.libelle} maxLength={200} className="!h-9" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setEtapes(etapes.filter((_, k) => k !== i))}>✕</Button>
              </div>
            ))}
            {etapes.length < 50 ? <Button type="button" variant="secondary" size="sm" onClick={() => setEtapes([...etapes, { id: `c${etapes.length + 1}`, libelle: "", fait: false }])}><IconPlus width={14} height={14} />{t.ajouterEtape}</Button> : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Checkbox name="visible_conseil" label={t.visibleConseil} defaultChecked={tache?.visibleConseil ?? true} />
        </div>
        <div className="mt-4"><Field label={t.piecesJointes} htmlFor="pieces" hint={t.piecesJointesAide} optionalLabel={dict.common.optional} error={fieldError(state, "pieces")}><Input id="pieces" name="pieces" type="file" multiple accept="image/*,application/pdf" /></Field></div>
      </Card>
      <FormAlert state={state} />
      <div className="flex justify-end"><SubmitButton>{tache ? dict.common.save : t.nouvelle}</SubmitButton></div>
    </form>
  );
}

export function StatutModal({ dict, locale, tache, syndic }: { dict: Dict; locale: Locale; tache: TacheDetail; syndic: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(changerStatut, IDLE);
  const t = dict.taches;
  const e = dict.enumsTaches;
  const cibles = STATUTS.filter((s) => s !== tache.statut && (syndic || s !== "ANNULEE"));
  const suivante = state.status === "success" ? (state.data as { suivante_id?: string | null } | undefined)?.suivante_id : null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t.changerStatut}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.changerStatut} subtitle={tache.titre} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={suivante ? `${t.statutChange} ${t.suivanteCreee}` : t.statutChange} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="tache_id" value={tache.id} />
            <Field label={t.nouveauStatut} htmlFor="statut" required><Select id="statut" name="statut" defaultValue={cibles.includes("TERMINEE") && tache.statut === "EN_COURS" ? "TERMINEE" : cibles[0]}>{cibles.map((s) => <option key={s} value={s}>{e.statut[s]}</option>)}</Select></Field>
            <Field label={t.commentaireStatut} htmlFor="commentaire_statut" optionalLabel={dict.common.optional}><Textarea id="commentaire_statut" name="commentaire" rows={2} maxLength={4000} /></Field>
            <Field label={t.photo} htmlFor="photo" optionalLabel={dict.common.optional}><Input id="photo" name="photo" type="file" accept="image/*,application/pdf" /></Field>
            {tache.recurrence ? <p className="text-[12px] text-soft">{t.recurrenceAide}</p> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.changerStatut} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function AnnulerModal({ dict, locale, tache }: { dict: Dict; locale: Locale; tache: TacheDetail }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(changerStatut, IDLE);
  const t = dict.taches;
  return (
    <>
      <Button variant="dangerGhost" onClick={() => setOpen(true)}>{t.annuler}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.annuler} subtitle={tache.titre} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.statutChange} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="tache_id" value={tache.id} /><input type="hidden" name="statut" value="ANNULEE" />
            <IrreversibleNotice>{t.annulerCorps}</IrreversibleNotice>
            <Field label={t.commentaireStatut} htmlFor="commentaire_annul" optionalLabel={dict.common.optional}><Textarea id="commentaire_annul" name="commentaire" rows={2} maxLength={4000} /></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.annuler} danger />
          </form>
        )}
      </Modal>
    </>
  );
}

export function AssignerModal({ dict, locale, tache, assignees }: { dict: Dict; locale: Locale; tache: TacheDetail; assignees: AssigneeOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(assignerTache, IDLE);
  const t = dict.taches;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{t.assigner}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.assignerTitre} subtitle={tache.titre} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={t.assigneeChange} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="tache_id" value={tache.id} />
            <Field label={t.assignee} htmlFor="assignee_id_m" hint={t.assigneeAide} error={fieldError(state, "assignee_id")}><Select id="assignee_id_m" name="assignee_id" defaultValue={tache.assignee?.id ?? ""}><option value="">{t.nonAssignee}</option>{assignees.map((a) => <option key={a.id} value={a.id}>{a.nom} · {dict.roles[a.role as keyof typeof dict.roles] ?? a.role}</option>)}</Select></Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={t.assigner} />
          </form>
        )}
      </Modal>
    </>
  );
}

/** Checklist cochable en place (syndic ou assigné(e)). */
export function Checklist({ dict, locale, tache, editable }: { dict: Dict; locale: Locale; tache: TacheDetail; editable: boolean }) {
  const [pending, start] = useTransition();
  const items = tache.checklist ?? [];
  if (!items.length) return null;
  const faits = items.filter((i) => i.fait).length;
  return (
    <div>
      <p className="mb-2 text-[13px] text-soft">{fill(dict.taches.checklistProgres, { n: faits, total: items.length })}</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <label className={`flex items-center gap-3 rounded-field border border-hairline px-3 py-2 text-[14px] ${editable ? "cursor-pointer hover:bg-hover" : ""}`}>
              <input type="checkbox" checked={it.fait} disabled={!editable || pending} onChange={(ev) => start(() => basculerEtape(locale, tache.id, it.id, ev.target.checked))} className="size-4 accent-[#4c6c5a]" />
              <span className={it.fait ? "text-soft line-through" : "text-ink-strong"}>{it.libelle}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommentaireForm({ dict, locale, tacheId }: { dict: Dict; locale: Locale; tacheId: string }) {
  const [state, action] = useActionState(commenterTache, IDLE);
  const t = dict.taches;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="tache_id" value={tacheId} />
      <Field label={t.votreCommentaire} htmlFor="contenu_t" error={fieldError(state, "contenu")}><Textarea id="contenu_t" name="contenu" rows={2} required maxLength={4000} /></Field>
      <FormAlert state={state} />
      <div className="flex items-center justify-end gap-3">{state.status === "success" ? <span className="text-[13px] text-ok">{t.commentaireEnvoye}</span> : null}<SubmitButton size="sm">{t.commenter}</SubmitButton></div>
    </form>
  );
}
