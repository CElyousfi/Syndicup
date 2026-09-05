import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { JustificatifDetail } from "../../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatMAD, formatPeriode, nomComplet } from "../../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { FileViewerButton } from "../../../../../../components/documents/document-viewer";
import { justificatifVariant, ligneAppelVariant } from "../../../../../../lib/status";
import { ValiderModal, RejeterModal, AnnulerBouton } from "../justificatif-modals";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.justificatifs };
}

export default async function JustificatifDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const j = dict.justificatifs;
  const e = dict.enumsJustificatifs;
  const syndic = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const res = await apiFetch<JustificatifDetail>(`/finances/justificatifs/${id}`);
  if (!res.ok) notFound();
  const x = res.data;
  const retour = syndic || ctx.roles.includes("CONSEIL_SYNDICAL") ? "/finances/justificatifs" : ctx.roles.includes("GARDIEN") ? "/finances/especes" : "/finances/payer";
  const viewer = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  const affectations = x.detailsJson?.affectations ?? [];
  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={`/${locale}${retour}`} label={dict.nav.justificatifs} />}
        title={`${x.lot?.numero ?? ""} · ${formatMAD(x.montant, ctx.locale)}`}
        badge={<Badge variant={justificatifVariant[x.statut]}>{e.statutJustificatif[x.statut]}</Badge>}
        subtitle={<>{e.methode[x.methode]}{x.banqueEmettrice ? ` · ${x.banqueEmettrice}` : ""} · {formatDate(x.datePaiementDeclaree, ctx.locale)}</>}
        actions={syndic && x.statut === "EN_ATTENTE" ? <><ValiderModal dict={dict} locale={ctx.locale} justificatif={x} /><RejeterModal dict={dict} locale={ctx.locale} justificatif={x} /></> : undefined}
      />
      {x.statut === "REJETE" && x.motifRejet ? <Banner variant="danger" className="mb-5" title={j.motifRejet}>{x.motifRejet}</Banner> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <SectionHeader title={j.preuve} />
            {x.preuve ? (
              <div className="mt-3 space-y-3">
                <FileViewerButton src={`/api/justificatif-preuve?id=${id}`} nom={x.preuve.nom} labels={viewer} label={j.voirPreuve} variant="primary" size="md" />
                {/\.(jpe?g|png|webp)$/i.test(x.preuve.nom) ? <img src={`/api/justificatif-preuve?id=${id}`} alt={x.preuve.nom} className="max-h-[520px] w-full rounded-field border border-hairline object-contain" /> : null}
              </div>
            ) : <p className="mt-3 text-sm text-soft">{j.aucunePreuve}</p>}
          </Card>
          <Card>
            <SectionHeader title={j.declarerTitre} />
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-soft">{j.declarePar}</dt><dd className="text-ink">{nomComplet(x.declarePar ?? null) ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{j.declareLe}</dt><dd className="tnum text-ink">{formatDateHeure(x.creeLe, ctx.locale)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{j.beneficiaire}</dt><dd className="text-ink">{x.beneficiaire}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{j.reference}</dt><dd className="tnum text-ink" dir="ltr">{x.reference ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-soft">{j.imputation}</dt><dd className="text-ink text-end">{x.appelDeFondsLotId ? j.imputationCible : j.imputationFifo}</dd></div>
              {x.traiteLe ? <div className="flex justify-between gap-3"><dt className="text-soft">{j.traiteLe}</dt><dd className="tnum text-ink">{formatDateHeure(x.traiteLe, ctx.locale)} · {nomComplet(x.traitePar ?? null) ?? ""}</dd></div> : null}
            </dl>
            {x.statut === "EN_ATTENTE" && x.declareParId === ctx.profil.id ? <div className="mt-3 text-end"><AnnulerBouton dict={dict} locale={ctx.locale} justificatif={x} /></div> : null}
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <SectionHeader title={j.lignesOuvertes} subtitle={<Link href={`/${locale}/lots/${x.lotId}?onglet=finances`} className="text-action hover:underline">{dict.invitations.lot} {x.lot?.numero}</Link>} />
            {x.lignes_ouvertes.length === 0 ? <p className="mt-3 text-sm text-soft">{j.aucuneLigneOuverte}</p> : (
              <ul className="mt-3 divide-y divide-hairline">
                {x.lignes_ouvertes.map((l) => (
                  <li key={l.appel_de_fonds_lot_id} className={`flex items-center justify-between gap-3 py-2.5 ${l.appel_de_fonds_lot_id === x.appelDeFondsLotId ? "rounded-field bg-action-wash px-2" : ""}`}>
                    <div><p className="text-sm font-medium text-ink">{formatPeriode(l.periode, ctx.locale)}</p><p className="tnum text-[12px] text-faint">{formatDate(l.date_echeance, ctx.locale)} · {dict.enums.typeAppel[l.type as keyof typeof dict.enums.typeAppel] ?? l.type}</p></div>
                    <div className="flex items-center gap-2"><Badge variant={ligneAppelVariant[l.statut as keyof typeof ligneAppelVariant]}>{dict.enums.statutLigne[l.statut as keyof typeof dict.enums.statutLigne]}</Badge><span className="tnum text-sm font-medium text-ink">{formatMAD(l.restant, ctx.locale)}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {affectations.length > 0 ? (
            <Card>
              <SectionHeader title={j.affectations} />
              <ul className="mt-3 divide-y divide-hairline text-sm">
                {affectations.map((a) => <li key={a.appel_de_fonds_lot_id} className="flex justify-between gap-3 py-2"><span className="text-body">{a.statut}</span><span className="tnum font-medium text-ink">{formatMAD(a.montant, ctx.locale)}</span></li>)}
              </ul>
              {x.detailsJson?.quittance_id ? <Link href={`/${locale}/finances/quittances/${x.detailsJson.quittance_id}`} className="mt-3 inline-block text-[13px] font-medium text-action hover:underline">{j.quittance}</Link> : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
