import Link from "next/link";
import type { Metadata } from "next";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Lot, TypeLot, StatutLot } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatEntier, formatMAD, nomComplet } from "../../../../lib/format";
import { versChaine } from "../../../../lib/centimes";
import { getSynthese, soldeParLot } from "../../../../lib/finances-data";
import { photoSrc } from "../../../../lib/photos";
import { PhotoBanner } from "../../../../components/ui/photo-banner";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Pagination } from "../../../../components/ui/pagination";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { Input, Select } from "../../../../components/ui/field";
import { StatCard } from "../../../../components/ui/stat-card";
import { Avatar } from "../../../../components/ui/avatar";
import {
  IconCircle,
  CBuilding,
  CCoins,
  CHome,
  CScale,
} from "../../../../components/ui/color-icons";
import { lotVariant } from "../../../../lib/status";
import { IconPlus, IconSearch } from "../../../../components/ui/icons";
import { ExportButtons } from "../../../../components/ui/export-buttons";

/** Glyphe couleur par famille de lot — habitat vs bâtiment/annexe. */
const LOTS_HABITAT = ["APPARTEMENT", "VILLA", "LOGE_GARDIEN"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.lots };
}

export default async function LotsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; q?: string; type?: string; statut?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const voitSolde = gestion || ctx.roles.includes("CONSEIL_SYNDICAL");
  const estResident = !voitSolde && !ctx.roles.includes("GARDIEN");

  const page = Math.max(1, Number(sp.page) || 1);
  const res = await apiFetch<Lot[]>("/lots", { searchParams: { page, limit: 50 } });
  const tous = res.ok ? res.data : [];

  const q = (sp.q ?? "").toLowerCase();
  const lots = tous.filter((l) => {
    if (sp.type && l.typeLot !== sp.type) return false;
    if (sp.statut && l.statut !== sp.statut) return false;
    if (q) {
      const proprios = (l.proprietaires ?? [])
        .map((p) => nomComplet(p.utilisateur) ?? "")
        .join(" ")
        .toLowerCase();
      if (!l.numero.toLowerCase().includes(q) && !proprios.includes(q)) return false;
    }
    return true;
  });

  // Solde par lot en un appel (synthèse financière, RLS appliquée côté API).
  const soldes = voitSolde ? soldeParLot(await getSynthese()) : new Map<string, bigint>();

  const p = (path: string) => `/${locale}${path}`;
  const totalTantiemes = ctx.copropriete?.totalTantiemes ?? null;

  // Agrégat d'affichage : total des soldes positifs (déjà chargés ci-dessus).
  let impayeTotal = 0n;
  for (const s of soldes.values()) if (s > 0n) impayeTotal += s;

  return (
    <div className="animate-fade">
      <PageHeader
        title={estResident ? dict.lots.mesLots : dict.lots.title}
        subtitle={
          res.ok && !estResident
            ? fill(dict.lots.subtitle, {
                count: res.meta.total ?? tous.length,
                tantiemes: totalTantiemes ? formatEntier(totalTantiemes) : "—",
              })
            : undefined
        }
        actions={
          <>
            {gestion || ctx.roles.includes("CONSEIL_SYNDICAL") ? <ExportButtons ressource="lots" labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx, title: dict.rapports.exportLotsAide }} /> : null}
            {gestion ? (
              <ButtonLink href={p("/lots/nouveau")}>
                <IconPlus width={16} height={16} />
                {dict.lots.nouveau}
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <PhotoBanner src={photoSrc(ctx.copropriete, "entree")} title={ctx.copropriete?.nom} subtitle={ctx.copropriete?.adresse} className="mb-4" />

      {!estResident ? (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={<CBuilding />}
            tone="sage"
            label={dict.nav.lots}
            value={res.ok ? (res.meta.total ?? tous.length) : tous.length}
          />
          <StatCard
            icon={<CScale />}
            tone="lilac"
            label={dict.lots.tantiemes}
            value={totalTantiemes ? formatEntier(totalTantiemes) : dict.common.none}
          />
          {voitSolde ? (
            <StatCard
              icon={<CCoins />}
              tone="sand"
              label={dict.dash.impayes}
              value={formatMAD(versChaine(impayeTotal), ctx.locale)}
              trendTone={impayeTotal > 0n ? "danger" : "ok"}
            />
          ) : null}
        </div>
      ) : null}

      {!estResident ? (
        <form className="filters mb-4 flex flex-wrap items-center gap-2" method="GET">
          <div className="relative">
            <IconSearch
              width={16}
              height={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <Input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder={dict.common.search}
              className="h-10 w-56 ps-9"
            />
          </div>
          <Select name="type" defaultValue={sp.type ?? ""} className="h-10 w-44">
            <option value="">
              {dict.lots.type} · {dict.common.all}
            </option>
            {(Object.keys(dict.enums.typeLot) as TypeLot[]).map((t) => (
              <option key={t} value={t}>
                {dict.enums.typeLot[t]}
              </option>
            ))}
          </Select>
          <Select name="statut" defaultValue={sp.statut ?? ""} className="h-10 w-44">
            <option value="">
              {dict.lots.statut} · {dict.common.all}
            </option>
            {(Object.keys(dict.enums.statutLot) as StatutLot[]).map((s) => (
              <option key={s} value={s}>
                {dict.enums.statutLot[s]}
              </option>
            ))}
          </Select>
          <button
            type="submit"
            className="h-10 rounded-btn border border-hairline-strong bg-surface px-4 text-[13px] font-medium text-ink-strong transition-colors hover:bg-hover"
          >
            {dict.common.filter}
          </button>
        </form>
      ) : null}

      {lots.length === 0 ? (
        <EmptyState
          title={dict.lots.aucunLot}
          hint={gestion ? dict.lots.aucunLotAide : undefined}
          action={
            gestion ? (
              <ButtonLink href={p("/lots/nouveau")} size="sm">
                {dict.lots.nouveau}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <THead>
                <TH>{dict.lots.numero}</TH>
                <TH>{dict.lots.type}</TH>
                <TH align="center">{dict.lots.etage}</TH>
                <TH align="end">{dict.lots.tantiemes}</TH>
                <TH>{dict.lots.proprietaire}</TH>
                <TH>{dict.lots.statut}</TH>
                {voitSolde ? <TH align="end">{dict.lots.solde}</TH> : null}
              </THead>
              <tbody>
                {lots.map((l) => {
                  const proprios = (l.proprietaires ?? []).filter((x) => !x.dateFin);
                  const noms = proprios
                    .map((x) => nomComplet(x.utilisateur))
                    .filter(Boolean)
                    .join(" · ");
                  const solde = soldes.get(l.id);
                  return (
                    <TR key={l.id}>
                      <TD>
                        <Link
                          href={p(`/lots/${l.id}`)}
                          className="inline-flex items-center gap-2.5 font-semibold text-ink hover:text-action"
                        >
                          <IconCircle tone="sage" size={32}>
                            {LOTS_HABITAT.includes(l.typeLot) ? (
                              <CHome width={17} height={17} />
                            ) : (
                              <CBuilding width={17} height={17} />
                            )}
                          </IconCircle>
                          <span className="max-w-28 truncate">{l.numero}</span>
                        </Link>
                      </TD>
                      <TD>
                        <Badge variant="outline">{dict.enums.typeLot[l.typeLot]}</Badge>
                      </TD>
                      <TD align="center" className="tnum text-body">
                        {l.etage === null ? dict.common.none : l.etage === 0 ? dict.lots.rdc : l.etage}
                      </TD>
                      <TD align="end" className="tnum text-body">
                        {formatEntier(l.tantiemes)}
                      </TD>
                      <TD className="text-body">
                        {noms ? (
                          <span className="flex items-center gap-2">
                            <Avatar nom={noms.split(" · ")[0] ?? noms} size={26} />
                            <span className="max-w-44 truncate">{noms}</span>
                            {proprios.length > 1 ? (
                              <span className="shrink-0 text-[11px] text-faint">
                                ({dict.enums.typePropriete.INDIVISION})
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-faint">{dict.common.none}</span>
                        )}
                      </TD>
                      <TD>
                        <Badge variant={lotVariant[l.statut]}>
                          {dict.enums.statutLot[l.statut]}
                        </Badge>
                      </TD>
                      {voitSolde ? (
                        <TD align="end">
                          {solde === undefined ? (
                            <span className="text-faint">{dict.common.none}</span>
                          ) : solde <= 0n ? (
                            <Badge variant="ok">{dict.enums.statutLigne.PAYE}</Badge>
                          ) : (
                            <span className="tnum font-semibold text-danger">
                              {formatMAD(versChaine(solde), ctx.locale)}
                            </span>
                          )}
                        </TD>
                      ) : null}
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableCard>
          {res.ok ? (
            <Pagination
              meta={res.meta}
              basePath={p("/lots")}
              searchParams={{ q: sp.q, type: sp.type, statut: sp.statut }}
              dict={dict}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
