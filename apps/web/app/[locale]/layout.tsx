import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { isLocale, dirFor } from "../../lib/i18n";
import "../globals.css";

// Inter (interface) + polices d'affiche — mêmes fichiers que l'app mobile (licences : fonts/LICENSES.md).
const inter = localFont({
  src: [
    { path: "../fonts/Inter-Regular.ttf", weight: "400" },
    { path: "../fonts/Inter-Medium.ttf", weight: "500" },
    { path: "../fonts/Inter-SemiBold.ttf", weight: "600" },
    { path: "../fonts/Inter-Bold.ttf", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});
const suDisplay = localFont({ src: "../fonts/ArchivoDisplay-Black.ttf", weight: "900", variable: "--font-su-display", display: "swap" });
const suDisplayAr = localFont({ src: "../fonts/NotoKufiArabic-ExtraBold.ttf", weight: "800", variable: "--font-su-display-ar", display: "swap" });
const suWordmark = localFont({ src: "../fonts/SuWordmark-Black.ttf", weight: "900", variable: "--font-su-wordmark", display: "swap" });

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
  themeColor: "#ffffff",
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
      className={`${inter.variable} ${suDisplay.variable} ${suDisplayAr.variable} ${suWordmark.variable} ${GeistMono.variable} ${notoArabic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
