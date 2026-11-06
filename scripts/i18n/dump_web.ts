/* Écrit sur stdout les dictionnaires web FR et AR (apps/web/lib/i18n/{fr,ar}.ts) en JSON. */
import { fr } from "../../apps/web/lib/i18n/fr";
import { ar } from "../../apps/web/lib/i18n/ar";
process.stdout.write(JSON.stringify({ fr, ar }));
