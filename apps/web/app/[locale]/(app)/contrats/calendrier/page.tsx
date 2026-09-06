/** Calendrier mensuel des échéances de contrats (M19) — vue mois, navigation, total des paiements. */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { Echeancier } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatMAD, formatPeriode } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Card } from "../../../../../components/ui/card";
import { echeanceVariant } from "../../../../../lib/status";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").contrats.calendrier };
}

export default async function CalendrierPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ mois?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
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
  const mad = (v: string | null | undefined) => formatMAD(v, ctx.locale);
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
    <div className="animate-fade">
      <PageHeader back={<BackLink href={p("/contrats")} label={c.titre} />} title={c.calendrier} subtitle={c.calendrierSubtitle} actions={<div className="flex items-center gap-2"><ButtonLink href={p(`/contrats/calendrier?mois=${decal(-1)}`)} variant="secondary" size="sm">{c.moisPrecedent}</ButtonLink><span className="tnum px-2 text-sm font-semibold text-ink">{formatPeriode(mois, ctx.locale)}</span><ButtonLink href={p(`/contrats/calendrier?mois=${decal(1)}`)} variant="secondary" size="sm">{c.moisSuivant}</ButtonLink></div>} />
      {!res.ok ? <Banner variant="warn" className="mb-4">{c.chargementImpossible}</Banner> : null}
      <Card padded={false}>
        <div className="grid grid-cols-7 border-b border-hairline text-center text-[11px] font-semibold uppercase tracking-wide text-faint">{jours.map((j) => <div key={j} className="py-2">{j}</div>)}</div>
        <div className="grid grid-cols-7">
          {cases.map((d, i) => {
            const k = d ? iso(d) : "";
            const ecs = d ? parJour.get(k) ?? [] : [];
            return (
              <div key={i} className={`min-h-[92px] border-b border-e border-hairline p-1.5 ${d ? "" : "bg-ground/40"} ${k === aujourdhui ? "bg-action/5" : ""}`}>
                {d ? <span className={`tnum text-[12px] ${k === aujourdhui ? "font-bold text-action" : "text-soft"}`}>{d.getUTCDate()}</span> : null}
                <div className="mt-1 space-y-1">
                  {ecs.map((ec) => (
                    <Link key={ec.id} href={p(`/contrats/${ec.contrat?.id ?? ec.contratId}`)} className="block rounded-md border border-hairline bg-surface px-1.5 py-1 text-[11px] leading-tight hover:bg-hover" title={`${ec.contrat?.libelle ?? ""} · ${e.typeEcheance[ec.type]}`}>
                      <span className="block truncate font-medium text-ink">{ec.contrat?.libelle}</span>
                      <span className="flex items-center justify-between gap-1 text-faint"><span className="truncate">{e.typeEcheance[ec.type]}</span>{ec.montant ? <span className="tnum">{mad(ec.montant)}</span> : null}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {res.ok ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-soft">{res.data.echeances.length === 0 ? c.aucuneEcheanceMois : `${c.totalMois} : `}<b className="tnum text-ink">{res.data.echeances.length ? mad(res.data.total_montant) : ""}</b></span>
          <div className="flex flex-wrap gap-1.5">{(["A_VENIR", "DEPENSE_GENEREE", "REALISEE", "MANQUEE"] as const).map((s) => <Badge key={s} variant={echeanceVariant[s]}>{e.statutEcheance[s]} · {res.data.echeances.filter((x) => x.statut === s).length}</Badge>)}</div>
        </div>
      ) : null}
    </div>
  );
}
