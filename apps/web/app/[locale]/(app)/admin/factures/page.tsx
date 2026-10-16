import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { FactureCourte } from "../../../../../lib/api/console-types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDateCourte } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Amount } from "../../../../../components/ui/amount";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { LiveList } from "../../../../../components/ui/live-list";
import { FiltrePills, factureVariant } from "../console-common";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.facturesTitre };
}

/** M29 — toutes les factures d'abonnement ; filtres : à encaisser, en retard, payées, annulées. */
export default async function FacturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ statut?: string; en_retard?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const L = ctx.locale;
  const p = (path: string) => `/${L}${path}`;

  const res = await apiFetch<FactureCourte[]>("/admin/factures");
  const toutes = res.ok ? res.data : [];
  const enRetard = sp.en_retard === "true";
  const statut = ["EMISE", "PAYEE", "ANNULEE"].includes(sp.statut ?? "") ? sp.statut : undefined;
  const liste = toutes.filter((f) => (enRetard ? f.en_retard : statut ? f.statut === statut : true));

  return (
    <div className="page-root">
      <PageHeader title={c.facturesTitre} subtitle={c.facturesSousTitre} />
      <FiltrePills
        items={[
          { href: p("/admin/factures"), label: c.tous, actif: !statut && !enRetard, count: toutes.length },
          { href: p("/admin/factures?statut=EMISE"), label: c.statutsFacture.EMISE, actif: statut === "EMISE" && !enRetard, count: toutes.filter((f) => f.statut === "EMISE").length },
          { href: p("/admin/factures?en_retard=true"), label: c.enRetard, actif: enRetard, count: toutes.filter((f) => f.en_retard).length },
          { href: p("/admin/factures?statut=PAYEE"), label: c.statutsFacture.PAYEE, actif: statut === "PAYEE", count: toutes.filter((f) => f.statut === "PAYEE").length },
          { href: p("/admin/factures?statut=ANNULEE"), label: c.statutsFacture.ANNULEE, actif: statut === "ANNULEE", count: toutes.filter((f) => f.statut === "ANNULEE").length },
        ]}
      />
      {liste.length === 0 ? (
        <EmptyState title={c.aucuneFacture} />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <TH>{c.numero}</TH>
              <TH>{c.client}</TH>
              <TH>{c.periode}</TH>
              <TH>{c.echeance}</TH>
              <TH align="end">{c.ttc}</TH>
              <TH align="end">{c.paye}</TH>
              <TH>{c.etat}</TH>
            </THead>
            <LiveList as="tbody">
              {liste.map((f) => (
                <TR key={f.id}>
                  <TD>
                    <Link href={p(`/admin/factures/${f.id}`)} className="font-mono text-[13px] font-semibold text-link">
                      {f.numero}
                    </Link>
                    <span className="block text-[12px] text-soft">{formatDateCourte(f.emise_le, L)}</span>
                  </TD>
                  <TD>
                    <Link href={p(`/admin/abonnements/${f.abonnement_id}`)} className="text-[14px] font-semibold text-ink hover:text-link">
                      {f.client_nom}
                    </Link>
                  </TD>
                  <TD className="text-[13px] text-body">
                    {formatDateCourte(f.periode_debut, L)} → {formatDateCourte(f.periode_fin, L)}
                  </TD>
                  <TD className={`text-[13px] ${f.en_retard ? "font-semibold text-danger" : "text-body"}`}>{formatDateCourte(f.echeance, L)}</TD>
                  <TD align="end">
                    <Amount value={f.montant_ttc} locale={L} className="text-[14px] font-semibold" />
                  </TD>
                  <TD align="end">
                    <Amount value={f.paye ?? "0.00"} locale={L} className="text-[14px] text-soft" />
                  </TD>
                  <TD>
                    <Badge variant={f.en_retard ? "danger" : factureVariant[f.statut]}>{f.en_retard ? c.enRetard : c.statutsFacture[f.statut]}</Badge>
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
