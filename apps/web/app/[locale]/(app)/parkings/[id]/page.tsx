/** Fiche emplacement (M23) — attribution en cours, historique, actions (attribuer / libérer / modifier / supprimer). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { EmplacementDetail, Lot } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDate, formatDateHeure, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { emplacementVariant } from "../../../../../lib/status";
import { AttribuerModal, EmplacementModal, LibererModal, SupprimerEmplacementModal } from "../parkings-client";
import { LiveList } from "../../../../../components/ui/live-list";
import { Amount } from "../../../../../components/ui/amount";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").parkings.titre };
}

export default async function EmplacementPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "GARDIEN"]);
  const { dict } = ctx;
  const t = dict.parkings;
  const e = dict.enumsParkings;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const res = await apiFetch<EmplacementDetail>(`/emplacements/${id}`);
  if (!res.ok) notFound();
  const x = res.data;
  const lotsRes = gestion ? await apiFetch<Lot[]>("/lots", { searchParams: { limit: 200 } }) : null;
  const lots = (lotsRes?.ok ? lotsRes.data : []).map((l) => ({ id: l.id, numero: l.numero }));
  const c = x.attributionCourante;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const etat = (a: EmplacementDetail["attributions"][number]) => (a.active ? { v: "ok" as const, l: t.active } : a.dateDebut > aujourdhui ? { v: "outline" as const, l: t.aVenir } : { v: "neutral" as const, l: t.terminee });

  return (
    <div className="page-root">
      <PageHeader
        back={<BackLink href={`/${locale}/parkings?onglet=emplacements`} label={t.titre} />}
        title={<span className="font-mono" dir="ltr">{x.code}</span>}
        badge={<Badge variant={emplacementVariant[x.statut]}>{e.statutEmplacement[x.statut]}</Badge>}
        subtitle={<>{e.typeEmplacement[x.type]}{x.niveau ? ` · ${t.niveau} ${x.niveau}` : ""}{!x.attribuable ? ` · ${t.nonAttribuable}` : ""}</>}
        actions={gestion ? (
          <div className="flex flex-wrap gap-2">
            {c ? <LibererModal dict={dict} locale={ctx.locale} emplacement={x} /> : x.attribuable && x.type !== "PARKING_VISITEUR" && x.statut !== "HORS_SERVICE" ? <AttribuerModal dict={dict} locale={ctx.locale} emplacement={x} lots={lots} /> : null}
            <EmplacementModal dict={dict} locale={ctx.locale} emplacement={x} />
            {x.nbAttributions === 0 ? <SupprimerEmplacementModal dict={dict} locale={ctx.locale} emplacement={x} /> : null}
          </div>
        ) : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title={t.attributionCourante} />
            {!c ? <p className="mt-4 rounded-[16px] bg-surface px-4 py-3.5 text-sm text-soft">{t.aucuneAttribution}</p> : (
              <>
                <div className="mt-5 flex items-center gap-4">
                  <span className="flex h-14 min-w-14 items-center justify-center rounded-full bg-brand px-4 text-[17px] font-bold text-lime" dir="ltr">{c.lotNumero ?? "—"}</span>
                  <div className="min-w-0"><p className="text-[13px] text-soft">{t.lotBeneficiaire}</p><p className="text-[18px] font-bold text-ink">{e.typeAttribution[c.type]}</p></div>
                </div>
                <dl className="mt-5 divide-y divide-wash-strong rounded-[16px] bg-surface px-4 text-sm">
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-3"><dt className="text-soft">{t.periode}</dt><dd className="tnum font-semibold text-ink">{formatDate(c.dateDebut, ctx.locale)} → {c.dateFin ? formatDate(c.dateFin, ctx.locale) : t.sansFin}</dd></div>
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-3"><dt className="text-soft">{t.redevance}</dt><dd className="tnum font-semibold text-ink">{c.redevanceMensuelle ? <><Amount value={c.redevanceMensuelle} locale={ctx.locale} currency={false} /> MAD</> : "—"}</dd></div>
                  {c.resolutionAgId ? <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-3"><dt className="text-soft">{t.resolutionAg}</dt><dd className="min-w-0 break-all font-mono text-[12px] text-body" dir="ltr">{c.resolutionAgId}</dd></div> : null}
                  {c.notes ? <div className="py-3"><dt className="text-soft">{t.notes}</dt><dd className="mt-0.5 whitespace-pre-wrap text-body">{c.notes}</dd></div> : null}
                </dl>
              </>
            )}
          </Card>
          <section className="pt-4">
            <SectionHeader title={t.historique} className="mb-3" />
            {x.attributions.length === 0 ? <p className="text-sm text-soft">{t.aucunHistorique}</p> : (
              <TableCard><Table>
                <THead><TH>{t.lot}</TH><TH>{t.type}</TH><TH>{t.periode}</TH><TH align="end">{t.redevance}</TH><TH>{t.statut}</TH><TH>{t.notes}</TH></THead>
                <LiveList as="tbody">{x.attributions.map((a) => { const s = etat(a); return (
                  <TR key={a.id}>
                    <TD className="font-bold text-ink">{a.lotNumero ?? "—"}</TD>
                    <TD className="text-body">{e.typeAttribution[a.type]}</TD>
                    <TD className="text-body tnum">{formatDate(a.dateDebut, ctx.locale)} → {a.dateFin ? formatDate(a.dateFin, ctx.locale) : t.sansFin}</TD>
                    <TD align="end" className="tnum">{a.redevanceMensuelle ? <><Amount value={a.redevanceMensuelle} locale={ctx.locale} currency={false} /> MAD</> : "—"}</TD>
                    <TD><Badge variant={s.v}>{s.l}</Badge></TD>
                    <TD className="text-[12px] text-soft">{a.creePar ? nomComplet(a.creePar) ?? "—" : "—"} · {formatDateHeure(a.creeLe, ctx.locale)}</TD>
                  </TR>
                ); })}</LiveList>
              </Table></TableCard>
            )}
          </section>
        </div>
        <Card className="lg:self-start">
          <SectionHeader title={t.notes} />
          <p className="mt-4 whitespace-pre-wrap rounded-[16px] bg-surface px-4 py-3.5 text-sm text-body">{x.notes ?? "—"}</p>
          <p className="mt-4 text-[12px] text-soft">{formatDateHeure(x.creeLe, ctx.locale)}</p>
        </Card>
      </div>
    </div>
  );
}
