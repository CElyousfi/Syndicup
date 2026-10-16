import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { VueEnsemble } from "../../../../lib/api/console-types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDateCourte, formatDateHeure, formatMontant } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { StatCard } from "../../../../components/ui/stat-card";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { ButtonLink } from "../../../../components/ui/button";
import { Amount } from "../../../../components/ui/amount";
import { EmptyState } from "../../../../components/ui/empty-state";
import { IconPlus, IconChevronEnd } from "../../../../components/ui/icons";
import { CChart, CCoins, CWallet, CBuilding } from "../../../../components/ui/color-icons";
import { Echeance, EtatBadge } from "./console-common";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.vueTitre };
}

const toneATraiter = { BLOQUE: "danger", GRACE: "warn", FIN_ESSAI: "info", RENOUVELLEMENT: "neutral", DEPASSEMENT_LOTS: "outline" } as const;

/** M29 — vue d'ensemble de l'opérateur : revenus, abonnements, ce qui demande une action aujourd'hui. */
export default async function VueEnsemblePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const p = (path: string) => `/${ctx.locale}${path}`;

  const res = await apiFetch<VueEnsemble>("/admin/vue-ensemble");
  if (!res.ok) {
    return (
      <div className="page-root">
        <PageHeader title={c.vueTitre} subtitle={c.vueSousTitre} />
        <Banner variant="danger" title={res.error.message} />
      </div>
    );
  }
  const v = res.data;

  return (
    <div className="page-root">
      <PageHeader
        title={c.vueTitre}
        subtitle={c.vueSousTitre}
        actions={
          <ButtonLink href={p("/admin/abonnements/nouveau")}>
            <IconPlus width={16} height={16} />
            {c.ouvrirAbonnement}
          </ButtonLink>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CChart />}
          tone="sage"
          label={c.mrr}
          value={<Amount value={v.mrr_ht} locale={ctx.locale} />}
          hint={fill(c.arr, { montant: formatMontant(v.arr_ht) })}
        />
        <StatCard icon={<CWallet />} tone="ok" label={c.encaisse30} value={<Amount value={v.encaisse_30j} locale={ctx.locale} />} />
        <StatCard
          icon={<CCoins />}
          tone="sand"
          label={c.facturesOuvertes}
          value={<Amount value={v.factures_ouvertes.montant_ttc} locale={ctx.locale} />}
          hint={fill(c.facturesOuvertesNb, { n: v.factures_ouvertes.nombre })}
          href={p("/admin/factures?statut=EMISE")}
        />
        <StatCard
          icon={<CBuilding />}
          tone="lilac"
          label={c.actifs}
          value={v.abonnements_actifs}
          hint={`${fill(c.lotsFactures, { n: v.lots_factures })} · ${c.essais} : ${v.essais_en_cours}`}
          href={p("/admin/abonnements")}
        />
      </div>

      {v.pipeline_essais_mensuel_ht !== "0.00" ? (
        <p className="-mt-3 mb-6 text-[13px] text-soft">
          {c.essais} — {fill(c.pipeline, { montant: formatMontant(v.pipeline_essais_mensuel_ht) })}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <SectionHeader title={c.aTraiter} className="mb-4" />
            {v.a_traiter.length === 0 ? (
              <p className="text-[14px] text-soft">{c.rienATraiter}</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {v.a_traiter.map((t) => (
                  <li key={`${t.type}-${t.abonnement_id}`}>
                    <Link href={p(`/admin/abonnements/${t.abonnement_id}`)} className="su-press flex items-center gap-3 py-3 transition-colors hover:bg-wash/60">
                      <Badge variant={toneATraiter[t.type]}>{c.typesATraiter[t.type]}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-ink">{t.client}</p>
                        <p className="truncate text-[13px] text-soft">
                          {t.type === "DEPASSEMENT_LOTS" ? fill(c.lotsEcart, { reels: t.lots_reels, contractes: t.lots_contractes }) : t.coproprietes.join(", ")}
                        </p>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                        <EtatBadge etat={t.etat} dict={dict} />
                        <Echeance etat={t.etat} dict={dict} />
                      </div>
                      <IconChevronEnd width={16} height={16} className="icon-flip shrink-0 text-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {v.coproprietes.sans_abonnement.length > 0 ? (
            <Card>
              <SectionHeader title={`${c.sansAbonnement} (${v.coproprietes.sans_abonnement.length})`} subtitle={c.sansAbonnementAide} className="mb-4" />
              <ul className="divide-y divide-hairline">
                {v.coproprietes.sans_abonnement.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={p(`/admin/coproprietes/${r.id}`)} className="truncate text-[15px] font-semibold text-ink hover:text-link">
                        {r.nom}
                      </Link>
                      <p className="text-[13px] text-soft">
                        {r.ville} · {r.nb_lots} lots · {formatDateCourte(r.creee_le, ctx.locale)}
                      </p>
                    </div>
                    <ButtonLink size="sm" variant="secondary" href={p(`/admin/abonnements/nouveau?copropriete=${r.id}`)}>
                      {c.ouvrirAbonnement}
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {v.factures_en_retard.length > 0 ? (
            <Card>
              <SectionHeader
                title={c.facturesEnRetard}
                action={<Link className="text-[14px] font-semibold text-link" href={p("/admin/factures?en_retard=true")}>{c.voirTout}</Link>}
                className="mb-3"
              />
              <ul className="divide-y divide-hairline">
                {v.factures_en_retard.map((f) => (
                  <li key={f.id}>
                    <Link href={p(`/admin/factures/${f.id}`)} className="flex items-center justify-between gap-3 py-2.5 hover:text-link">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-ink">{f.client_nom}</span>
                        <span className="text-[12px] text-danger">{f.numero} · {formatDateCourte(f.echeance, ctx.locale)}</span>
                      </span>
                      <Amount value={f.montant_ttc} locale={ctx.locale} className="text-[14px] font-semibold" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <SectionHeader
              title={c.activite}
              action={<Link className="text-[14px] font-semibold text-link" href={p("/admin/journal")}>{c.voirTout}</Link>}
              className="mb-3"
            />
            {v.activite_recente.length === 0 ? (
              <EmptyState title={dict.common.emptyDefault} />
            ) : (
              <ol className="space-y-3">
                {v.activite_recente.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-link" aria-hidden />
                    <Link href={p(`/admin/abonnements/${e.abonnement_id}`)} className="min-w-0 hover:text-link">
                      <span className="block text-[14px] font-semibold text-ink">{c.evenements[e.type]}</span>
                      <span className="block truncate text-[12px] text-soft">
                        {e.client} · {formatDateHeure(e.horodatage, ctx.locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {(v.par_etat.BLOQUE_IMPAYE ?? 0) + (v.par_etat.SUSPENDU ?? 0) > 0 ? (
            <Banner variant="danger" title={`${c.typesATraiter.BLOQUE} : ${(v.par_etat.BLOQUE_IMPAYE ?? 0) + (v.par_etat.SUSPENDU ?? 0)}`}>
              <Link href={p("/admin/abonnements?etat=BLOQUE_IMPAYE")} className="font-semibold text-link">{c.voirTout}</Link>
            </Banner>
          ) : null}
          <p className="text-[12px] text-faint">{formatDateHeure(v.calcule_le, ctx.locale)}</p>
        </div>
      </div>
    </div>
  );
}
