/** Calendrier mensuel des échéances de contrats (M19) — vue mois, navigation, total des paiements. */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { Echeancier } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatPeriode } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Card } from "../../../../../components/ui/card";
import { echeanceVariant } from "../../../../../lib/status";
import { Amount } from "../../../../../components/ui/amount";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").contrats.calendrier };
}

export default async function CalendrierPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ mois?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE"]);
  const { dict } = ctx;
  const c = dict.contrats;
  const e = dict.enumsContrats;
  const now = new Date();
  const mois = /^\d{4}-\d{2}$/.test(sp.mois ?? "") ? sp.mois! : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [y, m] = mois.split("-").map(Number) as [number, number];
  const debut = new Date(Date.UTC(y, m - 1, 1));
  const fin = new Date(Date.UTC(y, m, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const decal = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const res = await apiFetch<Echeancier>("/contrats/echeancier", { searchParams: { from: iso(debut), to: iso(fin) } });
  const p = (path: string) => `/${locale}${path}`;
  const parJour = new Map<string, Echeancier["echeances"]>();
  for (const ec of res.ok ? res.data.echeances : []) {
    const k = ec.dateEcheance.slice(0, 10);
    parJour.set(k, [...(parJour.get(k) ?? []), ec]);
  }
  // Grille : semaines commençant le lundi.
  const premierJour = (debut.getUTCDay() + 6) % 7;
  const cases: (Date | null)[] = [...Array<null>(premierJour).fill(null), ...Array.from({ length: fin.getUTCDate() }, (_, i) => new Date(Date.UTC(y, m - 1, i + 1)))];
  while (cases.length % 7) cases.push(null);
  const jours = [1, 2, 3, 4, 5, 6, 7].map((d) => new Date(Date.UTC(2024, 0, d)).toLocaleDateString(ctx.locale === "ar" ? "ar-MA" : "fr-FR", { weekday: "short", timeZone: "UTC" }));
  const aujourdhui = iso(now);
  return (
    <div className="page-root">
      <PageHeader back={<BackLink href={p("/contrats")} label={c.titre} />} title={c.calendrier} subtitle={c.calendrierSubtitle} actions={<div className="flex items-center gap-2"><ButtonLink href={p(`/contrats/calendrier?mois=${decal(-1)}`)} variant="secondary" size="sm">{c.moisPrecedent}</ButtonLink><span className="tnum px-2 text-[15px] font-bold text-ink">{formatPeriode(mois, ctx.locale)}</span><ButtonLink href={p(`/contrats/calendrier?mois=${decal(1)}`)} variant="secondary" size="sm">{c.moisSuivant}</ButtonLink></div>} />
      {!res.ok ? <Banner variant="warn" className="mb-4">{c.chargementImpossible}</Banner> : null}
      {/* Grille du mois : défilement interne sur mobile (jamais la page). */}
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
        <div className="min-w-[680px] p-2">
        <div className="grid grid-cols-7 text-center text-[12px] font-semibold text-soft">{jours.map((j) => <div key={j} className="py-2.5">{j}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cases.map((d, i) => {
            const k = d ? iso(d) : "";
            const ecs = d ? parJour.get(k) ?? [] : [];
            return (
              <div key={i} className={`min-h-[96px] rounded-2xl p-1.5 ${d ? "bg-wash" : ""} ${k === aujourdhui ? "shadow-[inset_0_0_0_1.5px_var(--color-link)]" : ""}`}>
                {d ? <span className={`tnum inline-flex size-6 items-center justify-center rounded-full text-[12px] ${k === aujourdhui ? "bg-cta font-bold text-ink" : "font-medium text-soft"}`}>{d.getUTCDate()}</span> : null}
                <div className="mt-1 space-y-1">
                  {ecs.map((ec) => (
                    <Link key={ec.id} href={p(`/contrats/${ec.contrat?.id ?? ec.contratId}`)} className="block rounded-lg bg-surface px-1.5 py-1 text-[11px] leading-tight transition-colors hover:bg-hover" title={`${ec.contrat?.libelle ?? ""} · ${e.typeEcheance[ec.type]}`}>
                      <span className="block truncate font-semibold text-ink">{ec.contrat?.libelle}</span>
                      <span className="flex items-center justify-between gap-1 text-soft"><span className="truncate">{e.typeEcheance[ec.type]}</span>{ec.montant ? <span className="tnum shrink-0 whitespace-nowrap"><Amount value={ec.montant} locale={ctx.locale} /></span> : null}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        </div>
      </Card>
      {res.ok ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-soft">{res.data.echeances.length === 0 ? c.aucuneEcheanceMois : `${c.totalMois} : `}<b className="tnum text-ink">{res.data.echeances.length ? <Amount value={res.data.total_montant} locale={ctx.locale} /> : ""}</b></span>
          <div className="flex flex-wrap gap-1.5">{(["A_VENIR", "DEPENSE_GENEREE", "REALISEE", "MANQUEE"] as const).map((s) => <Badge key={s} variant={echeanceVariant[s]}>{e.statutEcheance[s]} · {res.data.echeances.filter((x) => x.statut === s).length}</Badge>)}</div>
        </div>
      ) : null}
    </div>
  );
}
