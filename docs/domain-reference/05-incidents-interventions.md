# Doc A — Incidents & Interventions — Tous les Scénarios

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s5`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 2 (incident), Partie 17 §5.

---

## Incidents & Interventions — Tous les Scénarios

### 5.1 — Catégories Complètes d'Incidents

| Catégorie | Sous-catégories | Niveau urgence par défaut | Délai intervention cible | Responsabilité financière |
| --- | --- | --- | --- | --- |
| Plomberie | Fuite eau, canalisation bouchée, robinetterie, chauffe-eau collectif, pompe surpresseur, compteur eau | URGENT (fuite active) / NORMAL (bouchon) | 4h (urgent) / 48h (normal) | Parties communes = copropriété. Intérieur lot = propriétaire (sauf colonne montante) |
| Électricité | Panne générale, court-circuit parties communes, éclairage escalier, tableau électrique commun, groupe électrogène | URGENT (panne totale) / NORMAL (ampoule) | 2h (urgent) / 72h (normal) | Tableau commun = copropriété. Compteur individuel = ONEE / propriétaire |
| Ascenseur | Panne ascenseur, ascenseur bloqué (avec personne), bruit, porte défectueuse, maintenance annuelle | TRÈS URGENT (personne bloquée) / URGENT (panne) / NORMAL (maintenance) | 30min (personne bloquée) / 2h (panne) | Copropriété entière |
| Nettoyage | Parties communes sales, poubelles débordantes, graffiti, déchets sauvages, nuisibles (rats, cafards) | NORMAL / URGENT (nuisibles) | 24h (courant) / 4h (nuisibles) | Copropriété (prestataire nettoyage) |
| Sécurité | Intrusion, porte d'entrée cassée, interphone défaillant, éclairage sécurité absent, badge perdu, véhicule suspect | URGENT (intrusion/porte) / NORMAL (interphone) | 1h (intrusion) / 24h (interphone) | Copropriété. Si négligence gardien = engagement responsabilité |
| Structure | Fissures façade/plafond/murs, infiltration eau toiture, affaissement sol, problème fondations | URGENT (fissure active) / TRÈS URGENT (risque effondrement) | Expert 48h (urgent) / immédiat (risque effondrement) | Copropriété. Assurance si sinistre. |
| Jardins & Espaces verts | Arrosage en panne, arbre dangereux, clôture abîmée, éclairage extérieur, allées | URGENT (arbre dangereux) / NORMAL (reste) | 24h (urgent) / 1 semaine (normal) | Copropriété |
| Nuisances | Bruit (fêtes, travaux), odeurs, animaux non tenus en laisse, fumée, comportement antisocial | NORMAL / URGENT (si récurrent nocturne) | Médiation 24h / Mise en demeure 72h | Résident contrevenant responsable. Syndic médiateur. |
| Parking | Occupation illicite, barrière panne, inondation, véhicule abandonné, éclairage parking | URGENT (barrière / inondation) / NORMAL (reste) | 2h (urgent) / 48h (normal) | Copropriété (infrastructures) / Résident contrevenant (occupation) |
| Équipements collectifs | Piscine (pompe, traitement eau, carrelage), salle de sport (équipement cassé), interphone, vidéosurveillance | NORMAL en général | 48h-1 semaine | Copropriété |
| Administratif | Document manquant, erreur facturation, demande information, conflit de voisinage | NORMAL | 48-72h pour réponse | N/A |

### 5.2 — Incidents Complexes : Frontière Parties Communes / Privatives

**Le Cas le Plus Litigieux**
La frontière entre ce qui est "partie commune" (charge copropriété) et "partie privative" (charge propriétaire) est source de la majorité des conflits. La plateforme doit guider l'utilisateur dans cette distinction.

| Incident | Partie commune (copropriété paie) | Partie privative (propriétaire paie) | Cas ambigu | Règle arbitrage |
| --- | --- | --- | --- | --- |
| Fuite d'eau | Colonne montante principale, canalisation encastrée dans murs porteurs, compteur général | Robinetterie intérieure, douche, canalisation après compteur individuel | Fuite entre compteur individuel et premier robinet | Syndicat mandate plombier pour expertise. Résultat détermine la prise en charge. |
| Infiltration toiture | Toiture = partie commune. Tout ce qui vient du dessus. | Finitions intérieures (peinture, plâtre) si dégâts dus à la négligence du propriétaire du lot supérieur | Terrasse du propriétaire du dernier étage : étanchéité = commun, carrelage = privatif | Expertise contradictoire. Assurance copropriété activée en priorité. |
| Fissures dans l'appartement | Fissure traversante mur porteur = structure commune | Fissure superficielle enduit = privatif (normale en vieillissement) | Fissure dans cloison entre 2 appartements | Expert structure mandaté. Si mur porteur = copropriété. Si cloison = propriétaire. |
| Peinture escalier vs appartement | Escalier, couloirs, hall d'entrée = parties communes | Intérieur appartement = privatif | Porte palière de l'appartement : face extérieure = commune, face intérieure = privative | Porte palière : la face vue depuis la partie commune est peinte par la copropriété. |
| Dégât des eaux voisin du dessus | Si la cause est dans les parties communes | Si la cause est dans l'appartement du voisin | Origine incertaine | Expertise assurance. Assurance copropriété (dégât des eaux) en attente d'arbitrage. |
| Fenêtres et volets | Façade (aspect extérieur, couleur) = partie commune | Mécanisme intérieur, vitrage = privatif selon règlement | Remplacement double vitrage : esthétique vs performance | Règlement intérieur doit spécifier. Si silence = AG décide. |
| Interphone / Visiophone | Boîtier d'entrée principal, câblage principal | Combiné intérieur appartement | Câblage entre tableau et appartement | Câblage encastré dans parties communes = copropriété. |

### 5.3 — Workflows Incidents Spéciaux

| Cas | Workflow détaillé | Escalade |
| --- | --- | --- |
| Personne bloquée dans ascenseur | 1. Résident ou gardien signale (app ou appel d'urgence) → 2. Ticket TRÈS URGENT créé → 3. Notification immédiate au gardien + syndic → 4. Gardien contacte prestataire ascenseur (numéro d'urgence 24h/24) → 5. Mise à jour statut toutes les 15 min → 6. Si > 30 min → Appel Pompiers (15) | Pompiers si bloquée > 30 min. Rapport incident post-intervention. Vérification contrat maintenance. |
| Incendie dans parties communes | 1. Signalement → 2. Ticket URGENCE MAXIMALE → 3. Notification TOUS les résidents "Évacuation" → 4. Appel automatique (via app) au gardien → 5. Pompiers = 15 (hors app) → 6. Après → Rapport sinistre, activation assurance | Notifications mass-push à tous. Convocation AG extraordinaire post-sinistre. |
| Coupure eau générale immeuble | 1. Signalement → 2. Ticket URGENT → 3. Notification TOUS résidents → 4. Vérification : coupure ONEE ou panne pompe ? → 5a. Si ONEE : contact ONEE et notification avec délai estimé → 5b. Si pompe : prestataire urgence | Mise à jour toutes les heures jusqu'à résolution. Notification de clôture envoyée à tous les résidents dès le rétablissement. |
| Infestation nuisibles (rats, cafards) | 1. Signalement → 2. Ticket URGENT (santé publique) → 3. Syndic mandate société de dératisation → 4. Notification TOUS résidents avec consignes (préparer logement) → 5. Intervention planifiée → 6. Suivi 2 semaines | Si récurrent : analyse cause (poubelles, sous-sol humide). Plan d'action long terme. |
| Dégât des eaux chez plusieurs résidents | 1. Chaque résident sinistré ouvre son ticket → 2. Syndic regroupe les tickets en "sinistre groupé" → 3. Assurance copropriété déclarée → 4. Expert assurance mandaté → 5. Chaque résident documenté individuellement → 6. Rapport consolidé | Assurance copropriété + assurance individuelle de chaque résident. Les 2 peuvent contribuer. |

### 5.4 — Nuisances entre Résidents

| Type nuisance | Procédure | Niveaux d'escalade |
| --- | --- | --- |
| Bruit nocturne (fête, musique) | Signalement → Notification au résident contrevenant (anonymisée) → Si récidive → Mise en demeure formelle du syndic → Si persistance → Constat huissier → Tribunal | N1: notification app anonyme → N2: lettre syndic → N3: constat huissier → N4: tribunal |
| Travaux bruyants hors horaires | Signalement → Syndic vérifie autorisations → Notification au résident avec rappel horaires légaux (8h-20h en semaine, 9h-13h samedi, interdit dimanche au Maroc) | N1: rappel horaires → N2: mise en demeure → N3: tribunal si persistance |
| Animaux domestiques (aboiements, malpropreté) | Règlement intérieur peut interdire ou encadrer les animaux. Signalement syndic → Notification → Conciliation | Dépend du règlement intérieur. Certains interdisent les animaux = procédure stricte. |
| Odeurs (cuisine, cigarette) | Difficile à prouver. Médiation syndic. Si parties communes impactées (couloir) = incident parties communes. | Médiation prioritaire. Constat difficile. |
| Dépôt objets dans parties communes (couloirs, escaliers) | Parties communes doivent rester libres (sécurité incendie). Mise en demeure immédiate si blocage issue de secours. | N1: notification → N2: enlèvement par syndic aux frais du résident → N3: si issue secours = urgence immédiate |
| Travaux non déclarés modifiant l'aspect de l'immeuble | Toute modification façade ou structure nécessite accord AG. Travaux illicites = mise en demeure de remise en état. | N1: constat → N2: mise en demeure remise en état → N3: assignation en justice |
