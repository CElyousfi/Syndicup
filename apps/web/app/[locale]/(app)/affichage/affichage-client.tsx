"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../components/ui/modal";
import { Field, Input, Select, Textarea, Checkbox, Switch } from "../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../components/ui/form";
import { Button } from "../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { Banner } from "../../../../components/ui/banner";
import { ProgressBar } from "../../../../components/ui/progress";
import { IDLE, fieldError } from "../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../lib/i18n";
import type { AnnonceDetail, AudienceCommunication, CategorieAnnonce, ContactUtile, PreferencesNotification, Sondage } from "../../../../lib/api/types";
import { IconPlus } from "../../../../components/ui/icons";
import { archiverAnnonce, cloreSondage, commenter, creerAnnonce, creerSondage, enregistrerContact, enregistrerPreferences, marquerLue, masquerCommentaire, modifierAnnonce, ouvrirSondage, publierAnnonce, repondreSondage, supprimerAnnonce, supprimerContact, supprimerSondage } from "./actions";

const CATEGORIES: CategorieAnnonce[] = ["INFORMATION", "TRAVAUX", "COUPURE", "SECURITE", "URGENCE", "AG", "CONVIVIALITE", "REGLEMENT"];
const AUDIENCES: AudienceCommunication[] = ["TOUS", "PROPRIETAIRES", "OCCUPANTS", "CONSEIL", "BATIMENT"];

function Pied({ dict, onCancel, label, danger }: { dict: Dict; onCancel: () => void; label: string; danger?: boolean }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>{dict.common.cancel}</Button><SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton></div>;
}
function Succes({ dict, message, onClose }: { dict: Dict; message: string; onClose: () => void }) {
  return <div className="space-y-4"><p className="text-sm text-ink-strong">{message}</p><div className="flex justify-end"><Button variant="secondary" onClick={onClose}>{dict.common.close}</Button></div></div>;
}
function localInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Formulaire d'annonce (création + modification) — brouillon ou publication immédiate. */
export function AnnonceForm({ dict, locale, annonce, syndic, batiments }: { dict: Dict; locale: Locale; annonce?: AnnonceDetail; syndic: boolean; batiments: string[] }) {
  const [state, action] = useActionState(annonce ? modifierAnnonce : creerAnnonce, IDLE);
  const c = dict.communication;
  const e = dict.enumsCommunication;
  const [audience, setAudience] = useState<AudienceCommunication>(annonce?.audience ?? "TOUS");
  const [publier, setPublier] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {annonce ? <input type="hidden" name="annonce_id" value={annonce.id} /> : null}
      <input type="hidden" name="publier" value={publier ? "1" : "0"} />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={c.titreChamp} htmlFor="titre" required error={fieldError(state, "titre")}><Input id="titre" name="titre" required maxLength={200} defaultValue={annonce?.titre ?? ""} /></Field>
          </div>
          <Field label={c.categorie} htmlFor="categorie" required error={fieldError(state, "categorie")}>
            <Select id="categorie" name="categorie" defaultValue={annonce?.categorie ?? "INFORMATION"}>
              {CATEGORIES.filter((k) => syndic || k !== "URGENCE").map((k) => <option key={k} value={k}>{e.categorieAnnonce[k]}</option>)}
            </Select>
          </Field>
          <Field label={c.audience} htmlFor="audience" hint={c.audienceAide} required error={fieldError(state, "audience")}>
            <Select id="audience" name="audience" value={audience} onChange={(ev) => setAudience(ev.target.value as AudienceCommunication)}>
              {AUDIENCES.map((a) => <option key={a} value={a}>{e.audience[a]}</option>)}
            </Select>
          </Field>
          {audience === "BATIMENT" ? (
            <Field label={c.batiment} htmlFor="batiment" hint={c.batimentAide} required error={fieldError(state, "batiment")}>
              {batiments.length ? <Select id="batiment" name="batiment" defaultValue={annonce?.batiment ?? batiments[0]}>{batiments.map((b) => <option key={b} value={b}>{b}</option>)}</Select> : <Input id="batiment" name="batiment" required maxLength={40} defaultValue={annonce?.batiment ?? ""} />}
            </Field>
          ) : null}
          <Field label={c.expiration} htmlFor="expire_le" hint={c.expirationAide} optionalLabel={dict.common.optional} error={fieldError(state, "expire_le")}><Input id="expire_le" name="expire_le" type="datetime-local" dir="ltr" defaultValue={localInput(annonce?.expireLe)} className="tnum text-start" /></Field>
        </div>
        <div className="mt-4">
          <Field label={c.contenu} htmlFor="contenu" hint={c.contenuAide} required error={fieldError(state, "contenu")}><Textarea id="contenu" name="contenu" rows={8} required maxLength={20000} defaultValue={annonce?.contenu ?? ""} /></Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Checkbox name="epingle" label={c.epingler} defaultChecked={annonce?.epingle ?? false} />
          <Checkbox name="commentaires_actives" label={c.commentairesActives} defaultChecked={annonce?.commentairesActives ?? true} />
        </div>
        <div className="mt-4">
          <Field label={c.piecesJointes} htmlFor="pieces" hint={c.piecesJointesAide} optionalLabel={dict.common.optional} error={fieldError(state, "pieces")}><Input id="pieces" name="pieces" type="file" multiple accept="image/*,application/pdf" /></Field>
        </div>
      </Card>
      <FormAlert state={state} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" variant="secondary" onClick={() => setPublier(false)}>{annonce ? dict.common.save : c.enregistrerBrouillon}</Button>
        {!annonce ? <Button type="submit" onClick={() => setPublier(true)}>{c.publierMaintenant}</Button> : null}
      </div>
    </form>
  );
}

