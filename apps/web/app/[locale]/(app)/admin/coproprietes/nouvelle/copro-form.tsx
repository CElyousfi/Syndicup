"use client";

/**
 * Assistant « nouvelle résidence » (console opérateur) — le périmètre exact du super admin :
 *  1. La résidence — informations de base ;
 *  2. Le syndic — première invitation : code + QR + partage WhatsApp.
 * Tout le reste (lots, résidents, finances…) est le travail du syndic invité, dans SON
 * espace. La personne invitée crée elle-même ses identifiants : aucun mot de passe géré ici.
 */
import { useActionState, useEffect, useMemo, useState } from "react";
import { Field, Input, Select } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Banner } from "../../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../../components/ui/button";
import { CopyButton } from "../../../../../../components/ui/copy";
import { IconCircle, CHandshake } from "../../../../../../components/ui/color-icons";
import { IconCheck } from "../../../../../../components/ui/icons";
import { IDLE, fieldError } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import { formatDateHeure } from "../../../../../../lib/format";
import type { CanalInvitation, TypeResidence } from "../../../../../../lib/api/types";
import { creerCopropriete, inviterSyndicAdmin } from "../../actions";
import { CodeInvitation } from "../../../invitations/invitation-modals";
import { celebrate } from "../../../../../../lib/success";

