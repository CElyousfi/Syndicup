# ALIVE — rapport de couverture

_Généré par `node scripts/alive/check-alive.mjs --report` — ne pas modifier à la main._

Chaque cellule : ✅ n = n usages de primitives vivantes, aucun brut ; ❌ r / n = r usages bruts
sur n. `·` = élément absent de l'écran. Les exceptions motivées (`alive:allow`) ne comptent pas
comme brutes et sont listées en fin de rapport.

## Mobile (Flutter) — 100 % (1095 vivants, 0 bruts, 36 fichiers d'écran)

| Élément | Vivants | Bruts | Couverture |
|---|---:|---:|---:|
| Surfaces pressables | 181 | 0 | 100 % |
| Boutons | 174 | 0 | 100 % |
| Montants & nombres | 98 | 0 | 100 % |
| Champs | 157 | 0 | 100 % |
| Interrupteurs, cases, segments | 51 | 0 | 100 % |
| Images | 10 | 0 | 100 % |
| Chargement & progression | 105 | 0 | 100 % |
| Feuilles, dialogues, toasts | 220 | 0 | 100 % |
| Tirer pour actualiser | 89 | 0 | 100 % |
| Haptique & sons | 10 | 0 | 100 % |

| Écran (fichier) | Surfaces pressables | Boutons | Montants & nombres | Champs | Interrupteurs, cases, segments | Images | Chargement & progression | Feuilles, dialogues, toasts | Tirer pour actualiser | Haptique & sons |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `admin/admin_screens.dart` | ✅ 3 | ✅ 5 | ✅ 7 | ✅ 5 | · | · | ✅ 2 | ✅ 2 | ✅ 3 | · |
| `ag/ag_screens.dart` | ✅ 8 | ✅ 10 | · | ✅ 7 | ✅ 1 | ✅ 1 | ✅ 6 | ✅ 11 | ✅ 2 | · |
| `ag/ag_seance_screen.dart` | ✅ 3 | ✅ 5 | · | ✅ 1 | · | · | ✅ 1 | ✅ 5 | · | · |
| `auth/invitation_screens.dart` | ✅ 3 | ✅ 13 | · | ✅ 5 | ✅ 1 | · | ✅ 2 | ✅ 1 | · | · |
| `auth/login_screen.dart` | ✅ 1 | ✅ 7 | · | ✅ 3 | ✅ 1 | · | · | · | · | ✅ 2 |
| `auth/welcome_screen.dart` | ✅ 2 | ✅ 2 | · | · | · | ✅ 1 | · | · | · | · |
| `cabinet/cabinet_screens.dart` | ✅ 2 | · | ✅ 2 | · | ✅ 1 | · | ✅ 5 | · | ✅ 6 | · |
| `communication/communication_screens.dart` | ✅ 9 | ✅ 14 | · | ✅ 12 | ✅ 11 | · | ✅ 6 | ✅ 20 | ✅ 3 | · |
| `contrats/contrats_screens.dart` | ✅ 6 | · | ✅ 8 | · | ✅ 1 | · | ✅ 2 | · | ✅ 2 | · |
| `dashboard/dashboard_screen.dart` | ✅ 11 | ✅ 1 | ✅ 18 | · | · | ✅ 2 | ✅ 3 | · | ✅ 8 | · |
| `depenses/depenses_screens.dart` | ✅ 6 | ✅ 9 | ✅ 11 | ✅ 4 | ✅ 2 | · | ✅ 2 | ✅ 12 | ✅ 2 | · |
| `documents/document_viewer_screen.dart` | ✅ 2 | ✅ 1 | · | · | · | · | ✅ 2 | ✅ 2 | · | · |
| `documents/documents_screen.dart` | ✅ 3 | ✅ 2 | · | ✅ 3 | · | ✅ 1 | ✅ 1 | ✅ 5 | ✅ 1 | · |
| `espaces/espaces_screens.dart` | ✅ 2 | ✅ 5 | · | ✅ 6 | ✅ 2 | ✅ 1 | ✅ 3 | ✅ 11 | ✅ 6 | · |
| `finances/finances_screens.dart` | ✅ 10 | ✅ 6 | ✅ 15 | ✅ 13 | ✅ 4 | · | ✅ 7 | ✅ 11 | ✅ 9 | · |
| `incidents/incidents_screens.dart` | ✅ 9 | ✅ 7 | · | ✅ 12 | ✅ 2 | · | ✅ 3 | ✅ 10 | ✅ 5 | · |
| `invitations/invitations_screen.dart` | ✅ 1 | ✅ 6 | · | ✅ 3 | · | · | ✅ 1 | ✅ 9 | ✅ 1 | · |
| `justificatifs/justificatifs_screens.dart` | ✅ 5 | ✅ 7 | ✅ 4 | ✅ 6 | ✅ 2 | · | ✅ 4 | ✅ 11 | ✅ 4 | · |
| `lcd/lcd_screens.dart` | ✅ 3 | ✅ 16 | ✅ 2 | ✅ 17 | ✅ 5 | · | ✅ 8 | ✅ 13 | ✅ 4 | · |
| `lcd/lcd_sejour_screens.dart` | ✅ 10 | ✅ 10 | · | ✅ 10 | · | · | ✅ 3 | ✅ 18 | ✅ 1 | · |
| `litiges/litiges_screen.dart` | ✅ 2 | ✅ 3 | · | ✅ 4 | ✅ 1 | · | ✅ 1 | ✅ 9 | ✅ 1 | · |
| `lots/lots_screens.dart` | ✅ 12 | ✅ 9 | ✅ 4 | ✅ 14 | ✅ 6 | ✅ 1 | ✅ 9 | ✅ 13 | ✅ 4 | · |
| `membres/membres_screens.dart` | ✅ 4 | ✅ 2 | · | · | ✅ 1 | · | ✅ 2 | ✅ 4 | ✅ 1 | · |
| `notifications/notifications_screen.dart` | ✅ 1 | ✅ 1 | · | · | ✅ 1 | · | ✅ 1 | · | ✅ 1 | · |
| `onboarding/onboarding_screen.dart` | ✅ 2 | ✅ 1 | · | · | · | ✅ 1 | ✅ 3 | · | · | ✅ 1 |
| `parametres/parametres_screen.dart` | · | ✅ 6 | · | ✅ 9 | ✅ 2 | ✅ 1 | ✅ 1 | ✅ 7 | ✅ 1 | · |
| `parkings/parkings_screens.dart` | ✅ 7 | ✅ 4 | ✅ 5 | ✅ 8 | · | · | ✅ 6 | ✅ 14 | ✅ 9 | · |
| `personnel/personnel_rh_screens.dart` | ✅ 14 | ✅ 5 | ✅ 8 | ✅ 3 | · | · | ✅ 9 | ✅ 9 | ✅ 7 | · |
| `personnel/personnel_screen.dart` | ✅ 3 | ✅ 3 | · | ✅ 5 | · | · | ✅ 1 | ✅ 4 | ✅ 1 | · |
| `profil/profil_screens.dart` | ✅ 6 | ✅ 2 | · | ✅ 2 | ✅ 1 | · | ✅ 1 | ✅ 3 | · | · |
| `profil/sensations_section.dart` | ✅ 1 | · | · | · | ✅ 3 | · | · | · | · | ✅ 1 |
| `profil/sensations_test_screen.dart` | ✅ 5 | · | · | · | · | · | · | · | · | ✅ 2 |
| `rapports/rapports_screens.dart` | ✅ 5 | ✅ 2 | ✅ 12 | · | ✅ 1 | · | ✅ 4 | · | ✅ 2 | · |
| `shell/app_shell.dart` | ✅ 10 | · | · | · | · | ✅ 1 | · | ✅ 2 | · | ✅ 4 |
| `taches/taches_screens.dart` | ✅ 6 | ✅ 5 | · | ✅ 3 | ✅ 2 | · | ✅ 3 | ✅ 10 | ✅ 2 | · |
| `visites/visites_screens.dart` | ✅ 4 | ✅ 5 | ✅ 2 | ✅ 2 | · | · | ✅ 3 | ✅ 4 | ✅ 3 | · |