export function PublierModal({ dict, locale, annonce }: { dict: Dict; locale: Locale; annonce: AnnonceDetail }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"maintenant" | "programmer">(annonce.publieLe ? "programmer" : "maintenant");
  const [state, action] = useActionState(publierAnnonce, IDLE);
  const c = dict.communication;
  const diff = state.status === "success" ? (state.data as { programmee?: boolean; envoyes?: number } | undefined) : undefined;
  return (
    <>
      <Button onClick={() => setOpen(true)}>{c.publier}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={c.publierTitre} subtitle={annonce.titre} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={diff?.programmee ? c.programmee : fill(c.publiee, { n: diff?.envoyes ?? 0 })} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="annonce_id" value={annonce.id} /><input type="hidden" name="mode" value={mode} />
            <p className="text-sm text-body">{c.publierCorps}</p>
            <div className="flex gap-2">
              <Button type="button" variant={mode === "maintenant" ? "primary" : "secondary"} size="sm" onClick={() => setMode("maintenant")}>{c.publierMaintenant}</Button>
              <Button type="button" variant={mode === "programmer" ? "primary" : "secondary"} size="sm" onClick={() => setMode("programmer")}>{c.programmer}</Button>
            </div>
            {mode === "programmer" ? <Field label={c.dateProgrammee} htmlFor="publie_le" required error={fieldError(state, "publie_le")}><Input id="publie_le" name="publie_le" type="datetime-local" required dir="ltr" defaultValue={localInput(annonce.publieLe) || localInput(new Date(Date.now() + 3600_000).toISOString())} className="tnum text-start" /></Field> : null}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={c.publier} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function ArchiverModal({ dict, locale, annonce }: { dict: Dict; locale: Locale; annonce: AnnonceDetail }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(archiverAnnonce, IDLE);
  const c = dict.communication;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{c.archiver}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={c.archiver} subtitle={annonce.titre} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={c.archivee} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="annonce_id" value={annonce.id} />
            <IrreversibleNotice>{c.archiverCorps}</IrreversibleNotice>
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={c.archiver} danger />
          </form>
        )}
      </Modal>
    </>
  );
}

export function SupprimerBouton({ dict, locale, id, sondage }: { dict: Dict; locale: Locale; id: string; sondage?: boolean }) {
  const [state, action] = useActionState(sondage ? supprimerSondage : supprimerAnnonce, IDLE);
  const c = dict.communication;
  return <form action={action} className="inline-flex flex-col items-end gap-1"><input type="hidden" name="locale" value={locale} /><input type="hidden" name={sondage ? "sondage_id" : "annonce_id"} value={id} /><SubmitButton variant="dangerGhost">{sondage ? c.supprimerSondage : c.supprimer}</SubmitButton>{state.status === "error" ? <FormAlert state={state} /> : null}</form>;
}

