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
import { IconChevronEnd, IconPlus } from "../../../../components/ui/icons";
import { CCalendar, CVote, IconCircle } from "../../../../components/ui/color-icons";
import { EcheanceRelative } from "../tableau-de-bord/syndic";
import { LiveList } from "../../../../components/ui/live-list";
import { Figure } from "../../../../components/ui/amount";

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
    <div className="page-root">
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

      <PhotoBanner src={photoSrc(ctx.copropriete, "salle")} title={ctx.copropriete?.nom} className="mb-6" />

      {ags.length === 0 ? (
        <EmptyState
          title={dict.ag.aucuneAg}
          hint={gestion ? dict.ag.aucuneAgAide : undefined}
          illustration="empty-ag"
          action={
            gestion ? (
              <ButtonLink href={p("/ag/nouvelle")}>
                <IconPlus width={16} height={16} />
                {dict.ag.creer}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Liste à plat sur la toile (Wise) : pastille, titre gras, date, statut, chevron. */}
          <LiveList as="ul" className="stagger-grid -mx-2 space-y-1 sm:-mx-3">
            {ags.map((ag) => {
              const aVenir = ["PLANIFIEE", "CONVOQUEE"].includes(ag.statut);
              return (
                <li key={ag.id}>
                  <Link
                    href={p(`/ag/${ag.id}`)}
                    className="group flex items-center gap-3.5 rounded-2xl px-2 py-3 transition-colors hover:bg-wash sm:gap-4 sm:px-3"
                  >
                    <IconCircle tone={ag.statut === "EN_COURS" ? "warn" : aVenir ? "tosca" : "lilac"} size={48}>
                      {aVenir ? <CCalendar /> : <CVote />}
                    </IconCircle>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[16px] font-bold leading-snug text-ink">{dict.enums.typeAg[ag.type]}</p>
                      <p className="mt-0.5 text-[13px] text-soft">
                        <span className="tnum">{formatDateHeure(ag.dateAg, ctx.locale)}</span>
                        {ag.quorumAtteint ? (
                          <span className="hidden sm:inline">
                            {` · ${dict.ag.quorum} `}
                            <Figure value={formatPourcent(ag.quorumAtteint)} />
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <Badge variant={agVariant[ag.statut]} pulse={ag.statut === "EN_COURS"}>
                        {dict.enums.statutAg[ag.statut]}
                      </Badge>
                      {aVenir ? <EcheanceRelative iso={ag.dateAg} dict={dict} /> : null}
                    </div>
                    <IconChevronEnd
                      width={18}
                      height={18}
                      className="shrink-0 text-link transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                    />
                  </Link>
                </li>
              );
            })}
          </LiveList>
          {agsRes.ok ? <Pagination meta={agsRes.meta} basePath={p("/ag")} dict={dict} /> : null}
        </>
      )}
    </div>
  );
}
