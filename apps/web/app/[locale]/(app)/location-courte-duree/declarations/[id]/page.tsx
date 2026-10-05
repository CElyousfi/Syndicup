import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { LcdDeclaration, LcdSejour, Lot } from "../../../../../../lib/api/types";
import { fill, getDict, isLocale } from "../../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatTelephone } from "../../../../../../lib/format";
import { trierSejours, vueLcd } from "../../../../../../lib/lcd";
import { nomsMembres } from "../../../../../../lib/lcd-server";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { Avatar } from "../../../../../../components/ui/avatar";
import { EmptyState } from "../../../../../../components/ui/empty-state";
import { CKey, IconCircle } from "../../../../../../components/ui/color-icons";
import { declarationLcdVariant } from "../../../../../../lib/status";
import { SejourListe } from "../../../../../../components/lcd/sejour-list";
import {
  CloturerModal,
  DecisionPanel,
  DesignerGestionnaireModal,
  ModifierContactsModal,
} from "./declaration-actions";

type DeclarationDetail = LcdDeclaration & { sejours?: LcdSejour[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").lcd.declaration };
}

/** Ligne clé/valeur : libellé discret au début, valeur affirmée à l'extrémité. */
function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-soft">{label}</dt>
      <dd className="min-w-0 text-end font-semibold text-ink">{children}</dd>
    </div>
  );
}

