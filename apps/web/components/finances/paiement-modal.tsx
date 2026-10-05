"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { Segmented } from "../ui/tabs";
import { Field, Input, Select, Checkbox } from "../ui/field";
import { FormAlert, SubmitButton } from "../ui/form";
import { Button, ButtonLink } from "../ui/button";
import { Badge } from "../ui/badge";
import { Illustration } from "../ui/illustration";
import { IDLE } from "../../lib/forms";
import { celebrate } from "../../lib/success";
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

  const f = dict.finances;

  // Paiement = action majeure : écran de succès plein (Wise). La répartition FIFO, elle, reste
  // affichée dans la modale (information utile), avec la même illustration.
  const { paiementEnregistre, quittanceGeneree, voirQuittance } = f;
  useEffect(() => {
    if (state.status !== "success") return;
    const r = state.data as ResultatPaiement;
    if (r.mode === "fifo" && r.affectations && r.affectations.length > 0) {
      setResultat(r);
      return;
    }
    setOpen(false);
    celebrate({
      titre: paiementEnregistre,
      corps: r.quittanceId ? quittanceGeneree : undefined,
      illustration: "ok-paiement",
      href: r.quittanceId ? `/${locale}/finances/quittances/${r.quittanceId}` : undefined,
      hrefLabel: r.quittanceId ? voirQuittance : undefined,
    });
  }, [state, locale, paiementEnregistre, quittanceGeneree, voirQuittance]);

  const fermer = () => {
    setOpen(false);
    setResultat(null);
  };

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
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <Illustration name="ok-paiement" size={120} fallback={<PaiementOk />} />
              <p className="mt-3 text-[20px] font-bold tracking-tight text-ink">{f.paiementEnregistre}</p>
              {resultat.quittanceId ? (
                <p className="mt-1 max-w-sm text-[14px] leading-relaxed text-soft">{f.quittanceGeneree}</p>
              ) : null}
            </div>
            {resultat.mode === "fifo" && resultat.affectations ? (
              <div className="rounded-[20px] bg-tile px-4 py-3">
                <p className="pb-2 text-[13px] font-semibold text-ink">{f.fifoRepartition}</p>
                <ul className="divide-y divide-wash-strong">
                  {resultat.affectations.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="tnum text-[15px] font-semibold text-ink">
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
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={fermer}>
                {dict.common.close}
              </Button>
              {resultat.quittanceId ? (
                <ButtonLink href={`/${locale}/finances/quittances/${resultat.quittanceId}`}>
                  {f.voirQuittance}
                </ButtonLink>
              ) : null}
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

/** Repli dessiné du succès de paiement (tant que l'illustration 2D manque). */
function PaiementOk() {
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
      <circle cx="56" cy="56" r="50" fill="var(--color-sage-tint)" />
      <circle cx="56" cy="56" r="34" fill="var(--color-lime)" />
      <path d="M41 57l10 10 21-22" fill="none" stroke="var(--color-ink)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
