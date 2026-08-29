import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import { annuaireMembres } from "../../../../../lib/membres";
import { getLots } from "../../../../../lib/finances-data";
import type {
  Incident,
  IncidentCreateur,
  IncidentLog,
  IncidentPhoto,
  Prestataire,
} from "../../../../../lib/api/types";
import { PhotoGallery } from "../../../../../components/incidents/photo-gallery";
import { fill } from "../../../../../lib/i18n";
import { formatDateHeure, formatTelephone, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Avatar } from "../../../../../components/ui/avatar";
import { CAlert, CSend, CWrench, IconCircle } from "../../../../../components/ui/color-icons";
import { incidentVariant, urgenceVariant } from "../../../../../lib/status";
import { AssignerModal, ChangerStatutModal } from "./incident-actions";

type IncidentAvecJournal = Incident & { logs: IncidentLog[]; createur?: IncidentCreateur | null };

export default async function IncidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ signale?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const i = dict.incidents;
  const syndic = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const peutChangerStatut =
    syndic || ctx.roles.includes("GARDIEN") || ctx.role === "PRESTATAIRE";

  const incidentRes = await apiFetch<IncidentAvecJournal>(`/incidents/${id}`);
  if (!incidentRes.ok) notFound();
  const incident = incidentRes.data;

  const [prestatairesRes, lotsRes, membres, photosRes] = await Promise.all([
    syndic || ctx.roles.includes("GARDIEN") || ctx.roles.includes("CONSEIL_SYNDICAL")
      ? apiFetch<Prestataire[]>("/prestataires")
      : Promise.resolve(null),
    getLots(),
    annuaireMembres(),
    incident.photos.length > 0
      ? apiFetch<IncidentPhoto[]>(`/incidents/${id}/photos`)
      : Promise.resolve(null),
  ]);
  // Relais même origine : l'URL signée du stockage (127.0.0.1 en dev, bucket privé en prod)
  // n'est jamais donnée au navigateur — visible sur téléphone, tunnel et desktop.
  const photos = (photosRes?.ok ? photosRes.data : []).map((p, n) => ({
    path: p.path,
    url: `/api/incident-photo?id=${encodeURIComponent(id)}&n=${n}`,
  }));
  const prestataires = prestatairesRes?.ok ? prestatairesRes.data : [];
  const prestataireAssigne = prestataires.find((p) => p.id === incident.assigneAId);
  const lotConcerne = lotsRes.find((l) => l.id === incident.lotId);
  const membreParId = new Map(membres.map((m) => [m.id, m.nom]));
  const nomActeur = (acteurId: string | null, acteur?: { nom: string | null; prenom: string | null } | null) =>
    (acteur ? nomComplet(acteur) : null) ?? (acteurId ? membreParId.get(acteurId) : null) ?? null;
  const auteurNom =
    (incident.createur ? nomComplet(incident.createur) : null) ??
    membreParId.get(incident.creePar) ??
    null;

  const enRetard =
    incident.slaDeadline &&
    !["RESOLU", "FERME"].includes(incident.statut) &&
    new Date(incident.slaDeadline).getTime() < Date.now();

  return (
    <div className="animate-fade">
      {sp.signale === "1" ? (
        <Banner variant="ok" className="mb-5">
          {incident.urgence === "URGENCE_MAXIMALE" ? i.signaleUrgent : i.signale}
        </Banner>
      ) : null}

      <PageHeader
        back={<BackLink href={`/${locale}/incidents`} label={dict.nav.incidents} />}
        title={incident.sousCategorie}
        badge={
          <span className="inline-flex gap-1.5">
            <Badge variant={incidentVariant[incident.statut]}>
              {dict.enums.statutIncident[incident.statut]}
            </Badge>
            <Badge variant={urgenceVariant[incident.urgence]}>
              {dict.enums.urgence[incident.urgence]}
            </Badge>
          </span>
        }
        subtitle={
          <>
            {dict.enums.categorieIncident[incident.categorie]} ·{" "}
            {dict.enums.partie[incident.partie]}
            {lotConcerne ? ` · ${dict.invitations.lot} ${lotConcerne.numero}` : ""}
            {" · "}
            {fill(i.creeLe, { date: formatDateHeure(incident.creeLe, ctx.locale) })}
          </>
        }
        actions={
          <>
            {peutChangerStatut ? (
              <ChangerStatutModal
                dict={dict}
                locale={ctx.locale}
                incidentId={id}
                statutActuel={incident.statut}
              />
            ) : null}
            {syndic ? (
              <AssignerModal
                dict={dict}
                locale={ctx.locale}
                incidentId={id}
                prestataires={prestataires.map((p) => ({
                  id: p.id,
                  nom: p.nom,
                  specialite: p.specialite,
                  actif: p.actif,
                }))}
              />
            ) : null}
          </>
        }
      />

      {enRetard ? (
        <Banner variant="danger" className="mb-5" title={i.slaDepasse}>
          {dict.enums.urgenceSla[incident.urgence]}
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {incident.description ? (
            <Card>
              <SectionHeader title={i.description} />
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-body">
                {incident.description}
              </p>
            </Card>
          ) : null}

          {/* Photos du signalement — vignettes + visionneuse plein cadre */}
          {photos.length > 0 ? (
            <Card>
              <SectionHeader title={i.photos} />
              <div className="mt-4">
                <PhotoGallery
                  photos={photos}
                  altTemplate={i.photoDe}
                  closeLabel={dict.common.close}
                />
              </div>
            </Card>
          ) : null}

          {/* Journal append-only */}
          <Card>
            <SectionHeader title={i.journal} />
            {incident.logs.length === 0 ? (
              <p className="mt-3 text-sm text-soft">{i.journalVide}</p>
            ) : (
              <ol className="mt-6 ms-2">
                {incident.logs.map((log, idx) => {
                  const clos = log.statutApres === "RESOLU" || log.statutApres === "FERME";
                  const enCours = log.statutApres === "EN_COURS";
                  const dernier = idx === incident.logs.length - 1;
                  return (
                  <li
                    key={log.id}
                    className={`relative ps-7 ${dernier ? "pb-0" : "border-s border-hairline pb-7"}`}
                  >
                    <span
                      className={`absolute -start-[9px] top-0 flex size-[18px] items-center justify-center rounded-full ${
                        clos ? "bg-ok-tint" : enCours ? "bg-warn-tint" : "bg-tosca-tint"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          clos ? "bg-ok" : enCours ? "bg-warn" : "bg-action"
                        }`}
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {log.statutAvant ? (
                          <>
                            <Badge variant="outline">
                              {dict.enums.statutIncident[log.statutAvant]}
                            </Badge>
                            <span className="text-faint">→</span>
                          </>
                        ) : null}
                        <Badge variant={incidentVariant[log.statutApres]}>
                          {dict.enums.statutIncident[log.statutApres]}
                        </Badge>
                      </div>
                      {log.commentaire ? (
                        <p className="mt-1.5 text-sm leading-relaxed text-body">
                          {log.commentaire}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[12px] text-faint">
                        {nomActeur(log.acteurId, log.acteur) ? `${nomActeur(log.acteurId, log.acteur)} · ` : ""}
                        {formatDateHeure(log.horodatage, ctx.locale)}
                      </p>
                    </div>
                  </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader title={i.sla} />
            <div className="mt-3 flex items-start gap-3">
              <IconCircle tone={enRetard ? "danger" : "tosca"} size={40}>
                {enRetard ? <CAlert width={20} height={20} /> : <CWrench width={20} height={20} />}
              </IconCircle>
              <div className="min-w-0">
                <p className="text-sm text-body">{dict.enums.urgenceSla[incident.urgence]}</p>
                {incident.slaDeadline ? (
                  <p className={`tnum mt-1 text-sm font-medium ${enRetard ? "text-danger" : "text-ink"}`}>
                    {formatDateHeure(incident.slaDeadline, ctx.locale)}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
          <Card>
            <SectionHeader title={i.assigneA} />
            {prestataireAssigne ? (
              <div className="mt-3 flex items-start gap-3">
                <IconCircle tone="tosca" size={40}>
                  <CSend width={20} height={20} />
                </IconCircle>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{prestataireAssigne.nom}</p>
                  <p className="mt-0.5 truncate text-[13px] text-soft">{prestataireAssigne.specialite}</p>
                  <p className="mt-0.5 truncate text-[13px] text-body" dir="ltr">
                    {prestataireAssigne.contact}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-soft">{i.nonAssigne}</p>
            )}
          </Card>
          <Card>
            <SectionHeader title={i.creePar} />
            <div className="mt-3 flex items-center gap-3">
              <Avatar nom={auteurNom ?? "•"} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{auteurNom ?? dict.common.none}</p>
                {incident.createur?.telephone ? (
                  <a
                    href={`tel:${incident.createur.telephone}`}
                    className="tnum block truncate text-[13px] text-action hover:underline"
                    dir="ltr"
                  >
                    {formatTelephone(incident.createur.telephone)}
                  </a>
                ) : null}
                {incident.createur?.email ? (
                  <a
                    href={`mailto:${incident.createur.email}`}
                    className="block truncate text-[13px] text-soft hover:underline"
                    dir="ltr"
                  >
                    {incident.createur.email}
                  </a>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
