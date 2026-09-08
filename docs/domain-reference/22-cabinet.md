# Cabinet de syndic — portefeuille multi-résidences

> Domaine dérivé de Doc A §8 (syndic professionnel : un cabinet gère plusieurs copropriétés avec une
> petite équipe — gestionnaires, comptable) et Master Spec Partie 1.6 / 4 (isolation par
> copropriété, rôles par `role_utilisateur`). Aujourd'hui les rôles sont par copropriété et
> l'utilisateur change de résidence une par une : ce module ajoute l'espace « cabinet » (équipe,
> mandats, portefeuille, agenda, alertes, annuaire) SANS toucher au modèle d'isolation. Doc A ne
> décrit pas la mécanique du cabinet : ce fichier fixe le module M25 — il ne réécrit pas Doc A.
> Le mandat (majorité, honoraires) est PROVISOIRE (brief §16).

---

## 22.0 — Principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| **L'accès à une copropriété passe UNIQUEMENT par `role_utilisateur`** | Partie 1.6 : deux couches (permissions + RLS par copropriété) — l'une n'est jamais une excuse pour relâcher l'autre. | Les policies RLS des tables de copropriété **ne regardent jamais** `cabinet_membre`. La réconciliation `cabinet_appliquer_acces(cabinet)` (SECURITY DEFINER) pose / réactive / désactive les lignes `role_utilisateur` marquées `cabinet_id` : gestionnaire principal d'un mandat ACTIF → `SYNDIC` ; membre `CABINET_COMPTABLE` → `SYNDIC_COMPTABLE` (⚠️ rôle ajouté, lecture seule des finances). Retirer un membre, changer de gestionnaire ou terminer un mandat révoque ces rôles **dans la même transaction**. La claim JWT `roles` suit à l'émission suivante du jeton. |
| Un seul syndic actif | Partie 2.4 : index unique `role_syndic_unique_actif`. | Le cabinet ne remplace le syndic en place que par une **passation confirmée par lui** (`cabinet_mandat_confirmer`) : son rôle SYNDIC est désactivé, le gestionnaire principal reçoit le sien, la copropriété est rattachée (`copropriete.cabinet_id`), les accès appliqués — atomiquement. Une copropriété créée par le cabinet a un mandat ACTIF immédiat. |
| Espace cabinet hors copropriété | Un administrateur de cabinet n'a pas forcément de rôle de copropriété. | Contexte « acteur » (`withActeur` : `app.current_user_id` seul) ; tables `cabinet*` protégées par `cabinet_role_courant(cabinet)` (membre actif ou SUPER_ADMIN). Les routes `/cabinets/*` s'authentifient par le JWT seul (`acteurFromRequest`). Un membre sans aucun rôle de copropriété entre en mode « cabinet seul » (rôle applicatif `MEMBRE_CABINET`, clients uniquement) : espace cabinet et profil, pas de copropriété active. |
| Portefeuille instantané | 5 à 40 copropriétés, un tableau en une requête. | Vue matérialisée `portefeuille_kpi` (une ligne par copropriété : lots, appelé / encaissé / taux, impayés (montant, lots), justificatifs en attente, incidents ouverts / urgents, tâches en retard, prochaine AG, contrats expirant 30 j, assurance active, séjours LCD du jour, dernière activité) rafraîchie toutes les 15 min (job `portefeuille-kpi-refresh`) ; jamais lue directement par `application_role` : `cabinet_portefeuille(cabinet)` applique l'appartenance (ADMIN / COMPTABLE / SUPER_ADMIN : tout ; GESTIONNAIRE : ses copropriétés). Alertes calculées avec les paramètres du cabinet (`seuil_recouvrement`, `delai_justificatifs_jours`). |
| Agenda et alertes transverses | Le cabinet pilote toutes ses résidences. | Agenda fusionné (AG, échéances de contrats, tâches, paie, fins de mandat) et flux d'alertes (assurance absente, recouvrement < seuil, tâches en retard, justificatifs > N jours, incidents urgents) calculés copropriété par copropriété sur les mandats visibles (`cabinet_coproprietes_visibles`). |
| Honoraires | Doc A §8 : le mandat du syndic professionnel est rémunéré. | `honoraires_mensuels` → contrat `SYNDIC_PROFESSIONNEL` mensuel (M19) créé à la confirmation, dont les échéances PAIEMENT alimentent les dépenses `HONORAIRES_SYNDIC` (M16). Montant PROVISOIRE (brief §16). |
| Annuaire partagé | Les mêmes prestataires reviennent d'une résidence à l'autre. | `cabinet_prestataire` (modèles) copiés dans une copropriété (`prestataire.cabinet_prestataire_id`, copie idempotente) — jamais une référence partagée (RLS par copropriété). |
| Marque | Le cabinet signe ses documents. | Rapport de gestion et relevés portent « Géré par <cabinet> » (`cabinet_marque(copropriete)`) en plus du logo de la copropriété. |
| Journal | Chaque geste est tracé. | `cabinet_log` append-only (CABINET_*, MEMBRE_*, MANDAT_*, ACCES_APPLIQUE, PRESTATAIRE_MODELE) + `audit_log` côté copropriété (`MANDAT_PROPOSE/CONFIRME/TERMINE`, `MANDAT_CONTRAT_HONORAIRES`). |

## 22.1 — Rôles et visibilité

| Rôle cabinet | Espace cabinet | Copropriétés (via `role_utilisateur`) |
| --- | --- | --- |
| `CABINET_ADMIN` | tout : équipe, mandats, paramètres, portefeuille complet | SYNDIC des copropriétés dont il est gestionnaire principal |
| `CABINET_GESTIONNAIRE` | portefeuille / agenda / alertes de **ses** copropriétés, annuaire | SYNDIC des copropriétés dont il est gestionnaire principal |
| `CABINET_COMPTABLE` | portefeuille complet (lecture) | `SYNDIC_COMPTABLE` sur tous les mandats actifs : lecture des finances (policies SELECT additives sur les tables finances / contrats / lots), jamais d'écriture |

Cycle d'un mandat : `EN_ATTENTE → ACTIF → TERMINE` (un seul mandat actif par copropriété).

## 22.2 — Liens avec les autres modules

- **M1 / M2** : `role_utilisateur.cabinet_id`, claim JWT inchangée (les rôles de copropriété suffisent).
- **M5 / M17 / M16** : KPI (appelé, encaissé, impayés, justificatifs) ; dépenses d'honoraires.
- **M19 Contrats** : contrat `SYNDIC_PROFESSIONNEL` du mandat ; échéances dans l'agenda.
- **M20 Personnel** : paie dans l'agenda.
- **M22 Tâches** : tâches en retard (KPI, alertes, agenda).
- **M24 Import** : une nouvelle résidence du portefeuille démarre par l'import et la checklist.
- **M18 PDF** : marque du cabinet en en-tête.
