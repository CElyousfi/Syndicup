import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../../lib/app-context";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatMAD } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { StatCard } from "../../../../../components/ui/stat-card";
import { CCoins, CMoneyBag, CWallet } from "../../../../../components/ui/color-icons";
import { justificatifVariant } from "../../../../../lib/status";
import { DeclarerForm } from "../justificatifs/declarer-form";
import { AnnulerBouton } from "../justificatifs/justificatif-modals";
import { comptesBancaires, justificatifs, lotsEtLignesOuvertes, soldesLots } from "../justificatifs/data";

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
  const [comptes, { lots, lignes }, mes] = await Promise.all([comptesBancaires(ctx.coproprieteId), lotsEtLignesOuvertes(), justificatifs()]);
  const soldes = await soldesLots(lots);
  const totalDu = [...soldes.values()].reduce((acc, s) => acc + BigInt(Math.round(Number(s.solde_du) * 100)), 0n);
  const enAttente = [...soldes.values()].reduce((acc, s) => acc + BigInt(Math.round(Number(s.justificatifs_en_attente ?? "0") * 100)), 0n);
  const mad = (c: bigint) => formatMAD(`${c / 100n}.${String(c % 100n).padStart(2, "0")}`, ctx.locale);

  return (
    <div className="animate-fade">
      <PageHeader title={j.payerTitre} subtitle={j.payerSubtitle} />
      <div className="stat mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={<CMoneyBag />} tone={totalDu > 0n ? "sand" : "sage"} label={dict.finances.soldeDu} value={mad(totalDu)} />
        <StatCard icon={<CCoins />} tone="tosca" label={e.statutJustificatif.EN_ATTENTE} value={mad(enAttente)} hint={enAttente > 0n ? fill(j.enAttenteValidation, { montant: mad(enAttente) }) : undefined} />
        <StatCard icon={<CWallet />} tone="lilac" label={j.cmi} value="—" hint={j.cmiBientot} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title={j.virement} subtitle={j.virementAide} />
            {comptes.length === 0 ? <p className="mt-3 text-sm text-soft">{j.aucunCompte}</p> : (
              <ul className="mt-3 divide-y divide-hairline">
                {comptes.map((c) => (
                  <li key={c.index} className="flex items-center justify-between gap-3 py-2.5">
                    <div><p className="text-sm font-semibold text-ink">{c.libelle}</p><p className="text-[13px] text-soft">{c.banque}</p></div>
                    <span className="tnum text-sm text-body" dir="ltr">{c.rib_masque}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {lots.length > 0 ? <DeclarerForm dict={dict} locale={ctx.locale} lots={lots} lignes={lignes} comptes={comptes} mode="declarer" /> : null}
        </div>
        <div className="space-y-4">
          <Card>
            <SectionHeader title={j.especes} />
            <p className="mt-3 text-sm text-body">{j.especesAide}</p>
          </Card>
          <Card>
            <SectionHeader title={j.mesDeclarations} />
            {mes.rows.length === 0 ? <p className="mt-3 text-sm text-soft">{j.aucuneDeclaration}</p> : (
              <ul className="mt-3 divide-y divide-hairline">
                {mes.rows.map((x) => (
                  <li key={x.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/${locale}/finances/justificatifs/${x.id}`} className="block truncate text-sm font-medium text-ink hover:text-action">{x.lot?.numero} · {e.methode[x.methode]}</Link>
                        <span className="tnum text-[12px] text-faint">{formatDate(x.datePaiementDeclaree, ctx.locale)}{x.reference ? ` · ${x.reference}` : ""}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="tnum text-sm font-medium text-ink">{formatMAD(x.montant, ctx.locale)}</span>
                        <Badge variant={justificatifVariant[x.statut]}>{e.statutJustificatif[x.statut]}</Badge>
                      </div>
                    </div>
                    {x.statut === "REJETE" && x.motifRejet ? <p className="mt-1 text-[13px] text-danger">{x.motifRejet}</p> : null}
                    {x.statut === "EN_ATTENTE" && x.declareParId === ctx.profil.id ? <div className="mt-1 text-end"><AnnulerBouton dict={dict} locale={ctx.locale} justificatif={x} /></div> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {enAttente > 0n ? <Banner variant="info">{fill(j.enAttenteValidation, { montant: mad(enAttente) })}</Banner> : null}
        </div>
      </div>
    </div>
  );
}
