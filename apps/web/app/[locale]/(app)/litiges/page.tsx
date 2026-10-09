import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import { annuaireMembres } from "../../../../lib/membres";
import type { Litige } from "../../../../lib/api/types";
import { getDict, isLocale, fill, type Dict } from "../../../../lib/i18n";
import { formatDate } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Card } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { Avatar } from "../../../../components/ui/avatar";
import { CAlert, CScale, CShield, IconCircle } from "../../../../components/ui/color-icons";
import { litigeVariant } from "../../../../lib/status";
import { IconCheck } from "../../../../components/ui/icons";
import { CloturerLitigeModal, DeclarerLitigeModal, EscaladerModal } from "./litige-actions";
import { LiveList } from "../../../../components/ui/live-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.litiges };
}

export default async function LitigesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, [
    "SYNDIC",
    "SUPER_ADMIN",
    "CONSEIL_SYNDICAL",
    "PROPRIETAIRE",
    "INDIVISAIRE",
    "PERSONNE_MORALE_REPRESENTANT",
    "LOCATAIRE",
  ]);
  const { dict } = ctx;
  const li = dict.litiges;
  const gestion = ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"].some((r) =>
    ctx.roles.includes(r as never)
  );
  const syndic = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const peutDeclarer = !ctx.roles.includes("GARDIEN") && ctx.role !== "PRESTATAIRE";

  const [litigesRes, membres] = await Promise.all([
    apiFetch<Litige[]>("/litiges"),
    gestion ? annuaireMembres() : Promise.resolve([]),
  ]);
  const litiges = litigesRes.ok ? litigesRes.data : [];
  const membreParId = new Map(membres.map((m) => [m.id, m.nom]));

  // Indicateurs dérivés de la liste déjà chargée.
  const ouvertsNb = litiges.filter((l) => l.statut === "OUVERT").length;
  const resolusNb = litiges.filter((l) => l.statut === "RESOLU").length;

  return (
    <div className="page-root">
      <PageHeader
        title={gestion ? li.titre : li.mesLitiges}
        actions={peutDeclarer ? <DeclarerLitigeModal dict={dict} locale={ctx.locale} /> : undefined}
      />

      {litiges.length > 0 ? (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<CScale />}
            tone="lilac"
            label={gestion ? li.titre : li.mesLitiges}
            value={litiges.length}
          />
          <StatCard
            icon={<CAlert />}
            tone="warn"
            label={dict.dash.litigesOuverts}
            value={ouvertsNb}
            trendTone={ouvertsNb > 0 ? "warn" : "ok"}
          />
          <StatCard
            icon={<CShield />}
            tone="ok"
            label={dict.enums.statutLitige.RESOLU}
            value={resolusNb}
          />
        </div>
      ) : null}

      {litiges.length === 0 ? (
        <EmptyState
          title={li.aucun}
          hint={gestion ? li.aucunAide : undefined}
          illustration="empty-litiges"
          action={peutDeclarer ? <DeclarerLitigeModal dict={dict} locale={ctx.locale} /> : undefined}
        />
      ) : (
        <LiveList as="div" className="space-y-4">
          {litiges.map((l) => (
            <div key={l.id}><Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <span className="hidden sm:block">
                    <IconCircle tone="lilac" size={48}>
                      <CScale />
                    </IconCircle>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge variant={litigeVariant[l.statut]}>
                        {dict.enums.statutLitige[l.statut]}
                      </Badge>
                      <h2 className="min-w-0 truncate text-[17px] font-bold text-ink">{l.type}</h2>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-body">
                      {l.description}
                    </p>
                    <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[13px] text-soft">
                      {gestion && membreParId.get(l.creePar) ? (
                        <>
                          <Avatar nom={membreParId.get(l.creePar) ?? ""} size={18} />
                          <span>
                            {li.declarePar} {membreParId.get(l.creePar)} ·
                          </span>
                        </>
                      ) : null}
                      <span>{fill(li.declareLe, { date: formatDate(l.creeLe, ctx.locale) })}</span>
                    </p>
                  </div>
                </div>
                {gestion && l.statut === "OUVERT" ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {l.escaladeNiveau < 2 ? (
                      <EscaladerModal
                        dict={dict}
                        locale={ctx.locale}
                        litigeId={l.id}
                        niveauCible={String(l.escaladeNiveau + 1) as "1" | "2"}
                      />
                    ) : null}
                    {syndic ? (
                      <CloturerLitigeModal dict={dict} locale={ctx.locale} litigeId={l.id} />
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Stepper des 3 niveaux d'escalade */}
              <StepperEscalade dict={dict} niveau={l.escaladeNiveau} />
            </Card></div>
          ))}
        </LiveList>
      )}
    </div>
  );
}

function StepperEscalade({ dict, niveau }: { dict: Dict; niveau: 0 | 1 | 2 }) {
  const etapes = ["0", "1", "2"] as const;
  return (
    <ol className="mt-5 flex items-center gap-2 border-t border-wash-strong pt-4">
      {etapes.map((e, i) => {
        const atteint = niveau >= i;
        const courant = niveau === i;
        return (
          <li key={e} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`tnum flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                courant
                  ? "bg-brand text-white"
                  : atteint
                    ? "bg-cta text-ink"
                    : "bg-surface text-faint"
              }`}
            >
              {atteint && !courant ? <IconCheck width={12} height={12} /> : i}
            </span>
            <span
              className={`truncate text-[12px] ${
                courant ? "font-semibold text-ink" : atteint ? "text-body" : "text-faint"
              }`}
            >
              {dict.enums.escaladeLitige[e]}
            </span>
            {i < 2 ? <span className="h-0.5 min-w-3 flex-1 rounded-full bg-wash-strong" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
