# Doc A — Personnel de l'Immeuble — Gardien & Concierge

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s9`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 2 (personnel, visite), Partie 13.3 (offline).

---

## Personnel de l'Immeuble — Gardien & Concierge

### 9.1 — Profils du Personnel

| Profil | Rôle | Logement dans résidence ? | Accès plateforme | Cas Maroc |
| --- | --- | --- | --- | --- |
| Gardien résident (concierge logé) | Surveillance 24h/24, entretien courant, accueil livraisons, gestion incidents | OUI — loge de service (partie commune) | App mobile dédiée. Tickets, planning, messagerie. Pas d'accès finances. | Très fréquent dans immeubles de 20+ logements |
| Gardien non-résident (à la journée) | Présent sur plage horaire définie. Pas de permanence la nuit. | NON | Idem gardien résident mais notifications limitées aux heures de travail. | Fréquent dans petits immeubles |
| Agent de sécurité (société externe) | Surveillance, contrôle accès, rondes. Employé d'une société de sécurité. | NON (généralement) | Accès limité : incidents sécurité uniquement. Pas de planning dans l'app (géré par leur société). | Résidences fermées de standing |
| Femme de ménage (parties communes) | Nettoyage parties communes uniquement | NON | Pas de compte app nécessaire dans MVP. Gérée via planning gardien ou prestataire. | Très fréquent — souvent employée directement par la copropriété |
| Technicien de maintenance | Petits travaux courants (ampoules, serrures, robinetterie légère) | NON | Compte prestataire si externe. Planning géré par syndic. | Certaines grandes résidences ont un technicien interne |

### 9.2 — Gestion du Gardien — Tous les Cas

| Cas | Règle | Gestion plateforme |
| --- | --- | --- |
| Embauche gardien | Contrat CDI ou CDD. CNSS obligatoire. Décision AG (budget inclut salaire). | Fiche gardien créée. Compte invité. Lié à la copropriété. Logement attribué (lot type LOGE_GARDIEN). |
| Gardien absent (maladie, congé) | Remplacement à organiser par syndic. Continuité de service requise. | Statut gardien : ABSENT. Alerte syndic. Résidents notifiés si impact sur services (pas de gardiennage cette nuit). |
| Gardien utilise son logement comme commerce | La loge est un logement de service. Usage commercial = interdit. | Règlement intérieur. Si signalement = incident catégorie INFRACTION_USAGE. |
| Gardien fait rentrer des personnes non autorisées | Faute professionnelle. Peut justifier licenciement. | Incident catégorie SÉCURITÉ - FAUTE GARDIEN. Log avec preuves. Notification syndic. |
| Départ gardien — restitution logement | Logement de service doit être rendu à la fin du contrat. Délai légal de restitution. | Workflow "départ gardien" : désactivation compte, vérification état loge, nouveau gardien invité. Lot loge repassé en statut DISPONIBLE. |
| Gardien multi-immeubles | Dans certaines petites copropriétés, un gardien gère 2-3 petits immeubles proches | Compte gardien lié à plusieurs copropriétés. Tableau de bord avec vue multi-résidences. Planning centralisé. |
| Réception colis / livraisons | Gardien réceptionne et notifie le résident | Module livraisons : Gardien enregistre (destinataire + description) → notification push au résident. Résident confirme réception. |
| Visiteurs et contrôle d'accès | Gardien vérifie identité visiteur et prévient le résident | Module visites : Gardien peut envoyer notification "Visiteur pour Apt 4B — M. Dupont" → Résident autorise ou refuse → Gardien reçoit la réponse. |
| Gardien absent la nuit — incident nocturne | Résidents doivent savoir qui contacter en urgence | Fiche d'urgence configurable : contacts en l'absence du gardien (syndic, prestataire urgence, Pompiers). Visible dans l'app en permanence. |
