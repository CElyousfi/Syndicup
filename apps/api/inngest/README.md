# inngest

Fonctions asynchrones/cron (Master Spec Partie 15.3) : génération mensuelle des appels de fonds,
scan d'escalade impayés (quotidien, Doc A §3.3 N0→N6), anonymisation CNDP (mensuel), rappels
d'échéance AG. Un fichier par job, enregistré via webhook Inngest ↔ Vercel.
