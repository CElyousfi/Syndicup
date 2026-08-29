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
import { CShield, IconCircle } from "../../../../components/ui/color-icons";
import { nomComplet } from "../../../../lib/format";
import { ProfilForm } from "./profil-form";

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

  const coproParId = new Map(ctx.coproprietes.map((c) => [c.id, c.nom]));

  return (
    <div className="animate-fade">
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
        <Card className="lg:col-span-2">
          <ProfilForm
            dict={dict}
            locale={ctx.locale}
            nom={profil.nom ?? ""}
            prenom={profil.prenom ?? ""}
            langue={profil.langue_preferee}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeader title={pr.identifiants} subtitle={pr.identifiantsAide} />
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-soft">{dict.auth.emailLabel}</dt>
                <dd className="font-medium text-ink" dir="ltr">
                  {profil.email ?? dict.common.none}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-soft">{dict.auth.phoneLabel}</dt>
                <dd className="tnum font-medium text-ink" dir="ltr">
                  {formatTelephone(profil.telephone)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
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
            <ul className="mt-4 space-y-2.5">
              {(profil.roles ?? [])
                .filter((r) => r.actif)
                .map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-body">
                      {coproParId.get(r.copropriete_id) ?? r.copropriete_id.slice(0, 8)}
                    </span>
                    <Badge variant="outline">{dict.roles[r.role]}</Badge>
                  </li>
                ))}
            </ul>
          </Card>

          {/* J2 — CNDP */}
          <Card>
            <div className="flex items-center gap-3">
              <IconCircle tone="sage" size={40}>
                <CShield width={20} height={20} />
              </IconCircle>
              <h2 className="text-[15px] font-semibold text-ink">{pr.donneesTitre}</h2>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-body">{pr.donneesCorps}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-faint">{pr.donneesConservation}</p>
            <a
              href="/api/export-cndp"
              download
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-4 text-sm font-medium text-ink-strong transition-colors hover:bg-hover"
            >
              <IconDownload width={16} height={16} />
              {pr.exporter}
            </a>
            <p className="mt-2 text-[12px] text-faint">{pr.exportFormat}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
