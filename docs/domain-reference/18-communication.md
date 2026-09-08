# Communication — tableau d'affichage, sondages consultatifs, contacts utiles

> Domaine dérivé de Doc A §8 (obligations d'information du syndic envers les copropriétaires :
> travaux, coupures, décisions, convocations) et §12 (confidentialité : ce qu'un résident voit des
> autres). Doc A ne décrit pas de « tableau d'affichage » numérique : ce fichier fixe le module M21,
> qui remplace le groupe WhatsApp de la résidence — il ne réécrit pas Doc A. Un sondage n'est
> JAMAIS un vote d'assemblée générale (Doc A §6) : aucune valeur juridique.

---

## 18.0 — Principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| Le syndic écrit à la résidence | Jusqu'ici les notifications étaient des événements système ; l'annonce est le premier message rédigé. | `annonce` (titre, contenu Markdown restreint assaini, catégorie, audience, épingle, expiration, commentaires) ; auteur syndic ou conseil (URGENCE : syndic seul). |
| L'audience filtre deux fois | TOUS / PROPRIETAIRES / OCCUPANTS / CONSEIL / BATIMENT (`lot.batiment`). | Fan-out calculé par l'API (`destinatairesAudience`) ET policy RLS (`communication_audience_ok`) : un locataire ne voit ni ne reçoit jamais une annonce PROPRIETAIRES. |
| Publier est probant | Date de publication horodatée, destinataires comptés, notifications tracées. | `POST /annonces/{id}/publier` (Idempotency-Key) → `ANNONCE_PUBLIEE` (push / centre in-app selon préférence) ; URGENCE → `ANNONCE_URGENTE` push + SMS (si fournisseur) ; audit `ANNONCE_PUBLIEE`. Publication programmée : reste brouillon jusqu'au job horaire. |
| Lu par n / N, jamais « qui » entre résidents | Doc A §12 : les résidents ne se surveillent pas. | `annonce_lecture` unique (annonce, utilisateur) ; RLS : chacun lit la sienne, syndic / conseil lisent toutes ; `GET /annonces/{id}/lectures` gestion seule ; `nbLectures` nul pour un résident. |
| Commentaires modérés, jamais supprimés | Le syndic masque (motif d'audit), le contenu reste. | `annonce_commentaire.masque_par_id` ; RLS : masqué visible du syndic et de l'auteur ; limite 10 / 10 min / utilisateur ; désactivables par annonce (422 `COMMENTAIRES_DESACTIVES`). |
| Sondage = avis, pas vote | Doc A §6 : seule l'AG décide. | `sondage` + `sondage_reponse` unique (sondage, utilisateur) ; mention obligatoire (API, PDF, UI) ; pondération par tantièmes INFORMATIVE ; résultats agrégés uniquement (`sondage_resultats()` SECURITY DEFINER) — même le syndic ne lit aucune ligne de réponse (RLS : chacun la sienne). |
| Numéros utiles | Urgences nationales + prestataires de la résidence. | `contact_utile` (libellé, téléphone, ordre) ; lecture tout membre, gestion syndic ; tap-to-call. |
| Préférences respectées | Le résident choisit son canal. | `utilisateur.preferences_notification_json` (digest hebdo on/off, canal, push des annonces) — ⚠️ colonne ajoutée et signalée ; URGENCE toujours envoyée. |

## 18.1 — Cycle de vie

| Objet | Statuts | Transitions |
| --- | --- | --- |
| Annonce | `BROUILLON` → `PUBLIEE` → `ARCHIVEE` | publier (immédiat / programmé, fan-out), archiver (quitte le tableau, lectures conservées) ; un brouillon se supprime, une annonce publiée ne se supprime jamais. |
| Sondage | `BROUILLON` → `OUVERT` → `CLOS` | ouvrir (`SONDAGE_OUVERT` à l'audience), clore (manuel ou job à `date_fin`, `SONDAGE_CLOS` avec le nombre de réponses) ; un sondage ouvert ne se modifie plus (les réponses seraient faussées). |

Réponse : une seule par membre (409 `SONDAGE_DEJA_REPONDU`), options contrôlées (422
`SONDAGE_CHOIX_INVALIDE`), refusée hors OUVERT ou après `date_fin` (422 `SONDAGE_STATUT_INVALIDE`).
Résultats visibles de la gestion, de quiconque a répondu, et de tous à la clôture.

## 18.2 — Contenu et sécurité

- Markdown restreint : gras, italique, listes, liens http(s), paragraphes. `assainirMarkdown` échappe
  tout HTML, retire `javascript:` / `data:` et les liens non http(s) ; idempotent. Rendu web sans
  `dangerouslySetInnerHTML`, mobile en texte enrichi.
- Pièces jointes : `document.type = ANNONCE_PJ`, visibilité PUBLIC_COPROPRIETE, liées par
  `document.annonce_id` (⚠️ colonne ajoutée), périmètre `<copropriete>/communication/`.
- Identités : `communication_identites(uuid[])` (SECURITY DEFINER) ne renvoie que nom / prénom de
  membres du tenant — jamais téléphone ni e-mail — pour afficher l'auteur à un résident.

## 18.3 — Jobs

| Job | Cron | Effets | Idempotence |
| --- | --- | --- | --- |
| `communication-digest-hebdo` | lundi 09:00 | par membre : annonces publiées non lues + sondages ouverts de son audience, sur le canal de sa préférence (`COMMUNICATION_DIGEST`). | une notification par utilisateur et par semaine ISO (recherche de l'envoi existant) ; préférence `AUCUN` / digest désactivé = rien. |
| `communication-programmees-horaire` | toutes les heures (h+5) | publie les annonces programmées échues (fan-out), clôt les sondages dont `date_fin` est passée. | statut vérifié dans la transaction ; rejeu = 0 effet. |

## 18.3 bis — Notifications sur le téléphone (push par niveau)

> Master Spec 13.4 (FCM) + brief §8.2 (deep-links). Une seule classification pilote Android et iOS ;
> elle est calculée côté API (`push-niveaux.ts`) et voyage avec chaque push FCM **et** chaque
> événement du flux temps réel, pour que l'app affiche la même bannière quel que soit le chemin.

| Niveau | Templates | Android | iOS | Écran verrouillé | Désactivable |
| --- | --- | --- | --- | --- | --- |
| **URGENT** | visiteur à la porte (`VISITE_NOUVELLE` / `VISITE_REPONSE`), `INCIDENT_URGENCE_MAXIMALE`, `ANNONCE_URGENTE`, arrivée LCD, dépassement visiteur, véhicule gênant, badge perdu, `IMPAYE_N4..N6`, `AG_OUVERTE`, assurance absente, échéance de contrat manquée, `MANDAT_PROPOSE` | canal `syndicup_urgent` importance MAX (alerte « heads-up » qui reste), son + vibration, `PRIORITY_MAX` | `interruption-level: time-sensitive` (passe Concentration / Ne pas déranger — droit *Time Sensitive Notifications* dans `Runner.entitlements`), son, badge | oui, contenu visible (`visibility PUBLIC`) | **non** — ignore aussi les heures calmes |
| **NORMAL** | par défaut : appels de fonds, incidents, réservations, tâches, AG, dépenses, contrats, paie… | canal `syndicup` importance HIGH, son | `active`, son, badge | oui | `push_normal` |
| **INFO** | documents, PV, rapports, récapitulatifs, sondages, annonces simples, confirmations (paiement reçu, badge remis, mandat confirmé…) | canal `syndicup_info` importance DEFAULT, sans son | `passive` (pas de réveil de l'écran), badge | oui | `push_info` |
| **SILENCIEUX** | synchronisation du badge après « marquer comme lu » (`BADGE_SYNC`, pas de ligne `notification`) | données seules, priorité normale | `content-available`, `apns-push-type: background`, `badge` | — | — |

- **Préférences** (`PUT /users/me/preferences-notification`, web Profil / mobile « Notifications de la
  résidence ») : `push_normal`, `push_info`, `push_son`, `heures_calmes {debut, fin}` (heure de
  Casablanca ; pendant la plage NORMAL / INFO sont livrés sans son au niveau passif). Un niveau
  désactivé laisse la notification visible in-app (statut `EN_ATTENTE`, jamais un `ENVOYE` simulé).
- **Badge d'icône** = nombre de non lues du destinataire (`aps.badge`, `notification_count`) ; l'app
  l'aligne sur le compteur du flux et l'efface à zéro (iOS via canal natif `ma.syndicup.app/badge`).
- **Fils** (`thread-id` / `groupKey`) par domaine : `ag`, `finances`, `incidents`, `acces`,
  `reservations`, `communication`, `taches`, `contrats`, `personnel`, `cabinet`.
- **Actions** : « Ouvrir » (deep-link `notifications_link`) et « Marquer comme lu » (catégorie iOS
  `SYNDICUP_NOTIFICATION`, boutons Android) → `PATCH /notifications/{id}/read`.
- **Sans Firebase** (build local) : le flux temps réel porte les bannières — un événement reçu alors
  que l'app n'est pas au premier plan devient une notification système ; URGENT s'affiche même
  l'app ouverte. Avec Firebase, le push au premier plan n'est pas doublé quand le flux est connecté.
- **Permission** demandée après la connexion (Android 13+ `POST_NOTIFICATIONS`, iOS alerte + badge +
  son), jamais au lancement. Les alertes *critiques* Apple (droit spécial) ne sont pas utilisées.

## 18.4 — Liens avec les autres modules

- **M18 Rapports** : export `ANNONCES` (csv / xlsx, gestion) journalisé dans `export_log`.
- **M19 / M20** : les notifications existantes restent des événements système ; le tableau
  d'affichage porte la parole du syndic (travaux, AG, règlement).
- **M22 Tâches** : une annonce TRAVAUX pourra référencer la tâche ; non lié dans ce module.
- **M25 Cabinet** : le gestionnaire de cabinet publie au nom de la copropriété (rôle à venir).
