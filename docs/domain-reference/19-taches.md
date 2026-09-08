# Tâches — suivi des décisions et des obligations du syndic

> Domaine dérivé de Doc A §6 (les résolutions adoptées doivent être exécutées par le syndic, et
> les copropriétaires doivent pouvoir le vérifier) et §8 (obligations récurrentes du syndic :
> contrats, assurances, rapports, déclarations). Les incidents (§5) traitent les pannes ; la tâche
> porte le « à faire » du syndic, visible du conseil syndical. Doc A ne décrit pas de gestion de
> tâches : ce fichier fixe le module M22 — il ne réécrit pas Doc A. Le délai d'exécution d'une
> résolution est PROVISOIRE (brief §13).

---

## 19.0 — Principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| Une décision se suit | Doc A §6 : une résolution adoptée engage le syndic ; le copropriétaire doit voir qu'elle est exécutée. | `ag_resolution.necessite_execution` (⚠️ ajout) : à l'adoption, tâche `RESOLUTION_AG` « Exécuter la résolution … » assignée au syndic, échéance = date de l'AG + `copropriete.delai_execution_resolution_jours` (nullable, PROVISOIRE : non configuré = sans échéance). `GET /ag/{id}/resolutions/{resolutionId}/execution` (fonction SECURITY DEFINER) expose titre / statut / dates à tout membre voyant l'AG — jamais l'assigné ni les commentaires. |
| Les modules créent leurs tâches | Renouvellement de contrat, visite technique, incident résolu à régler, rapport à soumettre. | Hooks idempotents (une tâche par objet source) : `contrat_echeance.tache_id` (échéances non financières), `tache.incident_id` (RESOLU avec dépense BROUILLON / A_APPROUVER / APPROUVEE), `tache.rapport_gestion_id` (GENERE → terminée à la soumission). Aucune tâche pour une échéance PAIEMENT (c'est la dépense M16). |
| Récurrence | Obligations mensuelles / trimestrielles / semestrielles / annuelles. | `recurrence_json { frequence }` : à la clôture TERMINEE, l'occurrence suivante est créée une seule fois (`recurrence_parente_id`, checklist remise à zéro, même assigné(e)), origine `SYSTEME`. |
| Qui voit quoi | Doc A §12 : le conseil contrôle ; le personnel ne voit que ce qui le concerne. | RLS `tache` : syndic tout ; conseil si `visible_conseil` ; assigné(e) ses tâches. Écriture : syndic ; l'assigné(e) met à jour statut et checklist de SES tâches (jamais l'annulation) et crée l'occurrence suivante de sa tâche récurrente. |
| Journal probant | Chaque transition est tracée. | `tache_log` append-only (CREEE, MODIFIEE, STATUT_CHANGE, ASSIGNEE, CHECKLIST, COMMENTAIRE, DOCUMENT_AJOUTE, RECURRENCE, RAPPEL) + `audit_log` `TACHE_*`. |
| Hors-ligne | Le gardien met à jour ses tâches depuis la loge, sans réseau. | Mobile : file Drift `taches_queue` (Idempotency-Key = id de ligne) ; `POST /taches/{id}/statut` rejouable (même statut → `deja: true`, jamais une seconde occurrence). La photo de fin de tâche s'envoie en ligne. |

## 19.1 — Cycle de vie

| Statut | Transitions | Effets |
| --- | --- | --- |
| `A_FAIRE` | → EN_COURS / BLOQUEE / TERMINEE / ANNULEE | — |
| `EN_COURS` | → A_FAIRE / BLOQUEE / TERMINEE / ANNULEE | — |
| `BLOQUEE` | → A_FAIRE / EN_COURS / TERMINEE / ANNULEE | notification au syndic quand l'assigné(e) bloque. |
| `TERMINEE` | → A_FAIRE (réouverture syndic) | `terminee_le`, occurrence suivante (récurrence), échéance de contrat liée REALISEE. |
| `ANNULEE` | → A_FAIRE | syndic seul ; une échéance de contrat annulée annule sa tâche. |

Priorités BASSE / NORMALE / HAUTE / CRITIQUE ; `en_retard` = ouverte avec échéance passée. Une
tâche TERMINEE / ANNULEE ne se modifie plus (422 `TACHE_STATUT_INVALIDE`) ; l'assigné(e) doit être
syndic, conseil ou personnel (422 `TACHE_ASSIGNEE_INVALIDE`).

## 19.2 — Rappels

| Job | Cron | Effets | Idempotence |
| --- | --- | --- | --- |
| `taches-rappels-quotidien` | 08:00 | J-3, J-0 et retard → `TACHE_ECHEANCE` à l'assigné(e) (au syndic sans assigné) ; le lundi, `TACHES_EN_RETARD_HEBDO` au syndic et au conseil. | `rappel_j3_le` / `rappel_j0_le` / `rappel_retard_le` ; synthèse une fois par semaine ISO (notification existante). |

Notifications FR/AR : `TACHE_ASSIGNEE`, `TACHE_STATUT`, `TACHE_COMMENTAIRE`, `TACHE_ECHEANCE`,
`TACHES_EN_RETARD_HEBDO` — deep-links vers la tâche (web / mobile).

## 19.3 — Liens avec les autres modules

- **M6 AG** : `necessite_execution` à la création de la résolution ; suivi d'exécution sur la
  fiche AG (web / mobile), lisible par les copropriétaires.
- **M16 Dépenses / M4 Incidents** : tâche « Régler la dépense de l'incident » à la résolution.
- **M18 Rapports** : tâche « Soumettre le rapport de gestion à l'AG », close par la soumission.
- **M19 Contrats** : une tâche par échéance RENOUVELLEMENT / VISITE_TECHNIQUE /
  CONTROLE_REGLEMENTAIRE / AUTRE, réalisée ou annulée avec l'échéance.
- **M20 Personnel** : le gardien reçoit ses tâches (onglet mobile « Tâches », hors-ligne).
- **M21 Communication** : une annonce TRAVAUX peut renvoyer vers la tâche (lien manuel).
