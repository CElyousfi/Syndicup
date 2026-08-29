import type { Metadata } from "next";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Notification } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDateHeure } from "../../../../lib/format";
import { lienNotification } from "../../../../lib/notifications-link";
import { PageHeader } from "../../../../components/page-header";
import { EmptyState } from "../../../../components/ui/empty-state";
import { IconBell } from "../../../../components/ui/icons";
import { NotificationsList } from "./notifications-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.notifications };
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const n = dict.notifs;

  const res = await apiFetch<Notification[]>("/notifications");
  const notifications = res.ok ? res.data : [];
  const nonLues = notifications.filter((x) => !x.lu).length;

  const items = notifications.map((notif) => ({
    id: notif.id,
    titre: notif.rendu?.titre ?? notif.templateCode,
    corps: notif.rendu?.corps ?? null,
    lu: notif.lu,
    href: lienNotification(notif.templateCode, notif.contenuJson, ctx.locale),
    date: formatDateHeure(notif.horodatageEnvoi, ctx.locale),
    canal:
      notif.canal !== "IN_APP"
        ? `${(dict.enums.canal as Record<string, string>)[notif.canal] ?? notif.canal}${
            notif.statutEnvoi === "EN_ATTENTE" ? ` · ${dict.enums.statutEnvoi.EN_ATTENTE}` : ""
          }`
        : null,
  }));

  return (
    <div className="animate-fade">
      <PageHeader
        title={n.titre}
        subtitle={nonLues > 0 ? fill(n.nonLues, { n: nonLues }) : n.toutesLues}
      />

      {items.length === 0 ? (
        <EmptyState title={n.aucune} hint={n.aucuneAide} icon={<IconBell width={44} height={44} />} />
      ) : (
        <NotificationsList items={items} marquerLuLabel={n.marquerLu} />
      )}
    </div>
  );
}
