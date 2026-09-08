"use client";

/** Import (M24) — composants client : formulaire de fichier, mapping des colonnes, exécution avec progression, invitations en masse, démo. */
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "../../../../components/ui/card";
import { Field, Input, Select, Checkbox } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Banner } from "../../../../components/ui/banner";
import { Modal, IrreversibleNotice } from "../../../../components/ui/modal";
import { ProgressBar } from "../../../../components/ui/progress";
import { CopyButton } from "../../../../components/ui/copy";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import type { ImportJob, TypeImport } from "../../../../lib/api/types";
import { annulerImport, creerDemo, creerImport, envoyerInvitationsMasse, etatImport, executerImport, modifierMapping } from "./actions";

const TYPES: TypeImport[] = ["LOTS_PROPRIETAIRES", "SOLDES_OUVERTURE", "PRESTATAIRES", "CONTRATS", "VEHICULES_BADGES", "PERSONNEL"];

export function ImportForm({ dict, locale, typeInitial }: { dict: Dict; locale: Locale; typeInitial?: TypeImport }) {
  const [state, action, pending] = useActionState(creerImport, IDLE);
  const [type, setType] = useState<TypeImport>(typeInitial ?? "LOTS_PROPRIETAIRES");
  const t = dict.importation;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.typeImport} htmlFor="type" required hint={t.typesImportAide[type]}><Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as TypeImport)}>{TYPES.map((x) => <option key={x} value={x}>{t.typesImport[x]}</option>)}</Select></Field>
          <Field label={t.fichier} htmlFor="fichier" required hint={t.fichierAide} error={fieldError(state, "fichier")}><Input id="fichier" name="fichier" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></Field>
          {type === "LOTS_PROPRIETAIRES" || type === "PERSONNEL" ? <>
            <Field label={t.canal} htmlFor="canal"><Select id="canal" name="canal" defaultValue="SMS"><option value="SMS">{t.canalSms}</option><option value="EMAIL">{t.canalEmail}</option><option value="WHATSAPP">WhatsApp</option></Select></Field>
            <div className="pt-6"><Checkbox name="inviter" label={t.inviter} hint={t.inviterAide} defaultChecked /></div>
          </> : null}
          {type === "SOLDES_OUVERTURE" ? <Field label={t.dateReference} htmlFor="date_reference" hint={t.dateReferenceAide} optionalLabel={dict.common.optional}><Input id="date_reference" name="date_reference" type="date" dir="ltr" className="tnum text-start" /></Field> : null}
        </div>
        <p className="mt-4 text-[12px] text-soft">{t.modelesAide} <a className="text-action hover:underline" href={`/api/import-fichier?kind=modele&type=${type}&langue=fr`}>{t.modeleFr}</a> · <a className="text-action hover:underline" href={`/api/import-fichier?kind=modele&type=${type}&langue=ar`}>{t.modeleAr}</a></p>
      </Card>
      <FormAlert state={state} />
      <div className="flex justify-end"><SubmitButton>{pending ? t.analyseEnCours : t.analyser}</SubmitButton></div>
    </form>
  );
}

