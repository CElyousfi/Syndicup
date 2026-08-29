import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Invitation, Lot } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDateCourte } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Pagination } from "../../../../components/ui/pagination";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { CopyButton } from "../../../../components/ui/copy";
import { IconCircle, CKey } from "../../../../components/ui/color-icons";
import { invitationVariant } from "../../../../lib/status";
import { IconKey } from "../../../../components/ui/icons";
import { CreerInvitationModal, RegenererModal } from "./invitation-modals";
import { ConfirmDelete } from "../../../../components/ui/confirm-delete";
import { annulerInvitation } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.invitations };
}

export default async function InvitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; nouvelle?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const inv = dict.invitations;

  const page = Math.max(1, Number(sp.page) || 1);
  const [invitationsRes, lotsRes] = await Promise.all([
    apiFetch<Invitation[]>("/invitations", { searchParams: { page, limit: 20 } }),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
  ]);
  const invitations = invitationsRes.ok ? invitationsRes.data : [];
  const lots = lotsRes.ok ? lotsRes.data : [];
  const lotParId = new Map(lots.map((l) => [l.id, l.numero]));

  return (
    <div className="animate-fade">
      <PageHeader
        title={inv.titre}
        subtitle={inv.subtitle}
        actions={
          <CreerInvitationModal
            dict={dict}
            locale={ctx.locale}
            lots={lots.map((l) => ({ id: l.id, numero: l.numero }))}
            ouvertInitialement={sp.nouvelle === "1"}
          />
        }
      />

      <Banner variant="info" className="mb-4">
        {inv.envoiManuel} {inv.usageUniqueAide}
      </Banner>

      {invitations.length === 0 ? (
        <EmptyState
          title={inv.aucune}
          hint={inv.aucuneAide}
          icon={<IconKey width={44} height={44} />}
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <THead>
                <TH>{inv.code}</TH>
                <TH>{inv.role}</TH>
                <TH>{inv.lot}</TH>
                <TH>{inv.canal}</TH>
                <TH>{dict.lots.statut}</TH>
                <TH>{inv.expiration}</TH>
                <TH align="end" />
              </THead>
              <tbody>
                {invitations.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      <span className="inline-flex items-center gap-2.5">
                        <IconCircle tone="sand" size={32}>
                          <CKey width={17} height={17} />
                        </IconCircle>
                        <code className="rounded-md bg-ground px-2 py-0.5 font-mono text-[13px] font-semibold tracking-wider text-ink" dir="ltr">
                          {i.code}
                        </code>
                        {i.statut === "EN_ATTENTE" ? (
                          <CopyButton
                            value={i.code}
                            label={dict.common.copy}
                            copiedLabel={dict.common.copied}
                            className="h-7 px-2 text-[12px]"
                          />
                        ) : null}
                      </span>
                    </TD>
                    <TD>
                      <Badge variant="outline">{dict.roles[i.roleCible]}</Badge>
                    </TD>
                    <TD className="text-body">
                      {i.lotId ? (lotParId.get(i.lotId) ?? "—") : dict.common.none}
                    </TD>
                    <TD className="text-[13px] text-body">{dict.enums.canal[i.canal]}</TD>
                    <TD>
                      <Badge variant={invitationVariant[i.statut]}>
                        {dict.enums.statutInvitation[i.statut]}
                      </Badge>
                    </TD>
                    <TD className="text-[13px] text-soft">
                      <span className="block">{fill(inv.expire, { date: formatDateCourte(i.expireLe, ctx.locale) })}</span>
                      {i.statut === "EN_ATTENTE" ? (
                        <span className={`mt-0.5 block text-[12px] ${i.ouverteLe ? "font-medium text-warn" : "text-faint"}`}>
                          {i.ouverteLe ? fill(inv.ouverteLe, { date: formatDateCourte(i.ouverteLe, ctx.locale) }) : inv.nonOuverte}
                        </span>
                      ) : null}
                    </TD>
                    <TD align="end">
                      <span className="inline-flex items-center gap-1">
                        {i.statut === "EXPIREE" || i.statut === "EN_ATTENTE" ? (
                          <RegenererModal dict={dict} locale={ctx.locale} invitationId={i.id} />
                        ) : null}
                        {i.statut === "EN_ATTENTE" ? (
                          <ConfirmDelete
                            dict={dict}
                            locale={ctx.locale}
                            action={annulerInvitation}
                            champs={{ invitation_id: i.id }}
                            nom={`${dict.roles[i.roleCible]} · ${i.code}`}
                            titre={dict.gestion.invitationAnnuler}
                            label={dict.gestion.invitationAnnuler}
                            aide={dict.gestion.invitationAnnulerAide}
                          />
                        ) : null}
                      </span>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableCard>
          {invitationsRes.ok ? (
            <Pagination
              meta={invitationsRes.meta}
              basePath={`/${ctx.locale}/invitations`}
              dict={dict}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
