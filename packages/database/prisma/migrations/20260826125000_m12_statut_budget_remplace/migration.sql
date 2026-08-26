-- M12 — Budget rectificatif (Doc A §3.2) : un budget ACTIF remplacé par un rectificatif passe
-- en REMPLACE, libérant l'index partiel budget_ag_actif_unique_par_exercice (un seul ACTIF par
-- copropriété + exercice). Migration isolée : ADD VALUE ne doit pas être utilisé dans la même
-- transaction que des requêtes employant la nouvelle valeur.
ALTER TYPE "StatutBudgetAg" ADD VALUE 'REMPLACE';
