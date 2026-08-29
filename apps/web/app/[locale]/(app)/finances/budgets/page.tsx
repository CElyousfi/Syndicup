import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { AssembleeGenerale, BudgetAg } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDate, formatMAD } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Pagination } from "../../../../../components/ui/pagination";
import { StatCard } from "../../../../../components/ui/stat-card";
import { CWallet, IconCircle } from "../../../../../components/ui/color-icons";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { budgetVariant } from "../../../../../lib/status";
import { CreerBudgetModal, ModifierBudgetModal, ActiverBudgetModal } from "./budget-modals";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.budgets };
}

export default async function BudgetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const f = dict.finances;

  const page = Math.max(1, Number(sp.page) || 1);
  const [budgetsRes, agsRes] = await Promise.all([
    apiFetch<BudgetAg[]>("/finances/budgets", { searchParams: { page, limit: 20 } }),
    gestion ? apiFetch<AssembleeGenerale[]>("/ag", { searchParams: { limit: 20 } }) : null,
  ]);
  const budgets = budgetsRes.ok ? budgetsRes.data : [];

  const exerciceCourant = String(new Date().getFullYear());
  const actifCourant = budgets.some(
    (b) => b.statut === "ACTIF" && b.exercice === exerciceCourant
  );
  const budgetActif =
    budgets.find((b) => b.statut === "ACTIF" && b.exercice === exerciceCourant) ??
    budgets.find((b) => b.statut === "ACTIF") ??
    null;

  const agOptions = (agsRes?.ok ? agsRes.data : []).map((a) => ({
    id: a.id,
    libelle: `${dict.enums.typeAg[a.type]} · ${formatDate(a.dateAg, ctx.locale)}`,
  }));

  return (
    <div className="animate-fade">
      <PageHeader
        title={f.budgets}
        subtitle={f.budgetsSubtitle}
        actions={
          gestion ? (
            <CreerBudgetModal
              dict={dict}
              locale={ctx.locale}
              ags={agOptions}
              exerciceSuggere={exerciceCourant}
            />
          ) : undefined
        }
      />

      {!actifCourant && budgets.length > 0 ? (
        <Banner variant="warn" className="mb-4" title={f.budgetActifRequis}>
          {f.budgetsSubtitle}
        </Banner>
      ) : null}

      {budgets.length === 0 ? (
        <EmptyState
          title={f.aucunBudget}
          hint={gestion ? f.aucunBudgetAide : undefined}
          action={
            gestion ? (
              <CreerBudgetModal
                dict={dict}
                locale={ctx.locale}
                ags={agOptions}
                exerciceSuggere={exerciceCourant}
              />
            ) : undefined
          }
        />
      ) : (
        <>
          {budgetActif ? (
            <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                icon={<CWallet />}
                tone="sage"
                label={dict.dash.depensesBudget}
                value={formatMAD(budgetActif.montantTotal, ctx.locale)}
                trend={dict.enums.statutBudget.ACTIF}
                trendTone="ok"
                hint={budgetActif.exercice}
              />
            </div>
          ) : null}
          <TableCard>
            <Table>
              <THead>
                <TH>{f.exercice}</TH>
                <TH align="end">{f.montantVote}</TH>
                <TH>{dict.lots.statut}</TH>
                <TH>{f.agLiee}</TH>
                {gestion ? <TH align="end" /> : null}
              </THead>
              <tbody>
                {budgets.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <span className="flex items-center gap-3">
                        <IconCircle tone="sage" size={36} className="hidden sm:inline-flex">
                          <CWallet width={18} height={18} />
                        </IconCircle>
                        <span className="tnum font-semibold text-ink">{b.exercice}</span>
                      </span>
                    </TD>
                    <TD align="end" className="tnum font-medium text-ink">
                      {formatMAD(b.montantTotal, ctx.locale)}
                    </TD>
                    <TD>
                      <Badge variant={budgetVariant[b.statut]}>
                        {dict.enums.statutBudget[b.statut]}
                      </Badge>
                    </TD>
                    <TD>
                      {b.agId ? (
                        <Link
                          href={`/${ctx.locale}/ag/${b.agId}`}
                          className="text-[13px] font-medium text-action hover:underline"
                        >
                          {dict.nav.ag}
                        </Link>
                      ) : (
                        <span className="text-faint">{dict.common.none}</span>
                      )}
                    </TD>
                    {gestion ? (
                      <TD align="end">
                        <span className="inline-flex items-center gap-1.5">
                          {b.statut === "PROPOSE" ? (
                            <>
                              <ModifierBudgetModal
                                dict={dict}
                                locale={ctx.locale}
                                budget={b}
                                ags={agOptions}
                              />
                              <ActiverBudgetModal dict={dict} locale={ctx.locale} budget={b} />
                            </>
                          ) : b.statut === "VOTE" ? (
                            <ActiverBudgetModal dict={dict} locale={ctx.locale} budget={b} />
                          ) : null}
                        </span>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableCard>
          {budgetsRes.ok ? (
            <Pagination
              meta={budgetsRes.meta}
              basePath={`/${ctx.locale}/finances/budgets`}
              dict={dict}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
