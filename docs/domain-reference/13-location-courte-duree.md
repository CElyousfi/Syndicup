# Location courte durée (LCD) — côté copropriété

> Domaine dérivé de Doc A §10.2 (ligne « Résident loue sa villa via Airbnb : *Règlement intérieur
> peut interdire la location courte durée (nuisances). À voter en AG. Paramètre règlement :
> location_courte_duree = AUTORISEE / INTERDITE / ENCADREE. Si incident Airbnb = signalement
> facilité* ») et de Doc A §2.1/§2.2 (propriétaire absent / MRE, propriétaire seul redevable).
> Doc A ne détaille pas les cas d'usage : ce fichier les fixe pour le module M15 — il ne
> réécrit pas Doc A. Tout ce qui touche à la loi (Loi 18-00 / 30-24, déclaration des voyageurs,
> CNDP) est PROVISOIRE et tracé dans `docs/LEGAL_QUESTIONS_BRIEF.md` §7.

---

## 13.0 — Périmètre et principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| Périmètre copropriété seulement | Conformité au règlement, sécurité (qui est dans l'immeuble), nuisances. | Aucun prix, aucun paiement, aucune synchronisation de calendrier plateforme. |
| Le voyageur n'a jamais de compte | Un voyageur est une donnée du séjour, pas un utilisateur. | Ni `lot_occupant`, ni `role_utilisateur`, ni invitation pour un voyageur. `lot_occupant` reste réservé aux occupants stables. |
| Le propriétaire reste seul débiteur | Doc A §2.2 : les charges sont dues par le propriétaire. | Le module ne touche pas aux finances. Une redevance LCD n'existe pas dans cette version (roadmap M15, gatée par une résolution d'AG). |
| Données voyageur minimales (CNDP) | Nom du voyageur principal, nombre de voyageurs, téléphone (opt.), nationalité (opt.), pièce d'identité : type + 4 derniers caractères (opt.), plaque (opt.). | Jamais de numéro complet ni de scan. Anonymisation par le job CNDP (M13) après la rétention configurée. |
| Rien n'est deviné | Régime `NON_DEFINI` tant que l'AG (ou le syndic pour le règlement existant) ne l'a pas fixé. | `POST /lcd/declarations` → 422 `LCD_REGIME_NON_DEFINI` ; ENCADREE sans paramètres → 422 `LCD_PARAMETRE_NON_CONFIGURE`. |

## 13.1 — Régime de la copropriété

