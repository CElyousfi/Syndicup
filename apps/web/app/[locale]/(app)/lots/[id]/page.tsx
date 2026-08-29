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
import { Badge } from "../../../../../components/ui/badge";
import { ButtonLink } from "../../../../../components/ui/button";
import { LinkTabs } from "../../../../../components/ui/link-tabs";
import { Card } from "../../../../../components/ui/card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { Banner } from "../../../../../components/ui/banner";
import { Avatar } from "../../../../../components/ui/avatar";
import { IconCircle, CWallet } from "../../../../../components/ui/color-icons";
import { lotVariant, ligneAppelVariant, escaladeVariant } from "../../../../../lib/status";
import { AjouterProprietaireModal, AjouterOccupantModal } from "./rattachement-modals";
import { PaiementModal } from "../../../../../components/finances/paiement-modal";
import { ConfirmDelete } from "../../../../../components/ui/confirm-delete";
import { supprimerLot } from "../actions";
import { ContesterModal } from "../../../../../components/finances/contester-modal";

type Onglet = "propriete" | "occupation" | "finances" | "historique";

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
    ? ["propriete", "occupation", "finances", "historique"]
    : ["propriete", "occupation", "historique"];
  const ongletActif: Onglet = onglets.includes(sp.onglet as Onglet)
    ? (sp.onglet as Onglet)
    : "propriete";

  const proprietairesActifs = (lot.proprietaires ?? []).filter((p) => !p.dateFin);
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

  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={p("/lots")} label={dict.nav.lots} />}
        title={`${dict.enums.typeLot[lot.typeLot]} ${lot.numero}`}
        badge={<Badge variant={lotVariant[lot.statut]}>{dict.enums.statutLot[lot.statut]}</Badge>}
        subtitle={
          <>
            {formatEntier(lot.tantiemes)} {dict.ag.tantiemes}
            {lot.etage !== null ? ` · ${dict.lots.etage} ${lot.etage === 0 ? dict.lots.rdc : lot.etage}` : ""}
            {lot.superficie ? ` · ${formatEntier(lot.superficie)} m²` : ""}
          </>
        }
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">{dict.lots.proprietairesActifs}</h2>
            {gestion ? (
              <AjouterProprietaireModal
                dict={dict}
                locale={ctx.locale}
                lotId={id}
                membres={membres}
                quotePartExistante={quoteExistante}
              />
            ) : null}
          </div>
          {indivision ? <Banner variant="info">{dict.lots.representantAide}</Banner> : null}
          {proprietairesActifs.length === 0 ? (
            <Card>
              <p className="text-sm text-soft">{dict.common.emptyDefault}</p>
            </Card>
          ) : (
            <TableCard>
              <Table>
                <THead>
                  <TH>{dict.lots.proprietaire}</TH>
                  <TH align="end">{dict.lots.quotePart}</TH>
                  <TH>{dict.enums.typePropriete.PLEIN}</TH>
                  <TH>{dict.lots.dateDebut}</TH>
                </THead>
                <tbody>
                  {proprietairesActifs.map((pr) => (
                    <TR key={pr.id}>
                      <TD className="font-medium text-ink">
                        <span className="inline-flex max-w-full items-center gap-2.5">
                          <Avatar
                            nom={nomComplet(pr.utilisateur) ?? pr.utilisateurId}
                            size={30}
                          />
                          {pr.estRepresentantIndivision ? (
                            <span title={dict.lots.representantIndivision} className="shrink-0 text-warn">
                              ★
                            </span>
                          ) : null}
                          {nomComplet(pr.utilisateur) ? (
                            <span className="max-w-48 truncate">{nomComplet(pr.utilisateur)}</span>
                          ) : (
                            <span className="font-mono text-[12px] text-soft" dir="ltr">
                              {pr.utilisateurId.slice(0, 8)}…
                            </span>
                          )}
                        </span>
                      </TD>
                      <TD align="end" className="tnum font-medium text-ink">
                        {pr.quotePart} %
                      </TD>
                      <TD>
                        <Badge variant="outline">{dict.enums.typePropriete[pr.typePropriete]}</Badge>
                      </TD>
                      <TD className="text-body">{formatDate(pr.dateDebut, ctx.locale)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}
        </div>
      ) : null}

      {ongletActif === "occupation" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">{dict.lots.occupants}</h2>
            {gestion ? (
              <AjouterOccupantModal dict={dict} locale={ctx.locale} lotId={id} membres={membres} />
            ) : null}
          </div>
          {occupantsActifs.length === 0 ? (
            <Card>
              <p className="text-sm text-soft">{dict.lots.aucunOccupant}</p>
            </Card>
          ) : (
            <TableCard>
              <Table>
                <THead>
                  <TH>{dict.lots.utilisateur}</TH>
                  <TH>{dict.lots.onglets.occupation}</TH>
                  <TH>{dict.lots.dateDebut}</TH>
                  <TH align="center">{dict.lots.accesFinances}</TH>
                  <TH align="center">{dict.lots.recoitConvocations}</TH>
                </THead>
                <tbody>
                  {occupantsActifs.map((oc) => (
                    <TR key={oc.id}>
                      <TD className="font-medium text-ink">
                        <span className="inline-flex max-w-full items-center gap-2.5">
                          <Avatar
                            nom={nomComplet(oc.utilisateur) ?? oc.utilisateurId}
                            size={30}
                          />
                          {nomComplet(oc.utilisateur) ? (
                            <span className="max-w-48 truncate">{nomComplet(oc.utilisateur)}</span>
                          ) : (
                            <span className="font-mono text-[12px] text-soft" dir="ltr">
                              {oc.utilisateurId.slice(0, 8)}…
                            </span>
                          )}
                        </span>
                      </TD>
                      <TD>
                        <Badge variant="outline">
                          {dict.enums.typeOccupation[oc.typeOccupation]}
                        </Badge>
                      </TD>
                      <TD className="text-body">{formatDate(oc.dateDebut, ctx.locale)}</TD>
                      <TD align="center">{oc.accesFinancesAccorde ? "✓" : "—"}</TD>
                      <TD align="center">{oc.recoitConvocations ? "✓" : "—"}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}
        </div>
      ) : null}

      {ongletActif === "finances" && voitFinances && soldeRes.ok ? (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <IconCircle tone={versCentimes(soldeDu) <= 0n ? "ok" : "sand"} size={44}>
                <CWallet />
              </IconCircle>
              <div className="min-w-0">
                <p className="text-[13px] text-soft">{dict.finances.soldeDu}</p>
                {versCentimes(soldeDu) <= 0n ? (
                  <p className="mt-0.5 text-lg font-semibold text-ok">{dict.finances.soldeAJour}</p>
                ) : (
                  <p className="tnum mt-0.5 text-[26px] font-semibold leading-none tracking-tight text-danger">
                    {formatMAD(soldeDu, ctx.locale)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                  className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-btn border border-hairline bg-ground px-3.5 text-[13px] font-medium text-faint"
                  title={dict.finances.cmiIndisponible}
                >
                  {dict.dash.payerEnLigne}
                  <Badge variant="neutral">{dict.dash.bientotDisponible}</Badge>
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

      {ongletActif === "historique" ? (
        anciens.length === 0 ? (
          <Card>
            <p className="text-sm text-soft">{dict.lots.historiqueVide}</p>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-[15px] font-semibold text-ink">
              {dict.lots.proprietairesHistoriques}
            </h2>
            <TableCard>
              <Table>
                <THead>
                  <TH>{dict.lots.proprietaire}</TH>
                  <TH align="end">{dict.lots.quotePart}</TH>
                  <TH>{dict.lots.dateDebut}</TH>
                  <TH>{dict.lots.dateFin}</TH>
                </THead>
                <tbody>
                  {anciens.map((pr) => (
                    <TR key={pr.id}>
                      <TD className="font-medium text-ink">
                        <span className="inline-flex max-w-full items-center gap-2.5">
                          <Avatar
                            nom={nomComplet(pr.utilisateur) ?? pr.utilisateurId}
                            size={30}
                          />
                          {nomComplet(pr.utilisateur) ? (
                            <span className="max-w-48 truncate">{nomComplet(pr.utilisateur)}</span>
                          ) : (
                            <span className="font-mono text-[12px] text-soft" dir="ltr">
                              {pr.utilisateurId.slice(0, 8)}…
                            </span>
                          )}
                        </span>
                      </TD>
                      <TD align="end" className="tnum">{pr.quotePart} %</TD>
                      <TD className="text-body">{formatDate(pr.dateDebut, ctx.locale)}</TD>
                      <TD className="text-body">{formatDate(pr.dateFin, ctx.locale)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          </div>
        )
      ) : null}
    </div>
  );
}
