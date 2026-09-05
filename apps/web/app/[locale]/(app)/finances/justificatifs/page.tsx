import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDate, formatMAD, nomComplet } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { LinkTabs } from "../../../../../components/ui/link-tabs";
import { StatCard } from "../../../../../components/ui/stat-card";
import { CAlert, CCoins, CMoneyBag } from "../../../../../components/ui/color-icons";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { justificatifVariant } from "../../../../../lib/status";
import { ComptesModal, RibCompteButton } from "./justificatif-modals";
import { DeclarerForm } from "./declarer-form";
import { comptesBancaires, justificatifs, lotsEtLignesOuvertes } from "./data";

const ONGLETS = ["EN_ATTENTE", "VALIDE", "REJETE", "TOUS"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.justificatifs };
}

/** Syndic / conseil : file de validation ; syndic : comptes bancaires + déclaration au nom d'un lot. */
export default async function JustificatifsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ statut?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const j = dict.justificatifs;
  const e = dict.enumsJustificatifs;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const statut = (ONGLETS as readonly string[]).includes(sp.statut ?? "") && sp.statut !== "TOUS" ? sp.statut : sp.statut === "TOUS" ? undefined : "EN_ATTENTE";
  const p = (path: string) => `/${locale}${path}`;
  const coproId = ctx.coproprieteId ?? "";
  const [{ rows, parStatut }, comptes, refs] = await Promise.all([justificatifs(statut), comptesBancaires(ctx.coproprieteId), gestion ? lotsEtLignesOuvertes() : Promise.resolve(null)]);

  return (
    <div className="animate-fade">
      <PageHeader title={j.titre} subtitle={j.subtitle} actions={gestion && coproId ? <ComptesModal dict={dict} locale={ctx.locale} coproprieteId={coproId} comptes={comptes} /> : undefined} />
      <div className="stat mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<CAlert />} tone={(parStatut.EN_ATTENTE?.nb ?? 0) > 0 ? "warn" : "sage"} label={e.statutJustificatif.EN_ATTENTE} value={String(parStatut.EN_ATTENTE?.nb ?? 0)} hint={parStatut.EN_ATTENTE ? formatMAD(parStatut.EN_ATTENTE.montant, ctx.locale) : undefined} />
        <StatCard icon={<CMoneyBag />} tone="sage" label={e.statutJustificatif.VALIDE} value={String(parStatut.VALIDE?.nb ?? 0)} hint={parStatut.VALIDE ? formatMAD(parStatut.VALIDE.montant, ctx.locale) : undefined} />
        <StatCard icon={<CCoins />} tone="danger" label={e.statutJustificatif.REJETE} value={String(parStatut.REJETE?.nb ?? 0)} />
      </div>
      <LinkTabs className="mb-4" tabs={ONGLETS.map((o) => ({ href: p(`/finances/justificatifs?statut=${o}`), label: o === "TOUS" ? j.tous : e.statutJustificatif[o], active: o === "TOUS" ? statut === undefined : statut === o, count: o === "TOUS" ? undefined : parStatut[o]?.nb }))} />
      {rows.length === 0 ? <EmptyState title={j.aucun} hint={j.aucunAide} /> : (
        <TableCard>
          <Table>
            <THead><TH>{j.lot}</TH><TH>{j.declarePar}</TH><TH>{j.methode}</TH><TH>{j.reference}</TH><TH>{j.datePaiement}</TH><TH>{dict.lots.statut}</TH><TH align="end">{j.montant}</TH></THead>
            <tbody>
              {rows.map((x) => (
                <TR key={x.id}>
                  <TD className="font-semibold text-ink"><Link href={p(`/finances/justificatifs/${x.id}`)} className="hover:text-action">{x.lot?.numero ?? "—"}</Link></TD>
                  <TD className="text-body">{nomComplet(x.declarePar ?? null) ?? "—"}</TD>
                  <TD className="text-body">{e.methode[x.methode]}{x.banqueEmettrice ? <span className="block text-[12px] text-faint">{x.banqueEmettrice}</span> : null}</TD>
                  <TD className="text-body"><span dir="ltr">{x.reference ?? "—"}</span></TD>
                  <TD className="tnum text-soft">{formatDate(x.datePaiementDeclaree, ctx.locale)}</TD>
                  <TD><Badge variant={justificatifVariant[x.statut]}>{e.statutJustificatif[x.statut]}</Badge></TD>
                  <TD align="end" className="tnum font-medium text-ink">{formatMAD(x.montant, ctx.locale)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableCard>
      )}
      {gestion && coproId ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionHeader title={j.comptesEnregistres} subtitle={dict.depenses.ribAfficherAide} />
            {comptes.length === 0 ? <p className="mt-3 text-sm text-soft">{j.aucunCompteAide}</p> : (
              <ul className="mt-3 divide-y divide-hairline">
                {comptes.map((c) => (
                  <li key={c.index} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div><p className="text-sm font-semibold text-ink">{c.libelle}</p><p className="text-[13px] text-soft">{c.banque}</p></div>
                    <RibCompteButton dict={dict} locale={ctx.locale} coproprieteId={coproId} compte={c} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {refs ? <DeclarerForm dict={dict} locale={ctx.locale} lots={refs.lots} lignes={refs.lignes} comptes={comptes} mode="declarer" auNom /> : null}
        </div>
      ) : null}
    </div>
  );
}
