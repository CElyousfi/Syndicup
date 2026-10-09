import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { DepenseDetail } from "../../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../../lib/i18n";
import { formatDate, formatDateHeure, nomComplet } from "../../../../../../lib/format";
import { actionsPossibles, joursAvant } from "../../../../../../lib/depenses";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { CMoneyBag, IconCircle } from "../../../../../../components/ui/color-icons";
import { FileViewerButton } from "../../../../../../components/documents/document-viewer";
import { depenseVariant, factureVariant } from "../../../../../../lib/status";
import { SoumettreModal, DeciderModals, PayerModal, AnnulerModal, AjouterFactureModal, StatutFactureForm } from "./depense-actions";
import { Amount } from "../../../../../../components/ui/amount";
import { LiveList } from "../../../../../../components/ui/live-list";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.depenses };
}

export default async function DepenseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ creee?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE"]);
  const { dict } = ctx;
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  const syndic = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const conseil = ctx.roles.includes("CONSEIL_SYNDICAL");
  const p = (path: string) => `/${locale}${path}`;

  const res = await apiFetch<DepenseDetail>(`/depenses/${id}`);
  if (!res.ok) notFound();
  const x = res.data;
  const actions = actionsPossibles(x, { syndic, conseil });
  // Le conseil ne décide qu'au-dessus du seuil ; le syndic en dessous (l'API tranche, l'écran guide).
  const peutDecider = actions.decider && (x.niveau_approbation_requis === "CONSEIL" ? conseil || ctx.roles.includes("SUPER_ADMIN") : true);
  const viewerLabels = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  const nom = (u?: { nom: string | null; prenom: string | null } | null) => (u ? nomComplet(u) : null) ?? dict.common.none;

  return (
    <div className="page-root">
      {sp.creee === "1" ? <Banner variant="ok" className="mb-5" title={d.creee}>{d.creeeAide}</Banner> : null}

      <PageHeader
        back={<BackLink href={p("/finances/depenses")} label={d.titre} />}
        title={x.libelle}
        badge={
          <span className="inline-flex gap-1.5">
            <Badge variant={depenseVariant[x.statut]}>{e.statutDepense[x.statut]}</Badge>
            {x.source === "FONDS_RESERVE" ? <Badge variant="info">{e.sourceFinancement.FONDS_RESERVE}</Badge> : null}
          </span>
        }
        subtitle={
          <>
            {e.categorieDepense[x.categorie]}
            {x.budgetPoste ? ` · ${x.budgetPoste.libelle}` : ` · ${d.horsPoste}`}
            {" · "}
            {formatDate(x.dateDepense, ctx.locale)}
          </>
        }
        actions={
          <>
            {actions.modifier ? <ButtonLink href={p(`/finances/depenses/${id}/modifier`)} variant="secondary">{dict.common.modify}</ButtonLink> : null}
            {actions.soumettre ? <SoumettreModal dict={dict} locale={ctx.locale} depense={x} /> : null}
            {peutDecider ? <DeciderModals dict={dict} locale={ctx.locale} depense={x} /> : null}
            {actions.payer ? <PayerModal dict={dict} locale={ctx.locale} depense={x} /> : null}
            {actions.annuler ? <AnnulerModal dict={dict} locale={ctx.locale} depense={x} /> : null}
          </>
        }
      />

      {x.statut === "A_APPROUVER" ? (
        <Banner variant={x.seuil_non_configure ? "legal" : "info"} className="mb-5" title={`${d.niveau} : ${e.niveauApprobation[x.niveau_approbation_requis]}`}>
          {x.seuil_non_configure ? d.seuilNonConfigureCorps : d.soumettreCorps}
        </Banner>
      ) : null}
      {x.statut === "REJETEE" && x.motifRejet ? <Banner variant="danger" className="mb-5" title={d.motifRejet}>{x.motifRejet}</Banner> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* Résumé : le TTC en grand, puis HT / TVA et la description. */}
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <IconCircle tone={x.statut === "PAYEE" ? "ok" : x.statut === "REJETEE" || x.statut === "ANNULEE" ? "danger" : "sand"} size={56}>
                <CMoneyBag width={28} height={28} />
              </IconCircle>
              <div className="min-w-0">
                <p className="text-sm font-medium text-soft">{d.montantTtc}</p>
                <p className="tnum mt-1.5 text-[34px] font-bold leading-none tracking-[-0.02em] text-ink sm:text-[40px]"><Amount value={x.montantTtc} locale={ctx.locale} /></p>
              </div>
            </div>
            <dl className="mt-6 grid gap-2 sm:grid-cols-2">
              <div className="flex items-baseline justify-between gap-3 rounded-[18px] bg-surface px-4 py-3"><dt className="text-sm text-soft">{d.montantHt}</dt><dd className="tnum text-[15px] font-semibold text-ink">{x.montantHt ? <Amount value={x.montantHt} locale={ctx.locale} /> : "—"}</dd></div>
              <div className="flex items-baseline justify-between gap-3 rounded-[18px] bg-surface px-4 py-3"><dt className="text-sm text-soft">{d.tva}</dt><dd className="tnum text-[15px] font-semibold text-ink">{x.tva ? <Amount value={x.tva} locale={ctx.locale} /> : "—"}</dd></div>
            </dl>
            {x.description ? <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-body">{x.description}</p> : null}
          </Card>

          <Card>
            <SectionHeader title={d.factures} action={actions.ajouterFacture ? <AjouterFactureModal dict={dict} locale={ctx.locale} depense={x} /> : undefined} />
            {x.factures.length === 0 ? (
              <p className="mt-3 text-sm text-soft">{d.aucuneFacture}</p>
            ) : (
              <LiveList as="ul" className="mt-4 divide-y divide-wash-strong">
                {x.factures.map((f, n) => {
                  const jours = joursAvant(f.dateEcheance);
                  return (
                    <li key={f.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-bold text-ink" dir="ltr">{f.numero ?? d.facture}</span>
                          <Badge variant={factureVariant[f.statut]}>{e.statutFacture[f.statut]}</Badge>
                        </div>
                        <p className="tnum mt-1 text-[13px] text-soft">
                          {d.dateFacture} : {formatDate(f.dateFacture, ctx.locale)}
                          {f.dateEcheance ? ` · ${d.dateEcheance} : ${formatDate(f.dateEcheance, ctx.locale)}` : ""}
                          {jours !== null && f.statut !== "REGLEE" ? (
                            <span className={`ms-2 ${jours < 0 ? "text-danger" : jours <= 7 ? "text-warn" : "text-faint"}`}>
                              {jours < 0 ? d.echeanceDepassee : fill(d.echeanceProche, { jours })}
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <FileViewerButton src={`/api/depense-document?id=${id}&type=facture&n=${n}`} nom={f.document?.nom ?? "facture.pdf"} labels={viewerLabels} label={d.voirFacture} />
                          {syndic ? <StatutFactureForm dict={dict} locale={ctx.locale} depenseId={id} factureId={f.id} statut={f.statut} /> : null}
                        </div>
                      </div>
                      <span className="tnum shrink-0 text-[17px] font-bold text-ink"><Amount value={f.montantTtc} locale={ctx.locale} /></span>
                    </li>
                  );
                })}
              </LiveList>
            )}
          </Card>

          <Card>
            <SectionHeader title={d.journal} subtitle={d.journalAide} />
            {x.logs.length === 0 ? (
              <p className="mt-3 text-sm text-soft">{d.journalVide}</p>
            ) : (
              <LiveList as="ol" className="mt-6 ms-2">
                {x.logs.map((log, idx) => {
                  const dernier = idx === x.logs.length - 1;
                  const ok = log.type === "PAYEE" || log.type === "APPROUVEE";
                  const ko = log.type === "REJETEE" || log.type === "ANNULEE" || log.type === "FACTURE_CONTESTEE";
                  const details = log.detailsJson ?? {};
                  return (
                    <li key={log.id} className={`relative ps-7 ${dernier ? "pb-0" : "border-s-2 border-wash-strong pb-6"}`}>
                      <span className={`absolute -start-[10px] top-0 flex size-[18px] items-center justify-center rounded-full ${ok ? "bg-ok-tint" : ko ? "bg-danger-tint" : "bg-action-tint"}`}>
                        <span className={`size-2 rounded-full ${ok ? "bg-ok" : ko ? "bg-danger" : "bg-action"}`} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-ink">
                          {e.typeLog[log.type]}
                          {typeof details.niveau === "string" ? <span className="ms-2 text-[12px] font-normal text-soft">{e.niveauApprobation[details.niveau as "SYNDIC" | "CONSEIL"] ?? String(details.niveau)}</span> : null}
                        </p>
                        {typeof details.motif === "string" ? <p className="mt-1 text-sm text-body">{details.motif}</p> : null}
                        {typeof details.methode === "string" ? (
                          <p className="mt-1 text-sm text-body">
                            {e.methodePaiementDepense[details.methode as "VIREMENT" | "CHEQUE" | "ESPECES"] ?? String(details.methode)}
                            {typeof details.reference === "string" && details.reference ? <span className="tnum" dir="ltr"> · {details.reference}</span> : null}
                          </p>
                        ) : null}
                        {typeof details.numero === "string" ? <p className="mt-1 text-sm text-body" dir="ltr">{details.numero}</p> : null}
                        <p className="mt-1 text-[13px] text-soft">
                          {log.acteur ? `${nom(log.acteur)} · ` : ""}
                          {formatDateHeure(log.horodatage, ctx.locale)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </LiveList>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <SectionHeader title={d.paiement} />
            {x.statut === "PAYEE" ? (
              <dl className="mt-3 divide-y divide-wash-strong text-sm">
                <div className="flex justify-between gap-3 py-2.5"><dt className="text-soft">{d.payeLe}</dt><dd className="tnum font-semibold text-ink">{x.payeLe ? formatDate(x.payeLe, ctx.locale) : "—"}</dd></div>
                <div className="flex justify-between gap-3 py-2.5"><dt className="text-soft">{d.methode}</dt><dd className="font-semibold text-ink">{x.methodePaiement ? e.methodePaiementDepense[x.methodePaiement] : "—"}</dd></div>
                <div className="flex justify-between gap-3 py-2.5"><dt className="text-soft">{d.reference}</dt><dd className="tnum font-semibold text-ink" dir="ltr">{x.referencePaiement ?? "—"}</dd></div>
                <div className="flex justify-between gap-3 py-2.5"><dt className="text-soft">{d.source}</dt><dd className="font-semibold text-ink">{e.sourceFinancement[x.source]}</dd></div>
                {x.mouvementsFondsReserve.length > 0 ? (
                  <div className="flex justify-between gap-3 py-2.5"><dt className="text-soft">{d.mouvementReserve}</dt><dd className="tnum font-semibold text-danger"><Amount value={x.mouvementsFondsReserve[0]!.montant} locale={ctx.locale} /></dd></div>
                ) : null}
                <div className="pt-3">
                  {x.justificatifPaiementDocument ? (
                    <FileViewerButton src={`/api/depense-document?id=${id}&type=justificatif`} nom={x.justificatifPaiementDocument.nom} labels={viewerLabels} label={d.voirPreuve} variant="primary" size="md" />
                  ) : (
                    <span className="text-[13px] text-faint">{d.justificatif} : {dict.common.none}</span>
                  )}
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-soft">{e.statutDepense[x.statut]} · {e.sourceFinancement[x.source]}</p>
            )}
          </Card>

          <Card>
            <SectionHeader title={d.prestataire} />
            {x.prestataire ? (
              <p className="mt-3 text-sm">
                <Link href={p(`/prestataires/${x.prestataire.id}`)} className="text-[15px] font-bold text-ink hover:text-link">{x.prestataire.nom}</Link>
                <span className="block text-[13px] text-soft">{x.prestataire.specialite}</span>
              </p>
            ) : (
              <p className="mt-3 text-sm text-soft">{d.aucunPrestataire}</p>
            )}
            {x.incident ? (
              <p className="mt-3 text-sm">
                <span className="text-[13px] text-soft">{d.incidentLie}</span>
                <Link href={p(`/incidents/${x.incident.id}`)} className="link block">{x.incident.sousCategorie}</Link>
              </p>
            ) : null}
            {x.resolutionAg ? (
              <p className="mt-3 text-sm">
                <span className="text-[13px] text-soft">{d.resolutionAg}</span>
                <Link href={p(`/ag/${x.resolutionAg.agId}`)} className="link block">{x.resolutionAg.texte}</Link>
              </p>
            ) : null}
          </Card>

          <Card>
            <SectionHeader title={d.statut} />
            <dl className="mt-3 divide-y divide-wash-strong text-sm">
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-soft">{d.creePar}</dt><dd className="font-semibold text-ink">{nom(x.creePar)}</dd></div>
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-soft">{d.approuvePar}</dt><dd className="font-semibold text-ink">{x.approuvePar ? nom(x.approuvePar) : "—"}</dd></div>
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-soft">{d.approuveLe}</dt><dd className="tnum font-semibold text-ink">{x.approuveLe ? formatDateHeure(x.approuveLe, ctx.locale) : "—"}</dd></div>
              <div className="flex justify-between gap-3 py-2.5"><dt className="text-soft">{d.niveau}</dt><dd className="font-semibold text-ink">{e.niveauApprobation[x.niveau_approbation_requis]}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
