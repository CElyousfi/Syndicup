-- M21 — les numéros d'urgence marocains font 2 à 3 chiffres (15 pompiers, 19 police, 177 gendarmerie).
ALTER TABLE "contact_utile" DROP CONSTRAINT contact_utile_telephone_check;
ALTER TABLE "contact_utile" ADD CONSTRAINT contact_utile_telephone_check CHECK (char_length(telephone) BETWEEN 2 AND 30);
