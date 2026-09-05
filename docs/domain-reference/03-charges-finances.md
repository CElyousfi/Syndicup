# Doc A — Charges & Finances — Tous les Cas

> Extrait de `USE_CASES_Copropriete_Maroc_version_initial__1_.html` (section `#s3`). Doc A fait autorité sur le métier (Partie 0.1 du dossier d'ingénierie) — en cas de doute, se référer au fichier HTML original. Référence technique croisée : Partie 6 (Moteur Financier), Partie 2 (finances).

---

## Charges & Finances — Tous les Cas

### 3.1 — Calcul des Tantièmes — Règles et Exceptions

**Fondement légal**
Les tantièmes définissent la quote-part de chaque copropriétaire dans les parties communes et leur participation aux charges. Ils sont fixés dans le règlement de copropriété homologué par le tribunal (Loi 18-00, Art. 3). Toute modification nécessite une AG extraordinaire à l'unanimité ou double majorité selon l'objet.

| Situation | Règle de calcul | Exception | Impact plateforme |
| --- | --- | --- | --- |
| Base standard | Surface habitable + pondération étage + pondération exposition + pondération équipements | Chaque règlement de copropriété définit sa propre formule | La plateforme stocke les tantièmes finaux (pas la formule). Validation : somme = total défini. |
| Lot commercial vs résidentiel | Coefficient commercial (1.2 à 2x) souvent appliqué sur parties communes intensivement utilisées | Peut avoir des tantièmes séparés pour charges générales et charges spéciales | Champ tantiemes_generaux + tantiemes_speciaux par lot. |
| Parking titré dans même règlement | Tantièmes parking = faibles (ex: 30-80/10000). Calculés sur valeur vénale relative. | Parking sous-terrain peut avoir tantièmes dans "grille parking" séparée | Lot parking avec tantièmes propres. Contribue aux charges communes au prorata. |
| Cave titrée | Très faibles tantièmes (15-40/10000) | Si règlement prévoit charges cave séparées | Lot cave avec tantièmes propres. |
| Modification des tantièmes | Nécessite AG extraordinaire + accord très qualifié (souvent unanimité) | Si erreur dans le règlement initial = procédure judiciaire de rectification | Modification tantièmes = action réservée SUPER_ADMIN avec log d'audit obligatoire + justification. |
| Tantièmes et charges : les 2 grilles | Grille 1 : tantièmes pour répartition charges courantes. Grille 2 : tantièmes pour votes AG (peuvent être différents dans certains règlements). | Rare mais possible — certains règlements distinguent "parts dans les charges" et "parts dans les décisions" | 2 champs distincts si nécessaire : tantiemes_charges et tantiemes_votes. |
| Lot avec tantièmes 0 (erreur notariale) | Erreur de transcription. Existe malheureusement au Maroc. | Régularisation notariale nécessaire | Validation bloque tantièmes = 0 sur lot actif. Alerte syndic. Statut : TANTIEME_A_REGULARISER. |

### 3.2 — Appels de Fonds — Tous les Types

| Type | Déclencheur | Base calcul | Fréquence | Règles spéciales | Gestion plateforme |
| --- | --- | --- | --- | --- | --- |
| Appel mensuel ordinaire | Budget annuel voté en AG | Budget annuel / 12 × tantièmes lot | Mensuelle | Date d'échéance fixe (ex: 5 du mois) | Génération auto programmée. Notification J-5 avant échéance. |
| Appel trimestriel | Budget annuel voté en AG | Budget annuel / 4 × tantièmes | Trimestrielle | Plus courant dans les petits immeubles | Configurable : fréquence_appel_fonds = MENSUEL / TRIMESTRIEL / SEMESTRIEL. |
| Appel exceptionnel (travaux) | Travaux votés en AG (ravalement, ascenseur, toiture) | Devis travaux × tantièmes lot | Ponctuel | Peut être payé en plusieurs fois si AG l'a décidé. Délai de paiement spécifique. | Appel type EXCEPTIONNEL. Peut être échelonné (plan de paiement sur X mois). Chaque échéance = ligne appel fonds. |
| Appel fonds de réserve | Décision AG de constituer une réserve | Montant fixe ou % du budget voté | Annuelle ou mensuelle | Fonds bloqué — ne peut pas être utilisé sans vote AG | Compte séparé dans module finances : FONDS_RESERVE. Pas de décaissement sans décision AG tracée. |
| Régularisation de charges | Fin d'année — dépenses réelles vs budget prévisionnel | Dépenses réelles − provisions versées = solde par lot | Annuelle | Si dépenses < prévisions = remboursement ou déduction. Si > = complément à payer. | Module régularisation annuelle. Calcul différentiel. Peut générer avoir ou complément. Notifications individuelles par lot. |
| Appel d'urgence (sinistre) | Dégât des eaux majeur, incendie, effondrement partiel | Devis d'urgence / tantièmes | Exceptionnel | Avance immédiate puis régularisation avec assurance | Appel type URGENCE. Délai court. Assurance copropriété peut couvrir — lien avec documents assurance. |
| Appel premier emménagement (fonds de démarrage) | Nouvelle résidence — constitution trésorerie initiale | Fixé par promoteur ou première AG constitutive | Unique | Montant = 2-3 mois de charges souvent | Appel type DEMARRAGE. Généré lors de la création de la copropriété. |

### 3.3 — Impayés : Escalade et Gestion Complète

**Réalité Marocaine**
Le taux d'impayés en copropriété au Maroc est estimé à 30-40% selon les résidences. C'est LE problème numéro 1 des syndics. La plateforme doit gérer tout le cycle d'escalade avec des workflows précis.

| Niveau | Délai | Action automatique | Action manuelle syndic | Résultat attendu |
| --- | --- | --- | --- | --- |
| N1 Rappel simple | J+3 après échéance | Notification push + email automatique au copropriétaire | Aucune | Paiement dans les 7 jours suivants |
| N2 Relance formelle | J+15 | Email de relance formelle (template PDF joint) | Syndic peut personnaliser le message | Promesse de paiement ou contact |
| N3 Mise en demeure | J+30 | Génération courrier mise en demeure PDF (avec mention intérêts légaux) | Syndic envoie par courrier recommandé (tracé dans plateforme) | Paiement ou plan d'apurement |
| N4 Plan d'apurement | J+45 | Proposition automatique plan paiement échelonné | Syndic négocie et valide le plan. Échéancier créé dans plateforme. | Plan d'apurement accepté et suivi |
| N5 Suspension services (si légal) | J+60 | Alerte syndic pour décision | Syndic peut suspendre accès piscine, salle de sport selon règlement. NB: ne peut pas couper eau/électricité. | Pression psychologique |
| N6 Injonction à payer | J+90 | Génération dossier injonction à payer (pièces pour tribunal) | Syndic saisit le tribunal de première instance (Art. 39 Loi 18-00) | Ordonnance judiciaire |

#### Cas Particuliers d'Impayés

| Cas spécial | Règle | Gestion plateforme |
| --- | --- | --- |
| Propriétaire conteste le montant | Droit de contester via lettre au syndic. Le montant reste dû pendant la contestation sauf décision AG. | Flag CONTESTE sur la ligne d'appel fonds. Syndic peut annoter. Solde dû reste affiché. |
| Copropriétaire avec plusieurs lots dont certains soldés | Les impayés d'un lot n'affectent pas les droits sur les autres lots (sauf règlement contraire) | Impayé géré par lot, pas par personne. Vue consolidée par propriétaire possible pour syndic. |
| Vente du lot avec impayés | Le notaire doit obtenir attestation de situation financière du syndic. Le vendeur doit solder avant vente ou l'acheteur reprend le passif. | Module "attestation de situation financière" : génération PDF attestant le solde du lot. Signé numériquement par syndic. |
| Locataire paie à la place du propriétaire | Le paiement est accepté mais la quittance est au nom du propriétaire | Paiement enregistré avec champ payeur = locataire. Quittance au propriétaire. Note interne. |
| Décès du débiteur | La dette passe aux héritiers (solidairement si indivision) | Impayé reste sur le lot. Notifications aux contacts héritiers désignés. |
| Copropriétaire en faillite personnelle | Créance copropriété = créance privilégiée (rang prioritaire) | Statut PROCEDURE_COLLECTIVE sur le lot. Syndic notifié. Déclaration de créance à faire. |
| Impayé historique (avant la plateforme) | Le syndic peut importer les soldes d'ouverture | Champ solde_ouverture sur lot lors de l'initialisation. Tracé séparément des nouvelles charges. |

### 3.4 — Paiements Partiels, Avances, Trop-Perçus

| Cas | Règle comptable | Gestion plateforme |
| --- | --- | --- |
| Paiement partiel | Le syndic impute le paiement sur les charges les plus anciennes (règle du droit commun) | Imputation automatique FIFO (first in, first out) sur les lignes les plus anciennes. Reste dû recalculé. |
| Paiement en avance (avant appel émis) | Enregistrable comme avance. Sera déduit du prochain appel. | Paiement type AVANCE. Solde positif sur le lot. Déduit automatiquement du prochain appel. |
| Trop-perçu (erreur de saisie ou régularisation favorable) | Montant doit être remboursé ou porté en avoir pour prochain appel | Solde positif sur lot. Syndic choisit : REMBOURSER ou REPORTER sur prochain appel. |
| Chèque sans provision | Paiement revient impayé. Le lot redevient débiteur + frais bancaires possibles. | Workflow "paiement rejeté" : annulation du paiement enregistré, impayé recréé, notification syndic + propriétaire. Frais bancaires = dépense sur compte copropriété. |
| Virement mal référencé | Paiement reçu mais non identifiable | Paiement en statut NON_AFFECTE. Syndic doit l'affecter manuellement. Alerte dans tableau de bord. |
| Paiement groupé (propriétaire multi-lots) | Propriétaire paie en un virement pour ses 2 lots | Paiement avec répartition manuelle par le syndic. Ou automatique si montant = somme exacte des 2 lots. |

### 3.5 — Charges Locataire vs Propriétaire (Loi 6-79 Baux)

**Distinction importante**
En droit marocain, certaines charges sont "récupérables" sur le locataire (il les paie à son propriétaire), d'autres restent à la charge exclusive du propriétaire. La plateforme ne gère pas directement la relation bailleur-locataire, mais doit permettre au syndic de distinguer clairement pour chaque poste.

| Poste de charge | À la charge de | Récupérable sur locataire ? | Gestion plateforme |
| --- | --- | --- | --- |
| Entretien courant parties communes (nettoyage, jardins) | Copropriété (payé par tous) | OUI — proportionnellement à l'usage | Catégorie charge : ENTRETIEN_COURANT. Tag récupérable = OUI. |
| Eau froide parties communes | Copropriété | OUI | Tag récupérable = OUI |
| Électricité parties communes (éclairage, ascenseur) | Copropriété | OUI (ascenseur : quote-part selon étage) | Tag récupérable = OUI. Ascenseur = coefficient étage. |
| Salaire gardien / concierge | Copropriété | OUI — jusqu'à 75% récupérable (usage) | Tag récupérable = OUI (75%) |
| Travaux de ravalement façade | Copropriété / Propriétaire | NON — charge propriétaire exclusive | Tag récupérable = NON. Catégorie : TRAVAUX_GROS_OEUVRE |
| Remplacement ascenseur (gros travaux) | Copropriété / Propriétaires | NON | Tag récupérable = NON |
| Assurance immeuble | Copropriété | NON | Tag récupérable = NON. Catégorie : ASSURANCE |
| Taxe de services communaux | Propriétaire | NON (hors locaux) | Hors périmètre copropriété — information seulement |
| Entretien chaudière collective | Copropriété | OUI (usage courant) — NON (remplacement) | Distinction entretien courant vs remplacement dans catégories. |

### 3.6 — Fonds de Réserve & Travaux Importants

| Cas | Règle | Gestion plateforme |
| --- | --- | --- |
| Constitution fonds de réserve | Voté en AG. Montant et fréquence définis. Argent bloqué pour travaux futurs. | Compte séparé FONDS_RESERVE dans trésorerie. Alimentation = appels fonds dédiés. Décaissement = décision AG uniquement. |
| Utilisation fonds de réserve | Décision AG requise sauf urgence (définie dans règlement) | Décaissement lie à une décision AG (résolution référencée). Traçabilité complète. |
| Travaux votés payables en plusieurs fois | AG peut décider un échéancier de paiement (ex: 3 tranches sur 6 mois) | Appel fonds exceptionnel avec N lignes (une par tranche). Dates d'échéance distinctes. |
| Avance du syndic pour urgence | Syndic peut avancer sur fonds propres si urgence vitale | Dépense enregistrée avec type AVANCE_SYNDIC. Remboursement via appel fonds exceptionnel ensuite. |
| Devis travaux (comparatif) | Loi 18-00 suggère 3 devis minimum pour travaux importants | Module documents : type DEVIS. Lien avec résolution AG correspondante. Comparatif visible par conseil syndical. |
| Travaux partiellement couverts par assurance | Assurance paie sa part. Reste à charge = copropriété. | Dépense travaux = montant total. Recette assurance = entrée dans trésorerie. Reste = appel fonds si insuffisant. |

### 3.7 — Cas Spéciaux de Charges

| Cas | Description | Règle de répartition | Gestion plateforme |
| --- | --- | --- | --- |
| Piscine commune : tous ne l'utilisent pas | Certains résidents ne veulent pas payer la piscine | La piscine = partie commune = tous paient selon tantièmes. Pas d'opt-out légal sauf si règlement de copropriété l'exclut. | Charges piscine = catégorie séparée si le règlement a une grille spéciale. Sinon = charges générales. |
| Immeuble mixte résidentiel/commercial : clés de répartition différentes | Les commerces utilisent plus les parties communes (livraisons, clients) | Double grille : tantièmes résidentiels pour charges résidentielles, tantièmes commerciaux pour charges communes intensifiées | Champ tantiemes_speciaux_commercial. Appel fonds avec 2 grilles de calcul. |
| Lot en construction / VEFA : charges pendant travaux | Le promoteur paie les charges pour les lots invendus | Promoteur = copropriétaire temporaire. Charges calculées normalement. | Lot avec proprietaire_type = PROMOTEUR jusqu'à la vente. Charges envoyées au promoteur. |
| Charges spéciales antenne / fibre collective | Antenne collective ou réseau fibre immeuble = investissement + maintenance | Réparti sur tous les lots selon tantièmes ou forfait égalitaire selon AG | Catégorie charge : TELECOM_COLLECTIF. Mode répartition : TANTIEMES ou EGALITAIRE (configurable). |
| Dépassement budget en cours d'année | Si dépenses imprévues dépassent le budget voté | Syndic doit convoquer AG extraordinaire pour voter budget rectificatif sauf si règlement lui donne une marge (ex: ±10%) | Alerte automatique si dépenses dépassent X% du budget. Marge configurable. Suggestion de convocation AG extraordinaire. |

---

## 3.8 — Justificatifs de paiement et espèces à la loge (module M17 — dérivé de §3.3 « virement mal référencé », « chèque sans provision », §3.4 imputation FIFO, §12.3 confidentialité)

> Ajout M17 : Doc A décrit le paiement CMI et le paiement « manuel » saisi par le syndic ; en pratique
> les résidents paient par virement, chèque ou espèces au moins aussi souvent. Aucune API bancaire
> n'est disponible au Maroc : le rapprochement est manuel, fondé sur une preuve.

| Cas | Règle | Gestion plateforme |
| --- | --- | --- |
| Le résident a payé par virement / chèque | Il déclare « j'ai payé » : montant, méthode, banque, compte bénéficiaire (comptes de la copropriété — RIB masqué), référence, preuve (reçu, photo du chèque). Un locataire peut déclarer pour son lot (règle payeur §3.4). | `justificatif_paiement` EN_ATTENTE, Document `JUSTIFICATIF_PAIEMENT` (visibilité syndic ; le résident relit SA preuve via le justificatif). Notification `JUSTIFICATIF_DECLARE` au syndic. Preuve obligatoire (422 `JUSTIFICATIF_PREUVE_REQUISE`) sauf espèces saisies par le syndic / gardien. |
| Le syndic rapproche du relevé | Il valide (date de valeur) ou rejette avec motif. | Validation = `paiement` VALIDE (ciblé sur l'échéance choisie, ou FIFO sur les plus anciennes si « sur solde »), mise à jour des lignes, quittance par le moteur M5, notification `PAIEMENT_VALIDE` — tout ou rien. Rejet : rien sur le lot, notification `JUSTIFICATIF_REJETE`. Montant > dû total → 422 (l'avance n'est pas modélisée, §3.4). |
| Déclaration en attente et relances | Le résident a payé mais la preuve attend le syndic. | Le solde affiche « X en attente de validation » (`justificatifs_en_attente`) ; l'escalade impayés (§3.3) est **suspendue** sur une ligne dont le dû est couvert par un justificatif en attente ; rappel au syndic après `delai_validation_justificatif_jours` (nullable, jamais deviné). |
| Espèces remises au gardien | Le gardien encaisse à la loge ; le syndic confirme. | `POST /finances/paiements/especes` : gardien → justificatif ESPECES EN_ATTENTE (notification `PAIEMENT_ESPECES_SAISI`), syndic → paiement VALIDE direct. La table `paiement` étant append-only, aucun paiement « en attente » n'est créé puis modifié : la ligne naît à la confirmation (`/confirmer` = valider). |
| Comptes bancaires de la copropriété | Compte courant, fonds de réserve… | `copropriete.comptes_bancaires_json` ; tout membre lit banque + RIB masqué ; le syndic gère et lit le RIB complet (audit `RIB_CONSULTE`). Le RIB complet n'apparaît jamais dans un audit ni une liste. |
| Confidentialité (§12.3) | Un résident ne voit que ses lots ; le gardien ce qu'il a saisi. | Policy RLS `justificatif_paiement` (propriétaire ou occupant actif du lot ; gardien = `declare_par_id`) ; syndic / conseil tout. |
