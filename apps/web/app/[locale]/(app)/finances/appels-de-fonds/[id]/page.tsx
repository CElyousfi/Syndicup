import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { AppelDeFonds, Lot } from "../../../../../../lib/api/types";
import { formatDate, formatPeriode } from "../../../../../../lib/format";
import { ratio, sommeCentimes, versChaine, versCentimes } from "../../../../../../lib/centimes";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { ProgressBar } from "../../../../../../components/ui/progress";
import { CCoins, IconCircle } from "../../../../../../components/ui/color-icons";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../../components/ui/table";
import { appelVariant, escaladeVariant, ligneAppelVariant } from "../../../../../../lib/status";
import { PaiementModal } from "../../../../../../components/finances/paiement-modal";
import { Amount } from "../../../../../../components/ui/amount";
import { LiveList } from "../../../../../../components/ui/live-list";

export default async function AppelDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const f = dict.finances;

  const [appelRes, lotsRes] = await Promise.all([
    apiFetch<AppelDeFonds>(`/finances/appels-de-fonds/${id}`),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
  ]);
  if (!appelRes.ok) notFound();
  const appel = appelRes.data;
  const lignes = appel.lignes ?? [];
  const lotParId = new Map((lotsRes.ok ? lotsRes.data : []).map((l) => [l.id, l]));

  const du = sommeCentimes(lignes.map((l) => l.montantDu));
  const paye = sommeCentimes(lignes.map((l) => l.montantPaye));
  const r = ratio(paye, du);

  const lignesImpayees = lignes.filter((l) => l.statut !== "PAYE");

  return (
    <div className="page-root">
      <PageHeader
        back={<BackLink href={`/${ctx.locale}/finances/appels-de-fonds`} label={f.appels} />}
        title={formatPeriode(appel.periode, ctx.locale)}
        subtitle={dict.enums.typeAppel[appel.type]}
        actions={
          gestion && lignesImpayees.length > 0 ? (
            <PaiementModal
              dict={dict}
              locale={ctx.locale}
              modeInitial="cible"
              lignes={lignesImpayees.map((l) => ({
                id: l.id,
                libelle: lotParId.get(l.lotId)?.numero ?? l.lotId.slice(0, 8),
                restant: versChaine(versCentimes(l.montantDu) - versCentimes(l.montantPaye)),
              }))}
              lots={[...lotParId.values()].map((l) => ({ id: l.id, numero: l.numero }))}
            />
          ) : undefined
        }
      />

      {/* Résumé : montant, statut, échéance, encaissement — avant le détail par lot. */}
      <Card className="mb-10 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <IconCircle tone="sand" size={56}>
              <CCoins width={28} height={28} />
            </IconCircle>
            <div className="min-w-0">
              <p className="text-sm font-medium text-soft">{f.montantTotal}</p>
              <p className="tnum mt-1.5 text-[34px] font-bold leading-none tracking-[-0.02em] text-ink sm:text-[44px]">
                <Amount value={appel.montantTotal} locale={ctx.locale} />
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={appelVariant[appel.statut]}>{dict.enums.statutAppel[appel.statut]}</Badge>
              </div>
            </div>
          </div>
          <dl className="w-full shrink-0 divide-y divide-wash-strong rounded-[20px] bg-surface px-5 py-1.5 text-sm lg:w-80">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-soft">{f.echeance}</dt>
              <dd className="font-semibold text-ink">{formatDate(appel.dateEcheance, ctx.locale)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-soft">{f.paye}</dt>
              <dd className="tnum font-semibold text-ok"><Amount value={versChaine(paye)} locale={ctx.locale} /></dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-soft">{f.restant}</dt>
              <dd className={`tnum font-semibold ${du - paye > 0n ? "text-danger" : "text-ink"}`}>
                <Amount value={versChaine(du - paye)} locale={ctx.locale} upIsGood={false} />
              </dd>
            </div>
          </dl>
        </div>
        <div className="mt-7">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-semibold text-ink">{f.tauxPaiement}</span>
            <span className="tnum font-semibold text-ink">{Math.round(r * 100)}%</span>
          </div>
          <ProgressBar ratio={r} tone={r >= 1 ? "ok" : r >= 0.6 ? "action" : "warn"} className="h-2.5" />
        </div>
      </Card>

      <SectionHeader title={f.lignes} subtitle={f.lignesSubtitle} className="mb-4" />

      <TableCard>
        <Table>
          <THead>
            <TH>{dict.lots.numero}</TH>
            <TH align="end">{f.du}</TH>
            <TH align="end">{f.paye}</TH>
            <TH align="end">{f.restant}</TH>
            <TH>{dict.lots.statut}</TH>
            <TH />
          </THead>
          <LiveList as="tbody">
            {lignes.map((l) => {
              const lot = lotParId.get(l.lotId);
              const restant = versCentimes(l.montantDu) - versCentimes(l.montantPaye);
              return (
                <TR key={l.id}>
                  <TD>
                    {lot ? (
                      <Link
                        href={`/${ctx.locale}/lots/${lot.id}?onglet=finances`}
                        className="font-semibold text-ink hover:text-link"
                      >
                        {lot.numero}
                      </Link>
                    ) : (
                      <span className="font-mono text-[12px] text-soft" dir="ltr">
                        {l.lotId.slice(0, 8)}…
                      </span>
                    )}
                  </TD>
                  <TD align="end" className="tnum text-body">
                    <Amount value={l.montantDu} locale={ctx.locale} />
                  </TD>
                  <TD align="end" className="tnum text-body">
                    <Amount value={l.montantPaye} locale={ctx.locale} />
                  </TD>
                  <TD align="end" className="tnum font-medium text-ink">
                    <Amount value={versChaine(restant)} locale={ctx.locale} upIsGood={false} />
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5">
                      <Badge variant={ligneAppelVariant[l.statut]}>
                        {dict.enums.statutLigne[l.statut]}
                      </Badge>
                      {l.niveauEscalade !== "N0" ? (
                        <Badge variant={escaladeVariant(l.niveauEscalade)}>
                          {l.niveauEscalade}
                        </Badge>
                      ) : null}
                      {l.conteste ? <Badge variant="info">{dict.enums.conteste}</Badge> : null}
                    </span>
                  </TD>
                  <TD align="end" className="text-[12px] text-faint">
                    {l.niveauEscalade !== "N0"
                      ? dict.enums.escalade[l.niveauEscalade]
                      : null}
                  </TD>
                </TR>
              );
            })}
          </LiveList>
        </Table>
      </TableCard>
    </div>
  );
}
