import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { CCalendar, IconCircle } from "../../../../../components/ui/color-icons";
import { AgForm } from "./ag-form";

export default async function NouvelleAgPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);

  return (
    <div className="animate-fade">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <IconCircle tone="tosca" size={44}>
              <CCalendar />
            </IconCircle>
            {ctx.dict.ag.nouvelleTitre}
          </span>
        }
        back={<BackLink href={`/${locale}/ag`} label={ctx.dict.nav.ag} />}
      />
      <AgForm dict={ctx.dict} locale={ctx.locale} />
    </div>
  );
}
