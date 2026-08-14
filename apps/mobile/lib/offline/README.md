# lib/offline (Flutter)

Stratégie offline module gardien UNIQUEMENT (Master Spec Partie 13.3, 11.4) : `local_db/` (Drift/
SQLite), `sync_queue/`. Écriture optimiste + résolution "dernière écriture gagne" sur `visite`
seulement — ne jamais répliquer ce pattern sur une entité financière ou probante.
