import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../../lib/app-context";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatMAD } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { ButtonLink } from "../../../../../components/ui/button";
import { CCoins, CMoneyBag, CWallet, CBuilding, IconCircle } from "../../../../../components/ui/color-icons";
import { IconChevronEnd } from "../../../../../components/ui/icons";
import { justificatifTone, justificatifVariant } from "../../../../../lib/status";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { DeclarerForm } from "../justificatifs/declarer-form";
import { AnnulerBouton } from "../justificatifs/justificatif-modals";
import { comptesBancaires, justificatifs, lotsEtLignesOuvertes, soldesLots } from "../justificatifs/data";
import { Amount } from "../../../../../components/ui/amount";
import { LiveList } from "../../../../../components/ui/live-list";
import { LoadError } from "../../../../../components/ui/load-error";
import { versCentimes, versChaine } from "../../../../../lib/centimes";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.payer };
}

/** Résident : « Payer » — virement (comptes + déclaration avec preuve), carte (bientôt), espèces (information). */
export default async function PayerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const j = dict.justificatifs;
  const e = dict.enumsJustificatifs;
  const [comptesRes, { lots, lignes, erreur: erreurLots, lotsRefuses }, mes] = await Promise.all([comptesBancaires(ctx.coproprieteId), lotsEtLignesOuvertes(), justificatifs()]);
  const { soldes, erreur: erreurSoldes, refuse: soldesRefuses } = await soldesLots(lots);
  // Rôle sans accès aux lots ni aux soldes (403 par conception) : pas de carte « solde ».
  const voitSolde = !lotsRefuses && !soldesRefuses;
  // Solde indisponible (lots ou un solde de lot non lus) : JAMAIS « 0 MAD — solde à jour ».
  const soldeIndisponible = erreurLots ?? erreurSoldes;
  const comptes = comptesRes.ok ? comptesRes.data : [];
  // Centimes BigInt (lib/centimes) — jamais de float sur un montant.
  const totalDu = [...soldes.values()].reduce((acc, s) => acc + versCentimes(s.solde_du), 0n);
  const enAttente = [...soldes.values()].reduce((acc, s) => acc + versCentimes(s.justificatifs_en_attente ?? "0"), 0n);
  const chaine = versChaine;
  const mad = (c: bigint) => formatMAD(chaine(c), ctx.locale);

  return (
    <div className="page-root">
      <PageHeader title={j.payerTitre} subtitle={j.payerSubtitle} />
      {/* Résumé : ce que je dois, ce qui attend validation, le paiement en ligne. */}
      {voitSolde ? <Card className="mb-10 p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
          {soldeIndisponible ? (
            <div className="min-w-0">
              <p className="mb-2 text-sm font-medium text-soft">{dict.finances.soldeDu}</p>
              <LoadError error={soldeIndisponible} locale={ctx.locale} title={dict.errors.load.solde} variant="inline" />
              <p className="mt-2 text-[13px] text-soft">{dict.errors.load.soldeAide}</p>
            </div>
          ) : (
            <div className="flex min-w-0 items-start gap-4">
              <IconCircle tone={totalDu > 0n ? "sand" : "sage"} size={56}>
                <CMoneyBag width={28} height={28} />
              </IconCircle>
              <div className="min-w-0">
                <p className="text-sm font-medium text-soft">{dict.finances.soldeDu}</p>
                <p className="tnum mt-1.5 text-[34px] font-bold leading-none tracking-[-0.02em] text-ink sm:text-[44px]"><Amount value={chaine(totalDu)} locale={ctx.locale} upIsGood={false} /></p>
                {totalDu <= 0n ? <p className="mt-3 text-sm text-soft">{dict.finances.soldeAJour}</p> : null}
              </div>
            </div>
          )}
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5">
              <IconCircle tone="tosca" size={40}><CCoins width={20} height={20} /></IconCircle>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-soft">{e.statutJustificatif.EN_ATTENTE}</p>
                <p className="tnum text-[17px] font-bold text-ink">{soldeIndisponible ? dict.common.none : <Amount value={chaine(enAttente)} locale={ctx.locale} />}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5">
              <IconCircle tone="lilac" size={40}><CWallet width={20} height={20} /></IconCircle>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-soft">{j.cmi}</p>
                <p className="text-[15px] font-semibold text-ink">{j.cmiBientot}</p>
              </div>
            </div>
          </div>
        </div>
      </Card> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title={j.virement} subtitle={j.virementAide} />
            {!comptesRes.ok && comptesRes.error.status !== 403 ? <LoadError error={comptesRes.error} locale={ctx.locale} variant="inline" className="mt-4" /> : comptes.length === 0 ? <EmptyState className="py-8" title={j.aucunCompte} hint={dict.formulaires.vides.payerAucunCompteAide} illustration="empty-appels" /> : (
              <ul className="mt-4 space-y-2">
                {comptes.map((c) => (
                  <li key={c.index} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-surface px-4 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconCircle tone="sage" size={40}><CBuilding width={20} height={20} /></IconCircle>
                      <div className="min-w-0"><p className="truncate text-[15px] font-semibold text-ink">{c.libelle}</p><p className="text-[13px] text-soft">{c.banque}</p></div>
                    </div>
                    <span className="tnum font-mono text-sm text-ink-strong" dir="ltr">{c.rib_masque}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {lots.length > 0 ? <div id="declarer" className="scroll-mt-24"><DeclarerForm dict={dict} locale={ctx.locale} lots={lots} lignes={lignes} comptes={comptes} mode="declarer" /></div> : null}
        </div>
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionHeader title={j.especes} />
            <p className="mt-3 text-sm leading-relaxed text-body">{j.especesAide}</p>
          </Card>
          {enAttente > 0n ? <Banner variant="info">{fill(j.enAttenteValidation, { montant: mad(enAttente) })}</Banner> : null}
          <section>
            <SectionHeader title={j.mesDeclarations} className="mb-2" />
            {mes.erreur ? <LoadError error={mes.erreur} locale={ctx.locale} variant="inline" className="mt-3" /> : mes.rows.length === 0 ? (
              <EmptyState
                className="py-8"
                title={j.aucuneDeclaration}
                hint={dict.formulaires.vides.payerAucuneDeclarationAide}
                illustration="empty-appels"
                action={lots.length > 0 ? <ButtonLink href="#declarer" variant="secondary" size="sm">{j.declarer}</ButtonLink> : undefined}
              />
            ) : (
              <LiveList as="ul" className="-mx-2">
                {mes.rows.map((x) => (
                  <li key={x.id}>
                    <Link href={`/${locale}/finances/justificatifs/${x.id}`} className="group flex items-center gap-3 rounded-[18px] px-2 py-3 transition-colors hover:bg-wash">
                      <IconCircle tone={justificatifTone[x.statut]} size={44}><CCoins width={22} height={22} /></IconCircle>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold text-ink">{x.lot?.numero} · {e.methode[x.methode]}</p>
                        <p className="tnum truncate text-[13px] text-soft">{formatDate(x.datePaiementDeclaree, ctx.locale)}{x.reference ? ` · ${x.reference}` : ""}</p>
                        {x.statut === "REJETE" && x.motifRejet ? <p className="mt-0.5 line-clamp-2 text-[13px] text-danger">{x.motifRejet}</p> : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="tnum text-[15px] font-bold text-ink"><Amount value={x.montant} locale={ctx.locale} /></span>
                        <Badge variant={justificatifVariant[x.statut]}>{e.statutJustificatif[x.statut]}</Badge>
                      </div>
                      <IconChevronEnd width={18} height={18} className="shrink-0 text-link" />
                    </Link>
                    {x.statut === "EN_ATTENTE" && x.declareParId === ctx.profil.id ? <div className="-mt-1 mb-1 pe-2 text-end"><AnnulerBouton dict={dict} locale={ctx.locale} justificatif={x} /></div> : null}
                  </li>
                ))}
              </LiveList>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
