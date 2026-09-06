/** Détail d'un rapport de gestion (M18) — synthèse, PDF FR/AR (publique / complète), soumission à l'AG, instantané. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { AssembleeGenerale, RapportGestion } from "../../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatMAD, nomComplet } from "../../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { StatCard } from "../../../../../../components/ui/stat-card";
import { Table, TD, TH, THead, TR } from "../../../../../../components/ui/table";
import { CAlert, CChart, CMoneyBag, CWallet } from "../../../../../../components/ui/color-icons";
import { rapportVariant, resolutionVariant, trancheVariant } from "../../../../../../lib/status";
import { PdfRapportButtons, SoumettreModal } from "../../rapport-modals";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").rapports.gestionTitre };
}

export default async function RapportGestionDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const r = dict.rapports;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((x) => ctx.roles.includes(x as never));
  const [res, agsRes] = await Promise.all([apiFetch<RapportGestion>(`/rapports/gestion/${id}`), gestion ? apiFetch<AssembleeGenerale[]>("/ag", { searchParams: { limit: 50 } }) : Promise.resolve(null)]);
  if (!res.ok) notFound();
  const x = res.data;
  const d = x.donnees!;
  const p = (path: string) => `/${locale}${path}`;
  const mad = (v: string | null | undefined) => formatMAD(v, ctx.locale);
  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={p("/rapports/gestion")} label={r.gestionTitre} />}
        title={`${r.gestionTitre.split(" ")[0]} ${r.exercice.toLowerCase()} ${x.exercice}`}
        badge={<Badge variant={rapportVariant[x.statut]}>{dict.enumsRapports.statutRapport[x.statut]}</Badge>}
        subtitle={<>{r.generePar} {nomComplet(x.genere_par) ?? "—"} · {formatDateHeure(x.genere_le, ctx.locale)}</>}
        actions={gestion && x.statut === "GENERE" ? <SoumettreModal dict={dict} locale={ctx.locale} rapport={x} ags={agsRes?.ok ? agsRes.data : []} /> : undefined}
      />
      {x.statut === "BROUILLON" ? <Banner variant="warn" className="mb-4">{r.pdfEchec}</Banner> : null}
      {d.seuil_approbation_non_configure ? <Banner variant="legal" className="mb-4" title={r.seuilNonConfigure}>{dict.depenses.seuilNonConfigureCorps}</Banner> : null}
      <div className="stat mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<CWallet />} tone="sage" label={`${r.compteCourant} · ${r.cloture}`} value={mad(d.tresorerie.cloture.compte_courant)} hint={`${r.ouverture} ${mad(d.tresorerie.ouverture.compte_courant)}`} />
        <StatCard icon={<CMoneyBag />} tone="lilac" label={`${r.reserve} · ${r.cloture}`} value={d.tresorerie.reserve_configuree ? mad(d.tresorerie.cloture.reserve) : "—"} trend={d.tresorerie.reserve_configuree ? undefined : r.reserveAbsente} trendTone="neutral" hint={d.tresorerie.reserve_configuree ? `${r.ouverture} ${mad(d.tresorerie.ouverture.reserve)}` : undefined} />
        <StatCard icon={<CChart />} tone="tosca" label={r.recouvrement} value={d.recouvrement.taux ? `${d.recouvrement.taux} %` : "—"} hint={`${r.encaisse} ${mad(d.recouvrement.encaisse)}`} />
        <StatCard icon={<CAlert />} tone={Number(d.impayes.total) > 0 ? "warn" : "sage"} label={r.impayes} value={mad(d.impayes.total)} hint={fill(r.lotsEnRetard, { n: d.impayes.nb_lots_en_retard })} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title={r.document} subtitle={x.document_visibilite ? `${dict.documents.visibilite} : ${dict.enums.visibiliteDocument[x.document_visibilite]}` : undefined} />
            <div className="mt-4"><PdfRapportButtons dict={dict} rapport={x} complet /></div>
          </Card>
          <Card>
            <SectionHeader title={r.budget} subtitle={d.budget_vs_realise.budget ? `${r.prevu} ${mad(d.budget_vs_realise.totaux.montant_prevu)} · ${r.realise} ${mad(d.budget_vs_realise.totaux.realise)}` : r.aucunBudget} />
            {d.budget_vs_realise.postes.length > 0 ? (
              <div className="mt-3 overflow-x-auto scroll-thin">
                <Table>
                  <THead><TH>{dict.depenses.poste}</TH><TH align="end">{r.prevu}</TH><TH align="end">{r.realise}</TH><TH align="end">{r.ecart}</TH></THead>
                  <tbody>
                    {d.budget_vs_realise.postes.map((po) => (
                      <TR key={po.poste_id}><TD className="font-medium text-ink">{po.libelle}</TD><TD align="end" className="tnum text-body">{mad(po.montant_prevu)}</TD><TD align="end" className="tnum text-ink">{mad(po.realise)}</TD><TD align="end" className={`tnum ${po.depassement ? "text-danger" : "text-ok"}`}>{mad(po.ecart)}</TD></TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : null}
          </Card>
          <Card>
            <SectionHeader title={r.depenses} subtitle={`${d.depenses.length} · ${mad(d.depenses_par_categorie.total)}`} />
            <div className="mt-3 overflow-x-auto scroll-thin">
              <Table>
                <THead><TH>{r.date}</TH><TH>{r.libelle}</TH><TH>{r.prestataire}</TH><TH align="end">{r.montant}</TH></THead>
                <tbody>
                  {d.depenses.map((dep) => (
                    <TR key={dep.id}><TD className="tnum text-soft">{formatDate(dep.date, ctx.locale)}</TD><TD className="font-medium text-ink"><Link href={p(`/finances/depenses/${dep.id}`)} className="hover:text-action">{dep.libelle}</Link><span className="block text-[12px] text-faint">{dict.enumsDepenses.categorieDepense[dep.categorie]}</span></TD><TD className="text-body">{dep.prestataire ?? "—"}</TD><TD align="end" className="tnum text-ink">{mad(dep.montant_ttc)}</TD></TR>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
          <Card>
            <SectionHeader title={r.impayesParLot} subtitle={`${r.date} ${formatDate(d.impayes.arrete_le, ctx.locale)}`} />
            {d.impayes.par_lot.length === 0 ? <p className="mt-3 text-sm text-soft">{r.aucunImpaye}</p> : (
              <div className="mt-3 overflow-x-auto scroll-thin">
                <Table>
                  <THead><TH>{r.lot}</TH><TH align="center">{r.lignes}</TH><TH align="center">{r.retardMax}</TH><TH align="end">{r.resteDu}</TH></THead>
                  <tbody>
                    {d.impayes.par_lot.map((l) => (
                      <TR key={l.lot_id}><TD className="font-medium text-ink"><Link href={p(`/lots/${l.lot_id}?onglet=finances`)} className="hover:text-action">{l.lot_numero}</Link>{l.conteste ? <Badge variant="warn" className="ms-2">{r.conteste}</Badge> : null}</TD><TD align="center" className="tnum text-body">{l.nb_lignes}</TD><TD align="center" className="tnum text-body">{l.retard_max_jours} j</TD><TD align="end" className="tnum text-danger">{mad(l.reste_du)}</TD></TR>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">{d.impayes.tranches.map((tr) => <Badge key={tr.tranche} variant={trancheVariant[tr.tranche]}>{dict.enumsRapports.tranche[tr.tranche]} · {mad(tr.montant)}</Badge>)}</div>
          </Card>
        </div>
        <div className="min-w-0 space-y-4">
          <Card>
            <SectionHeader title={r.resolution} />
            {x.resolution && x.ag ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-ink">{x.resolution.texte}</p>
                <p className="text-soft">{dict.enumsRapports.typeMajorite[x.resolution.type_majorite]}</p>
                <Badge variant={resolutionVariant[x.resolution.resultat]}>{dict.enums.resultatResolution[x.resolution.resultat]}</Badge>
                <p><Link href={p(`/ag/${x.ag.id}`)} className="text-action hover:underline">{r.voirAg} · {formatDate(x.ag.date_ag, ctx.locale)}</Link></p>
              </div>
            ) : <p className="mt-3 text-sm text-soft">{x.statut === "GENERE" ? r.soumettreAide : "—"}</p>}
          </Card>
          <Card>
            <SectionHeader title={r.reserveMouvements} />
            {d.reserve.mouvements.length === 0 ? <p className="mt-3 text-sm text-soft">{r.aucun}</p> : (
              <ul className="mt-3 divide-y divide-hairline text-sm">
                {d.reserve.mouvements.map((m) => <li key={m.id} className="flex items-center justify-between gap-3 py-2"><span className="text-body">{formatDate(m.date, ctx.locale)} · {m.description ?? m.type}</span><span className={`tnum font-medium ${m.montant.startsWith("-") ? "text-danger" : "text-ok"}`}>{mad(m.montant)}</span></li>)}
              </ul>
            )}
          </Card>
          <Card>
            <SectionHeader title={r.faits} />
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-soft">{dict.nav.incidents}</dt><dd className="tnum text-ink">{d.faits_marquants.nb_incidents}</dd></div>
              <div><dt className="text-soft">{r.incidentsMajeurs}</dt><dd className="text-ink">{d.faits_marquants.incidents_majeurs.length === 0 ? r.aucun : d.faits_marquants.incidents_majeurs.map((i) => <Link key={i.id} href={p(`/incidents/${i.id}`)} className="block hover:text-action">{formatDate(i.date, ctx.locale)} · {dict.enums.categorieIncident[i.categorie as never]} — {i.sous_categorie}</Link>)}</dd></div>
              <div><dt className="text-soft">{r.agTenues}</dt><dd className="text-ink">{d.faits_marquants.ag_tenues.length === 0 ? r.aucun : d.faits_marquants.ag_tenues.map((a) => <Link key={a.id} href={p(`/ag/${a.id}`)} className="block hover:text-action">{formatDate(a.date, ctx.locale)} · {dict.enums.typeAg[a.type as never]} · {a.nb_resolutions}</Link>)}</dd></div>
              <div><dt className="text-soft">{r.contratsSignes}</dt><dd className="text-ink">{d.faits_marquants.contrats_signes.length === 0 ? r.aucun : d.faits_marquants.contrats_signes.map((c) => <span key={c.id} className="block">{formatDate(c.date, ctx.locale)} · {c.libelle}</span>)}</dd></div>
            </dl>
          </Card>
          <Card>
            <SectionHeader title={r.signatures} />
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-soft">{r.syndic}</dt><dd className="text-ink">{d.syndic.nom ?? r.nonRenseigne}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{r.presidentConseil}</dt><dd className="text-ink">{d.president_conseil.nom ?? r.nonRenseigne}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{r.justificatifsAttente}</dt><dd className="tnum text-ink">{d.justificatifs_en_attente.nb} · {mad(d.justificatifs_en_attente.montant)}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
