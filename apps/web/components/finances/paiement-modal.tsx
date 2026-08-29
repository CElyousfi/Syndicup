"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { Segmented } from "../ui/tabs";
import { Field, Input, Select, Checkbox } from "../ui/field";
import { FormAlert, SubmitButton } from "../ui/form";
import { Button, ButtonLink } from "../ui/button";
import { Badge } from "../ui/badge";
import { Banner } from "../ui/banner";
import { IDLE } from "../../lib/forms";
import type { Dict, Locale } from "../../lib/i18n";
import type { MethodePaiement, StatutLigneAppel } from "../../lib/api/types";
import { formatMAD } from "../../lib/format";
import { ligneAppelVariant } from "../../lib/status";
import { enregistrerPaiement } from "../../app/[locale]/(app)/finances/actions";
import { IconCoins } from "../ui/icons";

interface LigneOption {
  id: string;
  libelle: string;
  restant: string;
}
interface LotOption {
  id: string;
  numero: string;
}

interface ResultatPaiement {
  mode: "cible" | "fifo";
  statut?: StatutLigneAppel;
  affectations?: Array<{ appel_de_fonds_lot_id: string; montant: string; statut: StatutLigneAppel }>;
  quittanceId: string | null;
}

/**
 * D4 — enregistrement d'un paiement (syndic). Deux modes exclusifs : ligne ciblée ou FIFO par
 * lot. Le bouton « Réessayer » est toujours sûr (Idempotency-Key côté action).
 */
export function PaiementModal({
  dict,
  locale,
  lignes,
  lots,
  modeInitial = "cible",
  ligneInitiale,
  lotInitial,
  triggerVariant = "primary",
  triggerSize = "md",
}: {
  dict: Dict;
  locale: Locale;
  lignes: LigneOption[];
  lots: LotOption[];
  modeInitial?: "cible" | "fifo";
  ligneInitiale?: string;
  lotInitial?: string;
  triggerVariant?: "primary" | "secondary";
  triggerSize?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"cible" | "fifo">(modeInitial);
  const [state, action] = useActionState(enregistrerPaiement, IDLE);
  const [resultat, setResultat] = useState<ResultatPaiement | null>(null);

  useEffect(() => {
    if (state.status === "success") setResultat(state.data as ResultatPaiement);
  }, [state]);

  const fermer = () => {
    setOpen(false);
    setResultat(null);
  };

  const f = dict.finances;

  return (
    <>
      <Button variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)}>
        <IconCoins width={16} height={16} />
        {f.enregistrerPaiement}
      </Button>
      <Modal
        open={open}
        onClose={fermer}
        title={f.paiementTitre}
        closeLabel={dict.common.close}
      >
        {resultat ? (
          <div className="space-y-4">
            <Banner variant="ok" title={f.paiementEnregistre}>
              {resultat.quittanceId ? f.quittanceGeneree : null}
            </Banner>
            {resultat.mode === "fifo" && resultat.affectations ? (
              <div className="rounded-xl border border-hairline">
                <p className="border-b border-hairline px-4 py-2.5 text-[13px] font-semibold text-ink">
                  {f.fifoRepartition}
                </p>
                <ul className="divide-y divide-hairline">
                  {resultat.affectations.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="tnum text-sm font-medium text-ink">
                        {formatMAD(a.montant, locale)}
                      </span>
                      <Badge variant={ligneAppelVariant[a.statut]}>
                        {a.statut === "PAYE" ? f.fifoLigneSoldee : f.fifoLignePartielle}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              {resultat.quittanceId ? (
                <ButtonLink href={`/${locale}/finances/quittances/${resultat.quittanceId}`}>
                  {f.voirQuittance}
                </ButtonLink>
              ) : null}
              <Button variant="secondary" onClick={fermer}>
                {dict.common.close}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="mode" value={mode} />

            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "cible", label: f.paiementCible },
                { value: "fifo", label: f.paiementFifo },
              ]}
            />

            {mode === "cible" ? (
              <Field label={f.ligneConcernee} htmlFor="appel_de_fonds_lot_id" hint={f.paiementLigneAide} required>
                <Select
                  id="appel_de_fonds_lot_id"
                  name="appel_de_fonds_lot_id"
                  defaultValue={ligneInitiale ?? ""}
                  required
                >
                  {lignes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.libelle} — {formatMAD(l.restant, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label={dict.espaces.pourLot} htmlFor="lot_id" hint={f.paiementFifoAide} required>
                <Select id="lot_id" name="lot_id" defaultValue={lotInitial ?? ""} required>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.numero}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${f.montant} (${dict.common.mad})`} htmlFor="montant" required>
                <Input
                  id="montant"
                  name="montant"
                  inputMode="decimal"
                  dir="ltr"
                  pattern="\d{1,12}([.]\d{1,2})?"
                  placeholder="0.00"
                  required
                  className="tnum text-start"
                />
              </Field>
              <Field label={f.methode} htmlFor="methode" required>
                <Select id="methode" name="methode" required defaultValue="VIREMENT">
                  {(["VIREMENT", "ESPECES", "CHEQUE"] as MethodePaiement[]).map((m) => (
                    <option key={m} value={m}>
                      {dict.enums.methodePaiement[m]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label={f.payeur}
              htmlFor="payeur_utilisateur_id"
              hint={f.payeurAide}
              optionalLabel={dict.common.optional}
            >
              <Input id="payeur_utilisateur_id" name="payeur_utilisateur_id" dir="ltr" className="font-mono text-[13px] text-start" />
            </Field>

            {mode === "cible" ? (
              <Checkbox name="accepter_trop_percu" label={f.tropPercu} hint={f.tropPercuAide} />
            ) : null}

            <FormAlert state={state} />

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={fermer}>
                {dict.common.cancel}
              </Button>
              <SubmitButton>{f.enregistrerPaiement}</SubmitButton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
