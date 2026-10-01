import { Suspense } from "react";
import Image from "next/image";
import { Brand } from "../../../components/brand";
import { LocaleSwitch } from "../../../components/locale-switch";
import { RevealText } from "../../../components/ui/reveal-text";
import { getDict, isLocale, type Locale } from "../../../lib/i18n";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const dict = getDict(locale);

  return (
    <div className="flex min-h-screen bg-ground">
      {/* Colonne formulaire */}
      <main className="flex flex-1 flex-col px-6 sm:px-10">
        <header className="flex h-20 items-center justify-between">
          <Brand />
          <Suspense>
            <LocaleSwitch locale={locale} />
          </Suspense>
        </header>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-in-up">{children}</div>
        </div>
        <footer className="pb-6 text-center text-[12px] text-faint">
          {dict.auth.securityNote}
        </footer>
      </main>

      {/* Panneau image — résidence, palette du produit */}
      <aside className="relative m-3 hidden w-[44%] overflow-hidden rounded-[28px] shadow-float lg:block">
        {/* Travelling arrière à l'ouverture, puis lente respiration de la photo. */}
        <div className="hero-zoom absolute inset-0">
          <div className="hero-drift absolute inset-0">
            <Image
              src="/images/residence-hero.jpg"
              alt=""
              fill
              priority
              sizes="44vw"
              className="object-cover"
            />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-12">
          <p className="max-w-md text-3xl font-semibold leading-snug tracking-tight text-white">
            <RevealText text={dict.brand.tagline} delayMs={350} />
          </p>
          <p className="hero-rise mt-4 max-w-md text-[15px] leading-relaxed text-white/75" style={{ animationDelay: "750ms" }}>
            {dict.brand.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {[dict.nav.appels, dict.nav.ag, dict.nav.incidents, dict.nav.documents].map((f, i) => (
              <span
                key={f}
                className="hero-rise rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[13px] text-white backdrop-blur-sm transition-colors duration-300 hover:bg-white/20"
                style={{ animationDelay: `${950 + i * 70}ms` }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
