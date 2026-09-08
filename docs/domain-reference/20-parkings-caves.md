# Parkings et caves — emplacements non titrés, attributions, véhicules, badges

> Domaine dérivé de Doc A §4 (`04-parkings.md` : modèle des parkings, scénarios conflictuels —
> place occupée, visiteur externe, place « habituelle » sans droit, barrière, inondation, charges
> des places titrées) et §9 (gardien : contrôle d'accès, visiteurs), §12 (qui voit quoi). Les
> places **titrées** restent des lots `PARKING` / `CAVE` (Partie 2 : `lot.type_lot`, charges par
> tantièmes, vente avec ou sans l'appartement — M2 / M3) : ce module gère tout ce qui **n'est pas
> titré** — places communes, visiteurs, PMR, moto, vélo, caves communes — leur attribution, les
> véhicules déclarés, les badges / télécommandes / clés, et les cas « véhicule sur ma place ».
> Doc A ne décrit ni la redevance d'une place commune louée en interne ni les badges à caution :
> ce fichier fixe le module M23 (brief §14) — il ne réécrit pas Doc A.

---

## 20.0 — Principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| Titré ≠ commun | Doc A §4.1 : `TITRE` = lot avec titre foncier ; `COMMUN` / `ATTRIBUE_SANS_TITRE` / `MOTO` / `VELO` / `VISITEUR` = parties communes. | Titré = `lot` (inchangé). Commun = `emplacement` (`PARKING_COMMUN`, `PARKING_VISITEUR`, `PARKING_PMR`, `MOTO`, `VELO`, `CAVE_COMMUNE`), code unique par copropriété, niveau libre (« -1 », « RDC »), `attribuable`, statut `DISPONIBLE` / `ATTRIBUE` / `HORS_SERVICE`. Une place visiteur n'est jamais attribuable ; une place PMR n'est pas attribuée nominativement. |
| Pas de droit exclusif sur une place commune sans décision | Doc A §4.2 : « parking commun = pas de droit exclusif » ; l'AG peut décider un système d'attribution formelle. | `attribution_emplacement` : `ATTRIBUTION_AG` (résolution ADOPTEE liée), `ROTATION`, `LOCATION_INTERNE` (redevance mensuelle), `TEMPORAIRE` (date de fin obligatoire). Une seule attribution par période (chevauchement → 409 `ATTRIBUTION_CHEVAUCHEMENT`). Le syndic attribue et libère ; les résidents du lot sont prévenus. |
| Redevance d'usage | Location interne votée en AG. | `redevance_mensuelle` (≥ 0) ; job mensuel → appel de fonds `REDEVANCE_PARKING` (⚠️ valeur d'enum ajoutée) de la période, une ligne par lot = somme de ses redevances, échéance le 15 ; idempotent par (copropriété, période, type). Aucune redevance sans décision (montant PROVISOIRE, brief §14). |
| Véhicules connus du gardien | Doc A §4.2 : identifier le véhicule contrevenant ; §9 : sticker / badge résident. | `vehicule` : plaque normalisée (MAJUSCULES, séparateurs → tiret), **unique par copropriété** (409 `IMMATRICULATION_EXISTANTE`, même si le doublon est invisible sous RLS), déclarée par le résident pour SES lots ou par le syndic, désactivée (jamais supprimée). Recherche de plaque réservée au gardien et au syndic, **chaque recherche auditée** (`VEHICULE_RECHERCHE`), tolérante aux tirets manquants ; cache hors-ligne des plaques actives sur le mobile gardien. |
| Badges, télécommandes, clés | Doc A §4.1 `acces_badge` ; §4.2 vente → transfert du badge. | `badge` (`BADGE_PIETON`, `TELECOMMANDE_PARKING`, `CLE_CAVE`, `CARTE_ASCENSEUR`), identifiant unique par (copropriété, type), statut `ACTIF` / `PERDU` / `DESACTIVE` / `RESTITUE`, caution éventuelle liée à un paiement M17 du même lot. Perdu → syndic prévenu + tâche M22 « Désactiver le badge … » ; restitution avec caution rendue ou non tracée en audit. |
| Places visiteurs | Doc A §9 : le gardien contrôle l'entrée. | `visite.emplacement_id` + `immatriculation` + `heure_limite` (gardien pour SES visites, syndic) ; `sejour_courte_duree.emplacement_id` (M15). Occupation du jour, places libres, dépassement d'heure limite → `VISITEUR_DEPASSEMENT` au gardien (une fois par visite). |
| « Véhicule sur ma place » | Doc A §4.2 scénario 1 (titrée) et 4 (commune « habituelle »). | Incident catégorie `PARKING` avec `emplacement_id` et `immatriculation_signalee` ; le gardien / syndic prévient le lot propriétaire de la plaque (`VEHICULE_MAL_STATIONNE`, recherche auditée, ligne au journal de l'incident) ; plaque inconnue → 422 `IMMATRICULATION_INCONNUE` = véhicule extérieur, procédure fourrière selon le règlement (hors plateforme). |
| Qui voit quoi | Doc A §12. | RLS : `emplacement` lisible par tout le tenant ; `attribution_emplacement`, `vehicule`, `badge` : syndic / conseil / gardien tout, résident **ses lots** (fonction `lots_du_resident_courant()` — propriétaire actif ∪ occupant en cours). Écriture : syndic ; résident = ses véhicules et « badge perdu » (policy dédiée ACTIF → PERDU). Un badge d'un autre lot est invisible (404, jamais 403). |

## 20.1 — Cycle de vie d'un emplacement

| Statut | Transitions | Effets |
| --- | --- | --- |
| `DISPONIBLE` | → ATTRIBUE (attribution dont le début est arrivé), → HORS_SERVICE (syndic) | — |
| `ATTRIBUE` | → DISPONIBLE (libération, expiration par le job) | HORS_SERVICE refusé tant qu'une attribution est en cours (422 `EMPLACEMENT_STATUT_INVALIDE`). |
| `HORS_SERVICE` | → DISPONIBLE | aucune attribution ni place visiteur possible. |

`date_fin` d'une attribution = dernier jour d'occupation (inclus) ; « libérer » sans date =
libre dès aujourd'hui. Un emplacement avec historique (attribution, visite) ne se supprime pas :
il passe hors service.

## 20.2 — Jobs

| Job | Cron | Effets | Idempotence |
| --- | --- | --- | --- |
| `parkings-quotidien` | 07:00 | attributions expirées → DISPONIBLE + `ATTRIBUTION_EXPIREE` aux résidents du lot ; attributions dont le début est arrivé → ATTRIBUE ; visiteurs au-delà de `heure_limite` → `VISITEUR_DEPASSEMENT` aux gardiens. | `expiree_notifiee_le` ; notification existante par `visite_id`. |
| `parkings-redevances-mensuel` | 06:00 le 1er | appel de fonds `REDEVANCE_PARKING` de la période (somme des redevances des attributions actives ce mois, une ligne par lot, échéance le 15) + fan-out `finances/appel_de_fonds.emis`. | unicité (copropriété, période, type) ; aucune redevance = rien. |

Notifications FR/AR : `ATTRIBUTION_EMPLACEMENT`, `ATTRIBUTION_EXPIREE`, `BADGE_REMIS`,
`BADGE_PERDU`, `VEHICULE_MAL_STATIONNE`, `VISITEUR_DEPASSEMENT` — deep-links vers la fiche
emplacement, le registre des badges, l'incident ou les places visiteurs (web / mobile).

## 20.3 — Liens avec les autres modules

- **M2 / M3 Lots** : les places titrées restent des lots ; onglet « Parkings & badges » du lot
  (attributions, véhicules, badges).
- **M4 Incidents** : `incident.emplacement_id`, `immatriculation_signalee`, action « prévenir le
  propriétaire du véhicule ».
- **M6 AG** : `attribution_emplacement.resolution_ag_id` (attribution votée).
- **M8 Visites** : place visiteur, plaque, heure limite sur la visite du gardien.
- **M15 LCD** : `sejour_courte_duree.emplacement_id` (place visiteur du voyageur).
- **M16 / M5 Finances** : appel de fonds `REDEVANCE_PARKING` mensuel.
- **M17 Justificatifs** : `badge.caution_paiement_id` (paiement du même lot).
- **M18 Exports** : `GET /emplacements?format=csv|xlsx` (journalisé).
- **M22 Tâches** : tâche système « Désactiver le badge perdu … » (une par badge).
