import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { CoproForm } from "./copro-form";

export default async function NouvelleCoproPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);

  return (
    <div className="animate-fade">
      <PageHeader
        title={ctx.dict.admin.creer}
        back={<BackLink href={`/${locale}/admin`} label={ctx.dict.admin.titre} />}
      />
      <CoproForm dict={ctx.dict} locale={ctx.locale} />
    </div>
  );
}
