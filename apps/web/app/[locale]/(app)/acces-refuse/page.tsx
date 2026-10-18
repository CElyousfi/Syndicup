import type { Metadata } from "next";
import { getAppContext } from "../../../../lib/app-context";
import { getDict, isLocale } from "../../../../lib/i18n";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { IconCircle, CShield } from "../../../../components/ui/color-icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").errors.forbidden.title };
}

/**
 * « Pas d'accès » (403) — dans la coque, calme : ce n'est pas une panne, c'est un droit. Le motif
 * `abonnement` (402) explique que l'abonnement de la copropriété est suspendu et renvoie vers le
 * syndic (seul interlocuteur du résident).
 */
export default async function AccesRefusePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ motif?: string }>;
}) {
  const { locale } = await params;
  const { motif } = await searchParams;
  const ctx = await getAppContext(locale);
  const f = ctx.dict.errors.forbidden;
  const abonnement = motif === "abonnement";
  return (
    <div className="page-root">
      <EmptyState
        className="mx-auto max-w-lg py-16"
        icon={
          <IconCircle tone="sand" size={72}>
            <CShield width={32} height={32} />
          </IconCircle>
        }
        title={abonnement ? f.abonnementTitre : f.title}
        hint={abonnement ? f.abonnementCorps : f.body}
        action={
          <ButtonLink href={`/${ctx.locale}/tableau-de-bord`} size="lg">
            {ctx.dict.errors.actions.backHome}
          </ButtonLink>
        }
      />
    </div>
  );
}
