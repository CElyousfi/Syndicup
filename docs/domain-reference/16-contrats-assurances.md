# Contrats, assurances, échéances — « rien n'expire sans qu'on le sache »

> Domaine dérivé de Doc A §7 (parties communes : ascenseur, nettoyage, gardiennage, jardins —
> chaque service repose sur un contrat récurrent), §8 (obligations du syndic : assurance de
> l'immeuble obligatoire, responsabilité personnelle en cas de manquement), §5 (interventions :
> le prestataire sous contrat intervient en priorité). Doc A ne détaille ni le cycle de vie d'un
> contrat ni l'échéancier : ce fichier les fixe pour le module M19 — il ne réécrit pas Doc A. Le
> seuil d'engagement en AG et l'obligation d'assurance sont PROVISOIRES (brief §10).

---

## 16.0 — Principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| Un contrat = un échéancier | Une copropriété vit sur 5 à 15 contrats récurrents ; rater un renouvellement ou une échéance d'assurance est la première responsabilité du syndic. | `contrat` + `contrat_echeance` (PAIEMENT selon la périodicité, RENOUVELLEMENT à `date_fin − préavis`, échéances manuelles : visite technique, contrôle réglementaire), matérialisées 12 mois à l'avance, idempotentes (unique contrat / type / date). |
| L'assurance est un contrat | Doc A §8 : l'assurance immeuble est obligatoire ; les polices RC complètent. | `type ASSURANCE_IMMEUBLE / ASSURANCE_RC` + `details_assurance_json` (assureur, n° de police, garanties, franchise, capital) + attestation (Document `ATTESTATION_ASSURANCE`, visible du conseil). Aucune table séparée. |
| L'absence d'assurance remonte | Invariant de copropriété : au moins une ASSURANCE_IMMEUBLE ACTIVE non échue. | `GET /contrats/assurance`, bannière rouge (web / mobile), indicateur M18, job mensuel `ASSURANCE_IMMEUBLE_ABSENTE` au syndic et au conseil (au plus une fois par 28 jours). |
| Le contrat nourrit la dépense | Miroir de M16 : une échéance de paiement devient une dépense BROUILLON liée au contrat, au poste et au prestataire. | `POST /contrats/{id}/echeances/{eid}/generer-depense` (Idempotency-Key) → `depense.contrat_id`, échéance `DEPENSE_GENEREE` ; le cycle d'approbation / paiement reste celui de M16. |
| Engagement voté quand il pèse | Doc A §8.3 : les engagements importants passent par l'AG. | `copropriete.seuil_contrat_ag` (nullable, PROVISOIRE) : montant de période au-dessus → `resolution_ag_id` ADOPTEE obligatoire à l'activation (422 `CONTRAT_RESOLUTION_AG_REQUISE`). Non configuré = aucun contrôle, jamais deviné. |
| Confidentialité §12.3 | Contrats prestataires = syndic_only ; le conseil contrôle. | RLS `contrat*` : syndic + conseil ; contrat signé SYNDIC_ONLY, attestation CONSEIL_SYNDICAL ; résidents, gardien, prestataire : rien. `contrat_log` append-only. |

## 16.1 — Cycle de vie

| Statut | Sens | Qui | Effets |
| --- | --- | --- | --- |
| `BROUILLON` | Saisi, non signé / non démarré. | Syndic | Modifiable ; échéances manuelles possibles. |
| `ACTIF` | En cours. | Syndic (`/activer`, Idempotency-Key) | Contrôle du seuil AG ; échéancier des 12 prochains mois généré ; rappels J-30 / J-7. |
| `SUSPENDU` | Pause (litige, travaux…). | Syndic | Rappels et expiration suspendus ; réactivation par `/activer`. |
| `RESILIE` | Fin anticipée, motif obligatoire, date de résiliation. | Syndic | Échéances postérieures ANNULEE ; plus modifiable. |
| `EXPIRE` | `date_fin` atteinte sans reconduction tacite. | Job quotidien | Échéances futures ANNULEE ; `CONTRAT_EXPIRE` ; apparaît dans « à renouveler » 90 jours. |

