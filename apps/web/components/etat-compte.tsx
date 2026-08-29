import { seDeconnecter } from "../lib/actions/session-actions";
import type { Locale } from "../lib/i18n";

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
    <div className="card px-6 py-10 text-center">
      <div className="flex justify-center">{icone}</div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">{titre}</h1>
      <p className="mt-2 text-sm leading-relaxed text-soft">{corps}</p>
      <form action={seDeconnecter} className="mt-7">
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-btn border border-hairline-strong bg-surface px-5 text-sm font-medium text-ink-strong transition-colors hover:bg-hover"
        >
          {deconnexion}
        </button>
      </form>
    </div>
  );
}
