"use client";

import { useParams } from "next/navigation";
import { ErrorScreen } from "../../components/ui/error-screen";

/**
 * Erreur hors de l'espace connecté (pages publiques, sélection de copropriété, coque qui n'a pas
 * pu se construire) — plein écran, localisée d'après l'URL, référence (digest) discrète.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  return <ErrorScreen error={error} reset={reset} locale={params?.locale === "ar" ? "ar" : "fr"} fullScreen />;
}
