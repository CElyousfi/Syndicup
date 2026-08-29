import { getDict } from "../../lib/i18n";
import { ButtonLink } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";

/** 404 localisée (A5). La locale exacte n'est pas disponible ici : FR par défaut, texte court. */
export default function NotFound() {
  const dict = getDict("fr");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ground px-6">
      <div className="w-full max-w-md animate-in-up">
        <p className="tnum mb-6 text-center text-[64px] font-semibold leading-none tracking-tight text-hairline-strong">
          404
        </p>
        <EmptyState
          title={dict.common.notFoundTitle}
          hint={dict.common.notFoundBody}
          action={<ButtonLink href="/">{dict.common.backHome}</ButtonLink>}
        />
      </div>
    </div>
  );
}
