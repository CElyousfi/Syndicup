import { getAppContext } from "../../../lib/app-context";
import { apiFetch } from "../../../lib/api/client";
import { buildNav, buildMobileTabs } from "../../../components/shell/nav";
import { AppFrame } from "../../../components/shell/app-frame";
import { nomComplet } from "../../../lib/format";
import type { Notification } from "../../../lib/api/types";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [ctx, notifs] = await Promise.all([
    getAppContext(locale),
    apiFetch<Notification[]>("/notifications"),
  ]);
  const { dict } = ctx;
  const unread = notifs.ok ? notifs.data.filter((n) => !n.lu).length : 0;

  const coproIds = new Set(
    (ctx.profil.roles ?? []).filter((r) => r.actif).map((r) => r.copropriete_id)
  );

  const nav = buildNav(ctx.role, dict, ctx.locale);

  return (
    <AppFrame
      locale={ctx.locale}
      nav={nav}
      tabs={buildMobileTabs(nav, ctx.role, dict)}
      // Opérateur plateforme : pas de « copropriété courante » affichée — sa console
      // n'est pas l'espace d'une résidence (sa copropriété d'ancrage reste interne).
      coproId={ctx.role === "SUPER_ADMIN" ? null : (ctx.copropriete?.id ?? null)}
      coproNom={ctx.role === "SUPER_ADMIN" ? null : (ctx.copropriete?.nom ?? null)}
      coproLogo={ctx.role === "SUPER_ADMIN" ? null : (ctx.copropriete?.logoStoragePath ?? null)}
      coproVille={ctx.role === "SUPER_ADMIN" ? null : (ctx.copropriete?.ville ?? null)}
      multiCopro={ctx.role !== "SUPER_ADMIN" && coproIds.size > 1}
      userNom={nomComplet(ctx.profil) ?? ctx.profil.email ?? "—"}
      userRole={dict.roles[ctx.role]}
      unreadCount={unread}
      labels={{
        logout: dict.common.logout,
        profil: dict.nav.profil,
        donnees: dict.profil.donnees,
        notifications: dict.nav.notifications,
        switchCopro: dict.a11y.switchCopro,
        openMenu: dict.a11y.openMenu,
        closeMenu: dict.a11y.closeMenu,
        search: dict.common.search,
        plus: dict.nav.plus,
        menu: dict.nav.menu,
      }}
      tour={dict.onboarding}
    >
      {children}
    </AppFrame>
  );
}
