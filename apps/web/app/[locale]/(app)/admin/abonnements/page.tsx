import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { Abonnement, EtatAbonnement } from "../../../../../lib/api/console-types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDateCourte } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { ButtonLink } from "../../../../../components/ui/button";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Input } from "../../../../../components/ui/field";
import { Amount } from "../../../../../components/ui/amount";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { LiveList } from "../../../../../components/ui/live-list";
import { IconPlus, IconSearch } from "../../../../../components/ui/icons";
import { Echeance, EtatBadge, FiltrePills } from "../console-common";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.nav.abonnements };
}

const FILTRES: EtatAbonnement[] = ["EN_ESSAI", "A_JOUR", "RENOUVELLEMENT_PROCHE", "ESSAI_EXPIRE", "EN_RETARD", "ACCES_PROLONGE", "BLOQUE_IMPAYE", "SUSPENDU", "RESILIE"];

/** M29 — abonnements, filtrés par état calculé (essai, à jour, en retard, coupé…). */
export default async function AbonnementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ etat?: string; q?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const p = (path: string) => `/${ctx.locale}${path}`;

  // Liste complète (compteurs par état) puis filtre local : une seule requête.
  const res = await apiFetch<Abonnement[]>("/admin/abonnements", { searchParams: { q: sp.q || undefined } });
  const tous = res.ok ? res.data : [];
  const etat = FILTRES.includes(sp.etat as EtatAbonnement) ? (sp.etat as EtatAbonnement) : null;
  const liste = etat ? tous.filter((a) => a.etat.etat === etat) : tous;
  const compte = (e: EtatAbonnement) => tous.filter((a) => a.etat.etat === e).length;
  const href = (e?: EtatAbonnement) => {
    const u = new URLSearchParams();
    if (e) u.set("etat", e);
    if (sp.q) u.set("q", sp.q);
    const s = u.toString();
    return p(`/admin/abonnements${s ? `?${s}` : ""}`);
  };

  return (
    <div className="page-root">
      <PageHeader
        title={c.nav.abonnements}
        actions={
          <ButtonLink href={p("/admin/abonnements/nouveau")}>
            <IconPlus width={16} height={16} />
            {c.ouvrirAbonnement}
          </ButtonLink>
        }
      />

      <form className="mb-4" method="GET">
        {etat ? <input type="hidden" name="etat" value={etat} /> : null}
        <div className="relative w-80 max-w-full">
          <IconSearch width={16} height={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder={c.recherche} className="h-10 ps-9" />
        </div>
      </form>

      <FiltrePills
        items={[
          { href: href(), label: c.tous, actif: !etat, count: tous.length },
          ...FILTRES.filter((e) => compte(e) > 0 || e === etat).map((e) => ({ href: href(e), label: c.etats[e], actif: etat === e, count: compte(e) })),
        ]}
      />

      {liste.length === 0 ? (
        <EmptyState
          title={c.aucunAbonnement}
          action={
            <ButtonLink href={p("/admin/abonnements/nouveau")}>
              <IconPlus width={16} height={16} />
              {c.ouvrirAbonnement}
            </ButtonLink>
          }
        />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <TH>{c.client}</TH>
              <TH>{c.formule}</TH>
              <TH>{c.etat}</TH>
              <TH>{c.echeance}</TH>
              <TH align="center">{c.lotsContractes}</TH>
              <TH align="end">{c.mensuelHt}</TH>
              <TH align="end">{c.du}</TH>
            </THead>
            <LiveList as="tbody">
              {liste.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <Link href={p(`/admin/abonnements/${a.id}`)} className="block min-w-0 hover:text-link">
                      <span className="block truncate text-[15px] font-bold text-ink">{a.client.nom}</span>
                      <span className="block truncate text-[12px] text-soft">{a.coproprietes.map((r) => r.nom).join(", ") || "—"}</span>
                    </Link>
                  </TD>
                  <TD className="text-[13px] text-body">
                    {c.formules[a.formule]}
                    {a.tarif_fondateur ? <span className="ms-1 text-[11px] font-semibold text-link">★</span> : null}
                    <span className="block text-[12px] text-soft">{c.periodicites[a.periodicite]}</span>
                  </TD>
                  <TD>
                    <EtatBadge etat={a.etat} dict={dict} />
                  </TD>
                  <TD>
                    <span className="block text-[13px] text-body">{a.etat.echeance ? formatDateCourte(a.etat.echeance, ctx.locale) : "—"}</span>
                    <Echeance etat={a.etat} dict={dict} />
                  </TD>
                  <TD align="center" className="tnum text-body">
                    {a.lots_contractes}
                    {a.depassement_lots ? <span className="block text-[11px] font-semibold text-warn">{a.lots_reels}</span> : null}
                  </TD>
                  <TD align="end">
                    <Amount value={a.mensuel_ht} locale={ctx.locale} className="text-[14px]" />
                  </TD>
                  <TD align="end">
                    {a.du_ttc && a.du_ttc !== "0.00" ? (
                      <Amount value={a.du_ttc} locale={ctx.locale} className="text-[14px] font-semibold text-warn" />
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </LiveList>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
