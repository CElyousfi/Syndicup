"use client";

import { useActionState, useMemo, useState } from "react";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Field, Input, Select } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Banner } from "../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { CompteBancaire } from "../../../../../lib/api/types";
import { formatMAD, formatPeriode } from "../../../../../lib/format";
import { IconCamera, IconPlus } from "../../../../../components/ui/icons";
import { declarerJustificatif, saisirEspeces } from "./actions";

export interface LotOption { id: string; numero: string }
export interface LigneOption { id: string; lotId: string; periode: string; restant: string }

/**
 * Formulaire « Déclarer un paiement » (résident, ou syndic/gardien au nom d'un lot) et « Remise
 * d'espèces » (gardien/syndic). La preuve est un fichier (photo ou PDF) téléversé par l'action.
 */
export function DeclarerForm({ dict, locale, lots, lignes, comptes, mode, auNom = false }: { dict: Dict; locale: Locale; lots: LotOption[]; lignes: LigneOption[]; comptes: CompteBancaire[]; mode: "declarer" | "especes"; auNom?: boolean }) {
  const [state, action] = useActionState(mode === "especes" ? saisirEspeces : declarerJustificatif, IDLE);
  const j = dict.justificatifs;
  const e = dict.enumsJustificatifs;
  const [lotId, setLotId] = useState(lots[0]?.id ?? "");
  const [methode, setMethode] = useState<"VIREMENT" | "CHEQUE" | "ESPECES">(mode === "especes" ? "ESPECES" : "VIREMENT");
  const lignesDuLot = useMemo(() => lignes.filter((l) => l.lotId === lotId), [lignes, lotId]);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  if (state.status === "success") {
    const type = (state.data as { type?: string } | undefined)?.type;
    return (
      <Banner variant="ok" title={mode === "especes" ? (type === "PAIEMENT" ? j.especesPaiement : j.especesSaisie) : j.declare}>
        {mode === "especes" ? j.especesAideGardien : j.declareAide}
      </Banner>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {auNom ? <input type="hidden" name="au_nom" value="1" /> : null}
      <Card>
        <SectionHeader title={mode === "especes" ? j.especesSaisir : j.declarerTitre} subtitle={mode === "especes" ? j.especesAideGardien : j.declarerAide} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={j.lot} htmlFor="lot_id" required error={fieldError(state, "lot_id")}>
            <Select id="lot_id" name="lot_id" required value={lotId} onChange={(ev) => setLotId(ev.target.value)}>
              {lots.map((l) => <option key={l.id} value={l.id}>{l.numero}</option>)}
            </Select>
          </Field>
          <Field label={j.appel} htmlFor="appel_de_fonds_lot_id" required>
            <Select id="appel_de_fonds_lot_id" name="appel_de_fonds_lot_id" defaultValue="SOLDE">
              <option value="SOLDE">{j.surSolde}</option>
              {lignesDuLot.map((l) => <option key={l.id} value={l.id}>{formatPeriode(l.periode, locale)} · {j.restant} {formatMAD(l.restant, locale)}</option>)}
            </Select>
          </Field>
          <Field label={`${j.montant} (${dict.common.mad})`} htmlFor="montant" required error={fieldError(state, "montant")}>
            <Input id="montant" name="montant" inputMode="decimal" dir="ltr" pattern="\d{1,12}([.]\d{1,2})?" required className="tnum text-start" />
          </Field>
          <Field label={j.datePaiement} htmlFor="date_paiement" required error={fieldError(state, "date_paiement")}>
            <Input id="date_paiement" name="date_paiement" type="date" dir="ltr" required defaultValue={aujourdhui} className="tnum text-start" />
          </Field>
          {mode === "declarer" ? (
            <>
              <Field label={j.methode} htmlFor="methode" required>
                <Select id="methode" name="methode" required value={methode} onChange={(ev) => setMethode(ev.target.value as typeof methode)}>
                  {(["VIREMENT", "CHEQUE", "ESPECES"] as const).map((m) => <option key={m} value={m}>{e.methode[m]}</option>)}
                </Select>
              </Field>
              <Field label={j.beneficiaire} htmlFor="beneficiaire" required error={fieldError(state, "beneficiaire")}>
                {comptes.length > 0 ? (
                  <Select id="beneficiaire" name="beneficiaire" required defaultValue={comptes[0]!.libelle}>
                    {comptes.map((c) => <option key={c.index} value={c.libelle}>{c.libelle} · {c.banque} · {c.rib_masque}</option>)}
                  </Select>
                ) : (
                  <Input id="beneficiaire" name="beneficiaire" required maxLength={200} placeholder={j.compte} />
                )}
              </Field>
              {methode !== "ESPECES" ? (
                <>
                  <Field label={j.banqueEmettrice} htmlFor="banque_emettrice" optionalLabel={dict.common.optional}>
                    <Input id="banque_emettrice" name="banque_emettrice" maxLength={120} />
                  </Field>
                  <Field label={j.reference} htmlFor="reference" hint={j.referenceAide} optionalLabel={dict.common.optional} error={fieldError(state, "reference")}>
                    <Input id="reference" name="reference" dir="ltr" maxLength={120} className="text-start" />
                  </Field>
                </>
              ) : null}
            </>
          ) : (
            <Field label={j.commentaire} htmlFor="commentaire" optionalLabel={dict.common.optional}>
              <Input id="commentaire" name="commentaire" maxLength={500} />
            </Field>
          )}
        </div>
        <Field label={j.preuve} htmlFor="preuve" hint={j.preuveAide} required={mode === "declarer" && !auNom} optionalLabel={mode === "declarer" && !auNom ? undefined : dict.common.optional} error={fieldError(state, "preuve")}>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink hover:bg-hover">
              <IconCamera width={16} height={16} />{j.prendrePhoto}
              <input type="file" name="preuve" accept="image/*" capture="environment" className="sr-only" />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink hover:bg-hover">
              <IconPlus width={16} height={16} />{j.choisirFichier}
              <input id="preuve" type="file" name="preuve" accept="image/*,application/pdf" className="sr-only" />
            </label>
          </div>
        </Field>
        <FormAlert state={state} />
        <div className="mt-4 flex justify-end"><SubmitButton>{mode === "especes" ? j.especesSaisir : j.declarer}</SubmitButton></div>
      </Card>
    </form>
  );
}
