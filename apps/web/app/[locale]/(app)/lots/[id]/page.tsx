import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import { annuaireMembres } from "../../../../../lib/membres";
import type { AppelDeFonds, Lot, SoldeLot } from "../../../../../lib/api/types";
import { contexteLignes, getSynthese } from "../../../../../lib/finances-data";
import {
  formatDate,
  formatEntier,
  formatMAD,
  formatPeriode,
  nomComplet,
} from "../../../../../lib/format";
import { versCentimes, versChaine, sommeCentimes } from "../../../../../lib/centimes";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { ReleveButtons } from "../../../../../components/finances/releve-buttons";
import { Badge } from "../../../../../components/ui/badge";
import { ButtonLink } from "../../../../../components/ui/button";
import { LinkTabs } from "../../../../../components/ui/link-tabs";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { Banner } from "../../../../../components/ui/banner";
import { Avatar } from "../../../../../components/ui/avatar";
import { IconCircle, CWallet, CHome, CBuilding, CUsers, CKey } from "../../../../../components/ui/color-icons";
import { EmptyState } from "../../../../../components/ui/empty-state";
import type { ReactNode } from "react";
import { lotVariant, ligneAppelVariant, escaladeVariant } from "../../../../../lib/status";
import { AjouterProprietaireModal, AjouterOccupantModal } from "./rattachement-modals";
import { PaiementModal } from "../../../../../components/finances/paiement-modal";
import { ConfirmDelete } from "../../../../../components/ui/confirm-delete";
import { supprimerLot } from "../actions";
import { ContesterModal } from "../../../../../components/finances/contester-modal";
import { LotLcdCard } from "../../../../../components/lcd/lot-lcd-card";
import { LotParkingsSection } from "./lot-parkings";

type Onglet = "propriete" | "occupation" | "finances" | "historique" | "parkings";

/** Glyphe couleur par famille de lot — habitat vs bâtiment/annexe. */
const LOTS_HABITAT = ["APPARTEMENT", "VILLA", "LOGE_GARDIEN"];

