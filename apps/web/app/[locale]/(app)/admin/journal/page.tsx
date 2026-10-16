import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { EvenementAbonnement } from "../../../../../lib/api/console-types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDateHeure } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Card } from "../../../../../components/ui/card";
import { EmptyState } from "../../../../../components/ui/empty-state";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.journalTitre };
}

/** M29 — journal append-only de tous les abonnements (qui a fait quoi, quand). */
export default async function JournalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const L = ctx.locale;
  const res = await apiFetch<EvenementAbonnement[]>("/admin/journal", { searchParams: { limite: 300 } });
  const evs = res.ok ? res.data : [];

  return (
    <div className="page-root">
      <PageHeader title={c.journalTitre} subtitle={c.journalSousTitre} />
      {evs.length === 0 ? (
        <EmptyState title={dict.common.emptyDefault} />
      ) : (
        <Card>
          <ol className="divide-y divide-hairline">
            {evs.map((e) => {
              const d = (e.details ?? {}) as Record<string, unknown>;
              const extra = [d.numero ?? d.facture, d.motif, d.palier, d.montant ? `${String(d.montant)} MAD` : null].filter((x) => typeof x === "string" && x).join(" · ");
              return (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-3">
                  <span className="w-40 shrink-0 text-[12px] tnum text-soft">{formatDateHeure(e.horodatage, L)}</span>
                  <span className="text-[14px] font-semibold text-ink">{c.evenements[e.type]}</span>
                  <Link href={`/${L}/admin/abonnements/${e.abonnement_id}`} className="text-[14px] text-link">
                    {e.client}
                  </Link>
                  {extra ? <span className="text-[13px] text-body">{extra}</span> : null}
                  <span className="ms-auto text-[12px] text-soft">{e.acteur ?? c.systeme}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