export function MappingForm({ dict, locale, job }: { dict: Dict; locale: Locale; job: ImportJob }) {
  const [state, action] = useActionState(modifierMapping, IDLE);
  const t = dict.importation;
  const apercu = job.apercu;
  const options = job.mapping?.options ?? {};
  if (!apercu) return null;
  const verrouille = !["TELEVERSE", "ANALYSE", "PRET"].includes(job.statut);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="import_id" value={job.id} /><input type="hidden" name="nb_colonnes" value={apercu.entetes.length} />
      <p className="text-[13px] text-soft">{t.mappingAide}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {apercu.entetes.map((h, i) => {
          const courant = apercu.colonnes.find((c) => c.index === i)?.champ ?? "";
          return (
            <Field key={i} label={h || `${t.colonneFichier} ${i + 1}`} htmlFor={`colonne_${i}`}>
              <Select id={`colonne_${i}`} name={`colonne_${i}`} defaultValue={courant} disabled={verrouille}>
                <option value="">{t.ignorer}</option>
                {apercu.champs.map((c) => <option key={c.cle} value={c.cle}>{c.libelle[locale === "ar" ? "AR" : "FR"]}{c.requis ? ` (${t.requis})` : ""}</option>)}
              </Select>
            </Field>
          );
        })}
      </div>
      {!verrouille ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {job.type === "LOTS_PROPRIETAIRES" || job.type === "PERSONNEL" ? <><Field label={t.canal} htmlFor="canal_map"><Select id="canal_map" name="canal" defaultValue={options.canal ?? "SMS"}><option value="SMS">{t.canalSms}</option><option value="EMAIL">{t.canalEmail}</option><option value="WHATSAPP">WhatsApp</option></Select></Field><div className="pt-6"><Checkbox name="inviter" label={t.inviter} defaultChecked={options.inviter !== false} /></div></> : <input type="hidden" name="inviter" value="on" />}
            {job.type === "SOLDES_OUVERTURE" ? <Field label={t.dateReference} htmlFor="date_reference_map" hint={t.dateReferenceAide} optionalLabel={dict.common.optional}><Input id="date_reference_map" name="date_reference" type="date" defaultValue={options.date_reference ?? ""} dir="ltr" className="tnum text-start" /></Field> : null}
          </div>
          <FormAlert state={state} />
          <div className="flex justify-end"><SubmitButton variant="secondary">{t.enregistrerMapping}</SubmitButton></div>
        </>
      ) : null}
    </form>
  );
}

export function ExecutionPanel({ dict, locale, job }: { dict: Dict; locale: Locale; job: ImportJob }) {
  const [state, action] = useActionState(executerImport, IDLE);
  const [annul, annulerAction] = useActionState(annulerImport, IDLE);
  const [live, setLive] = useState<ImportJob>(job);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const t = dict.importation;
  const enCours = live.statut === "EN_COURS";
  useEffect(() => { setLive(job); }, [job]);
  useEffect(() => {
    if (!enCours) return;
    const timer = setInterval(async () => {
      const j = await etatImport(job.id);
      if (j) { setLive(j); if (j.statut !== "EN_COURS") { clearInterval(timer); router.refresh(); } }
    }, 2000);
    return () => clearInterval(timer);
  }, [enCours, job.id, router]);
  useEffect(() => { if (state.status === "success" || annul.status === "success") router.refresh(); }, [state.status, annul.status, router]);
  const ratio = live.nbLignes > 0 ? live.nbTraitees / live.nbLignes : 0;
  return (
    <div className="space-y-3">
      {live.statut === "PRET" ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="import_id" value={job.id} />
          <p className="text-[13px] text-soft">{t.executerAide}</p>
          <FormAlert state={state} />
          <SubmitButton>{t.executer}</SubmitButton>
        </form>
      ) : null}
      {enCours || live.statut === "TERMINE" || live.statut === "ECHOUE" || live.statut === "ANNULE" ? (
        <div>
          <div className="mb-1 flex items-center justify-between text-[13px]"><span className="font-medium text-ink-strong">{enCours ? t.enCours : live.statut === "TERMINE" ? t.termine : live.statut === "ECHOUE" ? t.echoue : t.annule}</span><span className="tnum text-soft">{live.nbTraitees}/{live.nbLignes}</span></div>
          <ProgressBar ratio={ratio} tone={live.statut === "ECHOUE" ? "danger" : live.statut === "TERMINE" ? "ok" : "action"} />
        </div>
      ) : null}
      {enCours ? (
        <>
          <Button variant="dangerGhost" size="sm" onClick={() => setConfirm(true)}>{t.annuler}</Button>
          <Modal open={confirm} onClose={() => setConfirm(false)} title={t.annuler} closeLabel={dict.common.close}>
            <form action={annulerAction} className="space-y-4"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="import_id" value={job.id} /><IrreversibleNotice>{t.annulerCorps}</IrreversibleNotice><FormAlert state={annul} /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setConfirm(false)}>{dict.common.cancel}</Button><SubmitButton variant="danger">{t.annuler}</SubmitButton></div></form>
          </Modal>
        </>
      ) : null}
    </div>
  );
}

