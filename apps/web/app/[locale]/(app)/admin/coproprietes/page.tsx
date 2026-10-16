import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { ResidenceAdmin } from "../../../../../lib/api/console-types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDateCourte } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { ButtonLink } from "../../../../../components/ui/button";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Input } from "../../../../../components/ui/field";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { LiveList } from "../../../../../components/ui/live-list";
import { IconCircle, CBuilding } from "../../../../../components/ui/color-icons";
import { IconPlus, IconSearch } from "../../../../../components/ui/icons";
import { coproVariant } from "../../../../../lib/status";
import { DemoModal } from "../../import/import-client";
import { EtatBadge, FiltrePills } from "../console-common";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.residencesTitre };
}

/** Toutes les résidences de la plateforme, avec leur abonnement, leurs lots réels et leurs comptes actifs. */
export default async function ResidencesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; filtre?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const p = (path: string) => `/${ctx.locale}${path}`;

  const res = await apiFetch<ResidenceAdmin[]>("/admin/coproprietes", { searchParams: { q: sp.q || undefined } });
  const toutes = res.ok ? res.data : [];
  const sans = toutes.filter((r) => !r.abonnement);
  const liste = sp.filtre === "sans" ? sans : toutes;
  const qs = (f?: string) => {
    const u = new URLSearchParams();
    if (sp.q) u.set("q", sp.q);
    if (f) u.set("filtre", f);
    const s = u.toString();
    return p(`/admin/coproprietes${s ? `?${s}` : ""}`);
  };

  return (
    <div className="page-root">
      <PageHeader
        title={c.residencesTitre}
        subtitle={c.residencesSousTitre}
        actions={
          <div className="flex flex-wrap gap-2">
            {ctx.coproprieteId ? <DemoModal dict={dict} locale={ctx.locale} coproprieteId={ctx.coproprieteId} /> : null}
            <ButtonLink href={p("/admin/coproprietes/nouvelle")} data-tour="admin-new">
              <IconPlus width={16} height={16} />
              {dict.admin.creer}
            </ButtonLink>
          </div>
        }
      />

      <form className="mb-4" method="GET">
        {sp.filtre ? <input type="hidden" name="filtre" value={sp.filtre} /> : null}
        <div className="relative w-72 max-w-full">
          <IconSearch width={16} height={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder={dict.common.search} className="h-10 ps-9" />
        </div>
      </form>

      <FiltrePills
        items={[
          { href: qs(), label: c.tous, actif: sp.filtre !== "sans", count: toutes.length },
          { href: qs("sans"), label: c.sansAbo, actif: sp.filtre === "sans", count: sans.length },
        ]}
      />

      {liste.length === 0 ? (
        <EmptyState title={dict.common.emptyDefault} illustration={sp.q ? "empty-search" : undefined} />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <TH>{dict.parametres.nom}</TH>
              <TH>{c.abonnement}</TH>
              <TH align="center">{c.lotsReels}</TH>
              <TH align="center">{c.comptesActifs}</TH>
              <TH>{dict.lots.statut}</TH>
              <TH>{c.creeLe}</TH>
            </THead>
            <LiveList as="tbody">
              {liste.map((r) => (
                <TR key={r.id}>
                  <TD className="font-semibold text-ink">
                    <Link href={p(`/admin/coproprietes/${r.id}`)} className="flex items-center gap-3 text-[15px] font-bold transition-colors hover:text-link">
                      <IconCircle tone="sage" size={40}>
                        <CBuilding width={20} height={20} />
                      </IconCircle>
                      <span className="min-w-0">
                        <span className="block truncate">{r.nom}</span>
                        <span className="block truncate text-[12px] font-normal text-soft">
                          {r.ville}
                          {r.cabinet ? ` · ${c.cabinet} ${r.cabinet.nom}` : ""}
                        </span>
                      </span>
                    </Link>
                  </TD>
                  <TD>
                    {r.abonnement ? (
                      <Link href={p(`/admin/abonnements/${r.abonnement.id}`)} className="flex flex-col items-start gap-1">
                        <EtatBadge etat={r.abonnement.etat} dict={dict} />
                        <span className="text-[12px] text-soft">
                          {c.formules[r.abonnement.formule]} · {r.abonnement.client}
                        </span>
                      </Link>
                    ) : (
                      <ButtonLink size="sm" variant="ghost" href={p(`/admin/abonnements/nouveau?copropriete=${r.id}`)}>
                        <IconPlus width={14} height={14} />
                        {c.ouvrirAbonnement}
                      </ButtonLink>
                    )}
                  </TD>
                  <TD align="center" className="tnum text-body">
                    {r.lots_reels}
                    <span className="text-faint"> / {r.nb_lots_declares}</span>
                  </TD>
                  <TD align="center" className="tnum text-body">
                    {r.comptes_actifs}
                  </TD>
                  <TD>
                    <Badge variant={coproVariant[r.statut]}>{dict.enums.statutCopropriete[r.statut]}</Badge>
                  </TD>
                  <TD className="text-[13px] text-soft">{formatDateCourte(r.creee_le, ctx.locale)}</TD>
                </TR>
              ))}
            </LiveList>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
