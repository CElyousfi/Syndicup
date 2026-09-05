import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { MembreCopropriete, RoleType } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDate, formatTelephone, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { Avatar } from "../../../../components/ui/avatar";
import { Input, Select } from "../../../../components/ui/field";
import { IconCircle, CUsers, CHome, CKey, CShield } from "../../../../components/ui/color-icons";
import { IconSearch } from "../../../../components/ui/icons";
import { compteVariant } from "../../../../lib/status";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getDict(locale).nav.membres : "Membres" };
}

const ROLES_FILTRE: RoleType[] = [
  "PROPRIETAIRE",
  "INDIVISAIRE",
  "PERSONNE_MORALE_REPRESENTANT",
  "LOCATAIRE",
  "GESTIONNAIRE_LCD",
  "CONSEIL_SYNDICAL",
  "GARDIEN",
  "PRESTATAIRE",
  "SYNDIC",
];

/**
 * Annuaire des membres — la vue de celui qui invite : qui est rattaché à la résidence, avec
 * quel rôle, sur quels lots, joignable comment, et où en est son compte. Recherche et filtre
 * par rôle côté serveur (GET), zéro état client.
 */
export default async function MembresPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const m = dict.membres;
  const p = (path: string) => `/${ctx.locale}${path}`;

  const res = await apiFetch<MembreCopropriete[]>("/users");
  const tous = res.ok ? res.data : [];

  const q = (sp.q ?? "").trim().toLowerCase();
  const roleFiltre = ROLES_FILTRE.includes(sp.role as RoleType) ? (sp.role as RoleType) : "";
  const membres = tous
    .filter((u) => !roleFiltre || u.roles.some((r) => r.role === roleFiltre && r.actif))
    .filter((u) => {
      if (!q) return true;
      const corpus = [
        nomComplet(u) ?? "",
        u.email ?? "",
        u.telephone ?? "",
        u.raison_sociale ?? "",
        ...u.lots.map((l) => l.numero),
        ...u.roles.map((r) => dict.roles[r.role]),
      ]
        .join(" ")
        .toLowerCase();
      return corpus.includes(q);
    })
    .sort((a, b) => (nomComplet(a) ?? "").localeCompare(nomComplet(b) ?? ""));

  const compte = (role: RoleType) => tous.filter((u) => u.roles.some((r) => r.role === role && r.actif)).length;
  const residents =
    compte("PROPRIETAIRE") + compte("INDIVISAIRE") + compte("PERSONNE_MORALE_REPRESENTANT") + compte("LOCATAIRE");
  const actifs = tous.filter((u) => u.statut_compte === "ACTIF").length;

  return (
    <div className="animate-fade">
      <PageHeader
        title={m.annuaire}
        subtitle={m.annuaireSubtitle}
        actions={
          <ButtonLink href={p("/invitations")} variant="primary">
            {m.inviter}
          </ButtonLink>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<CUsers />} tone="sage" label={dict.nav.membres} value={tous.length} />
        <StatCard icon={<CHome />} tone="sand" label={dict.roles.PROPRIETAIRE + " · " + dict.roles.LOCATAIRE} value={residents} />
        <StatCard icon={<CShield />} tone="lilac" label={dict.enums.statutCompte.ACTIF} value={actifs} trend={tous.length ? `${Math.round((actifs / tous.length) * 100)}%` : undefined} trendTone="neutral" />
        <StatCard icon={<CKey />} tone="tosca" label={dict.enums.statutCompte.INVITE} value={tous.filter((u) => u.statut_compte === "INVITE" || u.statut_compte === "EN_VALIDATION").length} />
      </div>

      <form className="filters mb-4 flex flex-wrap items-center gap-2" method="GET">
        <div className="relative">
          <IconSearch width={15} height={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder={m.rechercher} className="h-10 w-72 ps-9" />
        </div>
        <Select name="role" defaultValue={roleFiltre} className="h-10 w-56">
          <option value="">{m.tousRoles}</option>
          {ROLES_FILTRE.map((r) => (
            <option key={r} value={r}>
              {dict.roles[r]}
            </option>
          ))}
        </Select>
        <button type="submit" className="inline-flex h-10 items-center rounded-btn border border-hairline-strong bg-surface px-4 text-sm font-medium text-ink-strong hover:bg-hover">
          {dict.common.filter}
        </button>
      </form>

      {membres.length === 0 ? (
        <EmptyState
          title={m.aucun}
          hint={tous.length === 0 ? m.aucunAide : undefined}
          icon={
            <IconCircle tone="sage" size={64}>
              <CUsers width={30} height={30} />
            </IconCircle>
          }
          action={
            tous.length === 0 ? (
              <ButtonLink href={p("/invitations")} variant="primary">
                {m.inviter}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <TH>{m.colMembre}</TH>
              <TH>{m.colRoles}</TH>
              <TH>{m.colLots}</TH>
              <TH>{m.colContact}</TH>
              <TH>{m.colCompte}</TH>
              <TH>{m.colDepuis}</TH>
              <TH align="end">{dict.common.actions}</TH>
            </THead>
            <tbody>
              {membres.map((u) => {
                const nom = nomComplet(u) ?? u.raison_sociale ?? u.email ?? u.id.slice(0, 8);
                return (
                  <TR key={u.id}>
                    <TD>
                      <Link href={p(`/membres/${u.id}`)} className="inline-flex items-center gap-3">
                        <Avatar nom={nom} size={36} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink">{nom}</span>
                          {u.raison_sociale && nomComplet(u) ? (
                            <span className="block truncate text-[12px] text-soft">{u.raison_sociale}</span>
                          ) : null}
                        </span>
                      </Link>
                    </TD>
                    <TD>
                      <span className="inline-flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={`${r.role}-${r.depuis}`} variant={r.actif ? "outline" : "neutral"}>
                            {dict.roles[r.role]}
                            {r.actif ? "" : ` · ${m.roleInactif}`}
                          </Badge>
                        ))}
                      </span>
                    </TD>
                    <TD>
                      {u.lots.length === 0 ? (
                        <span className="text-[13px] text-faint">{m.sansLot}</span>
                      ) : (
                        <span className="inline-flex flex-wrap gap-1">
                          {u.lots.map((l) => (
                            <Link
                              key={`${l.id}-${l.lien}`}
                              href={p(`/lots/${l.id}`)}
                              title={l.lien === "PROPRIETAIRE" ? m.proprietaireDe : m.occupantDe}
                              className={`inline-flex h-6 items-center rounded-full px-2 text-[12px] font-semibold ${
                                l.lien === "PROPRIETAIRE" ? "bg-sand-tint text-sand" : "bg-tosca-tint text-tosca-deep"
                              }`}
                            >
                              {l.numero}
                            </Link>
                          ))}
                        </span>
                      )}
                    </TD>
                    <TD>
                      <span className="block text-[13px] text-body">
                        {u.email ? (
                          <a href={`mailto:${u.email}`} className="hover:text-action">
                            {u.email}
                          </a>
                        ) : (
                          dict.common.none
                        )}
                      </span>
                      {u.telephone ? (
                        <a href={`tel:${u.telephone}`} dir="ltr" className="block text-[13px] text-soft hover:text-action">
                          {formatTelephone(u.telephone)}
                        </a>
                      ) : null}
                    </TD>
                    <TD>
                      <Badge variant={compteVariant[u.statut_compte]}>{dict.enums.statutCompte[u.statut_compte]}</Badge>
                    </TD>
                    <TD className="text-[13px] text-soft">{formatDate(u.membre_depuis, ctx.locale)}</TD>
                    <TD align="end">
                      <ButtonLink href={p(`/membres/${u.id}`)} variant="secondary" size="sm">
                        {m.voirFiche}
                      </ButtonLink>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
