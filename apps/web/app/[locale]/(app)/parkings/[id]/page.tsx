/** Fiche emplacement (M23) — attribution en cours, historique, actions (attribuer / libérer / modifier / supprimer). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { EmplacementDetail, Lot } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatMontant, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { emplacementVariant } from "../../../../../lib/status";
import { AttribuerModal, EmplacementModal, LibererModal, SupprimerEmplacementModal } from "../parkings-client";

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
    <div className="animate-fade">
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
            {!c ? <p className="mt-3 text-sm text-soft">{t.aucuneAttribution}</p> : (
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><dt className="text-[12px] text-faint">{t.lotBeneficiaire}</dt><dd className="text-sm font-medium text-ink-strong">{c.lotNumero ?? "—"}</dd></div>
                <div><dt className="text-[12px] text-faint">{t.type}</dt><dd className="text-sm text-ink-strong">{e.typeAttribution[c.type]}</dd></div>
                <div><dt className="text-[12px] text-faint">{t.periode}</dt><dd className="text-sm text-ink-strong tnum">{formatDate(c.dateDebut, ctx.locale)} → {c.dateFin ? formatDate(c.dateFin, ctx.locale) : t.sansFin}</dd></div>
                <div><dt className="text-[12px] text-faint">{t.redevance}</dt><dd className="text-sm text-ink-strong tnum">{c.redevanceMensuelle ? `${formatMontant(c.redevanceMensuelle)} MAD` : "—"}</dd></div>
                {c.resolutionAgId ? <div><dt className="text-[12px] text-faint">{t.resolutionAg}</dt><dd className="font-mono text-[12px] text-body" dir="ltr">{c.resolutionAgId}</dd></div> : null}
                {c.notes ? <div className="sm:col-span-2"><dt className="text-[12px] text-faint">{t.notes}</dt><dd className="whitespace-pre-wrap text-sm text-body">{c.notes}</dd></div> : null}
              </dl>
            )}
          </Card>
          <TableCard>
            <div className="p-5 pb-2"><SectionHeader title={t.historique} /></div>
            {x.attributions.length === 0 ? <p className="px-5 pb-5 text-sm text-soft">{t.aucunHistorique}</p> : (
              <Table>
                <THead><TH>{t.lot}</TH><TH>{t.type}</TH><TH>{t.periode}</TH><TH align="end">{t.redevance}</TH><TH>{t.statut}</TH><TH>{t.notes}</TH></THead>
                <tbody>{x.attributions.map((a) => { const s = etat(a); return (
                  <TR key={a.id}>
                    <TD className="font-medium text-ink-strong">{a.lotNumero ?? "—"}</TD>
                    <TD className="text-body">{e.typeAttribution[a.type]}</TD>
                    <TD className="text-body tnum">{formatDate(a.dateDebut, ctx.locale)} → {a.dateFin ? formatDate(a.dateFin, ctx.locale) : t.sansFin}</TD>
                    <TD align="end" className="tnum">{a.redevanceMensuelle ? `${formatMontant(a.redevanceMensuelle)} MAD` : "—"}</TD>
                    <TD><Badge variant={s.v}>{s.l}</Badge></TD>
                    <TD className="text-[12px] text-soft">{a.creePar ? nomComplet(a.creePar) ?? "—" : "—"} · {formatDateHeure(a.creeLe, ctx.locale)}</TD>
                  </TR>
                ); })}</tbody>
              </Table>
            )}
          </TableCard>
        </div>
        <Card>
          <SectionHeader title={t.notes} />
          <p className="mt-3 whitespace-pre-wrap text-sm text-body">{x.notes ?? "—"}</p>
          <p className="mt-4 text-[12px] text-faint">{formatDateHeure(x.creeLe, ctx.locale)}</p>
        </Card>
      </div>
    </div>
  );
}
