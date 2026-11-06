# Traduire SyndicUp

SyndicUp est un logiciel de syndic de copropriété pour le Maroc : application web + mobile (iOS/Android) pour les syndics (bénévoles ou cabinets professionnels), les copropriétaires, les locataires, le conseil syndical et le personnel (gardiens, sécurité, ménage). On y gère les charges et appels de fonds, les paiements, les dépenses justifiées, la comptabilité réglementaire (Décret 2.23.700, loi 18-00), les assemblées générales (convocation, votes, procurations, procès-verbal), les incidents, les visiteurs à la porte, les réservations d'espaces communs, les parkings, la location courte durée, le personnel et la paie, les documents, les annonces. Dari est la mascotte et l'assistant IA de l'app. Ton : professionnel, calme, clair, rassurant ; langage courant, jamais de jargon technique ; rigueur sur les mentions légales et financières.

## Entrée
`scripts/i18n/work/source.json` : une liste de `{id, fr, ar, k}`. `fr` est le texte source (français, langue de référence). `ar` est la traduction arabe existante (seulement pour lever un doute de sens). `k` est une clé où le texte est utilisé (contexte : `web:nav.lots` = menu, `web:errors.codes.X.body` = message d'erreur, `mobile:…` = app mobile, `…enums.statutX.CODE` = libellé d'un statut, etc.).

## Sortie
Des objets JSON id → traduction, en **fichiers de parties** :
`scripts/i18n/work/out/<LANGUE>.part<N>.json` — 300 ids par partie, dans l'ordre des ids : part1 = ids 0–299, part2 = 300–599, part3 = 600–899… part10 = 2700–2999 (la dernière s'arrête au dernier id).
Puis lancer `python3 scripts/i18n/merge.py <LANGUE> <premier id> <dernier id>` (votre plage). Corrigez chaque problème signalé et relancez jusqu'à `0 problèmes`. Ne terminez que lorsque c'est le cas.

## Règles
- Chaque id de votre plage doit être traduit (aucune chaîne vide, pas de français restant sauf noms propres et sigles ci-dessous).
- Gardez les variables exactement : `{nom}`, `{n}`, `{montant}`, `{date}`… mêmes noms, même nombre ; ne traduisez jamais le texte entre accolades ; vous pouvez les déplacer dans la phrase.
- Gardez les symboles (· — → ← ✓ • %), les `**`, les retours à la ligne, les emoji.
- Ne traduisez jamais : SyndicUp, Dari, MAD, DH, CNDP, CNSS, AMO, ICE, RC, IF, RIB, CIN, TVA→ traduisez « TVA » par le sigle courant de votre langue (VAT, IVA, MwSt…), « Décret 2.23.700 », « loi 18-00 », « loi 106-12 », noms de villes, formats de fichiers (PDF, CSV, JPEG…).
- Nombres toujours en chiffres. Libellés en MAJUSCULES restent en majuscules (si l'écriture a une casse).
- Concision : ce sont des boutons, menus, titres et messages d'interface. Une traduction ne doit pas être beaucoup plus longue que le français ; les libellés courts (1–3 mots) restent courts.
- Registre poli et constant, comme le « vous » français : anglais neutre et professionnel ; espagnol « usted » ; italien « Lei » ; allemand « Sie » ; néerlandais « u » ; portugais européen (pt-PT), registre formel ; russe « вы » ; turc « siz » ; chinois simplifié avec « 您 ».
- Termes métier : utilisez le vocabulaire juridique normal de la copropriété dans votre langue, et le même terme partout. Repères (anglais) : copropriété = co-ownership / residence ; syndic = property manager (syndic) ; syndic bénévole = volunteer property manager ; cabinet de syndic = property management firm ; copropriétaire = co-owner ; conseil syndical = owners' council ; assemblée générale (AG) = general meeting (GM) ; appel de fonds = funds call ; charges = service charges ; tantièmes = shares (tantièmes) ; lot = unit ; partie commune = common area ; fonds de réserve = reserve fund ; procès-verbal = minutes ; convocation = notice of meeting ; procuration = proxy ; quittance = receipt ; justificatif = supporting document ; gardien = caretaker ; prestataire = contractor ; location courte durée = short-term rental. Exemples d'autres langues : es comunidad de propietarios / administrador de fincas / junta general / derrama ; de Eigentümergemeinschaft / Verwalter / Eigentümerversammlung / Hausgeld ; it condominio / amministratore / assemblea condominiale / millesimi.
- Les messages d'erreur rassurent sans dramatiser ; les mentions légales restent exactes et ne promettent rien de plus que le français.
- Les clés `…enums…` sont des libellés de statut/catégorie : courts, au même format que le français (nom ou participe).
