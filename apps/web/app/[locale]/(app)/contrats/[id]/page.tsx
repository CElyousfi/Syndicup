/** Détail d'un contrat (M19) — cycle de vie, échéancier + actions, documents (visionneuse), police d'assurance, dépenses liées, journal. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { ContratDetail } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatMAD, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Table, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { DocumentViewerButton } from "../../../../../components/documents/document-viewer";
import { contratVariant, depenseVariant, echeanceVariant } from "../../../../../lib/status";
import { ActiverModal, SuspendreModal, ResilierModal, RegenererBouton, AjouterEcheanceModal, EcheanceActions } from "../contrat-actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").contrats.titre };
}

export default async function ContratDetailPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ cree?: string }> }) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const c = dict.contrats;
  const e = dict.enumsContrats;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const res = await apiFetch<ContratDetail>(`/contrats/${id}`);
  if (!res.ok) notFound();
  const x = res.data;
  const p = (path: string) => `/${locale}${path}`;
  const mad = (v: string | null | undefined) => formatMAD(v, ctx.locale);
  const viewer = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  const vivant = x.statut === "ACTIF" || x.statut === "BROUILLON" || x.statut === "SUSPENDU";
  const det = x.detailsAssuranceJson;
  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={p("/contrats")} label={c.titre} />}
        title={x.libelle}
        badge={<Badge variant={contratVariant[x.statut]}>{e.statutContrat[x.statut]}</Badge>}
        subtitle={<>{e.typeContrat[x.type]}{x.prestataire ? ` · ${x.prestataire.nom}` : ""}{x.reference ? <> · <span dir="ltr">{x.reference}</span></> : null}</>}
        actions={gestion ? <>{vivant ? <ButtonLink href={p(`/contrats/${id}/modifier`)} variant="secondary">{dict.common.modify}</ButtonLink> : null}{x.statut === "BROUILLON" || x.statut === "SUSPENDU" ? <ActiverModal dict={dict} locale={ctx.locale} contrat={x} /> : null}{x.statut === "ACTIF" ? <SuspendreModal dict={dict} locale={ctx.locale} contrat={x} /> : null}{vivant ? <ResilierModal dict={dict} locale={ctx.locale} contrat={x} /> : null}</> : undefined}
      />
      {sp.cree ? <Banner variant="ok" className="mb-4" title={c.cree}>{c.creeAide}</Banner> : null}
      {x.statut === "RESILIE" && x.motifResiliation ? <Banner variant="warn" className="mb-4" title={`${c.motifResiliation}${x.dateResiliation ? ` · ${formatDate(x.dateResiliation, ctx.locale)}` : ""}`}>{x.motifResiliation}</Banner> : null}
      {x.statut === "ACTIF" && x.jours_avant_fin !== null && x.jours_avant_fin <= 90 ? <Banner variant={x.jours_avant_fin <= 30 ? "danger" : "warn"} className="mb-4">{fill(c.joursAvantFin, { n: x.jours_avant_fin })}{x.tacite ? ` · ${c.tacite}` : ""}</Banner> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeader title={c.echeancier} subtitle={c.echeancierAide} />
              {gestion && vivant ? <div className="flex flex-wrap gap-2"><AjouterEcheanceModal dict={dict} locale={ctx.locale} contrat={x} /><RegenererBouton dict={dict} locale={ctx.locale} contrat={x} /></div> : null}
            </div>
            {x.echeances.length === 0 ? <p className="mt-3 text-sm text-soft">{c.aucuneEcheance}</p> : (
              <div className="mt-3 overflow-x-auto scroll-thin">
                <Table>
                  <THead><TH>{c.dateEcheance}</TH><TH>{c.typeEcheance}</TH><TH align="end">{c.montant}</TH><TH>{c.statut}</TH>{gestion ? <TH /> : null}</THead>
                  <tbody>
                    {x.echeances.map((ec) => (
                      <TR key={ec.id}>
                        <TD className="tnum font-medium text-ink">{formatDate(ec.dateEcheance, ctx.locale)}</TD>
                        <TD className="text-body">{e.typeEcheance[ec.type]}{ec.depense ? <Link href={p(`/finances/depenses/${ec.depense.id}`)} className="block text-[12px] text-action hover:underline">{ec.depense.libelle} · {dict.enumsDepenses.statutDepense[ec.depense.statut]}</Link> : null}</TD>
                        <TD align="end" className="tnum text-ink">{mad(ec.montant)}</TD>
                        <TD><Badge variant={echeanceVariant[ec.statut]}>{e.statutEcheance[ec.statut]}</Badge></TD>
                        {gestion ? <TD align="end">{vivant ? <EcheanceActions dict={dict} locale={ctx.locale} contrat={x} echeance={ec} /> : null}</TD> : null}
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
          <Card>
            <SectionHeader title={c.depensesLiees} action={<Link href={p(`/finances/depenses?contrat_id=${id}`)} className="text-[13px] font-medium text-action hover:underline">{dict.nav.depenses}</Link>} />
            {x.depenses.length === 0 ? <p className="mt-3 text-sm text-soft">{c.aucuneDepenseLiee}</p> : (
              <ul className="mt-3 divide-y divide-hairline">
                {x.depenses.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0"><Link href={p(`/finances/depenses/${d.id}`)} className="font-medium text-ink hover:text-action">{d.libelle}</Link><span className="block text-[12px] text-faint">{formatDate(d.dateDepense, ctx.locale)}</span></div>
                    <div className="flex items-center gap-2"><Badge variant={depenseVariant[d.statut]}>{dict.enumsDepenses.statutDepense[d.statut]}</Badge><span className="tnum font-medium text-ink">{mad(d.montantTtc)}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <SectionHeader title={c.journal} />
            <ol className="mt-3 space-y-2 text-sm">
              {x.logs.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 border-b border-hairline pb-2 last:border-0">
                  <div><span className="font-medium text-ink">{c.journalTypes[l.type as keyof typeof c.journalTypes] ?? l.type}</span><span className="block text-[12px] text-faint">{l.acteur ? nomComplet(l.acteur) : c.systeme}</span></div>
                  <span className="tnum whitespace-nowrap text-[12px] text-soft">{formatDateHeure(l.horodatage, ctx.locale)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="min-w-0 space-y-4">
          <Card>
            <SectionHeader title={c.type} />
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-soft">{c.periodicite}</dt><dd className="text-ink">{e.periodicite[x.periodicite]}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{c.montantPeriode}</dt><dd className="tnum font-semibold text-ink">{mad(x.montantPeriode)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{c.dateDebut}</dt><dd className="tnum text-ink">{formatDate(x.dateDebut, ctx.locale)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{c.dateFin}</dt><dd className="tnum text-ink">{x.dateFin ? formatDate(x.dateFin, ctx.locale) : c.dureeIndeterminee}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{c.tacite}</dt><dd className="text-ink">{x.tacite ? dict.common.yes : dict.common.no}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{c.preavis}</dt><dd className="tnum text-ink">{x.preavisJours ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{c.poste}</dt><dd className="text-ink">{x.budgetPoste?.libelle ?? c.horsPoste}</dd></div>
              {x.resolutionAg ? <div className="flex justify-between gap-3"><dt className="text-soft">{c.resolutionAg}</dt><dd className="text-ink"><Link href={p(`/ag/${x.resolutionAg.agId}`)} className="text-action hover:underline">{x.resolutionAg.texte.slice(0, 60)}</Link></dd></div> : null}
              {x.prestataire ? <div className="flex justify-between gap-3"><dt className="text-soft">{c.prestataire}</dt><dd className="text-ink"><Link href={p(`/prestataires/${x.prestataire.id}`)} className="text-action hover:underline">{x.prestataire.nom}</Link></dd></div> : null}
            </dl>
            {x.notes ? <p className="mt-3 border-t border-hairline pt-3 text-sm text-body">{x.notes}</p> : null}
          </Card>
          {x.est_assurance ? (
            <Card>
              <SectionHeader title={c.assurance} />
              {det ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-soft">{c.assureur}</dt><dd className="text-ink">{det.assureur}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-soft">{c.numeroPolice}</dt><dd className="text-ink" dir="ltr">{det.numero_police}</dd></div>
                  {det.franchise ? <div className="flex justify-between gap-3"><dt className="text-soft">{c.franchise}</dt><dd className="tnum text-ink">{mad(det.franchise)}</dd></div> : null}
                  {det.capital_assure ? <div className="flex justify-between gap-3"><dt className="text-soft">{c.capitalAssure}</dt><dd className="tnum text-ink">{mad(det.capital_assure)}</dd></div> : null}
                  {det.garanties.length ? <div><dt className="text-soft">{c.garanties}</dt><dd className="mt-1 flex flex-wrap gap-1.5">{det.garanties.map((g) => <Badge key={g} variant="neutral">{g}</Badge>)}</dd></div> : null}
                </dl>
              ) : <p className="mt-3 text-sm text-soft">—</p>}
            </Card>
          ) : null}
          <Card>
            <SectionHeader title={dict.nav.documents} />
            {x.document || x.attestationDocument ? (
              <ul className="mt-3 space-y-2">
                {x.document ? <li className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-ink">{c.documentSigne}<span className="block text-[12px] text-faint">{x.document.nom}</span></span><DocumentViewerButton documentId={x.document.id} nom={x.document.nom} labels={viewer} /></li> : null}
                {x.attestationDocument ? <li className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-ink">{c.attestation}<span className="block text-[12px] text-faint">{x.attestationDocument.nom}</span></span><DocumentViewerButton documentId={x.attestationDocument.id} nom={x.attestationDocument.nom} labels={viewer} /></li> : null}
              </ul>
            ) : <p className="mt-3 text-sm text-soft">{dict.common.none}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
