import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { UtilisateurAdmin } from "../../../../../lib/api/console-types";
import type { RoleType, StatutCompte } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDateCourte, nomComplet } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { ButtonLink } from "../../../../../components/ui/button";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Field, Input } from "../../../../../components/ui/field";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { LiveList } from "../../../../../components/ui/live-list";
import { IconSearch } from "../../../../../components/ui/icons";
import { FormModal } from "../console-ui";
import { statutUtilisateurAction } from "../console-actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.utilisateursTitre };
}

/** M29 — tous les comptes de la plateforme : rôles par résidence, suspension / réactivation. */
export default async function UtilisateursPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const L = ctx.locale;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const res = await apiFetch<{ total: number; page: number; par_page: number; utilisateurs: UtilisateurAdmin[] }>("/admin/utilisateurs", {
    searchParams: { q: sp.q || undefined, page },
  });
  const data = res.ok ? res.data : { total: 0, page, par_page: 50, utilisateurs: [] };
  const pages = Math.max(1, Math.ceil(data.total / data.par_page));
  const lien = (n: number) => `/${L}/admin/utilisateurs?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(n) }).toString()}`;

  return (
    <div className="page-root">
      <PageHeader title={c.utilisateursTitre} subtitle={`${c.utilisateursSousTitre} ${fill(c.totalComptes, { n: data.total })}`} />
      <form className="mb-4" method="GET">
        <div className="relative w-80 max-w-full">
          <IconSearch width={16} height={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder={c.rechercheUtilisateur} className="h-10 ps-9" />
        </div>
      </form>
      {data.utilisateurs.length === 0 ? (
        <EmptyState title={dict.common.emptyDefault} illustration={sp.q ? "empty-search" : undefined} />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <TH>{dict.parametres.nom}</TH>
              <TH>{c.roles}</TH>
              <TH>{c.compte}</TH>
              <TH>{c.creeLe}</TH>
              <TH align="end" />
            </THead>
            <LiveList as="tbody">
              {data.utilisateurs.map((u) => {
                const suspendu = u.statut_compte === "SUSPENDU";
                const operateur = u.roles.some((r) => r.role === "SUPER_ADMIN");
                const modifiable = !operateur && ["ACTIF", "SUSPENDU", "EN_VALIDATION", "INVITE"].includes(u.statut_compte);
                return (
                  <TR key={u.id}>
                    <TD>
                      <span className="block text-[15px] font-bold text-ink">{nomComplet(u) ?? "—"}</span>
                      <span className="block text-[12px] text-soft">{[u.email, u.telephone].filter(Boolean).join(" · ")}</span>
                    </TD>
                    <TD className="text-[13px]">
                      {u.roles.length === 0 ? (
                        <span className="text-faint">{c.aucunRole}</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {u.roles.slice(0, 4).map((r) => (
                            <li key={`${r.role}-${r.copropriete_id}`}>
                              <span className="font-semibold text-ink">{dict.roles[r.role as RoleType] ?? r.role}</span>
                              <Link href={`/${L}/admin/coproprietes/${r.copropriete_id}`} className="text-soft hover:text-link"> · {r.copropriete_nom}</Link>
                            </li>
                          ))}
                          {u.roles.length > 4 ? <li className="text-soft">+{u.roles.length - 4}</li> : null}
                        </ul>
                      )}
                    </TD>
                    <TD>
                      <Badge variant={suspendu ? "danger" : u.statut_compte === "ACTIF" ? "ok" : "neutral"}>
                        {dict.enums.statutCompte?.[u.statut_compte as StatutCompte] ?? u.statut_compte}
                      </Badge>
                    </TD>
                    <TD className="text-[13px] text-soft">{formatDateCourte(u.cree_le, L)}</TD>
                    <TD align="end">
                      {modifiable ? (
                        <FormModal
                          label={suspendu ? c.reactiverCompte : c.suspendreCompte}
                          variant={suspendu ? "secondary" : "dangerGhost"}
                          title={suspendu ? c.reactiverCompte : c.suspendreCompte}
                          subtitle={`${nomComplet(u) ?? u.email ?? ""} — ${suspendu ? "" : c.suspendreCompteAide}`}
                          action={statutUtilisateurAction}
                          hidden={{ locale: L, utilisateur_id: u.id, statut_compte: suspendu ? "ACTIF" : "SUSPENDU", succes: suspendu ? c.compteReactive : c.compteSuspendu }}
                          submitLabel={c.confirmer}
                          submitVariant={suspendu ? "primary" : "danger"}
                          closeLabel={dict.common.close}
                        >
                          <Field label={c.motif} htmlFor={`mo_${u.id}`}>
                            <Input id={`mo_${u.id}`} name="motif" maxLength={500} />
                          </Field>
                        </FormModal>
                      ) : null}
                    </TD>
                  </TR>
                );
              })}
            </LiveList>
          </Table>
        </TableCard>
      )}
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-[13px] text-soft">
          {page > 1 ? <ButtonLink size="sm" variant="ghost" href={lien(page - 1)}>{c.precedent}</ButtonLink> : null}
          <span className="tnum">{page} / {pages}</span>
          {page < pages ? <ButtonLink size="sm" variant="ghost" href={lien(page + 1)}>{c.suivant}</ButtonLink> : null}
        </div>
      ) : null}
    </div>
  );
}
