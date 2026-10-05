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
        <h1 className="mt-6 text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">{dict.auth.inviteTitle}</h1>
        <p className="mx-auto mt-3 w-fit rounded-full bg-tile px-4 py-1.5 font-mono text-lg font-bold tracking-[0.3em] text-ink" dir="ltr">{code}</p>
        <Banner variant={apercu.statut === "ACCEPTEE" ? "info" : "warn"} className="mt-6 text-start">
          {message}
        </Banner>
        <div className="mt-7 flex flex-col gap-3">
          <ButtonLink href={`/${locale}/connexion`} size="lg" className="w-full">{dict.auth.signIn}</ButtonLink>
          <ButtonLink href={`/${locale}/invitation`} variant="secondary" size="lg" className="w-full">
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
      <h1 className="mt-6 text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[30px]">
        {fill(dict.auth.inviteRejoindre, { nom: apercu.copropriete_nom })}
      </h1>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[15px] text-soft">
        <Badge variant="info">{fill(dict.auth.inviteEnTantQue, { role })}</Badge>
        <span>{apercu.ville}</span>
      </p>
      <p className="mt-2 text-[13px] text-soft">
        {fill(dict.auth.inviteExpireLe, { date: formatDateHeure(apercu.expire_le, locale) })}
      </p>
    </div>
  );

  return (
    <div>
      {enTete}
      {/* À plat sur la toile (Wise). Le formulaire d'acceptation porte déjà son propre intitulé. */}
      <div className="mt-8 text-start">
        {session.accessToken ? (
          <AcceptForm dict={dict} locale={locale} code={code} />
        ) : (
          <>
            <h2 className="text-[19px] font-bold tracking-tight text-ink">{dict.auth.inviteVosInfos}</h2>
            <p className="mt-1 text-[14px] text-soft">{dict.auth.inviteVosInfosAide}</p>
            <InscriptionForm dict={dict} locale={locale} code={code} />
          </>
        )}
      </div>
    </div>
  );
}