export default async function DeclarationLcdPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const l = dict.lcd;
  const vue = vueLcd(ctx);
  if (vue === "aucune") redirect(`/${locale}/tableau-de-bord`);
  const p = (path: string) => `/${locale}${path}`;

  const declRes = await apiFetch<DeclarationDetail>(`/lcd/declarations/${id}`);
  if (!declRes.ok) notFound();
  const d = declRes.data;

  const [lotRes, nomMembre] = await Promise.all([
    apiFetch<Lot>(`/lots/${d.lotId}`),
    vue === "gestion" || vue === "conseil" ? nomsMembres(vue) : Promise.resolve(new Map<string, string>()),
  ]);
  const lot = lotRes.ok ? lotRes.data : null;
  const nom = (uid: string | null) => {
    if (!uid) return null;
    if (uid === ctx.profil.id) return [ctx.profil.prenom, ctx.profil.nom].filter(Boolean).join(" ") || null;
    return nomMembre.get(uid) ?? `${uid.slice(0, 8)}…`;
  };

  const gestion = vue === "gestion";
  const moi = ctx.profil.id;
  const proprietaire =
    vue === "resident" &&
    (d.declareParId === moi ||
      (lot?.proprietaires ?? []).some((r) => !r.dateFin && r.utilisateurId === moi));
  const gestionnaire = d.gestionnaireId === moi;
  const ouverte = d.statut !== "CLOTUREE";
  const peutEditer = ouverte && (gestion || proprietaire || gestionnaire);
  const peutGererGestionnaire = ouverte && (gestion || proprietaire);
  const peutCloturer = !d.dateFin && d.statut !== "CLOTUREE" && (gestion || proprietaire);
  const peutDeclarerSejour = d.statut === "VALIDEE" && (gestion || proprietaire || gestionnaire);
  const sejours = trierSejours(d.sejours ?? []);
  const numero = d.lot?.numero ?? lot?.numero ?? "—";

  return (
    <div className="page-root">
      <PageHeader
        back={<BackLink href={p("/location-courte-duree")} label={dict.nav.locationCourteDuree} />}
        title={`${l.lot} ${numero}`}
        badge={
          <Badge variant={declarationLcdVariant[d.statut]} pulse={d.statut === "EN_ATTENTE"}>
            {dict.enums.statutDeclarationLcd[d.statut]}
          </Badge>
        }
        subtitle={
          <>
            {d.lot ? `${dict.enums.typeLot[d.lot.typeLot]} · ` : ""}
            {l.dateDebut} : <span className="tnum">{formatDate(d.dateDebut, ctx.locale)}</span>
            {d.dateFin ? (
              <>
                {" · "}
                {l.dateFin} : <span className="tnum">{formatDate(d.dateFin, ctx.locale)}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {peutDeclarerSejour ? (
              <ButtonLink href={p(`/location-courte-duree/sejours/nouveau?lot=${d.lotId}`)}>
                {l.declarerSejour}
              </ButtonLink>
            ) : null}
            {lot ? (
              <ButtonLink href={p(`/lots/${d.lotId}`)} variant="secondary">
                {dict.lots.voirFiche}
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {d.motifDecision && (d.statut === "REFUSEE" || d.statut === "SUSPENDUE") ? (
        <Banner variant="danger" className="mb-5" title={l.motifDecision}>
          {d.motifDecision}
          {d.decideLe ? (
            <span className="mt-1 block text-[12px] text-faint">
              {fill(l.decideLe, { date: formatDateHeure(d.decideLe, ctx.locale) })}
            </span>
          ) : null}
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {gestion && ouverte ? (
            <Card>
              <SectionHeader title={l.decision} />
              <div className="mt-4">
                <DecisionPanel dict={dict} locale={ctx.locale} declarationId={d.id} statut={d.statut} />
              </div>
            </Card>
          ) : null}

          <Card>
            <SectionHeader
              title={l.declaration}
              action={peutEditer ? <ModifierContactsModal dict={dict} locale={ctx.locale} declaration={d} /> : undefined}
            />
            <dl className="mt-3 divide-y divide-wash-strong text-sm">
              <Kv label={l.plateformes}>
                {d.plateformesJson && d.plateformesJson.length > 0 ? (
                  <span className="inline-flex flex-wrap justify-end gap-1.5">
                    {d.plateformesJson.map((pf) => (
                      <Badge key={pf} variant="outline">
                        {pf}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="font-normal text-faint">{dict.common.none}</span>
                )}
              </Kv>
              <Kv label={l.contactUrgence}>
                {d.contactUrgenceNom ?? (d.contactUrgenceTelephone ? null : <span className="font-normal text-faint">{dict.common.none}</span>)}
                {d.contactUrgenceTelephone ? (
                  <a href={`tel:${d.contactUrgenceTelephone}`} className="link tnum block" dir="ltr">
                    {formatTelephone(d.contactUrgenceTelephone)}
                  </a>
                ) : null}
              </Kv>
              <Kv label={l.dateDebut}>
                <span className="tnum">{formatDate(d.dateDebut, ctx.locale)}</span>
              </Kv>
              <Kv label={l.dateFin}>
                {d.dateFin ? <span className="tnum">{formatDate(d.dateFin, ctx.locale)}</span> : <span className="font-normal text-faint">{dict.common.none}</span>}
              </Kv>
              {d.decideLe && d.statut !== "EN_ATTENTE" ? (
                <Kv label={l.decision}>
                  <span className="font-normal text-body">
                    {fill(l.decideLe, { date: formatDateHeure(d.decideLe, ctx.locale) })}
                    {d.motifDecision ? ` — ${d.motifDecision}` : ""}
                  </span>
                </Kv>
              ) : null}
            </dl>
          </Card>

          <div>
            <SectionHeader title={l.sejours} className="mb-3" />
            {sejours.length === 0 ? (
              <EmptyState
                title={l.aucunSejour}
                hint={d.statut === "VALIDEE" ? l.aucunSejourAide : undefined}
                illustration="empty-lcd"
              />
            ) : (
              <SejourListe sejours={sejours} dict={dict} locale={ctx.locale} lotNumero={numero} />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader title={l.declarant} />
            <div className="mt-3 flex items-center gap-3">
              <Avatar nom={nom(d.declareParId) ?? "•"} size={44} />
              <p className="truncate text-[15px] font-bold text-ink">{nom(d.declareParId) ?? dict.common.none}</p>
            </div>
          </Card>
          <Card>
            <SectionHeader title={l.gestionnaire} />
            {d.gestionnaireId ? (
              <div className="mt-3 flex items-center gap-3">
                <IconCircle tone="sage" size={44}>
                  <CKey width={22} height={22} />
                </IconCircle>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-ink">{nom(d.gestionnaireId)}</p>
                  <p className="text-[13px] text-soft">{dict.roles.GESTIONNAIRE_LCD}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-soft">{l.aucunGestionnaire}</p>
            )}
            <p className="mt-3 text-[13px] text-soft">{l.gestionnaireAide}</p>
            {peutGererGestionnaire ? (
              <div className="mt-4">
                <DesignerGestionnaireModal dict={dict} locale={ctx.locale} declarationId={d.id} dejaDesigne={!!d.gestionnaireId} />
              </div>
            ) : null}
          </Card>
          {peutCloturer ? (
            <Card>
              <SectionHeader title={l.cloturer} subtitle={l.cloturerAide} />
              <div className="mt-3">
                <CloturerModal dict={dict} locale={ctx.locale} declarationId={d.id} lotNumero={numero} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