| Régime | Sens | Effet plateforme |
| --- | --- | --- |
| `NON_DEFINI` | L'AG n'a pas encore statué (ou le syndic n'a pas saisi le règlement existant). | Aucune déclaration possible (422). Bannière explicite pour tous ; lien Paramètres pour le syndic. |
| `AUTORISEE` | Le règlement autorise la LCD sans condition particulière. | Déclaration `VALIDEE` d'office ; séjours déclarables ; gardien prévenu uniquement si `contact_gardien_obligatoire` (paramètre absent → jamais). |
| `ENCADREE` | Autorisée sous conditions votées en AG. | Déclaration `EN_ATTENTE` → décision syndic. Paramètres obligatoires : `declaration_prealable_obligatoire`, `delai_declaration_heures`, `nb_nuits_max_par_an`, `nb_voyageurs_max_par_lot`, `gestionnaire_obligatoire_si_proprietaire_absent`, `contact_gardien_obligatoire`. Une limite `null` = non configurée = non appliquée. |
| `INTERDITE` | Le règlement interdit la LCD. | Déclaration impossible (422 `LCD_INTERDITE`). Les déclarations existantes restent lisibles ; le syndic les suspend ou clôture manuellement. |

Le régime est fixé par le syndic (`PUT /lcd/reglement`, audit `LCD_REGLEMENT_MODIFIE`), avec
une résolution d'AG `ADOPTEE` facultative (`regime_lcd_ag_resolution_id`) — facultative parce que
la copropriété peut avoir voté avant d'utiliser la plateforme.

## 13.2 — Qui déclare quoi

| Acteur | Peut | Ne peut pas | Note |
| --- | --- | --- | --- |
| Propriétaire occupant (§2.1) | Déclarer son lot, déclarer/modifier/annuler des séjours, désigner un gestionnaire, clôturer. | Décider (valider/refuser), confirmer arrivée/départ. | Gestionnaire facultatif. |
| Propriétaire absent / MRE / bailleur (§2.1, §2.2) | Idem. | Idem. | Si `gestionnaire_obligatoire_si_proprietaire_absent` (ENCADREE) et pas de `lot_occupant` PROPRIETAIRE_OCCUPANT actif pour lui → 422 `LCD_GESTIONNAIRE_REQUIS`. |
| Indivisaire / représentant de personne morale (§2.4, §2.7) | Comme un propriétaire, sur les lots où il est propriétaire ACTIF (`lot_proprietaire.date_fin IS NULL`). | — | La RLS vérifie la propriété active, pas l'historique. |
| Gestionnaire LCD (rôle `GESTIONNAIRE_LCD`, nouveau — signalé) | Déclarer/modifier/annuler des séjours, modifier les contacts, lire ses déclarations. | Déclarer un lot, se remplacer par un autre gestionnaire, décider, confirmer. | Scopé aux déclarations où `gestionnaire_id = lui`. Compte existant de la copropriété (rôle créé à la désignation) ou invité via une invitation M2 `GESTIONNAIRE_LCD` sur le lot — liée à la déclaration à l'acceptation. |
| Syndic | Tout : régime, décision, saisie au nom d'un propriétaire peu digital (§2.1), confirmation arrivée/départ, clôture. | — | Décisions REFUSEE/SUSPENDUE avec motif obligatoire, audit `LCD_DECLARATION_DECISION`. |
| Conseil syndical | Lecture des déclarations et séjours. | Écrire. | — |
| Gardien (§9.2) | Voir les déclarations VALIDEES et tous les séjours ; confirmer arrivée (PREVU→EN_COURS) et départ (EN_COURS→TERMINE), avec nombre constaté. | Voir une déclaration REFUSEE/EN_ATTENTE ; modifier les données voyageur. | Le nombre constaté va dans `sejour_evenement.details_json`, jamais sur le séjour. Hors-ligne possible sur mobile (file de sync, même Idempotency-Key rejouée). |
| Locataire, voisins, prestataires | Rien. | Voir l'identité d'un voyageur. | Doc A §12.3 : l'identité d'un voyageur n'est pas pour l'immeuble. |

## 13.3 — Cycle d'une déclaration de lot

| Statut | Entrée | Sortie | Règle |
| --- | --- | --- | --- |
| `EN_ATTENTE` | Création en régime ENCADREE. Syndic notifié (`LCD_DECLARATION_A_VALIDER`). | Décision syndic. | Aucun séjour déclarable tant que non VALIDEE (422 `LCD_DECLARATION_NON_VALIDEE`). |
| `VALIDEE` | Régime AUTORISEE (d'office) ou décision syndic. | SUSPENDUE / CLOTUREE. | Séjours déclarables ; visible du gardien. |
| `REFUSEE` | Décision syndic avec motif. Propriétaire et gestionnaire notifiés (`LCD_DECLARATION_DECISION`, canal préféré). | Nouvelle décision possible (VALIDEE). | Invisible du gardien. |
| `SUSPENDUE` | Décision syndic avec motif — **manuelle**, typiquement après des incidents répétés liés à des séjours (voir 13.6). | VALIDEE (levée) / CLOTUREE. | Aucun séjour déclarable. Jamais automatique. |
| `CLOTUREE` | Propriétaire ou syndic (`date_fin`). | — | Refusée (409) tant qu'un séjour est PREVU ou EN_COURS. Une seule déclaration ouverte par lot (index unique partiel). |

## 13.4 — Cycle d'un séjour

| Statut | Transition | Acteur | Trace |
| --- | --- | --- | --- |
| `PREVU` | Création (`POST /lcd/sejours`, Idempotency-Key). | Propriétaire, gestionnaire, syndic. | Événement `DECLARE`, audit `LCD_SEJOUR_DECLARE`, syndic notifié ; gardien notifié (+ `GARDIEN_NOTIFIE`, `gardien_informe_le`) si ENCADREE ou `contact_gardien_obligatoire`. |
| `PREVU` → `PREVU` | Modification (mêmes règles qu'à la création). | Idem. | `MODIFIE`. |
| `PREVU` → `ANNULE` | Annulation. | Idem. | `ANNULE`, audit ; gardien prévenu s'il l'avait été. |
| `PREVU` → `EN_COURS` | Arrivée confirmée. **Jamais automatique.** | Gardien, syndic. | `ARRIVEE_CONFIRMEE` (+ `nb_voyageurs_constate`), audit `LCD_SEJOUR_ARRIVEE`. |
| `EN_COURS` → `TERMINE` | Départ confirmé, ou clôture automatique le lendemain de `date_depart` par le job quotidien. | Gardien, syndic ; système (`acteur_id = null`, `details_json.auto = true`). | `DEPART_CONFIRME`, audit `LCD_SEJOUR_DEPART` (manuel). |

Règles à la création / modification (régime ENCADREE, chaque limite ignorée si `null`) :

| Règle | Contrôle | Erreur |
| --- | --- | --- |
| Voyageurs | `nb_voyageurs ≤ nb_voyageurs_max_par_lot` | 422 `LCD_VOYAGEURS_MAX` |
| Délai de déclaration | si `declaration_prealable_obligatoire` : arrivée (date + heure prévue) ≥ `delai_declaration_heures` avant maintenant | 422 `LCD_DELAI_DECLARATION` |
| Quota annuel | nuits des séjours non annulés de l'année civile d'arrivée + ce séjour ≤ `nb_nuits_max_par_an` | 422 `LCD_QUOTA_NUITS_DEPASSE` |
| Chevauchement (tous régimes) | intervalle semi-ouvert `[arrivée, départ)` sur le même lot, séjours PREVU/EN_COURS | 409 `LCD_SEJOUR_CHEVAUCHEMENT` |

## 13.5 — Journée du gardien

| Moment | Ce que voit le gardien | Action | Hors-ligne |
| --- | --- | --- | --- |
| 06:00 (job `lcd-sejours-quotidien`) | Push « Arrivée prévue aujourd'hui — lot X, N voyageurs, heure » — une seule fois par séjour et par jour. | — | — |
| Dans la journée | `GET /lcd/sejours/du-jour` : arrivées, départs, séjours en cours. | « Confirmer l'arrivée » (nombre constaté facultatif), « Confirmer le départ ». | Mobile : action mise en file locale, rejouée au retour du réseau avec la même Idempotency-Key (M10). |
| Lendemain d'un départ non confirmé | Le séjour passe TERMINE automatiquement. | Rien. | — |

## 13.6 — Nuisance liée à un séjour (« signalement facilité », Doc A §10.2)

| Cas | Règle | Gestion plateforme |
| --- | --- | --- |
| Nuisance pendant un séjour | Tout résident autorisé à signaler crée un incident `NUISANCES` et peut le lier au séjour EN_COURS du lot (ou TERMINE depuis ≤ 7 jours). | `POST /incidents` avec `sejour_id` (même lot, vérifié sous RLS) → événement `INCIDENT_LIE` sur le séjour ; `GET /incidents?sejour_id=`. |
| Incidents répétés sur les séjours d'un lot | Le syndic décide, **manuellement**, une SUSPENSION de la déclaration (motif obligatoire) ou une clôture. | `POST /lcd/declarations/{id}/decision` `SUSPENDUE`. La synthèse du lot (`GET /lcd/lots/{id}/synthese`) affiche `incidents_lies` pour éclairer la décision. Aucune suspension automatique (roadmap M15 : hors périmètre, à décider en AG). |
| Contact d'urgence | La déclaration porte `contact_urgence_nom/telephone` (gestionnaire ou proche) pour le gardien et le syndic. | Visible dans le détail de la déclaration. |

## 13.7 — Quota et synthèse par lot

| Élément | Source | Note |
| --- | --- | --- |
| Nuits utilisées dans l'année | Somme des nuits des séjours non annulés dont l'arrivée est dans l'année civile courante. | Séjour à cheval sur deux années compté sur l'année d'arrivée (simplification signalée). |
| Quota | `parametres_lcd_json.nb_nuits_max_par_an` (ENCADREE) sinon `null`. | — |
| Derniers séjours | 10 derniers du lot. | — |
| Incidents liés | Comptés sous la RLS `incident` : le syndic voit tout, un propriétaire uniquement les siens (Doc A §12.3). | — |
