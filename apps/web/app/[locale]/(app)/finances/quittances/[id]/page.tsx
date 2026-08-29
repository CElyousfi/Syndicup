import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { Lot, Quittance } from "../../../../../../lib/api/types";
import { getLots, getSynthese } from "../../../../../../lib/finances-data";
import { fill } from "../../../../../../lib/i18n";
import { formatDate, formatMAD, formatPeriode } from "../../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Brand } from "../../../../../../components/brand";
import { CFile, IconCircle } from "../../../../../../components/ui/color-icons";
import { PrintButton } from "./print-button";

/** D5 — mise en page « document officiel » (valeur fiscale, conservation 10 ans). */
export default async function QuittancePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const f = dict.finances;

  const quittanceRes = await apiFetch<Quittance>(`/finances/quittances/${id}`);
  if (!quittanceRes.ok) notFound();
  const quittance = quittanceRes.data;

  // Contexte de la ligne (lot, période, montant) — reconstruit depuis les appels de fonds.
  let contexte: { lot: Lot | null; periode: string | null; montant: string | null } = {
    lot: null,
    periode: null,
    montant: null,
  };
  const [synthese, lots] = await Promise.all([getSynthese(), getLots()]);
  const ligne = synthese.lignes.find((l) => l.id === quittance.appelDeFondsLotId);
  if (ligne) {
    const appel = synthese.appels.find((a) => a.id === ligne.appelDeFondsId);
    contexte = {
      lot: lots.find((l) => l.id === ligne.lotId) ?? null,
      periode: appel?.periode ?? null,
      montant: ligne.montantDu,
    };
  }

  return (
    <div className="animate-fade">
      <div className="print:hidden">
        <PageHeader
          back={<BackLink href={`/${ctx.locale}/finances/appels-de-fonds`} label={f.appels} />}
          title={fill(f.quittanceNumero, { numero: quittance.numero })}
          actions={
            <>
              <PrintButton label={f.imprimer} />
              <a
                href={`/api/quittance-pdf?id=${quittance.id}`}
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-btn bg-ink px-5 text-sm font-medium text-white shadow-[0_10px_20px_-10px_rgb(18_18_18/0.45)] transition-colors hover:bg-[#2e3230]"
              >
                {ctx.dict.ag.pvTelecharger}
              </a>
            </>
          }
        />
      </div>

      {/* Document */}
      <div className="card mx-auto max-w-2xl p-6 sm:p-10 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-hairline pb-7">
          <Brand />
          <div className="flex items-center gap-3.5">
            <IconCircle tone="tosca" size={40} className="print:hidden">
              <CFile width={20} height={20} />
            </IconCircle>
            <div className="text-end">
              <p className="text-[17px] font-semibold text-ink">{f.quittanceTitre}</p>
              <p className="mt-0.5 font-mono text-[13px] text-soft" dir="ltr">
                {quittance.numero}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-7 text-sm leading-relaxed text-body">{f.quittanceCorps}</p>

        <dl className="mt-7 space-y-4">
          {ctx.copropriete ? (
            <LigneDoc label={dict.parametres.nom} valeur={ctx.copropriete.nom} />
          ) : null}
          {contexte.lot ? (
            <LigneDoc
              label={dict.invitations.lot}
              valeur={`${dict.enums.typeLot[contexte.lot.typeLot]} ${contexte.lot.numero}`}
            />
          ) : null}
          {contexte.periode ? (
            <LigneDoc label={f.periode} valeur={formatPeriode(contexte.periode, ctx.locale)} />
          ) : null}
          {contexte.montant ? (
            <div className="flex items-baseline justify-between gap-6 rounded-field bg-action-wash px-4 py-3 print:bg-transparent print:px-0 print:py-0">
              <dt className="text-[13px] font-medium text-ink">{f.montant}</dt>
              <dd className="text-end text-sm font-medium text-ink">
                <span className="tnum text-lg font-semibold">
                  {formatMAD(contexte.montant, ctx.locale)}
                </span>
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-6 text-[13px] text-soft">
          {fill(f.emiseLe, { date: formatDate(quittance.dateEmission, ctx.locale) })}
        </p>

        <p className="mt-9 border-t border-hairline pt-5 text-[12px] text-faint">
          {f.quittanceConservation}
        </p>
      </div>
    </div>
  );
}

function LigneDoc({ label, valeur }: { label: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="text-[13px] text-soft">{label}</dt>
      <dd className="text-end text-sm font-medium text-ink">{valeur}</dd>
    </div>
  );
}