/** Accusé de lecture silencieux à l'ouverture de l'annonce (idempotent côté API). */
export function MarquerLu({ locale, id, deja }: { locale: Locale; id: string; deja: boolean }) {
  const fait = useRef(false);
  useEffect(() => {
    if (deja || fait.current) return;
    fait.current = true;
    void marquerLue(locale, id);
  }, [locale, id, deja]);
  return null;
}

export function CommentaireForm({ dict, locale, annonceId }: { dict: Dict; locale: Locale; annonceId: string }) {
  const [state, action] = useActionState(commenter, IDLE);
  const c = dict.communication;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="annonce_id" value={annonceId} />
      <Field label={c.votreCommentaire} htmlFor="contenu" error={fieldError(state, "contenu")}><Textarea id="contenu" name="contenu" rows={2} required maxLength={2000} /></Field>
      <FormAlert state={state} />
      <div className="flex items-center justify-end gap-3">{state.status === "success" ? <span className="text-[13px] text-ok">{c.commentaireEnvoye}</span> : null}<SubmitButton size="sm">{c.commenter}</SubmitButton></div>
    </form>
  );
}

export function MasquerBouton({ dict, locale, annonceId, commentaireId }: { dict: Dict; locale: Locale; annonceId: string; commentaireId: string }) {
  const [state, action] = useActionState(masquerCommentaire, IDLE);
  if (state.status === "success") return <span className="text-[12px] text-soft">{dict.communication.masque}</span>;
  return <form action={action}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="annonce_id" value={annonceId} /><input type="hidden" name="commentaire_id" value={commentaireId} /><SubmitButton variant="dangerGhost" size="sm">{dict.communication.masquer}</SubmitButton></form>;
}

// ── Sondages ─────────────────────────────────────────────────────────────────

export function SondageForm({ dict, locale, batiments }: { dict: Dict; locale: Locale; batiments: string[] }) {
  const [state, action] = useActionState(creerSondage, IDLE);
  const c = dict.communication;
  const e = dict.enumsCommunication;
  const [audience, setAudience] = useState<AudienceCommunication>("TOUS");
  const [nb, setNb] = useState(3);
  const [ouvrir, setOuvrir] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="ouvrir" value={ouvrir ? "1" : "0"} />
      <Card>
        <Banner variant="info" className="mb-4">{c.mention}</Banner>
        <Field label={c.question} htmlFor="question" required error={fieldError(state, "question")}><Input id="question" name="question" required maxLength={300} /></Field>
        <div className="mt-4"><Field label={c.description} htmlFor="description" optionalLabel={dict.common.optional}><Textarea id="description" name="description" rows={3} maxLength={4000} /></Field></div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-ink-strong">{c.options}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: nb }, (_, i) => <Input key={i} name={`option_${i + 1}`} required={i < 2} maxLength={200} placeholder={fill(c.option, { n: i + 1 })} />)}
          </div>
          {nb < 10 ? <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setNb(nb + 1)}><IconPlus width={14} height={14} />{fill(c.option, { n: nb + 1 })}</Button> : null}
          {fieldError(state, "options") ? <p className="mt-1 text-[12px] text-danger">{fieldError(state, "options")}</p> : null}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={c.audience} htmlFor="audience_s" hint={c.audienceAide} required><Select id="audience_s" name="audience" value={audience} onChange={(ev) => setAudience(ev.target.value as AudienceCommunication)}>{AUDIENCES.map((a) => <option key={a} value={a}>{e.audience[a]}</option>)}</Select></Field>
          {audience === "BATIMENT" ? <Field label={c.batiment} htmlFor="batiment_s" required error={fieldError(state, "batiment")}>{batiments.length ? <Select id="batiment_s" name="batiment" defaultValue={batiments[0]}>{batiments.map((b) => <option key={b} value={b}>{b}</option>)}</Select> : <Input id="batiment_s" name="batiment" required maxLength={40} />}</Field> : null}
          <Field label={c.dateFin} htmlFor="date_fin" required error={fieldError(state, "date_fin")}><Input id="date_fin" name="date_fin" type="datetime-local" required dir="ltr" defaultValue={localInput(new Date(Date.now() + 7 * 86_400_000).toISOString())} className="tnum text-start" /></Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Checkbox name="choix_multiple" label={c.choixMultiple} />
          <Checkbox name="ponderation_tantiemes" label={c.ponderation} hint={c.ponderationAide} />
        </div>
        <p className="mt-3 text-[12px] text-soft">{c.anonymeAide}</p>
      </Card>
      <FormAlert state={state} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" variant="secondary" onClick={() => setOuvrir(false)}>{c.enregistrerBrouillon}</Button>
        <Button type="submit" onClick={() => setOuvrir(true)}>{c.ouvrir}</Button>
      </div>
    </form>
  );
}