/** Ligne personne (Wise) : avatar, nom gras, sous-titre gris, valeur ou badges à l'extrémité. */
function LignePersonne({
  nom,
  repli,
  sousTitre,
  fin,
  prefixe,
  extra,
}: {
  nom: string | null;
  repli: string;
  sousTitre: ReactNode;
  fin?: ReactNode;
  prefixe?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-wash">
      <Avatar nom={nom ?? repli} size={44} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-ink">
          {prefixe}
          {nom ? (
            <span className="truncate">{nom}</span>
          ) : (
            <span className="truncate font-mono text-[13px] font-medium text-soft" dir="ltr">
              {repli.slice(0, 8)}…
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-soft">{sousTitre}</p>
        {extra ? <div className="mt-2 flex flex-wrap gap-1.5">{extra}</div> : null}
      </div>
      {fin ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{fin}</div> : null}
    </li>
  );
}

export default async function LotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));

  const lotRes = await apiFetch<Lot>(`/lots/${id}`);
  if (!lotRes.ok) notFound();
  const lot = lotRes.data;

  const soldeRes = await apiFetch<SoldeLot>(`/finances/lots/${id}/solde`);
  const voitFinances = soldeRes.ok;

  const onglets: Onglet[] = voitFinances
    ? ["propriete", "occupation", "finances", "parkings", "historique"]
    : ["propriete", "occupation", "parkings", "historique"];
  const ongletActif: Onglet = onglets.includes(sp.onglet as Onglet)
    ? (sp.onglet as Onglet)
    : "propriete";

  const proprietairesActifs = (lot.proprietaires ?? []).filter((p) => !p.dateFin);
  // M18 — relevé de charges : le conseil (lecture) et le propriétaire du lot y ont droit, pas le locataire.
  const estProprietaireDuLot = ctx.roles.includes("CONSEIL_SYNDICAL") || proprietairesActifs.some((p) => p.utilisateurId === ctx.profil.id);
  const anciens = (lot.proprietaires ?? []).filter((p) => p.dateFin);
  const occupantsActifs = (lot.occupants ?? []).filter((o) => !o.dateFin);
  const indivision = proprietairesActifs.length > 1;

  const membres = gestion ? await annuaireMembres() : [];
  const quoteExistante = Number(
    (Number(sommeCentimes(proprietairesActifs.map((x) => x.quotePart))) / 100).toFixed(2)
  );

  // Contexte des lignes financières (période, type, escalade) — un appel de synthèse partagé.
  const contextLignes =
    ongletActif === "finances" && voitFinances
      ? contexteLignes(await getSynthese())
      : new Map<string, { periode: string; type: AppelDeFonds["type"]; escalade: string; lotId: string }>();

  const p = (path: string) => `/${locale}${path}`;
  const tabHref = (o: Onglet) => p(`/lots/${id}?onglet=${o}`);
  const soldeDu = soldeRes.ok ? soldeRes.data.solde_du : null;

  const totalTantiemes = ctx.copropriete?.totalTantiemes ?? null;
  const proprioPrincipal = proprietairesActifs.find((x) => x.estRepresentantIndivision) ?? proprietairesActifs[0];
  const nomPrincipal = proprioPrincipal ? nomComplet(proprioPrincipal.utilisateur) : null;
  const aJour = soldeDu !== null && versCentimes(soldeDu) <= 0n;
  const meta = [
    lot.batiment ? `${dict.lots.batiment} ${lot.batiment}` : null,
    lot.etage !== null ? `${dict.lots.etage} ${lot.etage === 0 ? dict.lots.rdc : lot.etage}` : null,
    lot.superficie ? `${formatEntier(lot.superficie)} m²` : null,
  ].filter(Boolean);

  return (
    <div className="page-root">
      <PageHeader
        back={<BackLink href={p("/lots")} label={dict.nav.lots} />}
        title={`${dict.enums.typeLot[lot.typeLot]} ${lot.numero}`}
        badge={<Badge variant={lotVariant[lot.statut]}>{dict.enums.statutLot[lot.statut]}</Badge>}
        actions={
          gestion ? (
            <>
              <ButtonLink href={p(`/lots/${id}/modifier`)} variant="secondary">
                {dict.common.modify}
              </ButtonLink>
              <ButtonLink href={p(`/lots/${id}/transfert`)} variant="primary">
                {dict.lots.transferer}
              </ButtonLink>
              <ConfirmDelete
                dict={dict}
                locale={ctx.locale}
                action={supprimerLot}
                champs={{ lot_id: id }}
                nom={lot.numero}
                aide={dict.gestion.lotSupprimerAide}
                size="md"
              />
            </>
          ) : undefined
        }
      />

      {/* Synthèse du lot : numéro, type, tantièmes, propriétaire, solde — avant les détails. */}
      <Card className="mb-7 p-5 sm:p-7">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <div className="flex h-[76px] min-w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded-[22px] bg-surface px-3 sm:h-[88px] sm:min-w-[88px]">
            {LOTS_HABITAT.includes(lot.typeLot) ? <CHome width={20} height={20} /> : <CBuilding width={20} height={20} />}
            <span className="tnum max-w-36 truncate text-[24px] font-bold leading-none tracking-[-0.02em] text-ink sm:text-[28px]" dir="ltr">
              {lot.numero}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[19px] font-bold tracking-tight text-ink">{dict.enums.typeLot[lot.typeLot]}</p>
            {meta.length > 0 ? <p className="mt-1 truncate text-[14px] text-soft">{meta.join(" · ")}</p> : null}
            {lot.typeUsage || indivision ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {lot.typeUsage ? <Badge variant="neutral">{dict.lots.usages[lot.typeUsage]}</Badge> : null}
                {indivision ? <Badge variant="neutral">{dict.enums.typePropriete.INDIVISION}</Badge> : null}
              </div>
            ) : null}
          </div>
        </div>

        <dl className={`mt-5 grid grid-cols-2 gap-3 sm:mt-6 ${soldeDu !== null ? "sm:grid-cols-3" : ""}`}>
          <div className="min-w-0 rounded-[20px] bg-surface p-4 sm:p-5">
            <dt className="text-[13px] font-medium text-soft">{dict.lots.tantiemes}</dt>
            <dd className="mt-1.5 flex items-baseline gap-1.5">
              <span className="tnum text-[20px] font-bold leading-none tracking-[-0.02em] text-ink sm:text-[26px]">{formatEntier(lot.tantiemes)}</span>
              {totalTantiemes ? <span className="tnum text-[13px] text-soft">/ {formatEntier(totalTantiemes)}</span> : null}
            </dd>
          </div>
          <div className={`min-w-0 rounded-[20px] bg-surface p-4 sm:p-5 ${soldeDu !== null ? "order-last col-span-2 sm:order-none sm:col-span-1" : ""}`}>
            <dt className="text-[13px] font-medium text-soft">{dict.lots.proprietaire}</dt>
            <dd className="mt-1.5 flex min-w-0 items-center gap-2.5">
              {proprioPrincipal ? (
                <>
                  <Avatar nom={nomPrincipal ?? proprioPrincipal.utilisateurId} size={34} />
                  <span className="min-w-0 truncate text-[15px] font-semibold text-ink">
                    {nomPrincipal ?? `${proprioPrincipal.utilisateurId.slice(0, 8)}…`}
                  </span>
                  {proprietairesActifs.length > 1 ? (
                    <span className="tnum shrink-0 rounded-full bg-wash px-2 py-0.5 text-[12px] font-semibold text-ink">
                      +{proprietairesActifs.length - 1}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-[15px] font-semibold text-faint">{dict.common.none}</span>
              )}
            </dd>
          </div>
          {soldeDu !== null ? (
            <div className="min-w-0 rounded-[20px] bg-surface p-4 sm:p-5">
              <dt className="text-[13px] font-medium text-soft">{dict.lots.solde}</dt>
              <dd className="mt-1.5">
                {aJour ? (
                  <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ok">
                    <span className="size-2 rounded-full bg-ok" aria-hidden />
                    {dict.enums.statutLigne.PAYE}
                  </span>
                ) : (
                  <span className="tnum block text-[18px] font-bold leading-tight tracking-[-0.02em] text-danger sm:text-[26px] sm:leading-none">
                    {formatMAD(soldeDu, ctx.locale)}
                  </span>
                )}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <LinkTabs
        className="mb-6"
        tabs={onglets.map((o) => ({
          href: tabHref(o),
          label: dict.lots.onglets[o],
          active: o === ongletActif,
        }))}
      />

      {ongletActif === "propriete" ? (
        <div className="space-y-4">
          <SectionHeader
            title={dict.lots.proprietairesActifs}
            action={
              gestion ? (
                <AjouterProprietaireModal
                  dict={dict}
                  locale={ctx.locale}
                  lotId={id}
                  membres={membres}
                  quotePartExistante={quoteExistante}
                />
              ) : undefined
            }
          />
          {indivision ? <Banner variant="info">{dict.lots.representantAide}</Banner> : null}
          {proprietairesActifs.length === 0 ? (
            <p className="py-4 text-sm text-soft">{dict.common.emptyDefault}</p>
          ) : (
            <ul className="-mx-3">
              {proprietairesActifs.map((pr) => (
                <LignePersonne
                  key={pr.id}
                  nom={nomComplet(pr.utilisateur)}
                  repli={pr.utilisateurId}
                  prefixe={
                    pr.estRepresentantIndivision ? (
                      <span title={dict.lots.representantIndivision} className="shrink-0 text-warn">
                        ★
                      </span>
                    ) : null
                  }
                  sousTitre={`${dict.enums.typePropriete[pr.typePropriete]} · ${dict.lots.dateDebut} ${formatDate(pr.dateDebut, ctx.locale)}`}
                  fin={<span className="tnum text-[16px] font-bold text-ink">{pr.quotePart} %</span>}
                />
              ))}
            </ul>
          )}
          {/* M15 — location courte durée : rendu seulement si l'API autorise la lecture (200). */}
          <LotLcdCard lotId={id} dict={dict} locale={ctx.locale} />
        </div>
      ) : null}

      {ongletActif === "occupation" ? (
        <div className="space-y-4">
          <SectionHeader
            title={dict.lots.occupants}
            action={
              gestion ? (
                <AjouterOccupantModal dict={dict} locale={ctx.locale} lotId={id} membres={membres} />
              ) : undefined
            }
          />
          {occupantsActifs.length === 0 ? (
            <EmptyState
              title={dict.lots.aucunOccupant}
              icon={
                <IconCircle tone="tosca" size={64}>
                  <CKey width={30} height={30} />
                </IconCircle>
              }
              className="py-10"
            />
          ) : (
            <ul className="-mx-3">
              {occupantsActifs.map((oc) => (
                <LignePersonne
                  key={oc.id}
                  nom={nomComplet(oc.utilisateur)}
                  repli={oc.utilisateurId}
                  sousTitre={`${dict.enums.typeOccupation[oc.typeOccupation]} · ${dict.lots.dateDebut} ${formatDate(oc.dateDebut, ctx.locale)}`}
                  extra={
                    oc.accesFinancesAccorde || oc.recoitConvocations ? (
                      <>
                        {oc.accesFinancesAccorde ? <Badge variant="neutral">{dict.lots.accesFinances}</Badge> : null}
                        {oc.recoitConvocations ? <Badge variant="neutral">{dict.lots.recoitConvocations}</Badge> : null}
                      </>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {ongletActif === "finances" && voitFinances && soldeRes.ok ? (
        <div className="space-y-5">
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <IconCircle tone={versCentimes(soldeDu) <= 0n ? "ok" : "sand"} size={48}>
                <CWallet />
              </IconCircle>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-soft">{dict.finances.soldeDu}</p>
                {versCentimes(soldeDu) <= 0n ? (
                  <p className="mt-1 text-[17px] font-bold text-ok">{dict.finances.soldeAJour}</p>
                ) : (
                  <p className="tnum mt-1 text-[30px] font-bold leading-none tracking-[-0.02em] text-danger">
                    {formatMAD(soldeDu, ctx.locale)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* M18 — relevé de charges (« état daté ») : syndic / conseil, ou propriétaire du lot. */}
              {gestion || estProprietaireDuLot ? <ReleveButtons dict={dict} lotId={id} lotNumero={lot.numero} /> : null}
              {gestion ? (
                <PaiementModal
                  dict={dict}
                  locale={ctx.locale}
                  modeInitial="fifo"
                  lotInitial={id}
                  lots={[{ id, numero: lot.numero }]}
                  lignes={soldeRes.data.lignes
                    .filter((l) => l.statut !== "PAYE")
                    .map((l) => {
                      const cx = contextLignes.get(l.appel_de_fonds_lot_id);
                      return {
                        id: l.appel_de_fonds_lot_id,
                        libelle: cx
                          ? `${lot.numero} · ${formatPeriode(cx.periode, ctx.locale)}`
                          : lot.numero,
                        restant: versChaine(
                          versCentimes(l.montant_du) - versCentimes(l.montant_paye)
                        ),
                      };
                    })}
                />
              ) : (
                <span
                  className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-btn bg-wash px-4 text-[13px] font-semibold text-soft"
                  title={dict.finances.cmiIndisponible}
                >
                  {dict.dash.payerEnLigne}
                  <Badge variant="outline">{dict.dash.bientotDisponible}</Badge>
                </span>
              )}
            </div>
          </Card>

          <TableCard>
            <Table>
              <THead>
                <TH>{dict.finances.periode}</TH>
                <TH align="end">{dict.finances.du}</TH>
                <TH align="end">{dict.finances.paye}</TH>
                <TH>{dict.lots.statut}</TH>
                <TH>{dict.finances.reponseStatut}</TH>
                <TH />
              </THead>
              <tbody>
                {soldeRes.data.lignes.map((l) => {
                  const cx = contextLignes.get(l.appel_de_fonds_lot_id);
                  return (
                    <TR key={l.appel_de_fonds_lot_id}>
                      <TD className="font-medium text-ink">
                        {cx ? formatPeriode(cx.periode, ctx.locale) : dict.common.none}
                        {cx ? (
                          <span className="ms-2 text-[12px] text-soft">
                            {dict.enums.typeAppel[cx.type]}
                          </span>
                        ) : null}
                      </TD>
                      <TD align="end" className="tnum text-body">
                        {formatMAD(l.montant_du, ctx.locale)}
                      </TD>
                      <TD align="end" className="tnum text-body">
                        {formatMAD(l.montant_paye, ctx.locale)}
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5">
                          <Badge variant={ligneAppelVariant[l.statut]}>
                            {dict.enums.statutLigne[l.statut]}
                          </Badge>
                          {cx && cx.escalade !== "N0" ? (
                            <Badge variant={escaladeVariant(cx.escalade)}>{cx.escalade}</Badge>
                          ) : null}
                        </span>
                      </TD>
                      <TD>
                        {l.conteste ? <Badge variant="info">{dict.enums.conteste}</Badge> : null}
                      </TD>
                      <TD align="end">
                        {!gestion && !l.conteste && l.statut !== "PAYE" ? (
                          <ContesterModal
                            dict={dict}
                            locale={ctx.locale}
                            appelDeFondsLotId={l.appel_de_fonds_lot_id}
                          />
                        ) : null}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableCard>
        </div>
      ) : null}

      {ongletActif === "parkings" ? <LotParkingsSection dict={dict} locale={ctx.locale} lot={lot} gestion={gestion} /> : null}

      {ongletActif === "historique" ? (
        anciens.length === 0 ? (
          <EmptyState
            title={dict.lots.historiqueVide}
            icon={
              <IconCircle tone="lilac" size={64}>
                <CUsers width={30} height={30} />
              </IconCircle>
            }
            className="py-10"
          />
        ) : (
          <div className="space-y-4">
            <SectionHeader title={dict.lots.proprietairesHistoriques} />
            <ul className="-mx-3">
              {anciens.map((pr) => (
                <LignePersonne
                  key={pr.id}
                  nom={nomComplet(pr.utilisateur)}
                  repli={pr.utilisateurId}
                  sousTitre={
                    <span className="tnum">
                      {formatDate(pr.dateDebut, ctx.locale)} → {formatDate(pr.dateFin, ctx.locale)}
                    </span>
                  }
                  fin={<span className="tnum text-[15px] font-semibold text-soft">{pr.quotePart} %</span>}
                />
              ))}
            </ul>
          </div>
        )
      ) : null}
    </div>
  );
}
