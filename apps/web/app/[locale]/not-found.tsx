import { getDict } from "../../lib/i18n";
import { ButtonLink } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";

/** 404 localisée (A5). La locale exacte n'est pas disponible ici : FR par défaut, texte court. */
export default function NotFound() {
  const dict = getDict("fr");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md animate-in-up">
        <p className="font-poster tnum text-center text-[88px] text-brand">404</p>
        <EmptyState
          title={dict.common.notFoundTitle}
          hint={dict.common.notFoundBody}
          illustration="empty-search"
          action={<ButtonLink href="/" size="lg">{dict.common.backHome}</ButtonLink>}
        />
      </div>
    </div>
  );
}