export function SondageTransitionModal({ dict, locale, sondage, action: quoi }: { dict: Dict; locale: Locale; sondage: Sondage; action: "ouvrir" | "clore" }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(quoi === "ouvrir" ? ouvrirSondage : cloreSondage, IDLE);
  const c = dict.communication;
  const label = quoi === "ouvrir" ? c.ouvrir : c.clore;
  return (
    <>
      <Button variant={quoi === "ouvrir" ? "primary" : "secondary"} onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={label} subtitle={sondage.question} closeLabel={dict.common.close}>
        {state.status === "success" ? <Succes dict={dict} message={quoi === "ouvrir" ? c.ouvert : c.clos} onClose={() => setOpen(false)} /> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="sondage_id" value={sondage.id} />
            {quoi === "clore" ? <IrreversibleNotice>{c.cloreCorps}</IrreversibleNotice> : <p className="text-sm text-body">{c.ouvrirCorps}</p>}
            <FormAlert state={state} />
            <Pied dict={dict} onCancel={() => setOpen(false)} label={label} danger={quoi === "clore"} />
          </form>
        )}
      </Modal>
    </>
  );
}

export function RepondreForm({ dict, locale, sondage }: { dict: Dict; locale: Locale; sondage: Sondage }) {
  const [state, action] = useActionState(repondreSondage, IDLE);
  const c = dict.communication;
  if (state.status === "success") return <Banner variant="ok">{c.reponseEnvoyee}</Banner>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="sondage_id" value={sondage.id} />
      <p className="text-sm font-medium text-ink-strong">{c.votreReponse}</p>
      <div className="space-y-2">
        {sondage.options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-field border border-hairline px-3 py-2.5 text-[14px] hover:bg-hover">
            <input type={sondage.choixMultiple ? "checkbox" : "radio"} name="choix" value={o.id} required={!sondage.choixMultiple} className="size-4 accent-[#4c6c5a]" />
            <span className="text-ink-strong">{o.libelle}</span>
          </label>
        ))}
      </div>
      <FormAlert state={state} />
      <div className="flex justify-end"><SubmitButton>{c.repondre}</SubmitButton></div>
    </form>
  );
}

export function ResultatsSondage({ dict, sondage }: { dict: Dict; sondage: Sondage }) {
  const c = dict.communication;
  const r = sondage.resultats;
  if (!r) return <p className="text-[13px] text-soft">{c.resultatsApres}</p>;
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-soft">{fill(c.reponses, { n: r.nb_reponses, total: r.nb_destinataires })}{r.ponderation_tantiemes ? ` · ${fill(c.tantiemesExprimes, { n: r.tantiemes_exprimes })}` : ""}</p>
      <div className="space-y-3">
        {r.options.map((o) => (
          <div key={o.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[14px]"><span className="text-ink-strong">{o.libelle}{sondage.maReponse?.includes(o.id) ? <span className="ms-2 text-[12px] text-action">✓</span> : null}</span><span className="tnum text-soft">{o.nb} · {o.pourcentage} %</span></div>
            <ProgressBar ratio={o.pourcentage / 100} tone="action" />
            {r.ponderation_tantiemes ? <div className="mt-1"><ProgressBar ratio={o.pourcentage_tantiemes / 100} tone="ink" /><p className="mt-0.5 text-[11px] text-faint">{c.parTantiemes} · {o.pourcentage_tantiemes} %</p></div> : null}
          </div>
        ))}
      </div>
      <p className="text-[12px] text-faint">{c.mention}</p>
    </div>
  );
}

// ── Contacts utiles ──────────────────────────────────────────────────────────

