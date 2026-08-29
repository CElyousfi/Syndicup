import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Prestataire } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { Avatar } from "../../../../components/ui/avatar";
import { PrestataireModal, ModifierPrestataireModal } from "./prestataire-modal";
import { ConfirmDelete } from "../../../../components/ui/confirm-delete";
import { supprimerPrestataire } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.prestataires };
}

export default async function PrestatairesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "GARDIEN"]);
  const { dict } = ctx;
  const i = dict.incidents;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));

  const res = await apiFetch<Prestataire[]>("/prestataires");
  const prestataires = res.ok ? res.data : [];

  return (
    <div className="animate-fade">
      <PageHeader
        title={i.prestataires}
        subtitle={i.prestatairesSubtitle}
        actions={gestion ? <PrestataireModal dict={dict} locale={ctx.locale} /> : undefined}
      />

      {prestataires.length === 0 ? (
        <EmptyState
          title={i.aucunPrestataire}
          hint={gestion ? i.aucunPrestataireAide : undefined}
          action={gestion ? <PrestataireModal dict={dict} locale={ctx.locale} /> : undefined}
        />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <TH>{i.nom}</TH>
              <TH>{i.specialite}</TH>
              <TH>{i.contact}</TH>
              <TH>{dict.lots.statut}</TH>
              {gestion ? <TH align="end">{dict.common.actions}</TH> : null}
            </THead>
            <tbody>
              {prestataires.map((p) => (
                <TR key={p.id}>
                  <TD className="font-semibold text-ink">
                    <span className="inline-flex items-center gap-3">
                      <Avatar nom={p.nom} size={36} />
                      <span className="min-w-0 truncate">{p.nom}</span>
                    </span>
                  </TD>
                  <TD className="text-body">{p.specialite}</TD>
                  <TD className="text-body">
                    <span dir="ltr">{p.contact}</span>
                  </TD>
                  <TD>
                    <Badge variant={p.actif ? "ok" : "outline"}>
                      {p.actif ? i.actif : i.inactif}
                    </Badge>
                  </TD>
                  {gestion ? (
                    <TD align="end">
                      <span className="inline-flex items-center gap-1">
                        <ModifierPrestataireModal dict={dict} locale={ctx.locale} prestataire={p} />
                        <ConfirmDelete
                          dict={dict}
                          locale={ctx.locale}
                          action={supprimerPrestataire}
                          champs={{ prestataire_id: p.id }}
                          nom={p.nom}
                        />
                      </span>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </tbody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
