import { redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { apiFetch } from "../../../lib/api/client";
import { getDict, isLocale, type Locale } from "../../../lib/i18n";
import { choisirCopropriete, seDeconnecter } from "../../../lib/actions/session-actions";
import type { Copropriete, Profil } from "../../../lib/api/types";
import { Brand } from "../../../components/brand";
import { LocaleSwitch } from "../../../components/locale-switch";
import { Button } from "../../../components/ui/button";
import { IconChevronEnd } from "../../../components/ui/icons";
import { IconCircle, CBuilding } from "../../../components/ui/color-icons";

export default async function ChoisirCoproPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const dict = getDict(locale);

  const [me, copros] = await Promise.all([
    apiFetch<Profil>("/users/me"),
    apiFetch<Copropriete[]>("/coproprietes"),
  ]);
  // Seul un vrai rejet d'authentification (401) justifie de renvoyer vers la connexion — une
  // panne transitoire de l'API (500, réseau…) ne doit jamais faire perdre la session à
  // quelqu'un qui est pourtant bien connecté (elle remonte à app/[locale]/error.tsx à la place).
  if (!me.ok && me.error.code === "UNAUTHENTICATED") redirect(`/${locale}/connexion`);
  if (!copros.ok && copros.error.code === "UNAUTHENTICATED") redirect(`/${locale}/connexion`);
  if (!me.ok) throw new Error(`Profil indisponible (${me.error.code} ${me.status}) : ${me.error.message}`);
  if (!copros.ok) throw new Error(`Copropriétés indisponibles (${copros.error.code} ${copros.status}) : ${copros.error.message}`);

  const rolesParCopro = new Map<string, string[]>();
  for (const r of (me.data.roles ?? []).filter((r) => r.actif)) {
    rolesParCopro.set(r.copropriete_id, [
      ...(rolesParCopro.get(r.copropriete_id) ?? []),
      dict.roles[r.role],
    ]);
  }
  const accessibles = copros.data.filter((c) => rolesParCopro.has(c.id));
  // NB : même avec une seule copropriété accessible, le choix reste un clic explicite —
  // la sélection pose un cookie, ce qu'un rendu de Server Component n'a pas le droit de
  // faire (cookies modifiables uniquement dans une Server Action / Route Handler).

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex h-[72px] items-center justify-between px-4 sm:h-20 sm:px-10">
        <Brand size={36} />
        <Suspense>
          <LocaleSwitch locale={locale} />
        </Suspense>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-lg animate-in-up">
          <div className="relative mb-8 hidden h-44 overflow-hidden rounded-[28px] bg-tile sm:block">
            <Image
              src="/images/residence-courtyard.jpg"
              alt=""
              fill
              sizes="512px"
              className="object-cover"
            />
          </div>
          <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">
            {dict.auth.chooseCoproTitle}
          </h1>
          <p className="mt-2 text-[15px] text-soft">{dict.auth.chooseCoproSubtitle}</p>

          {/* Liste Wise à plat : pastille, titre gras, sous-titre gris, chevron vert. */}
          <div className="-mx-3 mt-6 space-y-1">
            {accessibles.map((c) => (
              <form key={c.id} action={choisirCopropriete}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="copropriete_id" value={c.id} />
                <button
                  type="submit"
                  className="group flex w-full items-center gap-4 rounded-[20px] px-3 py-3 text-start transition-colors hover:bg-wash"
                >
                  <IconCircle tone="sage" size={48}>
                    <CBuilding width={24} height={24} />
                  </IconCircle>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold text-ink">
                      {c.nom}
                    </span>
                    <span className="mt-0.5 block text-[14px] text-soft">
                      {c.ville} · {(rolesParCopro.get(c.id) ?? []).join(", ")}
                    </span>
                  </span>
                  <IconChevronEnd className="shrink-0 text-link transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                </button>
              </form>
            ))}
          </div>

          <form action={seDeconnecter} className="mt-8 text-center">
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="ghost">
              {dict.common.logout}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
