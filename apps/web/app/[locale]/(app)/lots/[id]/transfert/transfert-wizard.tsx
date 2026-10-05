"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Field, Input, Checkbox } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Button, ButtonLink } from "../../../../../../components/ui/button";
import { Banner } from "../../../../../../components/ui/banner";
import { IrreversibleNotice } from "../../../../../../components/ui/modal";
import { CopyButton } from "../../../../../../components/ui/copy";
import { IDLE } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import { formatMAD } from "../../../../../../lib/format";
import { transfererPropriete } from "../../actions";
import { IconCheck } from "../../../../../../components/ui/icons";
import { IconCircle } from "../../../../../../components/ui/color-icons";
import { celebrate } from "../../../../../../lib/success";

/** C5 — assistant en 3 étapes, ConfirmDialog intégré à la dernière étape (irréversible). */
export function TransfertWizard({
  dict,
  locale,
  lotId,
  lotNumero,
  soldeDu,
  aDette,
}: {
  dict: Dict;
  locale: Locale;
  lotId: string;
  lotNumero: string;
  soldeDu: string;
  aDette: boolean;
}) {
  const [etape, setEtape] = useState(1);
  const [detteReprise, setDetteReprise] = useState(false);
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [confirme, setConfirme] = useState(false);
  const [state, action] = useActionState(transfererPropriete, IDLE);

  const t = dict.lots;
  const coordonneesOk = email.trim() !== "" || telephone.trim() !== "";

  const resultat = useMemo(
    () =>
      state.status === "success"
        ? (state.data as { code: string; expireLe: string })
        : null,
    [state]
  );
  // Transfert enregistré : moment majeur, annoncé en plein écran (le code reste affiché dessous).
  useEffect(() => {
    if (resultat) celebrate({ titre: t.transfertReussi, illustration: "ok-general" });
  }, [resultat, t.transfertReussi]);

  if (resultat) {
    return (
      <div className="card max-w-xl space-y-5 p-6 sm:p-7">
        <div className="flex items-center gap-3.5">
          <IconCircle tone="ok" size={48}>
            <IconCheck className="text-ok" />
          </IconCircle>
          <h2 className="text-[19px] font-bold tracking-tight text-ink">{t.transfertReussi}</h2>
        </div>
        <p className="text-[14px] text-body">{t.transfertCodeInvitation}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-surface px-5 py-4">
          <span className="font-mono text-[26px] font-bold tracking-[0.25em] text-ink" dir="ltr">
            {resultat.code}
          </span>
          <CopyButton
            value={resultat.code}
            label={dict.common.copy}
            copiedLabel={dict.common.copied}
          />
        </div>
        <Banner variant="info">{t.transfertRappel}</Banner>
        <div className="flex justify-end">
          <ButtonLink href={`/${locale}/lots/${lotId}`}>{t.voirFiche}</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card max-w-xl space-y-6 p-6 sm:p-7">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="lot_id" value={lotId} />

      {/* Fil d'étapes */}
      <ol className="flex items-center gap-2">
        {[t.transfertEtape1, t.transfertEtape2, t.transfertEtape3].map((label, i) => {
          const n = i + 1;
          const fait = etape > n;
          const actif = etape === n;
          return (
            <li key={n} className="flex min-w-0 flex-1 items-center gap-2.5">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                  fait
                    ? "bg-ok text-white"
                    : actif
                      ? "bg-brand text-white ring-4 ring-cta"
                      : "bg-surface text-soft"
                }`}
              >
                {fait ? <IconCheck width={14} height={14} /> : n}
              </span>
              <span
                className={`hidden truncate text-[13px] font-semibold sm:block ${
                  actif ? "text-ink" : "text-soft"
                }`}
              >
                {label}
              </span>
              {n < 3 ? (
                <span
                  className={`h-0.5 min-w-3 flex-1 rounded-full ${fait ? "bg-ok/50" : "bg-wash-strong"}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Titre de l'étape courante (lisible aussi sur mobile, où le fil masque les libellés) */}
      <h2 className="text-[19px] font-bold tracking-tight text-ink">
        {[t.transfertEtape1, t.transfertEtape2, t.transfertEtape3][etape - 1]}
      </h2>

      {/* Étape 1 — solde */}
      <div className={etape === 1 ? "space-y-4" : "hidden"}>
        {aDette ? (
          <>
            <Banner variant="warn" title={fill(t.transfertDette, { montant: formatMAD(soldeDu, locale) })} />
            <Checkbox
              name="dette_reprise_acquereur"
              checked={detteReprise}
              onChange={(e) => setDetteReprise(e.target.checked)}
              label={t.transfertDetteReprise}
              hint={t.transfertDetteRepriseAide}
            />
          </>
        ) : (
          <>
            <Banner variant="ok">{t.transfertSoldeNul}</Banner>
            {/* Champ requis par l'API même sans dette : attestation explicite. */}
            <input type="hidden" name="dette_reprise_acquereur" value="" />
          </>
        )}
        <div className="flex justify-end">
          <Button type="button" onClick={() => setEtape(2)} disabled={aDette && !detteReprise}>
            {dict.common.next}
          </Button>
        </div>
      </div>

      {/* Étape 2 — coordonnées */}
      <div className={etape === 2 ? "space-y-4" : "hidden"}>
        <p className="text-[14px] text-body">{t.transfertCoordonneesAide}</p>
        <Field label={dict.auth.emailLabel} htmlFor="email" optionalLabel={dict.common.optional}>
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-start"
          />
        </Field>
        <Field
          label={dict.auth.phoneLabel}
          htmlFor="telephone"
          optionalLabel={dict.common.optional}
        >
          <Input
            id="telephone"
            name="telephone"
            type="tel"
            dir="ltr"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="+212 6 00 00 00 00"
            className="text-start"
          />
        </Field>
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="secondary" onClick={() => setEtape(1)}>
            {dict.common.previous}
          </Button>
          <Button type="button" onClick={() => setEtape(3)} disabled={!coordonneesOk}>
            {dict.common.next}
          </Button>
        </div>
      </div>

      {/* Étape 3 — confirmation irréversible */}
      <div className={etape === 3 ? "space-y-4" : "hidden"}>
        <IrreversibleNotice>
          {t.transfertConfirmeAide}
          <span className="mt-1 block font-semibold">{dict.common.irreversible}</span>
        </IrreversibleNotice>
        <Checkbox
          checked={confirme}
          onChange={(e) => setConfirme(e.target.checked)}
          label={fill(t.transfertConfirme, {})}
          hint={`${dict.enums.typeLot.APPARTEMENT} ${lotNumero}`}
        />
        <FormAlert state={state} />
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="secondary" onClick={() => setEtape(2)}>
            {dict.common.previous}
          </Button>
          <SubmitButton variant="danger" disabled={!confirme}>
            {t.transferer}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
