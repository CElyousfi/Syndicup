/**
 * M29 — résidence fermée : l'abonnement SyndicUp est suspendu, résilié ou impayé au-delà du délai
 * de grâce. Le syndic voit comment rétablir l'accès ; les résidents, un message rassurant. Les
 * données sont intactes. Si la personne a d'autres résidences, elle peut en choisir une autre.
 */
import { redirect } from "next/navigation";
import { getDict, isLocale, fill, type Locale } from "../../../../../lib/i18n";
import { apiFetch } from "../../../../../lib/api/client";
import { readSession } from "../../../../../lib/session";
import type { Copropriete } from "../../../../../lib/api/types";
import type { AbonnementResidence } from "../../../../../lib/api/console-types";
import { IconCircle, CShield } from "../../../../../components/ui/color-icons";
import { ButtonLink } from "../../../../../components/ui/button";
import { Button } from "../../../../../components/ui/button";
import { ContactSyndicUp } from "../../../../../components/abonnement/contact";
import { seDeconnecter } from "../../../../../lib/actions/session-actions";

export default async function AbonnementSuspenduPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const dict = getDict(locale);
  const t = dict.abonnementResidence;
  const session = await readSession();
  if (!session.accessToken) redirect(`/${locale}/connexion`);

  const [abo, copros] = await Promise.all([
    apiFetch<AbonnementResidence>("/abonnement"),
    apiFetch<Copropriete[]>("/coproprietes"),
  ]);
  // Accès rétabli entre-temps (paiement enregistré) : retour à l'application.
  if (abo.ok && abo.data.niveau !== "BLOQUE") redirect(`/${locale}/tableau-de-bord`);

  const liste = copros.ok ? copros.data : [];
  const residence = liste.find((c) => c.id === session.coproprieteId)?.nom ?? dict.brand.name;
  const etat = abo.ok ? abo.data : null;
  const corps =
    etat?.etat === "RESILIE"
      ? fill(t.resilieCorps, { residence })
      : etat?.gestionnaire
        ? fill(t.suspenduCorpsGestion, { residence })
        : fill(t.suspenduCorpsResident, { residence });

  return (
    <div className="card px-6 py-12 text-center sm:px-10">
      <div className="flex justify-center">
        <IconCircle tone="warn" size={72}>
          <CShield width={32} height={32} />
        </IconCircle>
      </div>
      <h1 className="mt-6 text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">{t.suspenduTitre}</h1>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-soft">{corps}</p>
      {etat?.gestionnaire ? (
        <div className="mt-6">
          <ContactSyndicUp contact={etat.contact} labels={t} message={`${t.suspenduTitre} — ${residence}`} />
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink variant="ghost" href={`/${locale}/tableau-de-bord`}>
          {t.reessayer}
        </ButtonLink>
        {liste.length > 1 ? (
          <ButtonLink variant="ghost" href={`/${locale}/choisir-copropriete`}>
            {t.changerResidence}
          </ButtonLink>
        ) : null}
      </div>
      <form action={seDeconnecter} className="mt-4">
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="secondary">
          {dict.common.logout}
        </Button>
      </form>
    </div>
  );
}
