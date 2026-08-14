# Doc A — Parties Communes — Gestion & Conflits

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s7`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 2 (espace_commun, reservation_espace_commun).

---

## Parties Communes — Gestion & Conflits

### 7.1 — Inventaire des Parties Communes par Type de Résidence

| Partie commune | Immeuble | Résidence fermée | Villas | Bureaux | Règles spécifiques |
| --- | --- | --- | --- | --- | --- |
| Hall d'entrée / Lobby | ✓ | ✓ | ✓ (guérite) | ✓ | Propreté obligatoire. Décoration = décision AG. |
| Escaliers et couloirs | ✓ | — | — | ✓ | Aucun dépôt autorisé (sécurité incendie). |
| Ascenseur(s) | ✓ | — | — | ✓ | Contrat de maintenance obligatoire. Vérification annuelle. |
| Terrasse toit commune | ✓ | — | — | ✓ | Accès selon règlement. Peut être privatisée partiellement en AG. |
| Piscine collective | Rare | ✓ | ✓ | — | Règles d'hygiène strictes. Heures d'accès. Prestataire traitement eau. |
| Salle de sport / Gym | Rare | ✓ | ✓ | ✓ | Règles d'usage, horaires, équipements listés et inventoriés. |
| Salle polyvalente / Réunion | ✓ | ✓ | ✓ | ✓ | Réservable. Caution possible. Remise en état après usage. |
| Local gardien / loge | ✓ | ✓ | ✓ | ✓ | Logement de service. Règles usage définies dans contrat gardien. |
| Local poubelles / déchets | ✓ | ✓ | ✓ | ✓ | Séparation tri si règlement. Nettoyage = charge copropriété. |
| Parking commun / visiteurs | ✓ | ✓ | ✓ | ✓ | Règles d'usage votées AG. Horaires éventuels. |
| Voirie interne | — | ✓ | ✓ | — | Entretien, signalisation = charge copropriété. Vitesse limitée. |
| Espaces verts collectifs | ✓ | ✓ | ✓ | — | Prestataire jardinage. Règles (pas de vélos sur pelouse, etc.). |
| Réseau eau/électricité commun | ✓ | ✓ | ✓ | ✓ | Entretien = charge copropriété. Compteurs individuels = propriétaire + ONEE/REDAL. |
| Antenne / Fibre collective | ✓ | ✓ | ✓ | ✓ | Déployée par opérateur ou copropriété. Entretien = copropriété si infrastructure commune. |
| Guérite de sécurité / Portail | — | ✓ | ✓ | — | Personnel sécurité = charge copropriété. Portail électrique = maintenance. |

### 7.2 — Réservations d'Espaces Communs — Tous les Cas

| Cas | Règle | Gestion plateforme |
| --- | --- | --- |
| Réservation simple salle polyvalente | Réservation + validation syndic + remise en état | Formulaire : espace, date/heure début-fin, objet (réunion famille, AG...), nombre de personnes. Validation manuelle ou auto selon paramètre. |
| 2 résidents veulent le même créneau | Premier arrivé premier servi si mode auto. Arbitrage syndic si mode manuel. | Détection conflit en temps réel. Si conflit : mise en file d'attente. Notification si créneau devient disponible. |
| Caution pour espace (salle fête) | Règlement peut prévoir caution (ex: 500 DH) en cas de dégâts | Caution = engagement moral dans le MVP (pas de paiement en ligne). Syndic peut enregistrer réception caution espèces. Libération caution après inspection. |
| Réservation récurrente (cours de yoga hebdomadaire) | Autorisée si AG ou règlement le prévoit. Durée limitée. | Réservation type RECURRENTE : fréquence (hebdo/mensuel), date de fin. Vérification disponibilité sur toute la période. |
| Annulation tardive | Règlement peut prévoir pénalité ou blocage futur si annulation < Xh avant | Paramètre délai_annulation_libre par espace. Si annulation après délai → notification syndic. Compteur annulations tardives par résident. |
| Non-remise en état après usage | Propriétaire de la réservation responsable de la remise en état | Gardien peut signaler via ticket lié à la réservation. Coût remise en état = charge au résident (enregistrée manuellement). |
| Réservation piscine — créneaux | Si AG a décidé des créneaux (familles le matin, adultes le soir) | Créneaux configurables par espace. Chaque créneau = slot réservable. Règles d'âge ou de catégorie configurable. |
| Invités extérieurs dans espaces communs | Règlement peut limiter l'accès aux résidents seulement | Champ nombre_invites sur réservation. Règle max_invites configurable par espace. Au-delà = validation manuelle obligatoire. |
| Espace commun en travaux — réservations annulées | Syndic met l'espace hors service | Espace commun statut HORS_SERVICE. Toutes les réservations futures annulées automatiquement avec notification. |
| Utilisation espace sans réservation | Infraction règlement. Signalable au gardien. | Gardien peut signaler via incident. Notification au résident identifié. Compteur infractions. |
