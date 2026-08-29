import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Copropriete } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Input } from "../../../../components/ui/field";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { coproVariant } from "../../../../lib/status";
import { IconPlus, IconSearch } from "../../../../components/ui/icons";
import { StatCard } from "../../../../components/ui/stat-card";
import { IconCircle, CBuilding, CFile, CShield } from "../../../../components/ui/color-icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").admin.titre };
}

/** B6 — tableau de bord plateforme (super admin). */
export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const ad = dict.admin;

  const res = await apiFetch<Copropriete[]>("/coproprietes");
  const toutes = res.ok ? res.data : [];
  const actives = toutes.filter((c) => c.statut === "ACTIVE");
  const archivees = toutes.filter((c) => c.statut === "ARCHIVEE");
  const q = (sp.q ?? "").toLowerCase();
  const copros = toutes.filter(
    (c) => !q || c.nom.toLowerCase().includes(q) || c.ville.toLowerCase().includes(q)
  );

  return (
    <div className="animate-fade">
      <PageHeader
        title={ad.titre}
        subtitle={ad.subtitle}
        actions={
          <ButtonLink href={`/${locale}/admin/coproprietes/nouvelle`} data-tour="admin-new">
            <IconPlus width={16} height={16} />
            {ad.creer}
          </ButtonLink>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={<CBuilding />} tone="sage" label={ad.titre} value={toutes.length} />
        <StatCard
          icon={<CShield />}
          tone="ok"
          label={dict.enums.statutCopropriete.ACTIVE}
          value={actives.length}
        />
        <StatCard
          icon={<CFile />}
          tone="lilac"
          label={dict.enums.statutCopropriete.ARCHIVEE}
          value={archivees.length}
        />
      </div>

      <form className="mb-4" method="GET">
        <div className="relative max-w-xs">
          <IconSearch
            width={16}
            height={16}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder={dict.common.search} className="h-10 ps-9" />
        </div>
      </form>

      {copros.length === 0 ? (
        <EmptyState title={dict.common.emptyDefault} />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <TH>{dict.parametres.nom}</TH>
              <TH>{dict.parametres.ville}</TH>
              <TH>{dict.parametres.typeResidence}</TH>
              <TH align="center">{dict.parametres.nbLots}</TH>
              <TH>{dict.lots.statut}</TH>
              <TH align="end" />
            </THead>
            <tbody>
              {copros.map((c) => (
                <TR key={c.id}>
                  <TD className="font-semibold text-ink">
                    <Link
                      href={`/${locale}/admin/coproprietes/${c.id}`}
                      className="flex items-center gap-3 transition-colors hover:text-action"
                    >
                      <IconCircle tone="sage" size={36}>
                        <CBuilding width={18} height={18} />
                      </IconCircle>
                      <span className="min-w-0 truncate">{c.nom}</span>
                    </Link>
                  </TD>
                  <TD className="text-body">{c.ville}</TD>
                  <TD className="text-[13px] text-body">
                    {dict.enums.typeResidence[c.typeResidence]}
                  </TD>
                  <TD align="center" className="tnum text-body">
                    {c.nbLots}
                  </TD>
                  <TD>
                    <Badge variant={coproVariant[c.statut]}>
                      {dict.enums.statutCopropriete[c.statut]}
                    </Badge>
                  </TD>
                  <TD align="end">
                    <Link
                      href={`/${locale}/admin/coproprietes/${c.id}`}
                      className="inline-flex h-8 items-center rounded-btn px-2.5 text-[13px] font-medium text-action transition-colors hover:bg-action-tint"
                    >
                      {ad.ficheClient}
                    </Link>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
