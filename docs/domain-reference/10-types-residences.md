# Doc A — Types de Résidences — Règles Spécifiques Complètes

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s10`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 2 (copropriete.type_residence, config_json).

---

## Types de Résidences — Règles Spécifiques Complètes

### 10.1 — Matrice de Configuration par Type de Résidence

| Module / Feature | Immeuble collectif | Résidence fermée | Résidence villas | Immeuble bureaux | Immeuble mixte | Résidence étudiante |
| --- | --- | --- | --- | --- | --- | --- |
| Gestion lots appartements | ✓ Core | ✓ | — (villas) | ✓ bureaux | ✓ | ✓ |
| Gestion lots villas | — | ✓ | ✓ Core | — | — | — |
| Parkings sous-terrain | ✓ fréquent | ✓ | — (extérieur) | ✓ | ✓ | — |
| Ascenseur | ✓ si > R+2 | — | — | ✓ | ✓ | ✓ |
| Piscine collective | rare | ✓ | ✓ | — | — | — |
| Voirie interne | — | ✓ | ✓ | — | — | — |
| Sécurité 24h/24 | rare | ✓ | ✓ | ✓ | partiel | — |
| Portail / Contrôle accès | interphone | ✓ portail | ✓ portail | badge | partiel | interphone |
| Rotation locataires élevée | — | — | — | — | — | ✓ Core |
| AG fréquentes (+ 1/an) | standard | ✓ | — | — | — | — |
| Charges commerciales distinctes | — | — | — | ✓ | ✓ Core | — |
| Espaces verts importants | minimal | ✓ | ✓ | — | — | — |

### 10.2 — Cas Spéciaux par Type de Résidence

| Type résidence | Cas spécial | Règle | Gestion plateforme |
| --- | --- | --- | --- |
| Résidence fermée / Gated community | Accès visiteurs avec badge temporaire | Visiteur reçoit badge temporaire valable X heures | Module contrôle accès (post-MVP hardware). Dans MVP : gardien gère accès + enregistre visiteur dans app. |
| Résident loue sa villa via Airbnb | Règlement intérieur peut interdire la location courte durée (nuisances). À voter en AG. | Paramètre règlement : location_courte_duree = AUTORISEE / INTERDITE / ENCADREE. Si incident Airbnb = signalement facilité. |
| Charges sécurité très élevées (50% du budget) | Résidents peuvent contester si sécurité inefficace | Détail budget par poste visible dans app. Résidents voient que 50% va à la sécurité → discussion en AG. |
| Panne portail principal bloquant toute la résidence | Incident critique — tous les résidents impactés | Ticket URGENT + notification mass push à tous. Accès piéton alternatif activé par gardien. |
| Résidence étudiante / locative | Rotation locataires mensuelle | Codes d'invitation renouvelés fréquemment. Comptes désactivés rapidement. | Workflow rapide désactivation/invitation. Durée d'invitation configurable (7j, 24h, 48h). Mode "rotation rapide" sur la copropriété. |
| Locataire étudiant mineur (moins de 18 ans) | Le tuteur légal est responsable. L'étudiant peut utiliser l'app. | Compte étudiant lié à un compte tuteur. Notifications importantes envoyées au tuteur. |
| Fin d'année universitaire — départs massifs | Tous les étudiants partent en même temps | Outil de désactivation groupée + invitation groupée pour nouveaux locataires. Workflow "changement saisonnier". |
| Immeuble mixte résidentiel/commercial | Commerce fait des livraisons à 6h du matin | Conflit avec résidents. Horaires livraisons peuvent être réglementés en AG. | Règlement intérieur : horaires_livraisons configurable. Incidents nuisances liés au lot commercial tracés. |
| Restaurant veut installer une terrasse sur partie commune | Nécessite accord AG et éventuellement redevance à la copropriété | Résolution AG spécifique. Si accordée : redevance = entrée finances copropriété. Durée de l'autorisation limitée. |
| Commerce génère des odeurs dans les parties communes | Nuisance caractérisée. Mise en demeure possible. | Incident catégorie NUISANCES lié au lot commercial. Escalade si récurrent. |
| Immeuble neuf (promoteur) | Vice caché découvert après livraison | Garantie décennale (10 ans structure) et biennale (2 ans équipements) du promoteur. | Module garanties : suivi des réclamations sous garantie. Incidents liés au promoteur (responsable) vs copropriété. Dates de garantie saisies à la création. |
| Promoteur tarde à remettre les documents (règlement, plans) | Obligation légale de transmission dans les 3 mois après livraison | Checklist documents à recevoir du promoteur. Alerte si non reçus dans les délais. |
