/** Registre du personnel (M9 + M20) — fiches RH, poste, présence, logement de service ; liens planning / paie du mois. */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Lot, PersonnelRh } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDate, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { ButtonLink } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Avatar } from "../../../../components/ui/avatar";
import { personnelVariant } from "../../../../lib/status";
import { ChangerPresenceModal, CreerFicheModal } from "./personnel-modals";
import { ExportButtons } from "../../../../components/ui/export-buttons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.personnel };
}

export default async function PersonnelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const pe = dict.personnel;
  const en = dict.enumsPersonnelRh;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const conseil = !gestion && ctx.roles.includes("CONSEIL_SYNDICAL" as never);
  const p = (path: string) => `/${ctx.locale}${path}`;

  const [personnelRes, lotsRes] = await Promise.all([
    apiFetch<PersonnelRh[]>("/personnel"),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
  ]);
  const fiches = personnelRes.ok ? personnelRes.data : [];
  const lots = lotsRes.ok ? lotsRes.data : [];
  const loges = lots.filter((l) => l.typeLot === "LOGE_GARDIEN").map((l) => ({ id: l.id, numero: l.numero }));
  const absent = fiches.some((f) => f.statut === "ABSENT");
  const finProche = (f: PersonnelRh) => (f.dateFinContrat ? Math.ceil((new Date(f.dateFinContrat).getTime() - Date.now()) / 86_400_000) : null);

  return (
    <div className="page-root">
      <PageHeader
        title={pe.titre}
        subtitle={pe.subtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            {gestion || conseil ? <ButtonLink href={p("/personnel/planning")} variant="secondary">{pe.planning}</ButtonLink> : null}
            {gestion ? <ButtonLink href={p("/personnel/paie")} variant="secondary">{pe.paieMois}</ButtonLink> : null}
            {gestion ? <ExportButtons ressource="personnel" filtres={{}} labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx }} /> : null}
            {gestion ? <CreerFicheModal dict={dict} locale={ctx.locale} loges={loges} /> : null}
          </div>
        }
      />

      {absent ? <Banner variant="warn" className="mb-4">{pe.absentAlerte}</Banner> : null}

      {fiches.length === 0 ? (
        <EmptyState
          title={pe.aucuneFiche}
          hint={gestion ? pe.aucuneFicheAide : undefined}
          illustration="empty-personnel"
          action={gestion ? <CreerFicheModal dict={dict} locale={ctx.locale} loges={loges} /> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fiches.map((f) => {
            const nom = (f.utilisateur ? nomComplet(f.utilisateur) : null) ?? en.poste[f.poste];
            const estMoi = f.utilisateurId === ctx.profil.id;
            const jf = finProche(f);
            const ouvrable = gestion || estMoi;
            return (
              <Card key={f.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <Avatar nom={nom} size={52} solid={estMoi} />
                  <Badge variant={personnelVariant[f.statut]} pulse={f.statut === "ABSENT"}>{dict.enums.statutPersonnel[f.statut]}</Badge>
                </div>
                <h2 className="mt-4 truncate text-[18px] font-bold tracking-tight text-ink">
                  {ouvrable ? <Link href={p(`/personnel/${f.id}`)} className="hover:text-link">{nom}</Link> : nom}
                  {estMoi ? <span className="ms-2 text-[12px] font-medium text-soft">({pe.maFiche})</span> : null}
                </h2>
                <p className="mt-0.5 text-[14px] font-medium text-body">{en.poste[f.poste]}{f.typeContrat && ouvrable ? ` · ${en.typeContratTravail[f.typeContrat]}` : ""}</p>
                <div className="mt-4 divide-y divide-wash-strong rounded-[16px] bg-surface px-3.5 text-[13px]">
                  <p className="flex items-center justify-between gap-3 py-2.5"><span className="text-soft">{pe.logement}</span><span className="font-semibold text-ink">{f.logementLot?.numero ?? pe.aucuneLoge}</span></p>
                </div>
                <p className="mt-3 text-[12px] text-soft">{f.dateEmbauche ? `${pe.dateEmbauche} ${formatDate(f.dateEmbauche, ctx.locale)}` : formatDate(f.creeLe, ctx.locale)}</p>
                {jf !== null && jf >= 0 && jf <= 30 && ouvrable ? <p className="mt-3 rounded-[14px] bg-warn-tint px-3 py-2 text-[12.5px] font-semibold text-warn">{fill(pe.finContratProche, { n: jf })}</p> : null}
                {gestion || estMoi || conseil ? (
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
                    <ButtonLink href={p(`/personnel/${f.id}${conseil ? "?onglet=evaluations" : ""}`)} variant="secondary" size="sm">{estMoi && !gestion ? pe.monDossier : pe.dossier}</ButtonLink>
                    {gestion ? <ChangerPresenceModal dict={dict} locale={ctx.locale} personnelId={f.id} statutActuel={f.statut} logementActuel={f.logementLotId} loges={loges} /> : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
