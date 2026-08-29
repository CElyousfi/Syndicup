import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { BudgetAg } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { getSynthese, totauxGlobaux, totauxParAppel } from "../../../../../lib/finances-data";
import { formatDate, formatMAD, formatPeriode } from "../../../../../lib/format";
import { versChaine } from "../../../../../lib/centimes";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { ProgressBar } from "../../../../../components/ui/progress";
import { StatCard } from "../../../../../components/ui/stat-card";
import { CChart, CCoins, CMoneyBag, IconCircle } from "../../../../../components/ui/color-icons";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { appelVariant } from "../../../../../lib/status";
import { GenererAppelModal } from "./generer-modal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.appels };
}

export default async function AppelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; generer?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const f = dict.finances;

  const [synthese, budgetsRes] = await Promise.all([
    getSynthese(),
    apiFetch<BudgetAg[]>("/finances/budgets", { searchParams: { limit: 50 } }),
  ]);
  const appels = synthese.appels;
  const totaux = totauxParAppel(synthese);
  const { du, paye: payeGlobal, impaye, taux } = totauxGlobaux(synthese);

  const budgetActifManquant = !(budgetsRes.ok ? budgetsRes.data : []).some(
    (b) => b.statut === "ACTIF"
  );

  return (
    <div className="animate-fade">
      <PageHeader
        title={f.appels}
        subtitle={f.appelsSubtitle}
        actions={
          gestion ? (
            <GenererAppelModal
              dict={dict}
              locale={ctx.locale}
              ouvertInitialement={sp.generer === "1"}
              budgetActifManquant={budgetActifManquant}
            />
          ) : undefined
        }
      />

      {appels.length === 0 ? (
        <EmptyState
          title={f.aucunAppel}
          hint={gestion ? f.aucunAppelAide : undefined}
          action={
            gestion ? (
              <GenererAppelModal
                dict={dict}
                locale={ctx.locale}
                budgetActifManquant={budgetActifManquant}
              />
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Indicateurs globaux — dérivés de la synthèse déjà chargée. */}
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={<CMoneyBag />}
              tone="sage"
              label={f.tauxPaiement}
              value={formatMAD(versChaine(payeGlobal), ctx.locale)}
              trend={`${Math.round(taux * 100)}%`}
              trendTone={taux >= 0.85 ? "ok" : taux >= 0.6 ? "warn" : "danger"}
            />
            <StatCard
              icon={<CCoins />}
              tone="sand"
              label={f.restant}
              value={formatMAD(versChaine(impaye), ctx.locale)}
              trend={impaye > 0n ? undefined : `${dict.enums.statutLigne.PAYE}`}
              trendTone="ok"
            />
            <StatCard
              icon={<CChart />}
              tone="lilac"
              label={f.montantTotal}
              value={formatMAD(versChaine(du), ctx.locale)}
              className="sm:col-span-2 xl:col-span-1"
            />
          </div>
          <TableCard>
            <Table>
              <THead>
                <TH>{f.periode}</TH>
                <TH>{f.typeAppel}</TH>
                <TH align="end">{f.montantTotal}</TH>
                <TH>{f.echeance}</TH>
                <TH className="w-44">{f.tauxPaiement}</TH>
                <TH>{dict.lots.statut}</TH>
              </THead>
              <tbody>
                {appels.map((a) => {
                  const t = totaux.get(a.id) ?? { du: 0n, paye: 0n, ratio: 0 };
                  const paye = t.paye;
                  const r = t.ratio;
                  return (
                    <TR key={a.id}>
                      <TD>
                        <span className="flex items-center gap-3">
                          <IconCircle tone="sand" size={36} className="hidden sm:inline-flex">
                            <CCoins width={18} height={18} />
                          </IconCircle>
                          <Link
                            href={`/${ctx.locale}/finances/appels-de-fonds/${a.id}`}
                            className="truncate font-semibold text-ink hover:text-action"
                          >
                            {formatPeriode(a.periode, ctx.locale)}
                          </Link>
                        </span>
                      </TD>
                      <TD>
                        <Badge variant="outline">{dict.enums.typeAppel[a.type]}</Badge>
                      </TD>
                      <TD align="end" className="tnum font-medium text-ink">
                        {formatMAD(a.montantTotal, ctx.locale)}
                      </TD>
                      <TD className="text-body">{formatDate(a.dateEcheance, ctx.locale)}</TD>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <ProgressBar
                            ratio={r}
                            tone={r >= 1 ? "ok" : r >= 0.6 ? "action" : "warn"}
                            className="w-24"
                          />
                          <span className="tnum text-[12px] font-medium text-soft">
                            {formatMAD(versChaine(paye), ctx.locale)}
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <Badge variant={appelVariant[a.statut]}>
                          {dict.enums.statutAppel[a.statut]}
                        </Badge>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableCard>
        </>
      )}
    </div>
  );
}
