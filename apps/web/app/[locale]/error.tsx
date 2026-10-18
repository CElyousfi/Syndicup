"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

/**
 * Erreur hors de l'espace connecté (pages publiques, sélection de copropriété, coque qui n'a pas
 * pu se construire) — plein écran, localisée d'après l'URL, référence (digest) discrète.
 * L'écran est chargé À LA DEMANDE : cette frontière enveloppe les pages de connexion, dont le
 * poids JS ne doit pas grossir (décision D5) — rien n'est téléchargé tant que rien n'échoue.
 */
const ErrorScreen = dynamic(() => import("../../components/ui/error-screen").then((m) => m.ErrorScreen), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-surface" />,
});

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  return <ErrorScreen error={error} reset={reset} locale={params?.locale === "ar" ? "ar" : "fr"} fullScreen />;
}
