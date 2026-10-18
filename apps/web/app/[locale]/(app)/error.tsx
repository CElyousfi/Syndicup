"use client";

import { useParams } from "next/navigation";
import { ErrorScreen } from "../../../components/ui/error-screen";

/**
 * Frontière d'erreur de l'espace connecté : rendue DANS la coque (navigation, cloche, Dari
 * restent là — l'utilisateur n'est jamais éjecté), localisée d'après l'URL. « Réessayer »
 * relit la page ; « Retour à l'accueil » ; référence (digest) copiable pour le support.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  return <ErrorScreen error={error} reset={reset} locale={params?.locale === "ar" ? "ar" : "fr"} />;
}
