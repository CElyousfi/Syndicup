import { Suspense } from "react";
import Image from "next/image";
import { Brand } from "../../../components/brand";
import { LocaleSwitch } from "../../../components/locale-switch";
import { RevealText } from "../../../components/ui/reveal-text";
import { IconShield } from "../../../components/ui/icons";
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
    <div className="flex min-h-screen bg-surface">
      {/* Colonne formulaire — toile blanche (Wise) : marque en tête, pill de langue, contenu en colonne. */}
      <main className="flex min-w-0 flex-1 flex-col px-4 sm:px-10">
        <header className="flex h-[72px] items-center justify-between sm:h-20">
          <Brand size={36} />
          <Suspense>
            <LocaleSwitch locale={locale} />
          </Suspense>
        </header>
        <div className="flex flex-1 items-center justify-center py-8 sm:py-10">
          <div className="w-full max-w-[400px] animate-in-up">{children}</div>
        </div>
        <footer className="flex items-center justify-center gap-1.5 pb-6 text-center text-[12px] text-faint">
          <IconShield width={14} height={14} className="shrink-0" />
          <span>{dict.auth.securityNote}</span>
        </footer>
      </main>

      {/* Panneau de marque — illustration 2D de la résidence-logo sur tuile greige, titre-affiche
          vert (moment de marque, mêmes visuels que l'app mobile). À plat, sans ombre. */}
      <aside className="relative m-3 hidden w-[44%] flex-col overflow-hidden rounded-[28px] bg-tile lg:flex">
        <div className="hero-zoom flex flex-1 items-center justify-center px-10 pt-10">
          <Image
            src="/illustrations/welcome-hero.png"
            alt=""
            width={1024}
            height={1024}
            priority
            sizes="40vw"
            className="h-auto w-full max-w-[460px] object-contain"
          />
        </div>
        <div className="px-10 pb-10 xl:px-12 xl:pb-12">
          <p className="font-poster max-w-lg text-[44px] text-brand xl:text-[56px] [:root[lang=ar]_&]:text-[36px] xl:[:root[lang=ar]_&]:text-[44px]">
            <RevealText text={dict.brand.tagline} delayMs={350} />
          </p>
          <p className="hero-rise mt-5 max-w-md text-[16px] leading-relaxed text-body" style={{ animationDelay: "750ms" }}>
            {dict.brand.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {[dict.nav.appels, dict.nav.ag, dict.nav.incidents, dict.nav.documents].map((f, i) => (
              <span
                key={f}
                className="hero-rise rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-ink"
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
