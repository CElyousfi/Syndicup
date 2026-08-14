# Doc A — Le Syndic — Mandats, Changements & Conflits

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s8`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 4 (rôle syndic), Partie 5 (cycle de vie).

---

## Le Syndic — Mandats, Changements & Conflits

### 8.1 — Types de Syndics au Maroc

| Type | Description | Fréquence Maroc | Spécificités plateforme |
| --- | --- | --- | --- |
| Syndic professionnel (société) | Société agréée gérant plusieurs copropriétés en même temps | Très fréquent dans résidences de standing | Compte syndic peut gérer N copropriétés. Dashboard multi-copropriétés. Facturation honoraires. |
| Syndic bénévole (copropriétaire élu) | Un copropriétaire élu par ses pairs gère la résidence | Très fréquent dans petites résidences et vieilles résidences | Compte syndic = aussi compte résident. Droit de vote en AG sauf sur sa propre désignation/révocation. |
| Syndic provisoire (promoteur) | Promoteur assure la gestion jusqu'à la première AG constitutive | Toutes les nouvelles résidences | Compte type PROMOTEUR_SYNDIC. Droits limités dans le temps (durée mandat provisoire configurable). |
| Administrateur judiciaire | Nommé par tribunal en cas de syndic défaillant ou absent | Rare mais existe | Compte type ADMIN_JUDICIAIRE. Droits équivalents syndic mais avec log renforcé. |
| Syndic de fait (sans mandat officiel) | Copropriétaire qui gère sans être officiellement élu | Malheureusement fréquent au Maroc | Plateforme impose la désignation formelle via AG pour accès admin. Pas de syndic sans résolution AG. |

### 8.2 — Changement de Syndic — Workflow Complet

| Étape | Action | Gestion plateforme |
| --- | --- | --- |
| 1. Convocation AG révocation/désignation | AG convoquée avec OJ "désignation nouveau syndic" | AG créée type DÉSIGNATION_SYNDIC. Résolution vote avec candidats. |
| 2. Vote en AG | Résolution de désignation votée (majorité simple) | Vote enregistré. Résultat archivé dans PV. |
| 3. Transmission des archives | Ancien syndic doit transmettre TOUS les documents dans les 3 mois (Loi 18-00 Art. 27) | Checklist de transmission dans plateforme. Documents à transférer : comptabilité, contrats, correspondances, clés maîtresses. Chaque transfert confirmé. |
| 4. Transmission de la trésorerie | Ancien syndic vire le solde de trésorerie au nouveau compte | Solde trésorerie "transmis" = validation des 2 parties. Historique transactions conservé. |
| 5. Transfert des accès plateforme | Ancien syndic perd ses droits SYNDIC. Nouveau les obtient. | Désactivation ancien compte SYNDIC. Invitation nouveau syndic. Période de chevauchement possible (lecture seule pour l'ancien). |
| 6. Information des résidents | Notification à tous les copropriétaires du changement | Notification automatique "Nouveau syndic désigné : [Nom]. Contact : [infos]". |
| 7. Mise à jour contrats prestataires | Prestataires notifiés du changement de contact syndic | Notification aux prestataires actifs dans la plateforme. |

### 8.3 — Conflits Syndic-Copropriétaires

| Cas de conflit | Droits des copropriétaires | Gestion plateforme |
| --- | --- | --- |
| Syndic ne convoque pas l'AG annuelle | Pétition d'1/4 des copropriétaires pour forcer la convocation. Si refus → tribunal. | Alerte automatique si AG ordinaire non convoquée dans les 12 mois suivant la dernière. Outil de pétition en ligne (N signatures électroniques avec traçabilité). |
| Syndic refuse de fournir les comptes | Tout copropriétaire a droit aux comptes (Art. 23 Loi 18-00) | Module "Demande de documents" : traçable avec date de demande et réponse. Si non-réponse > 30j = alerte. |
| Syndic engage des dépenses non votées | Copropriétaires peuvent contester en AG. Syndic peut être tenu personnellement responsable. | Toute dépense > seuil configurable (ex: 5000 DH) doit être liée à une résolution AG ou classée comme urgence. Dépenses non liées = alerte conseil syndical. |
| Syndic favorise certains prestataires | Transparence : 3 devis obligatoires au-delà d'un seuil | Module devis : pour tout montant > X DH, 3 devis requis. Comparatif visible par conseil syndical. |
| Syndic ne répond pas aux incidents urgents | Copropriétaire peut mandater un prestataire en urgence et se faire rembourser | Si ticket URGENT non pris en charge en X heures → escalade automatique au conseil syndical + email de rappel au syndic. |
| Révocation du syndic pour faute | AG extraordinaire. Double majorité requise. | AG type RÉVOCATION. Résolution avec motifs documentés. Vote double majorité calculé automatiquement. |
