import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { AppelDeFonds, Lot } from "../../../../../../lib/api/types";
import { formatDate, formatMAD, formatPeriode } from "../../../../../../lib/format";
import { ratio, sommeCentimes, versChaine, versCentimes } from "../../../../../../lib/centimes";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { StatCard } from "../../../../../../components/ui/stat-card";
import { CCoins, CMoneyBag, CWallet } from "../../../../../../components/ui/color-icons";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../../components/ui/table";
import { appelVariant, escaladeVariant, ligneAppelVariant } from "../../../../../../lib/status";
import { PaiementModal } from "../../../../../../components/finances/paiement-modal";

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
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={`/${ctx.locale}/finances/appels-de-fonds`} label={f.appels} />}
        title={formatPeriode(appel.periode, ctx.locale)}
        badge={
          <Badge variant={appelVariant[appel.statut]}>{dict.enums.statutAppel[appel.statut]}</Badge>
        }
        subtitle={`${dict.enums.typeAppel[appel.type]} · ${f.echeance} ${formatDate(
          appel.dateEcheance,
          ctx.locale
        )}`}
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

      {/* Résumé */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={<CWallet />}
          tone="sage"
          label={f.montantTotal}
          value={formatMAD(appel.montantTotal, ctx.locale)}
        />
        <StatCard
          icon={<CMoneyBag />}
          tone="sage"
          label={f.tauxPaiement}
          value={formatMAD(versChaine(paye), ctx.locale)}
          trend={`${Math.round(r * 100)}%`}
          trendTone={r >= 1 ? "ok" : r >= 0.6 ? "warn" : "danger"}
        />
        <StatCard
          icon={<CCoins />}
          tone="sand"
          label={f.restant}
          value={formatMAD(versChaine(du - paye), ctx.locale)}
          className="sm:col-span-2 xl:col-span-1"
        />
      </div>

      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-ink">{f.lignes}</h2>
        <p className="text-[13px] text-soft">{f.lignesSubtitle}</p>
      </div>

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
          <tbody>
            {lignes.map((l) => {
              const lot = lotParId.get(l.lotId);
              const restant = versCentimes(l.montantDu) - versCentimes(l.montantPaye);
              return (
                <TR key={l.id}>
                  <TD>
                    {lot ? (
                      <Link
                        href={`/${ctx.locale}/lots/${lot.id}?onglet=finances`}
                        className="font-semibold text-ink hover:text-action"
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
                    {formatMAD(l.montantDu, ctx.locale)}
                  </TD>
                  <TD align="end" className="tnum text-body">
                    {formatMAD(l.montantPaye, ctx.locale)}
                  </TD>
                  <TD align="end" className="tnum font-medium text-ink">
                    {formatMAD(versChaine(restant), ctx.locale)}
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
          </tbody>
        </Table>
      </TableCard>
    </div>
  );
}