export function ContactForm({ dict, locale, contact, onDone }: { dict: Dict; locale: Locale; contact?: ContactUtile; onDone?: () => void }) {
  const [state, action] = useActionState(enregistrerContact, IDLE);
  const c = dict.communication;
  useEffect(() => { if (state.status === "success") onDone?.(); }, [state, onDone]);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_90px_auto] sm:items-end">
      <input type="hidden" name="locale" value={locale} />{contact ? <input type="hidden" name="contact_id" value={contact.id} /> : null}
      <Field label={c.libelle} htmlFor={`lib-${contact?.id ?? "new"}`} required error={fieldError(state, "libelle")}><Input id={`lib-${contact?.id ?? "new"}`} name="libelle" required maxLength={120} defaultValue={contact?.libelle ?? ""} /></Field>
      <Field label={c.telephone} htmlFor={`tel-${contact?.id ?? "new"}`} required error={fieldError(state, "telephone")}><Input id={`tel-${contact?.id ?? "new"}`} name="telephone" required dir="ltr" defaultValue={contact?.telephone ?? ""} className="tnum text-start" /></Field>
      <Field label={c.ordre} htmlFor={`ord-${contact?.id ?? "new"}`}><Input id={`ord-${contact?.id ?? "new"}`} name="ordre" type="number" min={0} max={999} dir="ltr" defaultValue={contact?.ordre ?? 0} className="tnum text-start" /></Field>
      <div className="flex gap-2"><SubmitButton size="sm">{contact ? dict.common.save : c.nouveauContact}</SubmitButton></div>
      {state.status === "error" ? <div className="sm:col-span-4"><FormAlert state={state} /></div> : null}
    </form>
  );
}
export function SupprimerContactBouton({ dict, locale, id }: { dict: Dict; locale: Locale; id: string }) {
  const [state, action] = useActionState(supprimerContact, IDLE);
  if (state.status === "success") return null;
  return <form action={action}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="contact_id" value={id} /><SubmitButton variant="dangerGhost" size="sm">{dict.communication.supprimerContact}</SubmitButton></form>;
}
export function ContactsGestion({ dict, locale, contacts }: { dict: Dict; locale: Locale; contacts: ContactUtile[] }) {
  const [edition, setEdition] = useState<string | null>(null);
  const c = dict.communication;
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-hairline">
        {contacts.map((x) => (
          <li key={x.id} className="py-3">
            {edition === x.id ? <ContactForm dict={dict} locale={locale} contact={x} onDone={() => setEdition(null)} /> : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-[14px] font-medium text-ink-strong">{x.libelle}</p><p className="tnum text-[13px] text-soft" dir="ltr">{x.telephone}</p></div>
                <div className="flex gap-1.5"><Button variant="secondary" size="sm" onClick={() => setEdition(x.id)}>{dict.common.modify}</Button><SupprimerContactBouton dict={dict} locale={locale} id={x.id} /></div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Card><SectionHeader title={c.nouveauContact} /><ContactForm dict={dict} locale={locale} /></Card>
    </div>
  );
}

// ── Préférences de notification ──────────────────────────────────────────────

export function PreferencesForm({ dict, locale, prefs }: { dict: Dict; locale: Locale; prefs: PreferencesNotification }) {
  const [state, action] = useActionState(enregistrerPreferences, IDLE);
  const c = dict.communication;
  const e = dict.enumsCommunication;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <Switch name="digest_hebdo" label={c.digestHebdo} hint={c.digestHebdoAide} defaultChecked={prefs.digest_hebdo} />
      <Field label={c.canalDigest} htmlFor="canal_digest"><Select id="canal_digest" name="canal_digest" defaultValue={prefs.canal_digest}>{(["EMAIL", "PUSH", "SMS", "AUCUN"] as const).map((k) => <option key={k} value={k}>{e.canalPreference[k]}</option>)}</Select></Field>
      <Switch name="annonces_push" label={c.annoncesPush} hint={c.annoncesPushAide} defaultChecked={prefs.annonces_push} />
      <FormAlert state={state} />
      <div className="flex items-center justify-end gap-3">{state.status === "success" ? <span className="text-[13px] text-ok">{c.preferencesEnregistrees}</span> : null}<SubmitButton>{dict.common.save}</SubmitButton></div>
    </form>
  );
}