export function InvitationsMasseModal({ dict, locale, importJobId, nb }: { dict: Dict; locale: Locale; importJobId?: string; nb: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(envoyerInvitationsMasse, IDLE);
  const t = dict.importation;
  const r = state.status === "success" ? (state.data as { total: number; envoyees: number; sans_contact: number; echouees: number } | undefined) : undefined;
  const qs = importJobId ? `&import_job_id=${importJobId}` : "";
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={nb === 0}>{t.invitationsMasse}{nb ? ` (${nb})` : ""}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.invitationsMasse} closeLabel={dict.common.close}>
        {r ? <div className="space-y-4"><Banner variant="ok">{fill(t.envoyees, { n: r.envoyees, total: r.total, sans: r.sans_contact, echecs: r.echouees })}</Banner><div className="flex justify-end"><Button variant="secondary" onClick={() => setOpen(false)}>{dict.common.close}</Button></div></div> : (
          <div className="space-y-4">
            <p className="text-sm text-body">{t.invitationsMasseAide}</p>
            <form action={action} className="space-y-3">
              <input type="hidden" name="locale" value={locale} />{importJobId ? <input type="hidden" name="import_job_id" value={importJobId} /> : null}
              <Field label={t.canal} htmlFor="canal_masse"><Select id="canal_masse" name="canal" defaultValue="SMS"><option value="SMS">{t.canalSms}</option><option value="EMAIL">{t.canalEmail}</option></Select></Field>
              <FormAlert state={state} />
              <div className="flex flex-wrap justify-end gap-2">
                <a className="inline-flex h-10 items-center rounded-full border border-hairline px-4 text-[13.5px] font-medium text-ink hover:bg-hover" href={`/api/import-fichier?kind=invitations&canal=WHATSAPP${qs}`}>{t.canalWhatsapp}</a>
                <a className="inline-flex h-10 items-center rounded-full border border-hairline px-4 text-[13.5px] font-medium text-ink hover:bg-hover" href={`/api/import-fichier?kind=invitations&canal=CSV${qs}`}>{t.canalCsv}</a>
                <SubmitButton>{t.invitationsMasse}</SubmitButton>
              </div>
            </form>
            <p className="text-[12px] text-soft">{t.telecharge}</p>
          </div>
        )}
      </Modal>
    </>
  );
}

export function DemoModal({ dict, locale, coproprieteId }: { dict: Dict; locale: Locale; coproprieteId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(creerDemo, IDLE);
  const t = dict.importation;
  const d = state.status === "success" ? (state.data as { nom: string; invitation_syndic: { code: string } } | undefined) : undefined;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{t.creerDemo}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.creerDemo} closeLabel={dict.common.close}>
        {d ? <div className="space-y-4"><Banner variant="ok">{t.demoCreee}</Banner><div className="flex items-center gap-2"><code className="rounded-md bg-ground px-3 py-1.5 font-mono text-[15px] font-semibold tracking-wider" dir="ltr">{d.invitation_syndic.code}</code><CopyButton value={d.invitation_syndic.code} label={dict.common.copy} copiedLabel={dict.common.copied} /></div><p className="text-sm text-body">{d.nom}</p><div className="flex justify-end"><Button variant="secondary" onClick={() => setOpen(false)}>{dict.common.close}</Button></div></div> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="copropriete_id" value={coproprieteId} />
            <p className="text-sm text-body">{t.creerDemoAide}</p>
            <Field label={t.nomDemo} htmlFor="nom_demo" optionalLabel={dict.common.optional}><Input id="nom_demo" name="nom" maxLength={200} /></Field>
            <Field label={t.joursDemo} htmlFor="jours_demo"><Input id="jours_demo" name="jours" type="number" min={1} max={90} defaultValue={30} dir="ltr" className="tnum text-start" /></Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>{dict.common.cancel}</Button><SubmitButton>{t.creerDemo}</SubmitButton></div>
          </form>
        )}
      </Modal>
    </>
  );
}
