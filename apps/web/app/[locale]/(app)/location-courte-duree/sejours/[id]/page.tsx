import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type {
  Incident,
  LcdDeclaration,
  LcdSejour,
  LcdSejourEvenement,
} from "../../../../../../lib/api/types";
import { fill, getDict, isLocale } from "../../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatTelephone } from "../../../../../../lib/format";
import { nbNuits, vueLcd } from "../../../../../../lib/lcd";
import { nomsMembres } from "../../../../../../lib/lcd-server";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { CCalendar, CUsers, CWrench, IconCircle } from "../../../../../../components/ui/color-icons";
import { incidentVariant, sejourVariant } from "../../../../../../lib/status";
import { IconChevronEnd } from "../../../../../../components/ui/icons";
import { Ligne, Lignes } from "../../../../../../components/espaces/ligne-liste";
import { ConfirmerArriveeForm, ConfirmerDepartForm } from "../../lcd-modals";
import { AnnulerSejourModal, PiecesJointesCard } from "./sejour-actions";
import type { LcdPieceJointe } from "../../../../../../lib/api/types";

type SejourDetail = LcdSejour & { evenements?: LcdSejourEvenement[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").lcd.sejour };
}

const TONE_EVENEMENT: Record<LcdSejourEvenement["type"], { fond: string; point: string }> = {
  DECLARE: { fond: "bg-tosca-tint", point: "bg-action" },
  MODIFIE: { fond: "bg-tosca-tint", point: "bg-action" },
  GARDIEN_NOTIFIE: { fond: "bg-tosca-tint", point: "bg-action" },
  ARRIVEE_CONFIRMEE: { fond: "bg-ok-tint", point: "bg-ok" },
  DEPART_CONFIRME: { fond: "bg-ok-tint", point: "bg-ok" },
  INCIDENT_LIE: { fond: "bg-warn-tint", point: "bg-warn" },
  ANNULE: { fond: "bg-danger-tint", point: "bg-danger" },
};

/** Ligne clé/valeur : libellé discret au début, valeur affirmée à l'extrémité. */
function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-soft">{label}</dt>
      <dd className="min-w-0 text-end font-semibold text-ink">{children}</dd>
    </div>
  );
}

