import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { FactureDetail } from "../../../../../../lib/api/console-types";
import { getDict, isLocale, fill } from "../../../../../../lib/i18n";
import { formatDate, formatDateCourte } from "../../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Amount } from "../../../../../../components/ui/amount";
import { factureVariant } from "../../console-common";
import { BoutonImprimer } from "./imprimer";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.factureTitre };
}

/**
 * M29 — facture d'abonnement, mise en page pour l'impression (« Imprimer » → PDF du navigateur).
 * Coordonnées de l'émetteur : variables NEXT_PUBLIC_SYNDICUP_* (raison sociale, ICE, RC, IF, adresse, RIB).
 */
export default async function FacturePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const L = ctx.locale;
  const res = await apiFetch<FactureDetail>(`/admin/factures/${id}`);
  if (!res.ok) notFound();
  const f = res.data;
  const emetteur = {
    nom: process.env.NEXT_PUBLIC_SYNDICUP_RAISON_SOCIALE ?? "SyndicUp",
    adresse: process.env.NEXT_PUBLIC_SYNDICUP_ADRESSE ?? null,
    ice: process.env.NEXT_PUBLIC_SYNDICUP_ICE ?? null,
    rc: process.env.NEXT_PUBLIC_SYNDICUP_RC ?? null,
    idf: process.env.NEXT_PUBLIC_SYNDICUP_IF ?? null,
    rib: process.env.NEXT_PUBLIC_SYNDICUP_RIB ?? null,
    email: process.env.NEXT_PUBLIC_SYNDICUP_EMAIL_FACTURATION ?? null,
  };

  return (
    <div className="page-root">
      <div className="print:hidden">
        <PageHeader
          back={<BackLink href={`/${L}/admin/abonnements/${f.abonnement_id}`} label={c.abonnement} />}
          title={`${c.factureTitre} ${f.numero}`}
          badge={<Badge variant={f.en_retard ? "danger" : factureVariant[f.statut]}>{f.en_retard ? c.enRetard : c.statutsFacture[f.statut]}</Badge>}
          actions={<BoutonImprimer label={c.imprimer} />}
        />
      </div>

      <article className="card mx-auto max-w-3xl space-y-8 p-8 print:max-w-none print:border-0 print:p-0 print:shadow-none sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1 text-[13px] text-body">
            <p className="text-[22px] font-bold tracking-tight text-ink">{emetteur.nom}</p>
            {emetteur.adresse ? <p>{emetteur.adresse}</p> : null}
            {emetteur.ice ? <p>ICE {emetteur.ice}</p> : null}
            {emetteur.rc || emetteur.idf ? <p>{[emetteur.rc ? `RC ${emetteur.rc}` : null, emetteur.idf ? `IF ${emetteur.idf}` : null].filter(Boolean).join(" · ")}</p> : null}
            {emetteur.email ? <p>{emetteur.email}</p> : null}
          </div>
          <div className="text-end">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-soft">{c.factureTitre}</p>
            <p className="font-mono text-[20px] font-bold text-ink">{f.numero}</p>
            <p className="text-[13px] text-body">{c.emiseLe} {formatDate(f.emise_le, L)}</p>
            <p className="text-[13px] text-body">{c.echeance} {formatDate(f.echeance, L)}</p>
          </div>
        </header>

        <section className="rounded-[16px] bg-tile p-4 text-[13px] text-body print:border print:border-hairline print:bg-transparent">
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-soft">{c.facturerA}</p>
          <p className="text-[15px] font-semibold text-ink">{f.client.raison_sociale ?? f.client.nom}</p>
          {f.client.adresse ? <p>{[f.client.adresse, f.client.ville].filter(Boolean).join(", ")}</p> : null}
          {f.client.ice ? <p>ICE {f.client.ice}</p> : null}
          {f.client.rc || f.client.identifiant_fiscal ? <p>{[f.client.rc ? `RC ${f.client.rc}` : null, f.client.identifiant_fiscal ? `IF ${f.client.identifiant_fiscal}` : null].filter(Boolean).join(" · ")}</p> : null}
          {f.lignes.coproprietes?.length ? <p className="mt-2">{fill(c.residencesCouvertes, { liste: f.lignes.coproprietes.join(", ") })}</p> : null}
          <p className="mt-2">
            {c.periode} : {formatDateCourte(f.periode_debut, L)} → {formatDateCourte(f.periode_fin, L)}
          </p>
        </section>

        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-hairline text-start text-[12px] uppercase tracking-wide text-soft">
              <th className="py-2 text-start font-semibold">{c.designation}</th>
              <th className="py-2 text-center font-semibold">{c.quantite}</th>
              <th className="py-2 text-end font-semibold">{c.prixUnitaire}</th>
              <th className="py-2 text-end font-semibold">{c.montant} {f.lignes.base_prix}</th>
            </tr>
          </thead>
          <tbody>
            {f.lignes.lignes.map((l, i) => (
              <tr key={i} className="border-b border-hairline align-top">
                <td className="py-3 pe-4 text-ink">{l.libelle}</td>
                <td className="py-3 text-center tnum text-body">{l.quantite}</td>
                <td className="py-3 text-end">
                  <Amount value={l.prix_unitaire} locale={L} />
                </td>
                <td className="py-3 text-end font-semibold">
                  <Amount value={l.montant} locale={L} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ms-auto grid w-full max-w-xs grid-cols-2 gap-y-2 text-[14px]">
          <dt className="text-soft">{c.totalHt}</dt>
          <dd className="text-end">
            <Amount value={f.montant_ht} locale={L} />
          </dd>
          <dt className="text-soft">{fill(c.totalTva, { taux: f.abonnement.taux_tva.replace(/\.00$/, "") })}</dt>
          <dd className="text-end">
            <Amount value={f.montant_tva} locale={L} />
          </dd>
          <dt className="border-t border-hairline pt-2 text-[15px] font-bold text-ink">{c.totalTtc}</dt>
          <dd className="border-t border-hairline pt-2 text-end text-[15px] font-bold">
            <Amount value={f.montant_ttc} locale={L} />
          </dd>
          {f.paiements.length ? (
            <>
              <dt className="text-soft">{c.paye}</dt>
              <dd className="text-end">
                <Amount value={f.paye} locale={L} />
              </dd>
              <dt className="font-semibold text-ink">{c.resteDu}</dt>
              <dd className="text-end font-semibold">
                <Amount value={f.reste_du} locale={L} />
              </dd>
            </>
          ) : null}
        </dl>

        {f.paiements.length ? (
          <section className="text-[13px]">
            <p className="mb-2 font-semibold text-ink">{c.paiementsRecus}</p>
            <ul className="space-y-1 text-body">
              {f.paiements.map((pa) => (
                <li key={pa.id} className="flex justify-between gap-3">
                  <span>
                    {formatDateCourte(pa.recu_le, L)} · {c.modes[pa.mode]}
                    {pa.reference ? ` · ${pa.reference}` : ""}
                  </span>
                  <Amount value={pa.montant} locale={L} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="space-y-1 border-t border-hairline pt-4 text-[12px] text-soft">
          <p>{fill(c.reglement, { date: formatDate(f.echeance, L) })}</p>
          {emetteur.rib ? <p className="font-mono">RIB {emetteur.rib}</p> : null}
          {f.statut === "ANNULEE" && f.motif_annulation ? <p className="font-semibold text-danger">{c.statutsFacture.ANNULEE} — {f.motif_annulation}</p> : null}
        </footer>
      </article>
    </div>
  );
}
