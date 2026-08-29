import type { MetadataRoute } from "next";

/**
 * Manifeste PWA — « Ajouter à l'écran d'accueil » donne à SyndicUp une icône, un écran
 * de démarrage et une fenêtre sans barre d'adresse : l'application mobile, sans store.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SyndicUp",
    short_name: "SyndicUp",
    description: "Gestion de copropriété — charges, assemblées, incidents, documents.",
    start_url: "/fr/tableau-de-bord",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ecebe4",
    theme_color: "#ecebe4",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
