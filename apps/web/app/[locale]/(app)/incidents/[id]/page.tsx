import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import { annuaireMembres } from "../../../../../lib/membres";
import { getLots } from "../../../../../lib/finances-data";
import type {
  EmplacementDetail,
  BudgetAg,
  BudgetPoste,
  Incident,
  IncidentCreateur,
  IncidentLog,
  IncidentPhoto,
  Prestataire,
} from "../../../../../lib/api/types";
import { PhotoGallery } from "../../../../../components/incidents/photo-gallery";
import { fill } from "../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatMAD, formatTelephone, nomComplet } from "../../../../../lib/format";
import { BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Avatar } from "../../../../../components/ui/avatar";
import { CCoins, CSend, IconCircle } from "../../../../../components/ui/color-icons";
import { IconArrowEnd, IconCheck, IconChevronEnd } from "../../../../../components/ui/icons";
import { CategorieIcon } from "../../../../../components/incidents/categorie-icon";
import { depenseVariant, incidentVariant, urgenceVariant } from "../../../../../lib/status";
import { AssignerModal, ChangerStatutModal } from "./incident-actions";
import { CreerDepenseIncidentModal, EvaluerPrestataireModal } from "./incident-depense-modals";
import { NotifierVehiculeModal } from "../../parkings/parkings-client";

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
  // M23 — code de l'emplacement concerné (lecture tenant, RLS).
  const emplacementRes = incident.emplacementId ? await apiFetch<EmplacementDetail>(`/emplacements/${incident.emplacementId}`) : null;
  const emplacementCode = emplacementRes?.ok ? emplacementRes.data.code : null;
  const prestataireAssigne = prestataires.find((p) => p.id === incident.assigneAId);
  // M16 — dépenses liées (syndic / conseil) et évaluation du prestataire (créateur ou syndic, RESOLU/FERME).
  const conseil = ctx.roles.includes("CONSEIL_SYNDICAL");
  const voitDepenses = (syndic || conseil) && Array.isArray(incident.depenses);
  const depenses = incident.depenses ?? [];
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  const resolu = incident.statut === "RESOLU" || incident.statut === "FERME";
  const peutEvaluer = resolu && Boolean(incident.assigneAId) && incident.notePrestataire == null && (syndic || incident.creePar === ctx.profil.id);
  let postesActifs: BudgetPoste[] = [];
  if (syndic) {
    const budgetsRes = await apiFetch<BudgetAg[]>("/finances/budgets", { searchParams: { limit: 50 } });
    const actif = (budgetsRes.ok ? budgetsRes.data : []).find((b) => b.statut === "ACTIF" && b.exercice === String(new Date().getFullYear()));
    if (actif) {
      const pr = await apiFetch<{ postes: BudgetPoste[] }>(`/finances/budgets/${actif.id}/postes`);
      postesActifs = pr.ok ? pr.data.postes : [];
    }
  }
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

  const lienDetail = (href: string) => `/${locale}${href}`;
  const ligne = "flex items-start justify-between gap-4 py-3.5";

  return (
    <div className="page-root">
      {sp.signale === "1" ? (
        <Banner variant="ok" className="mb-5">
          {incident.urgence === "URGENCE_MAXIMALE" ? i.signaleUrgent : i.signale}
        </Banner>
      ) : null}

      <div className="mb-4 sm:mb-5">
        <BackLink href={`/${locale}/incidents`} label={dict.nav.incidents} />
      </div>

      {/* Résumé — pastille de catégorie, titre, statut + urgence, actions */}
      <section className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4 sm:mb-8">
        <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
          <span className="hidden sm:block">
            <CategorieIcon categorie={incident.categorie} size={64} />
          </span>
          <span className="sm:hidden">
            <CategorieIcon categorie={incident.categorie} size={52} />
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">
              {incident.sousCategorie}
            </h1>
            <p className="mt-1.5 text-sm text-soft sm:text-[15px]">
              {dict.enums.categorieIncident[incident.categorie]} · {dict.enums.partie[incident.partie]}
              {" · "}
              <span className="tnum">{fill(i.creeLe, { date: formatDateHeure(incident.creeLe, ctx.locale) })}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge variant={incidentVariant[incident.statut]}>
                {dict.enums.statutIncident[incident.statut]}
              </Badge>
              <Badge variant={urgenceVariant[incident.urgence]}>
                {dict.enums.urgence[incident.urgence]}
              </Badge>
              {enRetard ? (
                <Badge variant="danger" pulse>
                  {i.slaDepasse}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        {peutChangerStatut || syndic || ctx.roles.includes("GARDIEN") ? (
          <div className="page-actions flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            {peutChangerStatut ? (
              <ChangerStatutModal
                dict={dict}
                locale={ctx.locale}
                incidentId={id}
                statutActuel={incident.statut}
              />
            ) : null}
            {(syndic || ctx.roles.includes("GARDIEN")) && (incident.immatriculationSignalee || incident.categorie === "PARKING") ? (
              <NotifierVehiculeModal dict={dict} locale={ctx.locale} incidentId={id} immatriculation={incident.immatriculationSignalee ?? null} />
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
          </div>
        ) : null}
      </section>

      {enRetard ? (
        <Banner variant="danger" className="mb-5" title={i.slaDepasse}>
          {dict.enums.urgenceSla[incident.urgence]}
        </Banner>
      ) : null}

      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-3">
        <div className="min-w-0 space-y-8 lg:col-span-2">
          {/* Clés / valeurs : prise en charge, catégorie, lot, date */}
          <Card className="py-2 sm:py-2">
            <dl className="divide-y divide-wash-strong text-sm">
              <div className={ligne}>
                <dt className="text-soft">{i.sla}</dt>
                <dd className="text-end">
                  <span className={`tnum block whitespace-nowrap font-semibold ${enRetard ? "text-danger" : "text-ink"}`}>
                    {incident.slaDeadline ? formatDateHeure(incident.slaDeadline, ctx.locale) : dict.common.none}
                  </span>
                  <span className="mt-0.5 block whitespace-nowrap text-[12px] text-soft">{dict.enums.urgenceSla[incident.urgence]}</span>
                </dd>
              </div>
              <div className={ligne}>
                <dt className="text-soft">{i.categorie}</dt>
                <dd className="text-end font-semibold text-ink">{dict.enums.categorieIncident[incident.categorie]}</dd>
              </div>
              {lotConcerne ? (
                <div className={ligne}>
                  <dt className="text-soft">{dict.invitations.lot}</dt>
                  <dd className="tnum text-end font-semibold text-ink">{lotConcerne.numero}</dd>
                </div>
              ) : null}
              {incident.immatriculationSignalee ? (
                <div className={ligne}>
                  <dt className="text-soft">{i.immatriculationSignalee}</dt>
                  <dd className="font-mono font-semibold text-ink" dir="ltr">{incident.immatriculationSignalee}</dd>
                </div>
              ) : null}
              {incident.emplacementId ? (
                <div className={ligne}>
                  <dt className="text-soft">{i.emplacementConcerne}</dt>
                  <dd>
                    <Link href={lienDetail(`/parkings/${incident.emplacementId}`)} className="link font-mono font-semibold" dir="ltr">
                      {emplacementCode ?? dict.parkings.titre}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {incident.description ? (
            <section>
              <SectionHeader title={i.description} />
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-body">
                {incident.description}
              </p>
            </section>
          ) : null}

          {/* Photos du signalement — vignettes + visionneuse plein cadre */}
          {photos.length > 0 ? (
            <section>
              <SectionHeader title={i.photos} />
              <div className="mt-4">
                <PhotoGallery
                  photos={photos}
                  altTemplate={i.photoDe}
                  closeLabel={dict.common.close}
                />
              </div>
            </section>
          ) : null}

          {/* Journal append-only — frise plate */}
          <section>
            <SectionHeader title={i.journal} />
            {incident.logs.length === 0 ? (
              <p className="mt-3 text-sm text-soft">{i.journalVide}</p>
            ) : (
              <ol className="mt-5">
                {incident.logs.map((log, idx) => {
                  const clos = log.statutApres === "RESOLU" || log.statutApres === "FERME";
                  const enCours = log.statutApres === "EN_COURS";
                  const dernier = idx === incident.logs.length - 1;
                  const acteur = nomActeur(log.acteurId, log.acteur);
                  return (
                    <li key={log.id} className="relative flex gap-4">
                      {/* Nœud + trait vers l'événement suivant */}
                      <div className="relative flex w-9 shrink-0 justify-center">
                        <span
                          className={`relative z-[1] flex size-9 items-center justify-center rounded-full ${
                            clos ? "bg-ok-tint text-ok" : enCours ? "bg-warn-tint text-warn" : "bg-action-tint text-link"
                          }`}
                        >
                          {clos ? <IconCheck width={16} height={16} /> : <span className="size-2.5 rounded-full bg-current" />}
                        </span>
                        {!dernier ? <span className="absolute top-9 bottom-0 w-0.5 bg-wash-strong" aria-hidden /> : null}
                      </div>
                      <div className={`min-w-0 flex-1 pt-1.5 ${dernier ? "" : "pb-7"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          {log.statutAvant ? (
                            <>
                              <Badge variant="outline">
                                {dict.enums.statutIncident[log.statutAvant]}
                              </Badge>
                              <IconArrowEnd width={14} height={14} className="text-faint" />
                            </>
                          ) : null}
                          <Badge variant={incidentVariant[log.statutApres]}>
                            {dict.enums.statutIncident[log.statutApres]}
                          </Badge>
                        </div>
                        {log.commentaire ? (
                          <p className="mt-2 text-[15px] leading-relaxed text-ink-strong">
                            {log.commentaire}
                          </p>
                        ) : null}
                        <p className="mt-1.5 text-[13px] text-soft">
                          {acteur ? <span className="font-semibold text-body">{acteur} · </span> : null}
                          <span className="tnum">{formatDateHeure(log.horodatage, ctx.locale)}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {voitDepenses ? (
            <section>
              {/* En-tête + action : l'action passe dessous sur mobile (titre jamais écrasé). */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeader
                  title={d.depensesLiees}
                  subtitle={incident.total_depenses ? <span className="tnum">{`${d.totalDepensesLiees} : ${formatMAD(incident.total_depenses, ctx.locale)}`}</span> : undefined}
                />
                {syndic ? <CreerDepenseIncidentModal dict={dict} locale={ctx.locale} incidentId={id} postes={postesActifs} /> : null}
              </div>
              {depenses.length === 0 ? (
                <p className="mt-3 text-sm text-soft">{d.aucuneDepenseLiee}</p>
              ) : (
                <ul className="-mx-3 mt-3">
                  {depenses.map((dep) => (
                    <li key={dep.id}>
                      <Link
                        href={lienDetail(`/finances/depenses/${dep.id}`)}
                        className="flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-wash"
                      >
                        <IconCircle tone="sand" size={44}>
                          <CCoins />
                        </IconCircle>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold text-ink">{dep.libelle}</span>
                          <span className="tnum block text-[13px] text-soft">{formatDate(dep.dateDepense, ctx.locale)}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <span className="tnum text-[15px] font-semibold text-ink">{formatMAD(dep.montantTtc, ctx.locale)}</span>
                          <Badge variant={depenseVariant[dep.statut]}>{e.statutDepense[dep.statut]}</Badge>
                        </span>
                        <IconChevronEnd width={18} height={18} className="shrink-0 text-link" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <p className="text-[13px] font-semibold text-soft">{i.assigneA}</p>
            {prestataireAssigne ? (
              <div className="mt-3 flex items-start gap-3">
                <IconCircle tone="tosca" size={44}>
                  <CSend />
                </IconCircle>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-ink">{prestataireAssigne.nom}</p>
                  <p className="mt-0.5 truncate text-[13px] text-soft">{prestataireAssigne.specialite}</p>
                  <p className="mt-0.5 truncate text-[13px] text-body" dir="ltr">
                    {prestataireAssigne.contact}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3">
                <IconCircle tone="surface" size={44}>
                  <CSend />
                </IconCircle>
                <p className="text-[15px] font-semibold text-soft">{i.nonAssigne}</p>
              </div>
            )}
            {incident.notePrestataire != null ? (
              <p className="mt-4 text-sm text-body">
                <span className="tnum text-warn" aria-hidden>{"★".repeat(incident.notePrestataire)}</span>{" "}
                {fill(d.dejaEvalue, { note: incident.notePrestataire })}
                {incident.commentairePrestataire ? <span className="block text-[13px] text-soft">« {incident.commentairePrestataire} »</span> : null}
              </p>
            ) : peutEvaluer ? (
              <div className="mt-4">
                <EvaluerPrestataireModal dict={dict} locale={ctx.locale} incidentId={id} prestataireNom={prestataireAssigne?.nom ?? ""} />
              </div>
            ) : null}
          </Card>
          <Card>
            <p className="text-[13px] font-semibold text-soft">{i.creePar}</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar nom={auteurNom ?? "•"} size={44} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-ink">{auteurNom ?? dict.common.none}</p>
                {incident.createur?.telephone ? (
                  <a
                    href={`tel:${incident.createur.telephone}`}
                    className="link tnum block truncate text-[13px]"
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
