/**
 * Routes toujours joignables par une résidence bloquée — de quoi afficher l'écran de suspension,
 * se déconnecter proprement et exporter ses données (CNDP). Rien qui lise des données de la résidence :
 * ni le widget, ni les activités en direct, ni les préférences.
 */
const ROUTES_LIBRES = [
  /^\/v1\/abonnement$/,
  /^\/v1\/users\/me$/,
  /^\/v1\/users\/me\/export$/,
  /^\/v1\/users\/me\/appareils$/,
  /^\/v1\/users\/me\/appareils\/(?!activite(\/|$))[^/]+$/,
  /^\/v1\/app\/version$/,
  /^\/v1\/auth(\/|$)/,
];

export function routeLibre(pathname: string): boolean {
  return ROUTES_LIBRES.some((re) => re.test(pathname));
}