## Web (Next.js) — 100 % (1652 vivants, 0 bruts, 230 fichiers d'écran)

| Élément | Vivants | Bruts | Couverture |
|---|---:|---:|---:|
| Surfaces pressables | 332 | 0 | 100 % |
| Boutons d'envoi | 110 | 0 | 100 % |
| Montants & nombres | 217 | 0 | 100 % |
| Champs | 647 | 0 | 100 % |
| Interrupteurs, cases, segments | 58 | 0 | 100 % |
| Images | 43 | 0 | 100 % |
| Chargement & progression | 115 | 0 | 100 % |
| Modales & toasts | 128 | 0 | 100 % |
| Haptique & sons | 2 | 0 | 100 % |

| Écran (fichier) | Surfaces pressables | Boutons d'envoi | Montants & nombres | Champs | Interrupteurs, cases, segments | Images | Chargement & progression | Modales & toasts | Haptique & sons |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `app/[locale]/(app)/admin/coproprietes/[id]/inviter-syndic-modal.tsx` | ✅ 3 | ✅ 1 | · | ✅ 2 | · | · | · | ✅ 2 | · |
| `app/[locale]/(app)/admin/coproprietes/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/admin/coproprietes/[id]/page.tsx` | · | · | ✅ 4 | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/admin/coproprietes/nouvelle/copro-form.tsx` | ✅ 3 | ✅ 2 | · | ✅ 12 | · | · | · | ✅ 1 | · |
| `app/[locale]/(app)/admin/coproprietes/nouvelle/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/admin/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/admin/page.tsx` | ✅ 1 | · | ✅ 3 | ✅ 1 | · | · | · | · | · |
| `app/[locale]/(app)/affichage/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/affichage/[id]/modifier/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/affichage/[id]/page.tsx` | ✅ 1 | · | · | · | · | ✅ 1 | ✅ 1 | · | · |
| `app/[locale]/(app)/affichage/affichage-client.tsx` | ✅ 12 | ✅ 8 | · | ✅ 24 | ✅ 10 | · | ✅ 2 | ✅ 6 | · |
| `app/[locale]/(app)/affichage/contacts/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/affichage/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/affichage/nouveau/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/affichage/page.tsx` | ✅ 3 | · | · | · | · | · | · | · | · |
| `app/[locale]/(app)/affichage/sondages/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/affichage/sondages/nouveau/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/ag/[id]/ag-actions.tsx` | ✅ 13 | ✅ 7 | · | ✅ 14 | ✅ 1 | · | · | ✅ 5 | · |
| `app/[locale]/(app)/ag/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/ag/[id]/page.tsx` | ✅ 3 | · | · | · | · | ✅ 2 | ✅ 1 | · | · |
| `app/[locale]/(app)/ag/[id]/pv/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/ag/[id]/resolutions/[rid]/votes/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/ag/[id]/resolutions/[rid]/votes/page.tsx` | · | · | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/ag/[id]/seance/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/ag/[id]/seance/pupitre.tsx` | ✅ 1 | ✅ 1 | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/ag/[id]/seance/salle.tsx` | ✅ 2 | · | · | · | · | · | · | · | · |
| `app/[locale]/(app)/ag/[id]/seance/vue-votant.tsx` | ✅ 2 | ✅ 1 | · | ✅ 2 | · | · | · | ✅ 2 | · |
| `app/[locale]/(app)/ag/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/ag/nouvelle/ag-form.tsx` | · | ✅ 1 | · | ✅ 4 | · | · | · | · | · |
| `app/[locale]/(app)/ag/nouvelle/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/ag/page.tsx` | ✅ 2 | · | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/cabinet/cabinet-client.tsx` | ✅ 9 | ✅ 2 | · | ✅ 28 | ✅ 1 | · | · | ✅ 7 | · |
| `app/[locale]/(app)/cabinet/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/cabinet/page.tsx` | ✅ 1 | · | ✅ 5 | · | ✅ 1 | ✅ 1 | ✅ 1 | · | · |
| `app/[locale]/(app)/contrats/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/contrats/[id]/modifier/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/contrats/[id]/page.tsx` | ✅ 1 | · | ✅ 5 | · | · | · | · | · | · |
| `app/[locale]/(app)/contrats/calendrier/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/contrats/calendrier/page.tsx` | ✅ 1 | · | ✅ 2 | · | · | · | · | · | · |
| `app/[locale]/(app)/contrats/contrat-actions.tsx` | ✅ 7 | ✅ 4 | · | ✅ 9 | · | · | · | ✅ 5 | · |
| `app/[locale]/(app)/contrats/contrat-form.tsx` | · | ✅ 1 | · | ✅ 38 | ✅ 1 | · | · | · | · |
| `app/[locale]/(app)/contrats/filtre-type.tsx` | · | · | · | ✅ 1 | · | · | · | · | · |
| `app/[locale]/(app)/contrats/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/contrats/nouveau/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/contrats/page.tsx` | ✅ 1 | · | ✅ 5 | · | ✅ 1 | · | · | · | · |
| `app/[locale]/(app)/documents/document-modal.tsx` | ✅ 3 | ✅ 1 | · | ✅ 6 | · | · | · | ✅ 1 | · |
| `app/[locale]/(app)/documents/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/documents/page.tsx` | ✅ 1 | · | · | · | · | ✅ 1 | · | ✅ 1 | · |
| `app/[locale]/(app)/espaces-communs/espace-modals.tsx` | ✅ 9 | ✅ 3 | · | ✅ 20 | ✅ 4 | · | · | ✅ 4 | · |
| `app/[locale]/(app)/espaces-communs/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/espaces-communs/page.tsx` | · | · | · | · | · | ✅ 1 | · | ✅ 1 | · |
| `app/[locale]/(app)/finances/appels-de-fonds/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/appels-de-fonds/[id]/page.tsx` | · | · | ✅ 6 | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/appels-de-fonds/generer-modal.tsx` | ✅ 4 | ✅ 1 | · | ✅ 8 | · | · | · | ✅ 1 | · |
| `app/[locale]/(app)/finances/appels-de-fonds/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/appels-de-fonds/page.tsx` | · | · | ✅ 5 | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/budgets/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/budgets/[id]/page.tsx` | · | · | ✅ 8 | · | · | · | ✅ 2 | · | · |
| `app/[locale]/(app)/finances/budgets/[id]/postes-modals.tsx` | ✅ 4 | ✅ 1 | · | ✅ 6 | · | · | · | ✅ 3 | · |
| `app/[locale]/(app)/finances/budgets/budget-modals.tsx` | ✅ 5 | ✅ 1 | · | ✅ 10 | · | · | · | ✅ 3 | · |
| `app/[locale]/(app)/finances/budgets/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/budgets/page.tsx` | ✅ 1 | · | ✅ 2 | · | · | · | · | · | · |
| `app/[locale]/(app)/finances/comptabilite/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/comptabilite/page.tsx` | ✅ 2 | · | ✅ 21 | · | · | · | ✅ 4 | · | · |
| `app/[locale]/(app)/finances/contestations/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/contestations/page.tsx` | · | · | ✅ 2 | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/finances/contestations/repondre-modal.tsx` | ✅ 3 | ✅ 1 | · | ✅ 4 | · | · | · | ✅ 1 | · |
| `app/[locale]/(app)/finances/depenses/[id]/depense-actions.tsx` | ✅ 10 | ✅ 2 | · | ✅ 21 | · | · | · | ✅ 7 | · |
| `app/[locale]/(app)/finances/depenses/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/depenses/[id]/modifier/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/depenses/[id]/page.tsx` | ✅ 1 | · | ✅ 5 | · | · | · | · | · | · |
| `app/[locale]/(app)/finances/depenses/depense-form.tsx` | ✅ 1 | ✅ 1 | · | ✅ 30 | · | · | · | · | · |
| `app/[locale]/(app)/finances/depenses/filtres.tsx` | · | · | · | ✅ 4 | · | · | · | · | · |
| `app/[locale]/(app)/finances/depenses/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/depenses/nouvelle/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/depenses/page.tsx` | ✅ 2 | · | ✅ 6 | · | ✅ 1 | · | · | · | · |
| `app/[locale]/(app)/finances/especes/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/especes/page.tsx` | · | · | ✅ 1 | · | · | · | · | · | · |
| `app/[locale]/(app)/finances/justificatifs/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/justificatifs/[id]/page.tsx` | · | · | ✅ 2 | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/finances/justificatifs/declarer-form.tsx` | ✅ 2 | ✅ 1 | · | ✅ 20 | · | · | · | ✅ 1 | · |
| `app/[locale]/(app)/finances/justificatifs/justificatif-modals.tsx` | ✅ 6 | ✅ 3 | · | ✅ 8 | · | · | · | ✅ 4 | · |
| `app/[locale]/(app)/finances/justificatifs/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/justificatifs/page.tsx` | · | · | ✅ 4 | · | ✅ 1 | · | · | · | · |
| `app/[locale]/(app)/finances/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/payer/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/payer/page.tsx` | · | · | ✅ 3 | · | · | · | · | · | · |
| `app/[locale]/(app)/finances/quittances/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/finances/quittances/[id]/page.tsx` | · | · | ✅ 1 | · | · | · | · | · | · |
| `app/[locale]/(app)/finances/quittances/[id]/print-button.tsx` | ✅ 1 | · | · | · | · | · | · | · | · |
| `app/[locale]/(app)/import/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/import/[id]/page.tsx` | ✅ 1 | · | ✅ 3 | · | · | · | · | · | · |
| `app/[locale]/(app)/import/import-client.tsx` | ✅ 7 | ✅ 6 | · | ✅ 11 | ✅ 2 | · | ✅ 1 | ✅ 4 | · |
| `app/[locale]/(app)/import/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/import/nouveau/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/import/onboarding-card.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/import/page.tsx` | ✅ 3 | · | · | · | ✅ 1 | ✅ 1 | · | · | · |
| `app/[locale]/(app)/incidents/[id]/incident-actions.tsx` | ✅ 6 | ✅ 2 | · | ✅ 6 | · | · | · | ✅ 2 | · |
| `app/[locale]/(app)/incidents/[id]/incident-depense-modals.tsx` | ✅ 6 | ✅ 2 | · | ✅ 15 | · | · | · | ✅ 2 | · |
| `app/[locale]/(app)/incidents/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/incidents/[id]/page.tsx` | · | · | ✅ 1 | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/incidents/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/incidents/nouveau/incident-form.tsx` | ✅ 3 | ✅ 1 | · | ✅ 12 | · | · | · | · | · |
| `app/[locale]/(app)/incidents/nouveau/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/incidents/page.tsx` | ✅ 3 | · | ✅ 3 | ✅ 3 | · | · | · | · | · |
| `app/[locale]/(app)/invitations/invitation-modals.tsx` | ✅ 5 | ✅ 2 | · | ✅ 6 | · | ✅ 1 | · | ✅ 3 | · |
| `app/[locale]/(app)/invitations/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/invitations/page.tsx` | · | · | · | · | · | · | · | ✅ 1 | · |
| `app/[locale]/(app)/litiges/litige-actions.tsx` | ✅ 9 | ✅ 3 | · | ✅ 10 | · | · | · | ✅ 4 | · |
| `app/[locale]/(app)/litiges/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/litiges/page.tsx` | · | · | ✅ 3 | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/location-courte-duree/declarations/[id]/declaration-actions.tsx` | ✅ 9 | ✅ 4 | · | ✅ 18 | ✅ 2 | · | · | ✅ 3 | · |
| `app/[locale]/(app)/location-courte-duree/declarations/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/location-courte-duree/declarations/[id]/page.tsx` | ✅ 2 | · | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/location-courte-duree/lcd-modals.tsx` | ✅ 5 | ✅ 3 | · | ✅ 14 | · | · | · | ✅ 3 | · |
| `app/[locale]/(app)/location-courte-duree/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/location-courte-duree/page.tsx` | ✅ 3 | · | ✅ 2 | · | · | · | · | · | · |
| `app/[locale]/(app)/location-courte-duree/reglement/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/location-courte-duree/reglement/reglement-form.tsx` | ✅ 1 | ✅ 1 | · | ✅ 10 | ✅ 3 | · | · | · | · |
| `app/[locale]/(app)/location-courte-duree/sejours/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/location-courte-duree/sejours/[id]/modifier/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/location-courte-duree/sejours/[id]/page.tsx` | ✅ 2 | · | · | · | · | · | · | · | · |
| `app/[locale]/(app)/location-courte-duree/sejours/[id]/sejour-actions.tsx` | ✅ 6 | ✅ 2 | · | ✅ 2 | · | ✅ 1 | · | ✅ 1 | · |
| `app/[locale]/(app)/location-courte-duree/sejours/nouveau/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/location-courte-duree/sejours/nouveau/page.tsx` | ✅ 1 | · | · | · | · | · | · | · | · |
| `app/[locale]/(app)/location-courte-duree/sejours/sejour-form.tsx` | ✅ 2 | ✅ 1 | · | ✅ 22 | · | · | · | · | · |
| `app/[locale]/(app)/lots/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/lots/[id]/modifier/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/lots/[id]/page.tsx` | ✅ 2 | · | ✅ 4 | · | ✅ 1 | ✅ 2 | · | ✅ 1 | · |
| `app/[locale]/(app)/lots/[id]/rattachement-modals.tsx` | ✅ 7 | ✅ 2 | · | ✅ 16 | ✅ 2 | · | ✅ 1 | ✅ 2 | · |
| `app/[locale]/(app)/lots/[id]/transfert/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/lots/[id]/transfert/transfert-wizard.tsx` | ✅ 5 | ✅ 1 | · | ✅ 4 | ✅ 2 | · | · | ✅ 1 | · |
| `app/[locale]/(app)/lots/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/lots/lot-form.tsx` | · | ✅ 1 | · | ✅ 18 | · | · | · | · | · |
| `app/[locale]/(app)/lots/nouveau/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/lots/page.tsx` | ✅ 3 | · | ✅ 4 | ✅ 3 | · | ✅ 2 | · | · | · |
| `app/[locale]/(app)/membres/[id]/anonymiser-modal.tsx` | ✅ 3 | ✅ 1 | · | · | ✅ 1 | · | · | ✅ 1 | · |
| `app/[locale]/(app)/membres/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/membres/[id]/page.tsx` | · | · | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/membres/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/membres/page.tsx` | ✅ 3 | · | ✅ 4 | ✅ 2 | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/notifications/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/notifications/notifications-list.tsx` | ✅ 1 | · | · | · | · | · | · | · | · |
| `app/[locale]/(app)/parametres/cabinet-mandat-card.tsx` | · | · | ✅ 1 | · | · | · | · | · | · |
| `app/[locale]/(app)/parametres/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/parametres/logo-form.tsx` | ✅ 2 | ✅ 1 | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/parametres/parametres-forms.tsx` | ✅ 1 | ✅ 2 | · | ✅ 31 | ✅ 3 | · | · | · | · |
| `app/[locale]/(app)/parametres/photos-form.tsx` | ✅ 2 | ✅ 1 | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/parkings/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/parkings/[id]/page.tsx` | · | · | ✅ 2 | · | · | · | · | · | · |
| `app/[locale]/(app)/parkings/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/parkings/page.tsx` | · | · | ✅ 6 | · | ✅ 1 | · | · | · | · |
| `app/[locale]/(app)/parkings/parkings-client.tsx` | ✅ 14 | ✅ 2 | · | ✅ 33 | ✅ 2 | · | · | ✅ 13 | · |
| `app/[locale]/(app)/personnel/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/personnel/[id]/page.tsx` | ✅ 1 | · | ✅ 5 | · | ✅ 1 | ✅ 1 | · | · | · |
| `app/[locale]/(app)/personnel/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/personnel/me/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/personnel/page.tsx` | ✅ 3 | · | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/personnel/paie/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/personnel/paie/page.tsx` | ✅ 1 | · | ✅ 7 | · | · | · | · | · | · |
| `app/[locale]/(app)/personnel/personnel-modals.tsx` | ✅ 6 | ✅ 2 | · | ✅ 10 | · | · | · | ✅ 3 | · |
| `app/[locale]/(app)/personnel/planning/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/personnel/planning/page.tsx` | ✅ 1 | · | · | · | · | · | · | · | · |
| `app/[locale]/(app)/personnel/rh-modals.tsx` | ✅ 10 | ✅ 5 | · | ✅ 35 | · | · | · | ✅ 8 | · |
| `app/[locale]/(app)/prestataires/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/prestataires/[id]/page.tsx` | · | · | ✅ 4 | · | ✅ 1 | · | · | · | · |
| `app/[locale]/(app)/prestataires/[id]/rib-button.tsx` | ✅ 1 | ✅ 1 | · | · | · | · | · | · | · |
| `app/[locale]/(app)/prestataires/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/prestataires/page.tsx` | · | · | · | · | · | ✅ 1 | · | ✅ 1 | · |
| `app/[locale]/(app)/prestataires/prestataire-modal.tsx` | ✅ 6 | ✅ 2 | · | ✅ 26 | ✅ 1 | · | · | ✅ 2 | · |
| `app/[locale]/(app)/profil/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/profil/page.tsx` | ✅ 1 | · | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/profil/profil-form.tsx` | · | ✅ 1 | · | ✅ 6 | · | · | · | · | · |
| `app/[locale]/(app)/profil/sensations-form.tsx` | · | · | · | · | ✅ 3 | · | · | · | ✅ 2 |
| `app/[locale]/(app)/rapports/exports/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/rapports/gestion/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/rapports/gestion/[id]/page.tsx` | · | · | ✅ 10 | · | · | · | · | · | · |
| `app/[locale]/(app)/rapports/gestion/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/rapports/gestion/page.tsx` | · | · | ✅ 3 | · | · | · | · | · | · |
| `app/[locale]/(app)/rapports/grand-livre/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/rapports/grand-livre/page.tsx` | · | · | ✅ 8 | · | · | · | · | · | · |
| `app/[locale]/(app)/rapports/impayes/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/rapports/impayes/page.tsx` | · | · | ✅ 4 | · | · | · | · | · | · |
| `app/[locale]/(app)/rapports/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/rapports/onglets.tsx` | · | · | · | · | ✅ 1 | · | · | · | · |
| `app/[locale]/(app)/rapports/page.tsx` | · | · | ✅ 14 | · | · | · | ✅ 4 | · | · |
| `app/[locale]/(app)/rapports/rapport-modals.tsx` | ✅ 8 | ✅ 2 | · | ✅ 8 | · | · | · | ✅ 4 | · |
| `app/[locale]/(app)/rapports/transparence/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/rapports/transparence/page.tsx` | · | · | ✅ 9 | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/reservations/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/reservations/page.tsx` | · | · | ✅ 3 | · | · | · | · | · | · |
| `app/[locale]/(app)/reservations/reservation-actions.tsx` | ✅ 6 | ✅ 3 | · | ✅ 2 | · | · | · | ✅ 2 | · |
| `app/[locale]/(app)/tableau-de-bord/gardien.tsx` | · | · | ✅ 3 | · | · | ✅ 3 | · | · | · |
| `app/[locale]/(app)/tableau-de-bord/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/tableau-de-bord/parts.tsx` | · | · | · | · | · | ✅ 1 | ✅ 1 | · | · |
| `app/[locale]/(app)/tableau-de-bord/prestataire.tsx` | · | · | ✅ 2 | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/tableau-de-bord/resident.tsx` | ✅ 3 | · | ✅ 4 | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/tableau-de-bord/syndic.tsx` | ✅ 2 | · | ✅ 11 | · | · | ✅ 1 | ✅ 3 | · | · |
| `app/[locale]/(app)/taches/[id]/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/taches/[id]/modifier/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/taches/[id]/page.tsx` | ✅ 1 | · | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/(app)/taches/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/taches/nouveau/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/taches/page.tsx` | ✅ 2 | · | ✅ 3 | · | ✅ 2 | · | · | · | · |
| `app/[locale]/(app)/taches/taches-client.tsx` | ✅ 7 | ✅ 3 | · | ✅ 15 | ✅ 3 | · | · | ✅ 3 | · |
| `app/[locale]/(app)/visites/loading.tsx` | · | · | · | · | · | · | ✅ 1 | · | · |
| `app/[locale]/(app)/visites/page.tsx` | · | · | ✅ 3 | · | · | · | · | · | · |
| `app/[locale]/(app)/visites/visite-actions.tsx` | ✅ 3 | ✅ 3 | · | ✅ 4 | · | · | · | ✅ 2 | · |
| `app/[locale]/(public)/compte/sans-acces/page.tsx` | ✅ 2 | · | · | · | · | · | · | · | · |
| `app/[locale]/(public)/connexion/code/otp-form.tsx` | · | ✅ 1 | · | · | · | · | · | · | · |
| `app/[locale]/(public)/connexion/login-form.tsx` | · | ✅ 2 | · | ✅ 6 | ✅ 1 | · | · | · | · |
| `app/[locale]/(public)/invitation/[code]/accept-form.tsx` | · | ✅ 1 | · | ✅ 4 | ✅ 1 | · | · | · | · |
| `app/[locale]/(public)/invitation/[code]/inscription-form.tsx` | · | ✅ 1 | · | ✅ 8 | ✅ 1 | · | · | · | · |
| `app/[locale]/(public)/invitation/[code]/page.tsx` | ✅ 2 | · | · | · | · | · | · | · | · |
| `app/[locale]/(public)/invitation/page.tsx` | ✅ 2 | · | · | ✅ 2 | · | · | · | · | · |
| `app/[locale]/choisir-copropriete/page.tsx` | ✅ 3 | · | · | · | · | · | · | · | · |
| `app/[locale]/error.tsx` | ✅ 1 | · | · | · | · | ✅ 1 | · | · | · |
| `app/[locale]/not-found.tsx` | ✅ 1 | · | · | · | · | · | · | · | · |
| `components/auth/qr-scanner.tsx` | ✅ 1 | · | · | · | · | · | · | ✅ 1 | · |
| `components/documents/document-viewer.tsx` | ✅ 1 | · | · | · | · | ✅ 1 | · | ✅ 1 | · |
| `components/espaces/espace-image.tsx` | · | · | · | · | · | ✅ 1 | · | · | · |
| `components/etat-compte.tsx` | ✅ 1 | · | · | · | · | · | · | · | · |
| `components/finances/contester-modal.tsx` | ✅ 3 | ✅ 1 | · | ✅ 2 | · | · | · | ✅ 2 | · |
| `components/finances/paiement-modal.tsx` | ✅ 4 | ✅ 1 | ✅ 1 | ✅ 10 | ✅ 2 | ✅ 1 | · | ✅ 2 | · |
| `components/finances/parcours-compta.tsx` | ✅ 1 | · | · | · | · | · | · | · | · |
| `components/finances/releve-buttons.tsx` | · | · | · | ✅ 1 | · | · | · | · | · |
| `components/incidents/photo-gallery.tsx` | ✅ 4 | · | · | · | · | ✅ 2 | · | ✅ 1 | · |
| `components/incidents/photo-picker.tsx` | ✅ 3 | · | · | · | · | ✅ 1 | · | · | · |
| `components/onboarding/guided-tour.tsx` | ✅ 3 | · | · | · | · | · | · | · | · |

## Exceptions motivées (`alive:allow`)

- `apps/mobile/lib/features/auth/login_screen.dart:318` — champ OTP invisible (opacité 0) sous les 6 cases dessinées — SuField afficherait libellé/cadre
- `apps/mobile/lib/features/contrats/contrats_screens.dart:57` — StatTile.hint n'accepte qu'une chaîne (montant secondaire, valeur principale déjà vivante)
- `apps/web/app/[locale]/(app)/affichage/affichage-client.tsx:278` — option de sondage en pastille : type checkbox/radio dynamique + required, que Checkbox/RadioGroup n'exposent pas
- `apps/web/app/[locale]/(app)/contrats/contrat-actions.tsx:170` — texte réservé aux lecteurs d'écran (sr-only), jamais visible donc jamais animé
- `apps/web/app/[locale]/(app)/finances/justificatifs/declarer-form.tsx:63` — <option> natif : texte seul, aucun élément React possible
- `apps/web/app/[locale]/(app)/lots/[id]/rattachement-modals.tsx:213` — radio réparti une ligne par copropriétaire (liste dynamique) : RadioGroup exige des options regroupées
- `apps/web/app/[locale]/(public)/connexion/code/otp-form.tsx:111` — case OTP à un chiffre (saisie/collage/navigation clavier spécialisés), déjà vivante via .otp-box[data-filled] ; Input imposerait hauteur et padding de champ
- `apps/web/app/[locale]/(public)/connexion/code/otp-form.tsx:149` — lien textuel « renvoyer le code » (style .link) : SubmitButton n'a pas de variante lien et la page publique doit rester légère
- `apps/web/components/finances/paiement-modal.tsx:169` — <option> natif : texte seul, aucun élément React possible
