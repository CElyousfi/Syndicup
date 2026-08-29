import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { isLocale, dirFor } from "../../lib/i18n";
import "../globals.css";

const notoArabic = localFont({
  src: "../fonts/noto-sans-arabic-var.woff2",
  weight: "400 700",
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SyndicUp",
    template: "%s · SyndicUp",
  },
  description:
    "Gestion de copropriété au Maroc — charges, assemblées générales, incidents, documents.",
  manifest: "/manifest.webmanifest",
  applicationName: "SyndicUp",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SyndicUp" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Écran bord à bord : les barres du shell mobile gèrent elles-mêmes les zones sûres (encoche, geste).
  viewportFit: "cover",
  themeColor: "#ecebe4",
};

// Tout le rendu dépend de la session (cookies httpOnly) et de données API fraîches :
// jamais de pré-rendu statique — un shell figé servirait le même état à tous.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      className={`${GeistSans.variable} ${GeistMono.variable} ${notoArabic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
