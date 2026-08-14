# Doc A — Conflits, Litiges & Cas Limites

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s12`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 2.3 (RLS), Partie 4 (RBAC), Partie 10 (Sécurité).

---

## Conflits, Litiges & Cas Limites

### 12.1 — Conflits Majeurs en Copropriété Marocaine

| Conflit | Fréquence | Règle légale | Workflow plateforme | Issue possible |
| --- | --- | --- | --- | --- |
| Contestation du montant des charges | Très fréquent | Droit de contester par lettre recommandée. Restent dus pendant la contestation. | Module contestation : résident soumet contestation avec motif → Syndic répond → Si non résolu → Médiation AG → Tribunal | Explication syndic suffit souvent. Erreur de calcul corrigée. Tribunal si persistance. |
| Travaux privatifs qui endommagent parties communes | Fréquent | Propriétaire responsable des dommages causés par ses travaux (Art. 18 Loi 18-00) | Incident ouvert avec photos avant/après. Expertise si nécessaire. Mise en demeure. Déduction sur remboursement ou action judiciaire. | Remise en état aux frais du propriétaire fautif. |
| Modification de façade non autorisée | Fréquent (climatiseurs, antennes, percement) | Toute modification façade = accord AG ou règlement. Remise en état possible si non autorisée. | Incident catégorie MODIFICATION_FAÇADE. Photo. Mise en demeure. Vote en AG si régularisation demandée. | Régularisation par vote AG ou remise en état. |
| Occupation irrégulière d'une partie commune (débarras dans couloir) | Très fréquent | Parties communes ne peuvent pas être appropriées. Obligation d'enlèvement. | Incident → Notification au résident → Délai 7 jours → Si non respect → Enlèvement par syndic aux frais du résident (décision AG). | Enlèvement. Facturation si récidive. |
| Conflit sur les tantièmes (mal calculés à l'origine) | Rare mais grave | Erreur dans le règlement = procédure judiciaire pour rectification. Complexe et long. | Signalement dans plateforme. Documentation de l'erreur. Génération dossier pour notaire/tribunal. Tantièmes figés jusqu'à décision judiciaire. | Rectification judiciaire. Régularisation des charges passées. |
| Syndic qui disparaît avec la trésorerie | Rare mais existe au Maroc | Délit pénal. Plainte au tribunal. Désignation administrateur judiciaire. | Conseil syndical a accès lecture trésorerie → Détection rapide. Alerte si solde anormalement bas. Traçabilité de toutes les sorties financières. | Plainte pénale. Administrateur judiciaire. Recouvrement difficile. |
| AG sans procès-verbal (ou PV falsifié) | Fréquent dans résidences mal gérées | PV = preuve légale des décisions AG. Sans PV = décisions contestables. | Plateforme génère PV automatiquement. Horodatage. Log immuable. Résidents reçoivent PV signé dans 48h. | PV numérique difficile à falsifier avec la plateforme. |
| Propriétaire refuse d'accéder à son appartement pour réparation commune | Rare mais problématique | Art. 20 Loi 18-00 : copropriétaire doit permettre l'accès pour travaux communs urgents. | Incident tracé. Notifications formelles. Si refus persistant → Tribunal peut ordonner l'accès. | Ordonnance judiciaire d'accès forcé. |

### 12.2 — Edge Cases Techniques & Situations Rares

| Cas limite | Situation | Comportement attendu de la plateforme |
| --- | --- | --- |
| Copropriété avec 1 seul copropriétaire | Tous les lots appartiennent à une seule personne (ex: promoteur avant 1ère vente) | AG = 1 personne. Quorum toujours atteint. PV généré normalement. Alerte si situation dure > 1 an (copropriété fictive). |
| Lot sans propriétaire désigné (orphelin) | Lot créé mais aucun propriétaire associé (erreur import ou succession ouverte) | Lot en statut ORPHELIN. Charges calculées mais aucun débiteur. Alerte syndic. Pas de vote AG pour ce lot. |
| Doublon d'email lors de l'inscription | 2 résidents différents essaient de s'inscrire avec le même email | 2e inscription bloquée. Message "cet email est déjà utilisé". Syndic peut forcer si erreur. |
| Code d'invitation déjà utilisé re-soumis | Résident essaie de re-soumettre son ancien code | Message clair "Code déjà utilisé. Vous êtes déjà inscrit. Connectez-vous." |
| Annulation AG après envoi des convocations | Syndic doit annuler l'AG (décès, urgence) | Bouton "Annuler AG" avec motif obligatoire. Notification à tous les destinataires de la convocation. AG archivée comme ANNULEE. |
| Vote AG avec égalité parfaite (50/50 en tantièmes) | Résolution à majorité simple avec partage exact | Résolution = REJETÉE (la majorité n'est pas atteinte si ex aequo). Mention dans PV. Peut être soumise à nouveau à la prochaine AG. |
| Immeuble partiellement détruit (incendie, séisme) | Certains lots inutilisables, copropriété doit décider reconstruction | Lots en statut SINISTRÉ. Charges suspendues pour lots sinistrés (configurable). AG extraordinaire obligatoire. Module assurance activé. |
| Résidence vendue à un nouveau promoteur (restructuration) | Le propriétaire de la résidence change à 100% | Transfert total : nouveau compte SUPER_ADMIN. Historique intégralement conservé. Tous les résidents notifiés. |
| Panne de la plateforme pendant une AG en cours | Coupure internet pendant un vote | Votes déjà enregistrés = conservés (sauvegarde temps réel). Reprise de session. Si panne totale : vote papier de secours recommandé dans le règlement intérieur. |
| Résident conteste un vote qui l'a lésé | Résident affirme ne pas avoir reçu la convocation | Log d'envoi de notification conservé (horodatage, canal, accusé de réception). Preuve de l'envoi. |
| 2 syndics revendiquent la même copropriété | Conflit entre ancien et nouveau syndic | Seul 1 compte SYNDIC actif par copropriété. Super admin arbitre. PV de désignation obligatoire pour chaque changement. |
| Copropriété fusionnée (2 immeubles gérés ensemble) | Décision AG de fusionner la gestion de 2 immeubles contigus | Multi-copropriétés sous même syndic. Finances séparées mais reporting consolidé possible. Charges = toujours par copropriété distincte. |

### 12.3 — Règles de Confidentialité & Accès aux Données

| Question | Réponse légale & règle plateforme |
| --- | --- |
| Un résident peut-il voir le nom de ses voisins ? | Les noms des copropriétaires sont accessibles sur demande (liste copropriétaires = document de la copropriété). Dans l'app : seul le syndic voit les noms complets. Résidents voient "Lot 4B" mais pas forcément le nom du propriétaire. Configurable. |
| Un résident peut-il voir les dettes des autres ? | NON. Impayés d'un résident = confidentiel. Seuls le syndic et le conseil syndical voient le détail. Résidents voient seulement le taux global de recouvrement de la copropriété. |
| Les PV d'AG sont-ils publics au sein de la copropriété ? | OUI. Les PV sont accessibles à tous les copropriétaires. Les locataires y ont accès si le propriétaire l'autorise. |
| Un prestataire peut-il voir les finances de la copropriété ? | NON. Prestataire accède uniquement à son ticket d'intervention. |
| Le syndic peut-il voir les votes individuels en AG ? | OUI pour le syndic (audit). Les résidents voient le résultat global uniquement (vote anonymisé dans l'affichage, mais tracé pour contestation judiciaire). |
| Combien de temps les données sont conservées ? | Conformité Loi 09-08 : données personnelles = durée nécessaire + 2 ans. Données financières = 10 ans (obligations fiscales). PV AG = durée de vie de la copropriété. |
