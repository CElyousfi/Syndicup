import { apiPublic } from "../../../../../lib/api/client";
import type { InviteApercu } from "../../../../../lib/api/types";
import { getDict, fill, isLocale, type Locale } from "../../../../../lib/i18n";
import { formatDateHeure } from "../../../../../lib/format";
import { readSession, readInvitationJeton } from "../../../../../lib/session";
import { AcceptForm } from "./accept-form";
import { InscriptionForm } from "./inscription-form";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Badge } from "../../../../../components/ui/badge";
import { IconCircle, CHandshake, CKey } from "../../../../../components/ui/color-icons";

/**
 * Cible des QR codes et des codes saisis. L'invité voit immédiatement QUI l'invite
 * (copropriété, rôle, validité) puis :
 *  - sans compte : un seul formulaire (identité + email + mot de passe) → compte créé,
 *    rattaché à la copropriété, session ouverte ;
 *  - déjà connecté : acceptation en un geste.
 * Le code est à usage unique et expire : un code utilisé/expiré/inconnu est expliqué,
 * jamais un formulaire inutile.
 */
export default async function InvitationCodePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale: raw, code: codeRaw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const dict = getDict(locale);
  const code = decodeURIComponent(codeRaw).toUpperCase();
  const jeton = await readInvitationJeton();
  const [session, apercuRes] = await Promise.all([
    readSession(),
    apiPublic<InviteApercu>(
      `/auth/invite/${encodeURIComponent(code)}${jeton ? `?jeton=${encodeURIComponent(jeton)}` : ""}`
    ),
  ]);
  const apercu: InviteApercu = apercuRes.ok ? apercuRes.data : { statut: "INVALIDE" } as InviteApercu;

  // États terminaux : expliquer, proposer la suite.
  if (apercu.statut !== "EN_ATTENTE") {
    const message =
      apercu.statut === "ACCEPTEE"
        ? dict.auth.inviteAlreadyUsed
        : apercu.statut === "OUVERTE"
          ? dict.auth.inviteOuverteAilleurs
          : apercu.statut === "INVALIDE"
            ? dict.auth.inviteInvalide
            : dict.auth.inviteExpired;
    return (
      <div className="text-center">
        <IconCircle tone={apercu.statut === "ACCEPTEE" ? "sage" : "sand"} size={72} className="mx-auto">
          <CKey width={32} height={32} />
        </IconCircle>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">{dict.auth.inviteTitle}</h1>
        <p className="mt-2 font-mono text-lg font-semibold tracking-[0.3em] text-soft" dir="ltr">{code}</p>
        <Banner variant={apercu.statut === "ACCEPTEE" ? "info" : "warn"} className="mt-6 text-start">
          {message}
        </Banner>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href={`/${locale}/connexion`}>{dict.auth.signIn}</ButtonLink>
          <ButtonLink href={`/${locale}/invitation`} variant="secondary">
            {dict.auth.inviteEnterCode}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const role = dict.roles[apercu.role_cible];
  const enTete = (
    <div className="text-center">
      <IconCircle tone="sand" size={72} className="mx-auto">
        <CHandshake width={34} height={34} />
      </IconCircle>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
        {fill(dict.auth.inviteRejoindre, { nom: apercu.copropriete_nom })}
      </h1>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-soft">
        <Badge variant="info">{fill(dict.auth.inviteEnTantQue, { role })}</Badge>
        <span>{apercu.ville}</span>
      </p>
      <p className="mt-2 text-[12px] text-faint">
        {fill(dict.auth.inviteExpireLe, { date: formatDateHeure(apercu.expire_le, locale) })}
      </p>
    </div>
  );

  return (
    <div>
      {enTete}
      <div className="card mt-6 p-5 text-start sm:p-6">
        <p className="text-[13px] font-semibold text-ink">{dict.auth.inviteVosInfos}</p>
        <p className="mt-0.5 text-[13px] text-soft">{dict.auth.inviteVosInfosAide}</p>
        {session.accessToken ? (
          <AcceptForm dict={dict} locale={locale} code={code} />
        ) : (
          <InscriptionForm dict={dict} locale={locale} code={code} />
        )}
      </div>
    </div>
  );
}
