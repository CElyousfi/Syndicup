import { seDeconnecter } from "../lib/actions/session-actions";
import type { Locale } from "../lib/i18n";
import { Button } from "./ui/button";

/** Écran pleine page d'état de compte bloquant (A5) : suspendu, en validation… */
export function EtatCompte({
  icone,
  titre,
  corps,
  locale,
  deconnexion,
}: {
  icone: React.ReactNode;
  titre: string;
  corps: string;
  locale: Locale;
  deconnexion: string;
}) {
  return (
    <div className="card px-6 py-12 text-center sm:px-10">
      <div className="flex justify-center">{icone}</div>
      <h1 className="mt-6 text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">{titre}</h1>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-soft">{corps}</p>
      <form action={seDeconnecter} className="mt-7">
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit" variant="secondary">
          {deconnexion}
        </Button>
      </form>
    </div>
  );
}
