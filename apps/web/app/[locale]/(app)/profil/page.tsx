import type { Metadata } from "next";
import { getAppContext } from "../../../../lib/app-context";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatTelephone } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { compteVariant } from "../../../../lib/status";
import { IconDownload } from "../../../../components/ui/icons";
import { Avatar } from "../../../../components/ui/avatar";
import { PosterCard } from "../../../../components/ui/poster-card";
import { nomComplet } from "../../../../lib/format";
import { ProfilForm } from "./profil-form";
import { apiFetch } from "../../../../lib/api/client";
import { PreferencesForm } from "../affichage/affichage-client";
import { PREFERENCES_NOTIFICATION_DEFAUT, type PreferencesNotification } from "../../../../lib/api/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").profil.titre };
}

export default async function ProfilPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ enregistre?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict, profil } = ctx;
  const pr = dict.profil;
  const prefsRes = await apiFetch<PreferencesNotification>("/users/me/preferences-notification");
  const prefs: PreferencesNotification = prefsRes.ok ? { ...PREFERENCES_NOTIFICATION_DEFAUT, ...prefsRes.data } : PREFERENCES_NOTIFICATION_DEFAUT;

  const coproParId = new Map(ctx.coproprietes.map((c) => [c.id, c.nom]));

  return (
    <div className="page-root">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3.5">
            <Avatar nom={nomComplet(profil) ?? profil.email ?? "•"} size={48} solid />
            {pr.titre}
          </span>
        }
      />

      {sp.enregistre === "1" ? (
        <Banner variant="ok" className="mb-4">
          {pr.enregistre}
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2 lg:self-start">
          <Card>
            <ProfilForm
              dict={dict}
              locale={ctx.locale}
              nom={profil.nom ?? ""}
              prenom={profil.prenom ?? ""}
              langue={profil.langue_preferee}
            />
          </Card>

          {/* J2 — CNDP : carte-affiche sous le formulaire (téléchargement direct, pas un lien Next). */}
          <PosterCard
            title={pr.donneesTitre}
            poster="poster-securite"
            body={
              <>
                <p>{pr.donneesCorps}</p>
                <p className="mt-2 text-[13px] text-white/70">{pr.donneesConservation}</p>
                <a
                  href="/api/export-cndp"
                  download
                  className="su-btn mt-6 inline-flex h-11 items-center gap-2 rounded-btn bg-cta px-6 text-[15px] font-semibold text-ink transition-colors hover:bg-lime-hover"
                >
                  <IconDownload width={16} height={16} />
                  {pr.exporter}
                </a>
                <p className="mt-2 text-[13px] text-white/70">{pr.exportFormat}</p>
              </>
            }
          />
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader title={dict.communication.preferences} subtitle={dict.communication.preferencesAide} />
            <div className="mt-4"><PreferencesForm dict={dict} locale={ctx.locale} prefs={prefs} /></div>
          </Card>
          <Card>
            <SectionHeader title={pr.identifiants} subtitle={pr.identifiantsAide} />
            {/* Lignes clé/valeur sur sous-bloc blanc (jamais greige sur greige). */}
            <dl className="mt-4 divide-y divide-hairline rounded-[18px] bg-surface px-4 text-[14px]">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-soft">{dict.auth.emailLabel}</dt>
                <dd className="min-w-0 truncate font-semibold text-ink" dir="ltr">
                  {profil.email ?? dict.common.none}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-soft">{dict.auth.phoneLabel}</dt>
                <dd className="tnum font-semibold text-ink" dir="ltr">
                  {formatTelephone(profil.telephone)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-soft">{dict.membres.compte}</dt>
                <dd>
                  <Badge variant={compteVariant[profil.statut_compte]}>
                    {dict.enums.statutCompte[profil.statut_compte]}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <SectionHeader title={pr.mesRoles} />
            <ul className="mt-4 divide-y divide-hairline rounded-[18px] bg-surface px-4">
              {(profil.roles ?? [])
                .filter((r) => r.actif)
                .map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-3 text-[14px]">
                    <span className="truncate font-semibold text-ink">
                      {coproParId.get(r.copropriete_id) ?? r.copropriete_id.slice(0, 8)}
                    </span>
                    <Badge variant="neutral">{dict.roles[r.role]}</Badge>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
