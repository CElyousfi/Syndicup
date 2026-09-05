"use client";

import { useActionState, useState } from "react";
import { Modal } from "../../../../components/ui/modal";
import { Field, Input, Select } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Banner } from "../../../../components/ui/banner";
import { FileViewerButton } from "../../../../components/documents/document-viewer";
import { IDLE, fieldError } from "../../../../lib/forms";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { AssembleeGenerale, BudgetAg, RapportGestion } from "../../../../lib/api/types";
import { formatDate } from "../../../../lib/format";
import { IconDownload, IconPlus } from "../../../../components/ui/icons";
import { genererRapport, soumettreRapportAg, definirFacturesVisibles } from "./actions";

function Pied({ dict, onCancel, label }: { dict: Dict; onCancel: () => void; label: string }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button><SubmitButton>{label}</SubmitButton></div>;
}

export function GenererModal({ dict, locale, budgets, exerciceDefaut }: { dict: Dict; locale: Locale; budgets: BudgetAg[]; exerciceDefaut: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(genererRapport, IDLE);
  const [exercice, setExercice] = useState(exerciceDefaut);
  const r = dict.rapports;
  const data = state.status === "success" ? (state.data as { id: string; regenere: boolean; pdf_erreur: string | null } | undefined) : undefined;
  return (
    <>
      <Button onClick={() => setOpen(true)}><IconPlus width={16} height={16} />{r.generer}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={r.genererTitre} closeLabel={dict.common.close}>
        {state.status === "success" && data ? (
          <div className="space-y-4">
            <Banner variant={data.pdf_erreur ? "warn" : "ok"} title={data.regenere ? r.regenere : r.genere}>{data.pdf_erreur ? r.pdfEchec : r.genereAide}</Banner>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>{dict.common.close}</Button>
              <a href={`/${locale}/rapports/gestion/${data.id}`} className="inline-flex h-10 items-center rounded-btn bg-ink px-4 text-[13px] font-medium text-white">{dict.common.see}</a>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <p className="text-sm text-body">{r.genererAide}</p>
            <Field label={r.exercice} htmlFor="exercice" required error={fieldError(state, "exercice")}>
              <Input id="exercice" name="exercice" inputMode="numeric" pattern="\d{4}" dir="ltr" required value={exercice} onChange={(e) => setExercice(e.target.value)} className="tnum text-start" />
            </Field>
            <Field label={dict.rapports.budget} htmlFor="budget_ag_id" optionalLabel={dict.common.optional} error={fieldError(state, "budget_ag_id")}>
              <Select id="budget_ag_id" name="budget_ag_id" defaultValue="">
                <option value="">{dict.common.optional}</option>
                {budgets.filter((b) => b.exercice === exercice).map((b) => <option key={b.id} value={b.id}>{b.exercice} · {dict.enums.statutBudget[b.statut]}</option>)}
              </Select>
            </Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={r.generer} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function SoumettreModal({ dict, locale, rapport, ags }: { dict: Dict; locale: Locale; rapport: RapportGestion; ags: AssembleeGenerale[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(soumettreRapportAg, IDLE);
  const r = dict.rapports;
  const eligibles = ags.filter((a) => a.statut === "PLANIFIEE" || a.statut === "CONVOQUEE");
  return (
    <>
      <Button onClick={() => setOpen(true)}>{r.soumettre}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={r.soumettreTitre} subtitle={`${r.exercice} ${rapport.exercice}`} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4"><Banner variant="ok" title={r.soumis}>{r.soumisAide}</Banner><div className="flex justify-end"><Button variant="secondary" onClick={() => setOpen(false)}>{dict.common.close}</Button></div></div>
        ) : eligibles.length === 0 ? (
          <div className="space-y-4"><Banner variant="warn">{r.aucuneAgEligible}</Banner><div className="flex justify-end"><a href={`/${locale}/ag/nouvelle`} className="inline-flex h-10 items-center rounded-btn bg-ink px-4 text-[13px] font-medium text-white">{dict.nav.ag}</a></div></div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="rapport_id" value={rapport.id} />
            <p className="text-sm text-body">{r.soumettreAide}</p>
            <Field label={r.agCible} htmlFor="ag_id" required error={fieldError(state, "ag_id")}>
              <Select id="ag_id" name="ag_id" required defaultValue={eligibles[0]!.id}>
                {eligibles.map((a) => <option key={a.id} value={a.id}>{dict.enums.typeAg[a.type]} · {formatDate(a.dateAg, locale)} · {dict.enums.statutAg[a.statut]}</option>)}
              </Select>
            </Field>
            <Field label={r.typeMajorite} htmlFor="type_majorite" hint={r.typeMajoriteAide} optionalLabel={dict.common.optional} error={fieldError(state, "type_majorite")}>
              <Select id="type_majorite" name="type_majorite" defaultValue="">
                <option value="">{dict.common.optional}</option>
                {(["SIMPLE", "DOUBLE", "UNANIMITE"] as const).map((m) => <option key={m} value={m}>{dict.enumsRapports.typeMajorite[m]}</option>)}
              </Select>
            </Field>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={r.soumettre} />
          </form>
        )}
      </Modal>
    </>
  );
}

/** Boutons PDF du rapport : visionneuse intégrée + téléchargement, FR / AR, publique / complète. */
export function PdfRapportButtons({ dict, rapport, complet }: { dict: Dict; rapport: RapportGestion; complet: boolean }) {
  const r = dict.rapports;
  const viewer = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  const src = (langue: "fr" | "ar", variante: "publique" | "complete") => `/api/rapport-pdf?id=${rapport.id}&langue=${langue}&variante=${variante}`;
  const Groupe = ({ variante, titre }: { variante: "publique" | "complete"; titre: string }) => (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-field border border-hairline p-3">
      <span className="text-sm text-body">{titre}</span>
      <div className="flex flex-wrap gap-2">
        <FileViewerButton src={src("fr", variante)} nom={`${r.gestionTitre} ${rapport.exercice} — FR.pdf`} labels={viewer} label={r.pdfFr} />
        <FileViewerButton src={src("ar", variante)} nom={`${r.gestionTitre} ${rapport.exercice} — AR.pdf`} labels={viewer} label={r.pdfAr} />
        <a href={`${src("fr", variante)}&download=1`} className="inline-flex h-9 items-center gap-1.5 rounded-btn border border-hairline-strong bg-surface px-3 text-[13px] font-medium text-ink-strong hover:bg-hover" title={dict.common.download}><IconDownload width={14} height={14} /></a>
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      <Groupe variante="publique" titre={r.pdfPublique} />
      {complet ? <Groupe variante="complete" titre={r.pdfComplet} /> : null}
    </div>
  );
}

export function FacturesToggle({ dict, locale, coproprieteId, visible }: { dict: Dict; locale: Locale; coproprieteId: string; visible: boolean }) {
  const [state, action] = useActionState(definirFacturesVisibles, IDLE);
  const r = dict.rapports;
  const actuel = state.status === "success" ? ((state.data as { visible: boolean }).visible) : visible;
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="copropriete_id" value={coproprieteId} /><input type="hidden" name="visible" value={actuel ? "0" : "1"} />
      <span className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${actuel ? "bg-ok" : "bg-hairline-strong"}`} aria-hidden><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${actuel ? "translate-x-5 rtl:-translate-x-5" : ""}`} /></span>
      <SubmitButton variant="secondary" size="sm">{actuel ? r.facturesMasquer : r.facturesActiver}</SubmitButton>
      {state.status === "success" ? <span className="text-[12px] text-ok">{r.facturesMaj}</span> : null}
      {state.status === "error" ? <FormAlert state={state} /> : null}
    </form>
  );
}
