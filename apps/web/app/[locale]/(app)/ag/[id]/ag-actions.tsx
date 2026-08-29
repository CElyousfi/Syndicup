"use client";

import { useActionState, useState } from "react";
import { Modal, IrreversibleNotice } from "../../../../../components/ui/modal";
import { Field, Input, Select, Textarea } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Button, ButtonLink } from "../../../../../components/ui/button";
import { IDLE } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import {
  ajouterResolution,
  annulerAg,
  convoquerAg,
  donnerProcuration,
  ouvrirAg,
  revoquerProcuration,
} from "../actions";
import { IconPlus, IconSend } from "../../../../../components/ui/icons";

/** Bouton « Convoquer » — l'état gaté légal (422) s'affiche en bannière, jamais en erreur. */
export function ConvoquerForm({
  dict,
  locale,
  agId,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
}) {
  const [state, action] = useActionState(convoquerAg, IDLE);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="ag_id" value={agId} />
      <FormAlert
        state={state}
        legalGateTitle={dict.legalGate.banner}
        legalGateAction={
          <ButtonLink href={`/${locale}/parametres#legaux`} variant="secondary" size="sm">
            {dict.legalGate.goToSettings}
          </ButtonLink>
        }
      />
      <SubmitButton size="lg" className="w-full">
        <IconSend width={16} height={16} />
        {dict.ag.convoquer}
      </SubmitButton>
    </form>
  );
}

export function OuvrirForm({
  dict,
  locale,
  agId,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
}) {
  const [state, action] = useActionState(ouvrirAg, IDLE);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="ag_id" value={agId} />
      <FormAlert
        state={state}
        legalGateTitle={dict.legalGate.banner}
        legalGateAction={
          <ButtonLink href={`/${locale}/parametres#legaux`} variant="secondary" size="sm">
            {dict.legalGate.goToSettings}
          </ButtonLink>
        }
      />
      <SubmitButton size="lg" className="w-full">{dict.ag.ouvrirSeance}</SubmitButton>
    </form>
  );
}

export function AnnulerModal({
  dict,
  locale,
  agId,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(annulerAg, IDLE);
  return (
    <>
      <Button variant="dangerGhost" onClick={() => setOpen(true)}>
        {dict.ag.annuler}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={dict.ag.annuler} closeLabel={dict.common.close}>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{dict.common.updated}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="ag_id" value={agId} />
            <Field label={dict.ag.annulerMotif} htmlFor="motif" required>
              <Textarea id="motif" name="motif" required minLength={3} />
            </Field>
            <p className="text-[13px] text-soft">{dict.ag.annulerCorps}</p>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.back}
              </Button>
              <SubmitButton variant="danger">{dict.ag.annuler}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function ResolutionModal({
  dict,
  locale,
  agId,
  prochainOrdre,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  prochainOrdre: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(ajouterResolution, IDLE);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <IconPlus width={15} height={15} />
        {dict.ag.ajouterResolution}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={dict.ag.ajouterResolution} closeLabel={dict.common.close} wide>
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{dict.common.updated}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="ag_id" value={agId} />
            <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
              <Field label={dict.ag.ordre} htmlFor="ordre" required>
                <Input
                  id="ordre"
                  name="ordre"
                  type="number"
                  min={1}
                  defaultValue={prochainOrdre}
                  required
                  className="tnum"
                />
              </Field>
              <Field label={dict.ag.typeMajorite} htmlFor="type_majorite" required>
                <Select id="type_majorite" name="type_majorite" defaultValue="SIMPLE" required>
                  {(["SIMPLE", "DOUBLE", "UNANIMITE"] as const).map((m) => (
                    <option key={m} value={m}>
                      {dict.enums.typeMajorite[m]} — {dict.enums.typeMajoriteAide[m]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={dict.ag.texteResolution} htmlFor="texte" required>
              <Textarea id="texte" name="texte" required minLength={3} rows={4} />
            </Field>
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.common.add}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/** E4 — donner procuration (cas d'usage clé du MRE). */
export function ProcurationModal({
  dict,
  locale,
  agId,
  mesLots,
  membres,
  syndic,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  mesLots: Array<{ id: string; numero: string }>;
  membres: Array<{ id: string; nom: string; lots: string[] }>;
  /** Le syndic peut saisir une procuration papier pour un mandant tiers. */
  syndic: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(donnerProcuration, IDLE);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {dict.ag.donnerProcuration}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={dict.ag.donnerProcuration}
        subtitle={dict.ag.procurationsAide}
        closeLabel={dict.common.close}
      >
        {state.status === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-strong">{dict.ag.procurationDonnee}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="ag_id" value={agId} />
            <Field label={dict.invitations.lot} htmlFor="proc_lot" required>
              <Select id="proc_lot" name="lot_id" required defaultValue={mesLots[0]?.id ?? ""}>
                {mesLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.numero}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={dict.ag.mandataire} htmlFor="proc_mandataire" hint={dict.ag.mandataireAide} required>
              <>
                <Input
                  id="proc_mandataire"
                  name="mandataire_id"
                  list="proc-membres"
                  dir="ltr"
                  required
                  pattern="[0-9a-fA-F-]{36}"
                  className="font-mono text-[13px] text-start"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
                <datalist id="proc-membres">
                  {membres.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom} · {m.lots.join(", ")}
                    </option>
                  ))}
                </datalist>
              </>
            </Field>
            {syndic ? (
              <Field
                label={dict.ag.mandant}
                htmlFor="proc_mandant"
                optionalLabel={dict.common.optional}
              >
                <Input
                  id="proc_mandant"
                  name="mandant_id"
                  list="proc-membres"
                  dir="ltr"
                  pattern="[0-9a-fA-F-]{36}"
                  className="font-mono text-[13px] text-start"
                />
              </Field>
            ) : null}
            <FormAlert state={state} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{dict.ag.donnerProcuration}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function RevoquerForm({
  dict,
  locale,
  agId,
  procurationId,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  procurationId: string;
}) {
  const [state, action] = useActionState(revoquerProcuration, IDLE);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="ag_id" value={agId} />
      <input type="hidden" name="procuration_id" value={procurationId} />
      <SubmitButton variant="dangerGhost" size="sm">
        {dict.ag.revoquer}
      </SubmitButton>
      {state.status === "error" ? (
        <p className="text-[12px] text-danger">{state.message}</p>
      ) : null}
    </form>
  );
}

/** Clôture (pupitre) — ConfirmDialog irréversible. */
export function CloturerModal({
  dict,
  locale,
  agId,
  action: cloturer,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  action: (prev: import("../../../../../lib/forms").FormState, fd: FormData) => Promise<import("../../../../../lib/forms").FormState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(cloturer, IDLE);
  return (
    <>
      <Button variant="danger" size="lg" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        {dict.ag.cloturer}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={dict.ag.cloturer} closeLabel={dict.common.close}>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="ag_id" value={agId} />
          <IrreversibleNotice>{dict.ag.cloturerCorps}</IrreversibleNotice>
          <FormAlert state={state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton variant="danger">{dict.ag.cloturer}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
