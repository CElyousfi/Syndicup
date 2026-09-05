/**
 * Comptabilité autonome (syndic / conseil) — « Mon relevé » (résidents, périmètre RLS).
 * Tout est dérivé du grand livre (appels, lignes par lot, paiements, budget) en centimes
 * BigInt : aucune saisie, aucun calcul demandé à l'utilisateur. Exports CSV par section.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { BudgetAg, Paiement } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDateHeure, formatMAD, formatPeriode } from "../../../../../lib/format";
import { versChaine } from "../../../../../lib/centimes";
import { getLots, getSynthese } from "../../../../../lib/finances-data";
import {
  budgetVsRealise,
  exercice,
  exercicesDisponibles,
  journalPaiements,
  parLot,
  parMois,
  parType,
  totauxExercice,
} from "../../../../../lib/comptabilite";
import { PageHeader } from "../../../../../components/page-header";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Badge } from "../../../../../components/ui/badge";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { StatCard } from "../../../../../components/ui/stat-card";
import { Bars, Donut } from "../../../../../components/ui/charts";
import { ProgressBar } from "../../../../../components/ui/progress";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { IconCircle, CChart, CCoins, CFile, CMoneyBag, CWallet, CAlert } from "../../../../../components/ui/color-icons";
import { IconDownload } from "../../../../../components/ui/icons";
import { ExportButtons } from "../../../../../components/ui/export-buttons";
import { ParcoursCompta, AideReleveResident, type EtapeParcours } from "../../../../../components/finances/parcours-compta";
import { escaladeVariant } from "../../../../../lib/status";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").comptabilite.titre };
}

export default async function ComptabilitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ exercice?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const c = dict.comptabilite;
  const gestion = ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"].some((r) => ctx.roles.includes(r as never));
  const mad = (v: bigint) => formatMAD(versChaine(v), ctx.locale);

  const [synthese, lots, budgetsRes] = await Promise.all([
    getSynthese(),
    getLots(),
    apiFetch<BudgetAg[]>("/finances/budgets"),
  ]);
  // Résident : uniquement les exercices où SES lots ont des lignes (jamais un exercice à zéro).
  const exercices = exercicesDisponibles(synthese, !gestion);
  // Vocabulaire par rôle : le syndic « encaisse », le résident « règle ».
  const lbl = gestion
    ? { appele: c.appele, encaisse: c.encaisse, restant: c.restant, taux: c.taux, parMoisAide: c.parMoisAide, journalAide: c.journalAide, aucunPaiement: c.aucunPaiement }
    : { appele: c.appeleResident, encaisse: c.regle, restant: c.resteAPayer, taux: c.partReglee, parMoisAide: c.parMoisAideResident, journalAide: c.journalAideResident, aucunPaiement: c.aucunPaiementResident };
  const annee = exercices.includes(sp.exercice ?? "") ? sp.exercice! : exercices[0];
  const p = (path: string) => `/${ctx.locale}${path}`;

  // Parcours guidé (syndic) : l'état réel des trois gestes qui alimentent toute la comptabilité.
  const budgets = budgetsRes.ok ? budgetsRes.data : [];
  const budgetActif = budgets.some((b) => b.statut === "ACTIF");
  const budgetEnCours = budgets.some((b) => b.statut === "PROPOSE" || b.statut === "VOTE");
  const aDesAppels = synthese.appels.length > 0;
  const aDesPaiements = synthese.lignes.some((l) => l.montantPaye !== "0.00" && l.montantPaye !== "0");
  const etapes: EtapeParcours[] = [
    { cle: "budget", etat: budgetActif ? "fait" : budgetEnCours ? "en_cours" : "a_faire", href: p("/finances/budgets") },
    { cle: "appel", etat: aDesAppels ? "fait" : "a_faire", href: p("/finances/appels") },
    { cle: "paiement", etat: aDesPaiements ? "fait" : aDesAppels ? "en_cours" : "a_faire", href: p("/finances/appels") },
  ];
  const parcoursComplet = etapes.every((e) => e.etat === "fait");

  if (!annee) {
    return (
      <div className="animate-fade space-y-6">
        <PageHeader title={gestion ? c.titre : c.monReleve} subtitle={gestion ? c.subtitle : c.monReleveSubtitle} />
        {gestion ? <ParcoursCompta dict={dict} etapes={etapes} /> : <AideReleveResident dict={dict} />}
        <EmptyState title={c.aucunExercice} />
      </div>
    );
  }

  const paiementsRes = await apiFetch<Paiement[]>("/finances/paiements", { searchParams: { exercice: annee } });
  const e = exercice(synthese, paiementsRes.ok ? paiementsRes.data : [], annee);
  const t = totauxExercice(e);
  const mois = parMois(e);
  const types = parType(e);
  const releve = parLot(e, lots);
  const journal = journalPaiements(e, synthese, lots);
  const bvr = budgetVsRealise(budgetsRes.ok ? budgetsRes.data : [], e);
  const enRetard = releve.filter((r) => r.restant > 0n).length;
  const maxDu = mois.reduce((m, r) => (r.du > m ? r.du : m), 0n);
  const csvHref = (type: string) => `/api/finances-csv?type=${type}&exercice=${annee}&locale=${ctx.locale}`;

  return (
    <div className="animate-fade">
      <PageHeader
        title={gestion ? c.titre : c.monReleve}
        subtitle={gestion ? c.subtitle : c.monReleveSubtitle}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="me-1 text-[12px] font-medium uppercase tracking-[0.08em] text-faint">{c.exercice}</span>
            {exercices.map((ex) => (
              <Link
                key={ex}
                href={p(`/finances/comptabilite?exercice=${ex}`)}
                className={`tnum inline-flex h-9 items-center rounded-btn px-3.5 text-[13px] font-semibold transition-colors ${
                  ex === annee ? "bg-ink text-white" : "bg-surface text-body ring-1 ring-inset ring-hairline-strong hover:bg-hover"
                }`}
              >
                {ex}
              </Link>
            ))}
          </div>
        }
      />

      {/* Indicateurs — tous calculés */}
      {gestion && !parcoursComplet ? <div className="mb-6"><ParcoursCompta dict={dict} etapes={etapes} /></div> : null}
      {!gestion ? <div className="mb-6"><AideReleveResident dict={dict} /></div> : null}

      <div className={`grid gap-4 sm:grid-cols-2 ${gestion ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        <StatCard icon={<CCoins />} tone="sand" label={lbl.appele} value={mad(t.du)} />
        <StatCard icon={<CMoneyBag />} tone="sage" label={lbl.encaisse} value={mad(t.paye)} />
        <StatCard
          icon={<CAlert />}
          tone={t.restant > 0n ? "danger" : "ok"}
          label={lbl.restant}
          value={mad(t.restant)}
          trend={t.restant <= 0n ? c.aJour : undefined}
          trendTone="ok"
        />
        <StatCard
          icon={<CChart />}
          tone="tosca"
          label={lbl.taux}
          value={`${Math.round(t.taux * 100)}%`}
          trendTone={t.taux >= 0.85 ? "ok" : t.taux >= 0.6 ? "warn" : "danger"}
        />
        {gestion ? (
          <StatCard icon={<CWallet />} tone="lilac" label={c.lotsEnRetard} value={enRetard} trendTone={enRetard > 0 ? "danger" : "ok"} />
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Mois par mois */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title={c.parMois}
            subtitle={lbl.parMoisAide}
            action={
              <a href={csvHref("mois")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-action hover:underline">
                <IconDownload width={14} height={14} />
                CSV
              </a>
            }
          />
          <Bars
            className="mt-8"
            height={200}
            items={mois.map((r, i) => ({
              label: formatPeriode(r.periode, ctx.locale),
              totalRatio: maxDu > 0n ? Number(r.du) / Number(maxDu) : 0,
              paidRatio: r.taux,
              displayPaid: mad(r.paye),
              displayTotal: mad(r.du),
              active: i === mois.length - 1,
            }))}
            yTop={mad(maxDu)}
            yMid={mad(maxDu / 2n)}
            legendPaid={lbl.encaisse}
            legendTotal={lbl.appele}
          />
          <div className="mt-6 overflow-x-auto scroll-thin">
            <Table>
              <THead>
                <TH>{c.colMois}</TH>
                <TH align="center">{c.colAppels}</TH>
                <TH align="end">{lbl.appele}</TH>
                <TH align="end">{lbl.encaisse}</TH>
                <TH align="end">{lbl.restant}</TH>
                <TH align="end">{lbl.taux}</TH>
              </THead>
              <tbody>
                {mois.map((r) => (
                  <TR key={r.periode}>
                    <TD className="font-medium text-ink">{formatPeriode(r.periode, ctx.locale)}</TD>
                    <TD align="center" className="tnum text-body">{r.nbAppels}</TD>
                    <TD align="end" className="tnum text-body">{mad(r.du)}</TD>
                    <TD align="end" className="tnum text-ink">{mad(r.paye)}</TD>
                    <TD align="end" className={`tnum ${r.restant > 0n ? "text-danger" : "text-ok"}`}>{mad(r.restant)}</TD>
                    <TD align="end" className="tnum text-body">{Math.round(r.taux * 100)}%</TD>
                  </TR>
                ))}
                <TR className="bg-ground/60 font-semibold">
                  <TD className="text-ink">{c.total}</TD>
                  <TD align="center" className="tnum text-ink">{mois.reduce((n, r) => n + r.nbAppels, 0)}</TD>
                  <TD align="end" className="tnum text-ink">{mad(t.du)}</TD>
                  <TD align="end" className="tnum text-ink">{mad(t.paye)}</TD>
                  <TD align="end" className={`tnum ${t.restant > 0n ? "text-danger" : "text-ok"}`}>{mad(t.restant)}</TD>
                  <TD align="end" className="tnum text-ink">{Math.round(t.taux * 100)}%</TD>
                </TR>
              </tbody>
            </Table>
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          {/* Par nature d'appel */}
          <Card>
            <SectionHeader title={c.parType} />
            <div className="mt-5">
              <Donut
                size={150}
                centerLabel={mad(t.du)}
                centerSub={lbl.appele}
                items={types.map((r) => ({
                  label: dict.enums.typeAppel[r.type],
                  value: Number(r.du),
                  display: mad(r.du),
                }))}
              />
            </div>
          </Card>

          {/* Budget vs réalisé */}
          {gestion ? (
            <Card>
              <SectionHeader title={c.budget} subtitle={bvr.budget ? `${c.exercice} ${bvr.budget.exercice}` : undefined} />
              {bvr.budget ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-soft">{c.budgetVote}</span>
                    <span className="tnum font-semibold text-ink">{mad(bvr.vote)}</span>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-soft">{c.budgetAppele}</span>
                      <span className="tnum font-medium text-ink">{mad(bvr.appele)} · {Math.round(bvr.tauxAppele * 100)}%</span>
                    </div>
                    <ProgressBar ratio={bvr.tauxAppele} tone="ink" className="mt-1.5" />
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-soft">{c.budgetEncaisse}</span>
                      <span className="tnum font-medium text-ink">{mad(bvr.encaisse)} · {Math.round(bvr.tauxEncaisse * 100)}%</span>
                    </div>
                    <ProgressBar ratio={bvr.tauxEncaisse} tone="ok" className="mt-1.5" />
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
                    <span className="text-soft">{c.budgetEcart}</span>
                    <span className={`tnum font-semibold ${bvr.ecart < 0n ? "text-danger" : "text-ink"}`}>{mad(bvr.ecart)}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-soft">{c.aucunBudget}</p>
              )}
            </Card>
          ) : null}

          {/* Exports */}
          <Card>
            <div className="flex items-center gap-3">
              <IconCircle tone="tosca" size={40}>
                <CFile width={20} height={20} />
              </IconCircle>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink">{c.exporter}</h2>
                <p className="text-[12px] text-soft">{c.exportAide}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {[
                ["mois", c.exportMois],
                ["lots", c.exportLots],
                ["paiements", c.exportPaiements],
              ].map(([type, label]) => (
                <a
                  key={type}
                  href={csvHref(type!)}
                  className="inline-flex h-10 items-center gap-2 rounded-btn border border-hairline-strong bg-surface px-4 text-[13px] font-medium text-ink-strong transition-colors hover:bg-hover"
                >
                  <IconDownload width={15} height={15} className="text-action" />
                  {label}
                </a>
              ))}
            </div>
          </Card>
        </div>

        {/* Relevé par lot */}
        <Card className="lg:col-span-3" padded={false}>
          <div className="p-6 pb-3">
            <SectionHeader
              title={gestion ? c.parLot : c.monReleve}
              subtitle={gestion ? c.parLotAide : c.parLotAideResident}
              action={
                <a href={csvHref("lots")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-action hover:underline">
                  <IconDownload width={14} height={14} />
                  CSV
                </a>
              }
            />
          </div>
          <TableCard className="rounded-none border-0 shadow-none">
            <Table>
              <THead>
                <TH>{c.colLot}</TH>
                <TH align="end">{lbl.appele}</TH>
                <TH align="end">{lbl.encaisse}</TH>
                <TH align="end">{lbl.restant}</TH>
                <TH>{c.colEscalade}</TH>
                <TH>{c.colDernierPaiement}</TH>
                {gestion ? <TH align="end">{dict.common.actions}</TH> : null}
              </THead>
              <tbody>
                {releve.map((r) => (
                  <TR key={r.lotId}>
                    <TD>
                      <Link href={p(`/lots/${r.lotId}?onglet=finances`)} className="font-medium text-ink hover:text-action">
                        {r.typeLot ? `${dict.enums.typeLot[r.typeLot]} ` : ""}{r.numero}
                      </Link>
                    </TD>
                    <TD align="end" className="tnum text-body">{mad(r.du)}</TD>
                    <TD align="end" className="tnum text-ink">{mad(r.paye)}</TD>
                    <TD align="end" className={`tnum font-medium ${r.restant > 0n ? "text-danger" : "text-ok"}`}>{mad(r.restant)}</TD>
                    <TD>
                      {r.restant > 0n ? (
                        <Badge variant={escaladeVariant(r.escalade)}>{dict.enums.escalade[r.escalade]}</Badge>
                      ) : (
                        <Badge variant="ok">{c.aJour}</Badge>
                      )}
                    </TD>
                    <TD className="text-[13px] text-soft">{r.dernierPaiement ? formatDateHeure(r.dernierPaiement, ctx.locale) : dict.common.none}</TD>
                    {gestion ? (
                      <TD align="end">
                        {r.restant > 0n ? (
                          <Link
                            href={p(`/lots/${r.lotId}?onglet=finances`)}
                            className="inline-flex h-8 items-center whitespace-nowrap rounded-btn bg-action-tint px-3 text-[12px] font-semibold text-action transition-colors hover:bg-action hover:text-white"
                          >
                            {c.enregistrerPaiement}
                          </Link>
                        ) : null}
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableCard>
        </Card>

        {/* Journal des paiements */}
        <Card className="lg:col-span-3" padded={false}>
          <div className="p-6 pb-3">
            <SectionHeader
              title={c.journal}
              subtitle={lbl.journalAide}
              action={
                gestion ? (
                  <ExportButtons ressource="paiements" filtres={{ exercice: annee }} labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx, title: dict.rapports.exportPaiementsAide }} size="sm" />
                ) : (
                  <a href={csvHref("paiements")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-action hover:underline">
                    <IconDownload width={14} height={14} />
                    CSV
                  </a>
                )
              }
            />
          </div>
          {journal.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-soft">{lbl.aucunPaiement}</p>
          ) : (
            <TableCard className="rounded-none border-0 shadow-none">
              <Table>
                <THead>
                  <TH>{c.colDate}</TH>
                  <TH>{c.colLot}</TH>
                  <TH>{c.colPeriode}</TH>
                  <TH>{c.colMethode}</TH>
                  <TH align="end">{c.colMontant}</TH>
                </THead>
                <tbody>
                  {journal.map((r) => (
                    <TR key={r.id}>
                      <TD className="text-[13px] text-body">{formatDateHeure(r.horodatage, ctx.locale)}</TD>
                      <TD className="font-medium text-ink">{r.lotNumero}</TD>
                      <TD className="text-[13px] text-body">
                        {r.periode ? formatPeriode(r.periode, ctx.locale) : dict.common.none}
                        {r.typeAppel ? <span className="text-faint"> · {dict.enums.typeAppel[r.typeAppel]}</span> : null}
                      </TD>
                      <TD><Badge variant="outline">{dict.enums.methodePaiement[r.methode]}</Badge></TD>
                      <TD align="end" className="tnum font-semibold text-ink">{mad(r.montantC)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}
        </Card>
      </div>
      <p className="mt-4 text-[12px] text-faint">{fill(c.subtitle, {})}</p>
    </div>
  );
}
