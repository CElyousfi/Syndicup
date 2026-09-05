import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { AssembleeGenerale } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDateHeure, formatPourcent } from "../../../../lib/format";
import { photoSrc } from "../../../../lib/photos";
import { PhotoBanner } from "../../../../components/ui/photo-banner";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Pagination } from "../../../../components/ui/pagination";
import { agVariant } from "../../../../lib/status";
import { IconArrowEnd, IconPlus } from "../../../../components/ui/icons";
import { CCalendar, CVote, IconCircle } from "../../../../components/ui/color-icons";
import { EcheanceRelative } from "../tableau-de-bord/syndic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.ag };
}

export default async function AgListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));

  const page = Math.max(1, Number(sp.page) || 1);
  const agsRes = await apiFetch<AssembleeGenerale[]>("/ag", { searchParams: { page, limit: 20 } });
  const ags = agsRes.ok ? agsRes.data : [];
  const p = (path: string) => `/${locale}${path}`;

  return (
    <div className="animate-fade">
      <PageHeader
        title={dict.ag.titre}
        actions={
          gestion ? (
            <ButtonLink href={p("/ag/nouvelle")}>
              <IconPlus width={16} height={16} />
              {dict.ag.creer}
            </ButtonLink>
          ) : undefined
        }
      />

      <PhotoBanner src={photoSrc(ctx.copropriete, "salle")} title={ctx.copropriete?.nom} className="mb-4" />

      {ags.length === 0 ? (
        <EmptyState
          title={dict.ag.aucuneAg}
          hint={gestion ? dict.ag.aucuneAgAide : undefined}
          action={
            gestion ? (
              <ButtonLink href={p("/ag/nouvelle")} size="sm">
                {dict.ag.creer}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {ags.map((ag) => {
              const aVenir = ["PLANIFIEE", "CONVOQUEE"].includes(ag.statut);
              return (
                <Link
                  key={ag.id}
                  href={p(`/ag/${ag.id}`)}
                  className="card group flex flex-wrap items-center gap-4 p-4 transition-all hover:border-action/40 hover:shadow-lift sm:p-5"
                >
                  <IconCircle tone={aVenir ? "tosca" : "lilac"} size={44}>
                    {aVenir ? <CCalendar /> : <CVote />}
                  </IconCircle>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="text-[15px] font-semibold text-ink group-hover:text-action">
                        {dict.enums.typeAg[ag.type]}
                      </p>
                      <Badge
                        variant={agVariant[ag.statut]}
                        pulse={ag.statut === "EN_COURS"}
                      >
                        {dict.enums.statutAg[ag.statut]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-soft">
                      {formatDateHeure(ag.dateAg, ctx.locale)}
                      {ag.quorumAtteint
                        ? ` · ${dict.ag.quorum} ${formatPourcent(ag.quorumAtteint)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {aVenir ? <EcheanceRelative iso={ag.dateAg} dict={dict} /> : null}
                    <IconArrowEnd className="text-faint transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
          {agsRes.ok ? <Pagination meta={agsRes.meta} basePath={p("/ag")} dict={dict} /> : null}
        </>
      )}
    </div>
  );
}
