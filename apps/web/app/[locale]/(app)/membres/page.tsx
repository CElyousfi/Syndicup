import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { MembreCopropriete, RoleType } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDate, formatTelephone, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Button, ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { Avatar } from "../../../../components/ui/avatar";
import { Input, Select } from "../../../../components/ui/field";
import { IconCircle, CUsers, CHome, CKey, CShield } from "../../../../components/ui/color-icons";
import { IconChevronEnd, IconSearch } from "../../../../components/ui/icons";
import { compteVariant } from "../../../../lib/status";
import { LiveList } from "../../../../components/ui/live-list";

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
    <div className="page-root">
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
          <Input name="q" defaultValue={sp.q ?? ""} placeholder={m.rechercher} className="h-10 w-72 max-w-full ps-9" />
        </div>
        <Select name="role" defaultValue={roleFiltre} className="h-10 w-56">
          <option value="">{m.tousRoles}</option>
          {ROLES_FILTRE.map((r) => (
            <option key={r} value={r}>
              {dict.roles[r]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          {dict.common.filter}
        </Button>
      </form>

      {membres.length === 0 ? (
        <EmptyState
          title={m.aucun}
          hint={tous.length === 0 ? m.aucunAide : undefined}
          illustration={tous.length > 0 ? "empty-search" : undefined}
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
        <LiveList as="ul" className="stagger-grid -mx-3">
          {membres.map((u) => {
            const nom = nomComplet(u) ?? u.raison_sociale ?? u.email ?? u.id.slice(0, 8);
            const fiche = p(`/membres/${u.id}`);
            return (
              <li key={u.id} className="flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-wash">
                <Link href={fiche} tabIndex={-1} aria-hidden className="shrink-0 self-start sm:self-center">
                  <Avatar nom={nom} size={44} />
                </Link>
                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                  <div className="min-w-0 sm:flex-1">
                    <Link href={fiche} className="block truncate text-[15px] font-bold text-ink hover:text-link">
                      {nom}
                    </Link>
                    <p className="truncate text-[13px] text-soft">
                      {u.raison_sociale && nomComplet(u) ? <span>{u.raison_sociale} · </span> : null}
                      {u.email ? (
                        <a href={`mailto:${u.email}`} className="hover:text-link">
                          {u.email}
                        </a>
                      ) : null}
                      {u.email && u.telephone ? " · " : null}
                      {u.telephone ? (
                        <a href={`tel:${u.telephone}`} dir="ltr" className="hover:text-link">
                          {formatTelephone(u.telephone)}
                        </a>
                      ) : null}
                      {!u.email && !u.telephone ? dict.common.none : null}
                    </p>
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:mt-0 sm:justify-end">
                    {u.roles.map((r) => (
                      <Badge key={`${r.role}-${r.depuis}`} variant={r.actif ? "neutral" : "outline"}>
                        {dict.roles[r.role]}
                        {r.actif ? "" : ` · ${m.roleInactif}`}
                      </Badge>
                    ))}
                    {u.lots.map((l) => (
                      <Link
                        key={`${l.id}-${l.lien}`}
                        href={p(`/lots/${l.id}`)}
                        title={l.lien === "PROPRIETAIRE" ? m.proprietaireDe : m.occupantDe}
                        className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold ${
                          l.lien === "PROPRIETAIRE" ? "bg-sand-tint text-sand" : "bg-tosca-tint text-tosca-deep"
                        }`}
                      >
                        {l.numero}
                      </Link>
                    ))}
                    {u.lots.length === 0 ? <span className="text-[12px] text-faint">{m.sansLot}</span> : null}
                    <span className="hidden text-[12px] text-soft tnum lg:ms-2 lg:inline" title={m.colDepuis}>
                      {formatDate(u.membre_depuis, ctx.locale)}
                    </span>
                    <Badge variant={compteVariant[u.statut_compte]}>{dict.enums.statutCompte[u.statut_compte]}</Badge>
                  </div>
                </div>
                <Link
                  href={fiche}
                  aria-label={m.voirFiche}
                  title={m.voirFiche}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-link transition-colors hover:bg-wash"
                >
                  <IconChevronEnd width={18} height={18} className="icon-flip" />
                </Link>
              </li>
            );
          })}
        </LiveList>
      )}
    </div>
  );
}
