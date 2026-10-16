/** Routes toujours joignables par une résidence bloquée — de quoi afficher l'écran de suspension. */
const ROUTES_LIBRES = [/^\/v1\/abonnement(\/|$)/, /^\/v1\/users\/me(\/|$)/, /^\/v1\/app\/version(\/|$)/, /^\/v1\/auth(\/|$)/];

export function routeLibre(pathname: string): boolean {
  return ROUTES_LIBRES.some((re) => re.test(pathname));
}
