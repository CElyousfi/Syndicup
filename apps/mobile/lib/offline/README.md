# lib/offline (Flutter)

Stratégie offline module gardien UNIQUEMENT (Master Spec Partie 13.3, 11.4) : `local_db/` (Drift/
SQLite), `sync_queue/`. Écriture optimiste + résolution "dernière écriture gagne" sur `visite`
et sur les confirmations d'arrivée / de départ d'un séjour LCD (`lcd_actions_queue`, M15 — la
ligne locale porte l'Idempotency-Key rejouée à l'identique, jamais un second événement).
Ne jamais répliquer ce pattern sur une entité financière ou probante à valeur monétaire.
