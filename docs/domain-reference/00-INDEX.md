# Doc A — Index des domaines métier

Source originale : `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (conservée intacte dans le projet — ces fichiers en sont une conversion pour usage agent, pas une nouvelle source de vérité).

Objectif : qu'un agent de codage ne charge en contexte que le domaine sur lequel il travaille au lieu du document complet (~124k caractères / 200+ cas).

| Fichier | Domaine | Réf. Master Spec |
|---|---|---|
| [`01-lots-taxonomie.md`](./01-lots-taxonomie.md) | Taxonomie des Lots & Types de Propriété | Partie 2 (lot), Partie 17 §1 |
| [`02-proprietaires-occupants-statuts.md`](./02-proprietaires-occupants-statuts.md) | Propriété, Occupation & Statuts des Résidents | Partie 2 (utilisateur, lot_proprietaire, lot_occupant, succession), Partie 5 |
| [`03-charges-finances.md`](./03-charges-finances.md) | Charges & Finances — Tous les Cas | Partie 6 (Moteur Financier), Partie 2 (finances) |
| [`04-parkings.md`](./04-parkings.md) | Parkings — Règles Complètes & Tous les Scénarios Maroc | Partie 2 (lot — type_lot=parking) |
| [`05-incidents-interventions.md`](./05-incidents-interventions.md) | Incidents & Interventions — Tous les Scénarios | Partie 2 (incident), Partie 17 §5 |
| [`06-assemblees-generales.md`](./06-assemblees-generales.md) | Assemblées Générales — Tous les Cas Loi 18-00 | Partie 8 (Moteur AG), Partie 2 (assemblées générales) |
| [`07-parties-communes.md`](./07-parties-communes.md) | Parties Communes — Gestion & Conflits | Partie 2 (espace_commun, reservation_espace_commun) |
| [`08-syndic.md`](./08-syndic.md) | Le Syndic — Mandats, Changements & Conflits | Partie 4 (rôle syndic), Partie 5 (cycle de vie) |
| [`09-personnel-gardien.md`](./09-personnel-gardien.md) | Personnel de l'Immeuble — Gardien & Concierge | Partie 2 (personnel, visite), Partie 13.3 (offline) |
| [`10-types-residences.md`](./10-types-residences.md) | Types de Résidences — Règles Spécifiques Complètes | Partie 2 (copropriete.type_residence, config_json) |
| [`11-onboarding-cycle-vie.md`](./11-onboarding-cycle-vie.md) | Onboarding & Cycle de Vie Utilisateur | Partie 5 (Onboarding & Cycle de Vie Utilisateur — remplace ce §11) |
| [`12-conflits-litiges-confidentialite.md`](./12-conflits-litiges-confidentialite.md) | Conflits, Litiges & Cas Limites | Partie 2.3 (RLS), Partie 4 (RBAC), Partie 10 (Sécurité) |
| [`13-location-courte-duree.md`](./13-location-courte-duree.md) | Location courte durée (côté copropriété : régime, déclarations, séjours, gardien, nuisances) — dérivé de Doc A §10.2, module M15 | Partie 2 (copropriete.regime_lcd, lot_location_courte_duree, sejour_courte_duree, sejour_evenement), Partie 4 (rôle GESTIONNAIRE_LCD) |
| [`14-depenses-comptabilite.md`](./14-depenses-comptabilite.md) | Dépenses, factures, fournisseurs, postes budgétaires — « l'argent qui sort » (cycle d'approbation, paiement, fonds de réserve, budget vs réalisé) — dérivé de Doc A §3, §6, §8, module M16 | Partie 2 (budget_poste, depense, facture, depense_log, fonds_reserve_mouvement.depense_id), Partie 6 (Moteur Financier) |
| [`15-rapports-transparence.md`](./15-rapports-transparence.md) | Rapports, rapport de gestion annuel, exports, transparence « où va mon argent », relevé de charges (« état daté ») — dérivé de Doc A §8, §6, §3.5, §11, module M18 | Partie 2 (rapport_gestion, export_log, copropriete.factures_visibles_residents), Partie 6 (Moteur Financier), Partie 9 (documents RAPPORT_GESTION) |