export function CoproForm({ dict, locale }: { dict: Dict; locale: Locale }) {
  const ad = dict.admin;
  const [etape, setEtape] = useState<1 | 2>(1);
  const [copro, setCopro] = useState<{ id: string; nom: string } | null>(null);
  const etapes = [ad.etapeInfos, ad.etapeSyndic];

  return (
    <div className="max-w-2xl">
      {/* Fil d'avancement */}
      <ol className="mb-6 flex items-center gap-2">
        {etapes.map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const faite = etape > n;
          const active = etape === n;
          return (
            <li key={label} className="flex min-w-0 items-center gap-2">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                  faite ? "bg-ok text-white" : active ? "bg-brand text-white ring-4 ring-cta" : "bg-tile text-soft"
                }`}
              >
                {faite ? <IconCheck width={15} height={15} /> : n}
              </span>
              <span className={`truncate text-[14px] font-semibold ${active ? "text-ink" : "text-soft"}`}>
                {label}
              </span>
              {n < 2 ? <span className={`mx-1 h-0.5 w-8 shrink-0 rounded-full ${faite ? "bg-ok/50" : "bg-wash-strong"}`} /> : null}
            </li>
          );
        })}
      </ol>

      {etape === 1 ? (
        <EtapeInfos
          dict={dict}
          locale={locale}
          onCreee={(c) => {
            setCopro(c);
            setEtape(2);
          }}
        />
      ) : null}
      {etape === 2 && copro ? <EtapeSyndic dict={dict} locale={locale} copro={copro} /> : null}
    </div>
  );
}

/* ── Étape 1 : la résidence ─────────────────────────────────────────────── */

function EtapeInfos({
  dict,
  locale,
  onCreee,
}: {
  dict: Dict;
  locale: Locale;
  onCreee: (c: { id: string; nom: string }) => void;
}) {
  const [state, action] = useActionState(creerCopropriete, IDLE);
  const pa = dict.parametres;

  const creee = useMemo(
    () => (state.status === "success" ? (state.data as { id: string; nom: string }) : null),
    [state]
  );
  // Transition d'étape hors rendu (un setState parent pendant le rendu est interdit).
  useEffect(() => {
    if (creee) onCreee(creee);
  }, [creee, onCreee]);
  if (creee) return null;

  return (
    <form action={action} className="card space-y-4 p-6 sm:p-7">
      <input type="hidden" name="locale" value={locale} />
      <Field label={pa.nom} htmlFor="n_nom" required error={fieldError(state, "nom")}>
        <Input id="n_nom" name="nom" required maxLength={200} />
      </Field>
      <Field label={pa.adresse} htmlFor="n_adresse" required error={fieldError(state, "adresse")}>
        <Input id="n_adresse" name="adresse" required maxLength={500} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={pa.ville} htmlFor="n_ville" required error={fieldError(state, "ville")}>
          <Input id="n_ville" name="ville" required maxLength={100} />
        </Field>
        <Field label={pa.nbLots} htmlFor="n_nb" required error={fieldError(state, "nb_lots")}>
          <Input id="n_nb" name="nb_lots" type="number" min={1} max={10000} required className="tnum" />
        </Field>
      </div>
      <Field label={pa.typeResidence} htmlFor="n_type" required>
        <Select id="n_type" name="type_residence" defaultValue="IMMEUBLE_COLLECTIF" required>
          {(Object.keys(dict.enums.typeResidence) as TypeResidence[]).map((t) => (
            <option key={t} value={t}>
              {dict.enums.typeResidence[t]}
            </option>
          ))}
        </Select>
      </Field>
      <FormAlert state={state} />
      <div className="flex justify-end border-t border-wash-strong pt-5">
        <SubmitButton>{dict.common.create}</SubmitButton>
      </div>
    </form>
  );
}

/* ── Étape 2 : le premier syndic ────────────────────────────────────────── */

function EtapeSyndic({
  dict,
  locale,
  copro,
}: {
  dict: Dict;
  locale: Locale;
  copro: { id: string; nom: string };
}) {
  const ad = dict.admin;
  const [state, action] = useActionState(inviterSyndicAdmin, IDLE);
  const resultat = useMemo(
    () => (state.status === "success" ? (state.data as { code: string; expireLe: string }) : null),
    [state]
  );
  const canaux = Object.keys(dict.enums.canal) as CanalInvitation[];
  // Invitation du premier syndic émise : écran de succès plein écran (le code reste affiché dessous).
  useEffect(() => {
    if (resultat) celebrate({ titre: ad.codePret, corps: copro.nom, illustration: "ok-invitation" });
  }, [resultat, ad.codePret, copro.nom]);

  if (resultat) {
    const lien =
      typeof window !== "undefined"
        ? `${window.location.origin}/${locale}/invitation/${resultat.code}`
        : "";
    const message = fill(ad.messageWhatsApp, { nom: copro.nom, lien, code: resultat.code });
    return (
      <div className="card space-y-5 p-5 sm:p-7">
        <Banner variant="ok" title={ad.codePret}>
          {copro.nom}
        </Banner>
        <CodeInvitation
          code={resultat.code}
          lien={lien}
          pied={fill(dict.auth.inviteExpireLe, { date: formatDateHeure(resultat.expireLe, locale) })}
          actions={
            <>
              <CopyButton value={resultat.code} label={dict.common.copy} copiedLabel={dict.common.copied} />
              <ButtonLink
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
                variant="secondary"
                size="sm"
              >
                {ad.partagerWhatsApp}
              </ButtonLink>
            </>
          }
        />
        <div className="flex justify-end border-t border-wash-strong pt-5">
          <ButtonLink href={`/${locale}/admin/coproprietes/${copro.id}`}>{ad.terminer}</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-5 p-6 sm:p-7">
      <input type="hidden" name="copropriete_id" value={copro.id} />
      <div className="flex items-start gap-3.5">
        <IconCircle tone="sand" size={48}>
          <CHandshake />
        </IconCircle>
        <div className="min-w-0">
          <h2 className="text-[19px] font-bold tracking-tight text-ink">{ad.inviterSyndic}</h2>
          <p className="mt-1 text-[13px] text-soft">{ad.syndicAide}</p>
        </div>
      </div>
      <Field label={dict.invitations.canal} htmlFor="w_canal" required>
        <Select id="w_canal" name="canal" defaultValue="WHATSAPP" required>
          {canaux.map((c) => (
            <option key={c} value={c}>
              {dict.enums.canal[c]}
            </option>
          ))}
        </Select>
      </Field>
      <FormAlert state={state} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-wash-strong pt-5">
        <ButtonLink href={`/${locale}/admin/coproprietes/${copro.id}`} variant="ghost">
          {ad.plusTard}
        </ButtonLink>
        <SubmitButton>{ad.inviterSyndic}</SubmitButton>
      </div>
    </form>
  );
}