export default async function SejourDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ declare?: string; modifie?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const l = dict.lcd;
  const vue = vueLcd(ctx);
  if (vue === "aucune") redirect(`/${locale}/tableau-de-bord`);
  const p = (path: string) => `/${locale}${path}`;

  const sejourRes = await apiFetch<SejourDetail>(`/lcd/sejours/${id}`);
  if (!sejourRes.ok) notFound();
  const s = sejourRes.data;

  const [declRes, incidentsRes, nomMembre] = await Promise.all([
    apiFetch<LcdDeclaration>(`/lcd/declarations/${s.declarationLcdId}`),
    vue === "gestionnaire"
      ? Promise.resolve(null)
      : apiFetch<Incident[]>("/incidents", { searchParams: { sejour_id: id, limit: 20 } }),
    vue === "gestion" || vue === "conseil" || vue === "gardien" ? nomsMembres(vue) : Promise.resolve(new Map<string, string>()),
  ]);
  const declaration = declRes.ok ? declRes.data : null;
  const incidents = incidentsRes?.ok ? incidentsRes.data : [];
  const piecesRes = s.piecesJointes?.length ? await apiFetch<LcdPieceJointe[]>(`/lcd/sejours/${id}/pieces-jointes`) : null;
  const pieces = (piecesRes?.ok ? piecesRes.data : []).map((pj, n) => ({ ...pj, src: `/api/lcd-piece?sejour=${encodeURIComponent(id)}&n=${n}` }));
  const rolesJoint = ["SYNDIC", "SUPER_ADMIN", "PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT", "GESTIONNAIRE_LCD"];
  const peutRetirer = ctx.roles.some((r) => rolesJoint.includes(r)) && s.statut !== "ANNULE";
  const peutJoindre = (peutRetirer || ctx.roles.includes("GARDIEN")) && s.statut !== "ANNULE";
  const nom = (uid: string | null) => {
    if (!uid) return null;
    if (uid === ctx.profil.id) return [ctx.profil.prenom, ctx.profil.nom].filter(Boolean).join(" ") || null;
    return nomMembre.get(uid) ?? null;
  };

  const gestion = vue === "gestion";
  const moi = ctx.profil.id;
  const acteurDuSejour =
    gestion ||
    s.declareParId === moi ||
    (declaration ? declaration.declareParId === moi || declaration.gestionnaireId === moi : false);
  const peutConfirmer = gestion || vue === "gardien";
  const peutModifier = s.statut === "PREVU" && acteurDuSejour;
  const nuits = nbNuits(s.dateArrivee, s.dateDepart);
  const evenements = [...(s.evenements ?? [])].sort((a, b) => a.horodatage.localeCompare(b.horodatage));

  return (
    <div className="page-root">
      {sp.declare === "1" ? (
        <Banner variant="ok" className="mb-5">
          {l.sejourDeclare}
        </Banner>
      ) : sp.modifie === "1" ? (
        <Banner variant="ok" className="mb-5">
          {l.sejourModifie}
        </Banner>
      ) : null}

      <PageHeader
        back={<BackLink href={p("/location-courte-duree")} label={dict.nav.locationCourteDuree} />}
        title={s.voyageurPrincipalNom}
        badge={
          <Badge variant={sejourVariant[s.statut]} pulse={s.statut === "EN_COURS"}>
            {dict.enums.statutSejour[s.statut]}
          </Badge>
        }
        subtitle={
          <>
            {l.lot} {s.lot?.numero ?? "—"} ·{" "}
            <span className="tnum inline-block" dir="ltr">
              {formatDate(s.dateArrivee, ctx.locale)} → {formatDate(s.dateDepart, ctx.locale)}
            </span>{" "}
            · {nuits === 1 ? l.nuit : fill(l.nuits, { n: nuits })} ·{" "}
            {s.nbVoyageurs === 1 ? l.voyageur : fill(l.voyageurs, { n: s.nbVoyageurs })}
          </>
        }
        actions={
          <>
            {peutConfirmer && s.statut === "PREVU" ? (
              <ConfirmerArriveeForm dict={dict} locale={ctx.locale} sejourId={s.id} nbVoyageurs={s.nbVoyageurs} size="md" />
            ) : null}
            {peutConfirmer && s.statut === "EN_COURS" ? (
              <ConfirmerDepartForm dict={dict} locale={ctx.locale} sejourId={s.id} size="md" />
            ) : null}
            {s.statut === "EN_COURS" && vue !== "conseil" ? (
              <ButtonLink href={p(`/incidents/nouveau?sejour=${s.id}`)} variant="secondary">
                {l.signalerNuisance}
              </ButtonLink>
            ) : null}
            {peutModifier ? (
              <ButtonLink href={p(`/location-courte-duree/sejours/${s.id}/modifier`)} variant="secondary">
                {dict.common.modify}
              </ButtonLink>
            ) : null}
            {peutModifier ? (
              <AnnulerSejourModal dict={dict} locale={ctx.locale} sejourId={s.id} voyageurNom={s.voyageurPrincipalNom} />
            ) : null}
          </>
        }
      />

      {s.statut === "ANNULE" ? (
        <Banner variant="warn" className="mb-5" title={fill(l.annuleLe, { date: formatDateHeure(s.annuleLe, ctx.locale) })}>
          {s.motifAnnulation ?? ""}
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeader title={l.voyageurPrincipal} />
            <dl className="mt-3 divide-y divide-wash-strong text-sm">
              <Kv label={l.voyageurNom}>{s.voyageurPrincipalNom}</Kv>
              <Kv label={l.nbVoyageurs}>
                <span className="tnum">{s.nbVoyageurs}</span>
              </Kv>
              <Kv label={l.voyageurTelephone}>
                {s.voyageurTelephone ? (
                  <a href={`tel:${s.voyageurTelephone}`} className="link tnum" dir="ltr">
                    {formatTelephone(s.voyageurTelephone)}
                  </a>
                ) : (
                  <span className="font-normal text-faint">{dict.common.none}</span>
                )}
              </Kv>
              <Kv label={l.voyageurNationalite}>
                {s.voyageurNationalite ? <span dir="ltr">{s.voyageurNationalite}</span> : <span className="font-normal text-faint">{dict.common.none}</span>}
              </Kv>
              <Kv label={l.pieceIdentite}>
                {s.pieceIdentiteType ? dict.enums.typePieceIdentite[s.pieceIdentiteType] : <span className="font-normal text-faint">{dict.common.none}</span>}
                {s.pieceIdentiteFin ? (
                  <span className="ms-2 font-mono text-[13px] font-normal text-soft" dir="ltr">
                    ····{s.pieceIdentiteFin}
                  </span>
                ) : null}
              </Kv>
              <Kv label={l.plaqueVehicule}>
                {s.plaqueVehicule ? (
                  <span className="font-mono" dir="ltr">
                    {s.plaqueVehicule}
                  </span>
                ) : (
                  <span className="font-normal text-faint">{dict.common.none}</span>
                )}
              </Kv>
            </dl>
          </Card>

          <PiecesJointesCard dict={dict} locale={ctx.locale} sejourId={s.id} pieces={pieces} peutJoindre={peutJoindre} peutRetirer={peutRetirer} />

          <Card>
            <SectionHeader title={l.journal} />
            {evenements.length === 0 ? (
              <p className="mt-3 text-sm text-soft">{l.journalVide}</p>
            ) : (
              <ol className="mt-6 ms-2">
                {evenements.map((ev, idx) => {
                  const dernier = idx === evenements.length - 1;
                  const tone = TONE_EVENEMENT[ev.type];
                  const constate =
                    ev.detailsJson && typeof ev.detailsJson.nb_voyageurs_constate === "number"
                      ? (ev.detailsJson.nb_voyageurs_constate as number)
                      : null;
                  const motif =
                    ev.detailsJson && typeof ev.detailsJson.motif === "string" ? (ev.detailsJson.motif as string) : null;
                  return (
                    <li key={ev.id} className={`relative ps-7 border-s-2 ${dernier ? "border-transparent pb-0" : "border-wash-strong pb-7"}`}>
                      <span className={`absolute -start-[10px] top-0 flex size-[18px] items-center justify-center rounded-full ${tone.fond}`}>
                        <span className={`size-2 rounded-full ${tone.point}`} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-ink">{dict.enums.typeEvenementSejour[ev.type]}</p>
                        {constate !== null ? (
                          <p className="mt-0.5 text-[13px] text-body">
                            {l.nbVoyageursConstate} : <span className="tnum">{constate}</span>
                          </p>
                        ) : null}
                        {motif ? <p className="mt-0.5 text-[13px] text-body">{motif}</p> : null}
                        <p className="mt-1 text-[12px] text-faint">
                          {nom(ev.acteurId) ? `${nom(ev.acteurId)} · ` : ""}
                          {formatDateHeure(ev.horodatage, ctx.locale)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        {/* Mobile : le résumé du séjour passe en tête. */}
        <div className="order-first space-y-4 lg:order-none">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <IconCircle tone={s.statut === "EN_COURS" ? "ok" : s.statut === "ANNULE" ? "danger" : "tosca"} size={52}>
                <CCalendar width={26} height={26} />
              </IconCircle>
              <Badge variant={sejourVariant[s.statut]} pulse={s.statut === "EN_COURS"}>
                {dict.enums.statutSejour[s.statut]}
              </Badge>
            </div>
            <p className="mt-4 text-[13px] text-soft">{l.sejour}</p>
            <p className="tnum mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {nuits === 1 ? l.nuit : fill(l.nuits, { n: nuits })}
            </p>
            <dl className="mt-3 divide-y divide-wash-strong text-sm">
              <Kv label={l.dateArrivee}>
                <span className="tnum">
                  {formatDate(s.dateArrivee, ctx.locale)}
                  {s.heureArriveePrevue ? ` · ${s.heureArriveePrevue}` : ""}
                </span>
              </Kv>
              <Kv label={l.dateDepart}>
                <span className="tnum">{formatDate(s.dateDepart, ctx.locale)}</span>
              </Kv>
            </dl>
            <p className="mt-3 rounded-2xl bg-surface px-4 py-3 text-[13px] text-body">
              {s.gardienInformeLe
                ? fill(l.gardienInforme, { date: formatDateHeure(s.gardienInformeLe, ctx.locale) })
                : l.gardienNonInforme}
            </p>
          </Card>
          {declaration ? (
            <Card>
              <SectionHeader title={l.declaration} />
              <div className="relative mt-3 flex items-center gap-3 rounded-2xl bg-surface p-3">
                <IconCircle tone="sage" size={44}>
                  <CUsers width={22} height={22} />
                </IconCircle>
                <div className="min-w-0 flex-1 text-sm">
                  <Link
                    href={p(`/location-courte-duree/declarations/${declaration.id}`)}
                    className="block text-[15px] font-bold text-ink after:absolute after:inset-0 after:rounded-2xl after:content-['']"
                  >
                    {l.lot} {declaration.lot?.numero ?? s.lot?.numero ?? "—"}
                  </Link>
                  {declaration.contactUrgenceNom ? (
                    <p className="mt-0.5 text-[13px] text-body">
                      {l.contactUrgence} : {declaration.contactUrgenceNom}
                      {declaration.contactUrgenceTelephone ? (
                        <a href={`tel:${declaration.contactUrgenceTelephone}`} className="link tnum relative z-10 mt-0.5 block w-fit" dir="ltr">
                          {formatTelephone(declaration.contactUrgenceTelephone)}
                        </a>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <IconChevronEnd width={18} height={18} className="shrink-0 text-link" />
              </div>
            </Card>
          ) : null}
          {incidentsRes ? (
            <Card>
              <SectionHeader title={l.incidentsLies} />
              {incidents.length === 0 ? (
                <p className="mt-3 text-sm text-soft">{dict.common.none}</p>
              ) : (
                <Lignes className="mt-2">
                  {incidents.map((inc) => (
                    <Ligne
                      key={inc.id}
                      icon={<CWrench width={20} height={20} />}
                      tone="tosca"
                      href={p(`/incidents/${inc.id}`)}
                      title={inc.sousCategorie}
                      end={<Badge variant={incidentVariant[inc.statut]}>{dict.enums.statutIncident[inc.statut]}</Badge>}
                    />
                  ))}
                </Lignes>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
