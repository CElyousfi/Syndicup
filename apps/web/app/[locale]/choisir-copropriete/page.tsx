import { redirect } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { apiFetch } from "../../../lib/api/client";
import { getDict, isLocale, type Locale } from "../../../lib/i18n";
import { choisirCopropriete, seDeconnecter } from "../../../lib/actions/session-actions";
import type { Copropriete, Profil } from "../../../lib/api/types";
import { Brand } from "../../../components/brand";
import { LocaleSwitch } from "../../../components/locale-switch";
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
  if (!me.ok || !copros.ok) redirect(`/${locale}/connexion`);

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
    <div className="flex min-h-screen flex-col bg-ground">
      <header className="flex h-20 items-center justify-between px-6 sm:px-10">
        <Brand />
        <Suspense>
          <LocaleSwitch locale={locale} />
        </Suspense>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 py-10">
        <div className="w-full max-w-lg animate-in-up">
          <div className="relative mb-8 hidden h-40 overflow-hidden rounded-card shadow-lift sm:block">
            <Image
              src="/images/residence-courtyard.jpg"
              alt=""
              fill
              sizes="512px"
              className="object-cover"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {dict.auth.chooseCoproTitle}
          </h1>
          <p className="mt-1 text-sm text-soft">{dict.auth.chooseCoproSubtitle}</p>

          <div className="mt-7 space-y-3">
            {accessibles.map((c) => (
              <form key={c.id} action={choisirCopropriete}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="copropriete_id" value={c.id} />
                <button
                  type="submit"
                  className="card group flex w-full items-center gap-4 p-5 text-start transition-all hover:-translate-y-0.5 hover:border-action/40 hover:shadow-float"
                >
                  <IconCircle tone="sage" size={48}>
                    <CBuilding width={24} height={24} />
                  </IconCircle>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {c.nom}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-soft">
                      {c.ville} · {(rolesParCopro.get(c.id) ?? []).join(", ")}
                    </span>
                  </span>
                  <IconChevronEnd className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                </button>
              </form>
            ))}
          </div>

          <form action={seDeconnecter} className="mt-8 text-center">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="text-[13px] font-medium text-soft hover:text-ink-strong">
              {dict.common.logout}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
