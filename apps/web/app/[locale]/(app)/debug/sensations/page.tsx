import { notFound } from "next/navigation";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { PageHeader } from "../../../../../components/page-header";
import { SensationsTest } from "./sensations-test";

/** Écran de test des sensations — développement, ou SENSATIONS_TEST=true (revue sur téléphone). */
export default async function SensationsTestPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.SENSATIONS_TEST !== "true") notFound();
  const { locale } = await params;
  const dict = getDict(isLocale(locale) ? locale : "fr");
  return (
    <div className="page-root">
      <PageHeader title={dict.alive.test} subtitle={dict.alive.testAide} />
      <SensationsTest dict={dict} />
    </div>
  );
}
