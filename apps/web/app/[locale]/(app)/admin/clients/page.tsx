import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { ClientFacturation } from "../../../../../lib/api/console-types";
import { getDict, isLocale, type Dict } from "../../../../../lib/i18n";
import { PageHeader } from "../../../../../components/page-header";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Field, Input, Select, Textarea } from "../../../../../components/ui/field";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { LiveList } from "../../../../../components/ui/live-list";
import { IconPlus, IconSearch } from "../../../../../components/ui/icons";
import { FormModal } from "../console-ui";
import { enregistrerClientAction } from "../console-actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.clientsTitre };
}

function ChampsClient({ dict, cl }: { dict: Dict; cl?: ClientFacturation }) {
  const c = dict.console;
  const k = cl?.id ?? "nouveau";
  return (
    <>
      {cl ? null : (
        <Field label={c.typeClient} htmlFor={`t_${k}`} required>
          <Select id={`t_${k}`} name="type" defaultValue="SYNDICAT">
            <option value="SYNDICAT">{c.typesClient.SYNDICAT}</option>
            <option value="CABINET">{c.typesClient.CABINET}</option>
          </Select>
        </Field>
      )}
      <Field label={c.nomClient} htmlFor={`n_${k}`} required>
        <Input id={`n_${k}`} name="nom" required maxLength={200} defaultValue={cl?.nom ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.raisonSociale} htmlFor={`rs_${k}`}>
          <Input id={`rs_${k}`} name="raison_sociale" maxLength={200} defaultValue={cl?.raison_sociale ?? ""} />
        </Field>
        <Field label={c.ice} htmlFor={`ice_${k}`}>
          <Input id={`ice_${k}`} name="ice" inputMode="numeric" maxLength={15} className="tnum" defaultValue={cl?.ice ?? ""} />
        </Field>
        <Field label={c.rc} htmlFor={`rc_${k}`}>
          <Input id={`rc_${k}`} name="rc" maxLength={60} defaultValue={cl?.rc ?? ""} />
        </Field>
        <Field label={c.identifiantFiscal} htmlFor={`if_${k}`}>
          <Input id={`if_${k}`} name="identifiant_fiscal" maxLength={60} defaultValue={cl?.identifiant_fiscal ?? ""} />
        </Field>
        <Field label={c.adresse} htmlFor={`ad_${k}`}>
          <Input id={`ad_${k}`} name="adresse" maxLength={300} defaultValue={cl?.adresse ?? ""} />
        </Field>
        <Field label={c.ville} htmlFor={`v_${k}`}>
          <Input id={`v_${k}`} name="ville" maxLength={100} defaultValue={cl?.ville ?? ""} />
        </Field>
        <Field label={c.contactNom} htmlFor={`cn_${k}`}>
          <Input id={`cn_${k}`} name="contact_nom" maxLength={200} defaultValue={cl?.contact_nom ?? ""} />
        </Field>
        <Field label={c.contactTelephone} htmlFor={`ct_${k}`}>
          <Input id={`ct_${k}`} name="contact_telephone" inputMode="tel" maxLength={20} defaultValue={cl?.contact_telephone ?? ""} />
        </Field>
      </div>
      <Field label={c.contactEmail} htmlFor={`ce_${k}`}>
        <Input id={`ce_${k}`} name="contact_email" type="email" maxLength={200} defaultValue={cl?.contact_email ?? ""} />
      </Field>
      <Field label={c.notes} htmlFor={`no_${k}`}>
        <Textarea id={`no_${k}`} name="notes_client" rows={2} maxLength={2000} defaultValue={cl?.notes ?? ""} />
      </Field>
    </>
  );
}

/** M29 — qui paie : syndicats et cabinets ; création et modification de la fiche de facturation. */
export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; ouvrir?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const L = ctx.locale;
  const res = await apiFetch<ClientFacturation[]>("/admin/clients", { searchParams: { q: sp.q || undefined } });
  const clients = res.ok ? res.data : [];
  // Lien « Voir » depuis une fiche abonnement : le client concerné en tête de liste.
  const tries = sp.ouvrir ? [...clients].sort((a, b) => (a.id === sp.ouvrir ? -1 : b.id === sp.ouvrir ? 1 : 0)) : clients;

  return (
    <div className="page-root">
      <PageHeader
        title={c.clientsTitre}
        subtitle={c.clientsSousTitre}
        actions={
          <FormModal label={c.nouveauClientBouton} icon={<IconPlus width={16} height={16} />} variant="primary" size="md" title={c.nouveauClientBouton} action={enregistrerClientAction} hidden={{ locale: L, succes: c.clientCree }} submitLabel={c.nouveauClientBouton} closeLabel={dict.common.close} wide>
            <ChampsClient dict={dict} />
          </FormModal>
        }
      />
      <form className="mb-4" method="GET">
        <div className="relative w-72 max-w-full">
          <IconSearch width={16} height={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder={dict.common.search} className="h-10 ps-9" />
        </div>
      </form>
      {tries.length === 0 ? (
        <EmptyState title={c.aucunClient} />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <TH>{c.client}</TH>
              <TH>{c.typeClient}</TH>
              <TH>{c.contactNom}</TH>
              <TH align="center">{c.nbAbonnements}</TH>
              <TH align="end" />
            </THead>
            <LiveList as="tbody">
              {tries.map((cl) => (
                <TR key={cl.id} className={cl.id === sp.ouvrir ? "bg-action-wash" : ""}>
                  <TD>
                    <span className="block text-[15px] font-bold text-ink">{cl.nom}</span>
                    <span className="block text-[12px] text-soft">{[cl.raison_sociale, cl.ice ? `ICE ${cl.ice}` : null, cl.ville].filter(Boolean).join(" · ")}</span>
                  </TD>
                  <TD className="text-[13px] text-body">{c.typesClient[cl.type]}</TD>
                  <TD className="text-[13px] text-body">
                    {cl.contact_nom ?? "—"}
                    {cl.contact_email ? <a href={`mailto:${cl.contact_email}`} className="block text-link">{cl.contact_email}</a> : null}
                    {cl.contact_telephone ? <span className="block text-soft">{cl.contact_telephone}</span> : null}
                  </TD>
                  <TD align="center" className="tnum">
                    {cl.abonnements ? (
                      <Link className="font-semibold text-link" href={`/${L}/admin/abonnements?q=${encodeURIComponent(cl.nom)}`}>
                        {cl.abonnements}
                      </Link>
                    ) : (
                      <Link className="text-[13px] font-semibold text-link" href={`/${L}/admin/abonnements/nouveau?client=${cl.id}`}>
                        {c.ouvrirAbonnement}
                      </Link>
                    )}
                  </TD>
                  <TD align="end">
                    <FormModal label={c.modifierClient} variant="ghost" title={c.modifierClient} subtitle={cl.nom} action={enregistrerClientAction} hidden={{ locale: L, client_id: cl.id, succes: c.clientModifie }} submitLabel={c.confirmer} closeLabel={dict.common.close} wide>
                      <ChampsClient dict={dict} cl={cl} />
                    </FormModal>
                  </TD>
                </TR>
              ))}
            </LiveList>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
