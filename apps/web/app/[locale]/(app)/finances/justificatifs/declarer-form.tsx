"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Field, Input, Select } from "../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../components/ui/form";
import { Banner } from "../../../../../components/ui/banner";
import { IDLE, fieldError } from "../../../../../lib/forms";
import type { Dict, Locale } from "../../../../../lib/i18n";
import type { CompteBancaire } from "../../../../../lib/api/types";
import { formatMAD, formatPeriode } from "../../../../../lib/format";
import { IconCamera, IconPlus } from "../../../../../components/ui/icons";
import { celebrate } from "../../../../../lib/success";
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

  // Virement déclaré / espèces remises = geste de paiement : écran de succès plein (Wise).
  const type = state.status === "success" ? (state.data as { type?: string } | undefined)?.type : undefined;
  const titreSucces = mode === "especes" ? (type === "PAIEMENT" ? j.especesPaiement : j.especesSaisie) : j.declare;
  const corpsSucces = mode === "especes" ? j.especesAideGardien : j.declareAide;
  const succes = state.status === "success";
  useEffect(() => {
    if (succes) celebrate({ titre: titreSucces, corps: corpsSucces, illustration: "ok-paiement" });
  }, [succes, titreSucces, corpsSucces]);

  if (succes) {
    return (
      <Banner variant="ok" title={titreSucces}>
        {corpsSucces}
      </Banner>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {auNom ? <input type="hidden" name="au_nom" value="1" /> : null}
      <Card>
        <SectionHeader title={mode === "especes" ? j.especesSaisir : j.declarerTitre} subtitle={mode === "especes" ? j.especesAideGardien : j.declarerAide} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
        <div className="mt-4">
        <Field label={j.preuve} htmlFor="preuve" hint={j.preuveAide} required={mode === "declarer" && !auNom} optionalLabel={mode === "declarer" && !auNom ? undefined : dict.common.optional} error={fieldError(state, "preuve")}>
          <div className="flex flex-wrap gap-2">
            <label className="su-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-btn border-[1.5px] border-link px-4 text-[13px] font-semibold text-link transition-colors hover:bg-action-wash has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-action">
              <IconCamera width={16} height={16} />{j.prendrePhoto}
              <input type="file" name="preuve" accept="image/*" capture="environment" className="sr-only" />
            </label>
            <label className="su-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-btn border-[1.5px] border-link px-4 text-[13px] font-semibold text-link transition-colors hover:bg-action-wash has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-action">
              <IconPlus width={16} height={16} />{j.choisirFichier}
              <input id="preuve" type="file" name="preuve" accept="image/*,application/pdf" className="sr-only" />
            </label>
          </div>
        </Field>
        </div>
        <div className="mt-4 empty:hidden"><FormAlert state={state} /></div>
        <div className="mt-5 flex justify-end"><SubmitButton className="w-full sm:w-auto">{mode === "especes" ? j.especesSaisir : j.declarer}</SubmitButton></div>
      </Card>
    </form>
  );
}
