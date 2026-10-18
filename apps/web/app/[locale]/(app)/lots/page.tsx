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
import { Button, ButtonLink } from "../../../../components/ui/button";
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
import { Amount } from "../../../../components/ui/amount";
import { LiveList } from "../../../../components/ui/live-list";
import { LoadError } from "../../../../components/ui/load-error";
import { failureOf } from "../../../../lib/api/unwrap";
import { Banner } from "../../../../components/ui/banner";

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
  searchParams: Promise<{ page?: string; q?: string; type?: string; statut?: string; supprime?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const voitSolde = gestion || ctx.roles.includes("CONSEIL_SYNDICAL");
  const estResident = !voitSolde && !ctx.roles.includes("GARDIEN");

  const page = Math.max(1, Number(sp.page) || 1);
  // Filtres appliqués PAR L'API (q, type, statut) : meta.total est filtré, la pagination suit
  // l'URL. Le compteur « Lots » reste le total de la copropriété (requête sans filtre, 1 ligne).
  const filtre = Boolean(sp.q || sp.type || sp.statut);
  const [res, totalRes] = await Promise.all([
    apiFetch<Lot[]>("/lots", { searchParams: { page, limit: 50, q: sp.q || undefined, type: sp.type || undefined, statut: sp.statut || undefined } }),
    filtre ? apiFetch<Lot[]>("/lots", { searchParams: { page: 1, limit: 1 } }) : Promise.resolve(null),
  ]);
  const lots = res.ok ? res.data : [];
  const totalLots = totalRes ? (totalRes.ok ? totalRes.meta.total : undefined) : res.ok ? res.meta.total : undefined;

  // Solde par lot en un appel (synthèse financière, RLS appliquée côté API).
  // Synthèse en échec : soldes « — » ligne par ligne et total indisponible (jamais « 0 — Payé »).
  const synthese = voitSolde ? await getSynthese() : null;
  const soldesIndisponibles = synthese !== null && !synthese.ok;
  const soldes = synthese?.ok ? soldeParLot(synthese.data) : new Map<string, bigint>();

  const p = (path: string) => `/${locale}${path}`;
  const totalTantiemes = ctx.copropriete?.totalTantiemes ?? null;

  // Agrégat d'affichage : total des soldes positifs (déjà chargés ci-dessus).
  let impayeTotal = 0n;
  for (const s of soldes.values()) if (s > 0n) impayeTotal += s;

  return (
    <div className="page-root">
      {sp.supprime === "1" ? <Banner variant="ok" className="mb-4">{dict.formulaires.succes.lotSupprime}</Banner> : null}
      <PageHeader
        title={estResident ? dict.lots.mesLots : dict.lots.title}
        subtitle={
          res.ok && !estResident
            ? fill(dict.lots.subtitle, {
                count: totalLots ?? lots.length,
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
            value={res.ok && totalLots !== undefined ? totalLots : dict.common.none}
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
              value={soldesIndisponibles ? dict.common.none : formatMAD(versChaine(impayeTotal), ctx.locale)}
              trend={soldesIndisponibles ? dict.errors.load.solde : undefined}
              trendTone={soldesIndisponibles ? "neutral" : impayeTotal > 0n ? "danger" : "ok"}
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
          <Button type="submit" variant="secondary">
            {dict.common.filter}
          </Button>
        </form>
      ) : null}

      {!res.ok ? (
        <LoadError error={failureOf(res)} locale={ctx.locale} />
      ) : lots.length === 0 && filtre ? (
        <EmptyState
          title={dict.formulaires.filtres.aucunResultat}
          hint={dict.formulaires.filtres.aucunResultatAide}
          illustration="empty-search"
          action={<ButtonLink href={p("/lots")} variant="secondary" size="sm">{dict.formulaires.filtres.effacer}</ButtonLink>}
        />
      ) : lots.length === 0 ? (
        <EmptyState
          title={dict.lots.aucunLot}
          hint={gestion ? dict.lots.aucunLotAide : undefined}
          illustration="empty-lots"
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
              <LiveList as="tbody">
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
                          className="inline-flex items-center gap-3 text-[15px] font-bold text-ink hover:text-link"
                        >
                          <IconCircle tone="sage" size={40}>
                            {LOTS_HABITAT.includes(l.typeLot) ? (
                              <CHome width={20} height={20} />
                            ) : (
                              <CBuilding width={20} height={20} />
                            )}
                          </IconCircle>
                          <span className="max-w-28 truncate">{l.numero}</span>
                        </Link>
                      </TD>
                      <TD>
                        <span className="text-[14px] text-body">{dict.enums.typeLot[l.typeLot]}</span>
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
                            <Avatar nom={noms.split(" · ")[0] ?? noms} size={30} />
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
                            <span className="tnum font-bold text-danger">
                              <Amount value={versChaine(solde)} locale={ctx.locale} upIsGood={false} />
                            </span>
                          )}
                        </TD>
                      ) : null}
                    </TR>
                  );
                })}
              </LiveList>
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