Reconduction tacite (`tacite = true`) : à `date_fin`, le job prolonge d'une durée égale à la
période initiale (mois calendaires, fin incluse : 01/01 → 31/12 = 12 mois), régénère l'échéancier
et journalise `RECONDUIT` (`CONTRAT_RECONDUIT`). Toute transition écrit `contrat_log` + `audit_log`.

## 16.2 — Échéancier

| Type | Génération | Statuts |
| --- | --- | --- |
| `PAIEMENT` | Automatique : MENSUELLE / TRIMESTRIELLE / SEMESTRIELLE / ANNUELLE calées sur `date_debut` (fin de mois bornée : 31/01 → 28/02 → 31/03) ; PONCTUELLE = une seule ; montant = `montant_periode`. | `A_VENIR` → `DEPENSE_GENEREE` (dépense créée) → `REALISEE` ; `MANQUEE` (date passée sans dépense, job) ; `ANNULEE`. |
| `RENOUVELLEMENT` | Automatique : `date_fin − preavis_jours`. Tâche M22 posée quand la table `tache` existe. | `A_VENIR` → `REALISEE` / `ANNULEE`. |
| `VISITE_TECHNIQUE`, `CONTROLE_REGLEMENTAIRE`, `AUTRE` | Manuelles (`POST /contrats/{id}/echeances` avec `type` + `date_echeance`). | idem |

Rappels : `CONTRAT_ECHEANCE_PROCHE` à J-30 puis J-7 au syndic, une seule fois chacun
(`notifie_j30_le` / `notifie_j7_le`) ; une échéance déjà à moins de 7 jours ne reçoit que le J-7.
`GET /contrats/echeancier?from&to` alimente le calendrier ; `GET /contrats/a-renouveler?jours`
liste les fins proches et les expirés récents.

## 16.3 — Jobs

| Job | Cron | Effets | Idempotence |
| --- | --- | --- | --- |
| `contrats-echeances-quotidien` | 06:00 | 1) fins de contrat : reconduction tacite ou EXPIRE ; 2) PAIEMENT dépassés → MANQUEE (`CONTRAT_ECHEANCE_MANQUEE`) ; 3) rappels J-30 / J-7. | marqueurs posés dans la même transaction ; rejeu = 0 effet (test). |
| `contrats-assurance-mensuel` | 1er du mois 08:00 | aucune ASSURANCE_IMMEUBLE ACTIVE non échue → `ASSURANCE_IMMEUBLE_ABSENTE` syndic + conseil. | `copropriete.assurance_alerte_envoyee_le` (28 jours), remis à zéro dès qu'une police est active. |

## 16.4 — Liens avec les autres modules

- **M16 Dépenses** : `depense.contrat_id` ; `GET /depenses?contrat_id=` ; catégorie déduite du poste
  ou du type (`CATEGORIE_CONTRAT_VERS_DEPENSE`).
- **M18 Rapports** : tableau de bord `contrats` (actifs, à échoir 30 j, expirés 90 j, échéances 30 j,
  manquées, assurance) ; faits marquants du rapport de gestion = contrats démarrés dans l'exercice ;
  export `CONTRATS` (csv / xlsx, journalisé).
- **M22 Tâches** : échéances RENOUVELLEMENT → tâche de renouvellement (colonne `tache_id` posée).
- **M7 Incidents / M16 Prestataires** : le prestataire sous contrat est proposé en premier.

## 16.5 — Hors périmètre / à confirmer

- Seuil d'engagement en AG (montant, base légale) et sanction de l'absence d'assurance : brief §10.
- Signature électronique du contrat : le PDF signé est un document, pas une signature qualifiée.
- Renouvellement automatique avec révision de prix (indexation) : non modélisé ; le syndic
  modifie `montant_periode` (échéancier régénéré).
