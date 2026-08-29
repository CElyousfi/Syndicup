# apps/web/components

`ui/` — primitives maison (Badge, Button, Card, Field, Modal, Table, Banner, EmptyState,
Progress/RingGauge, Tabs…) : rayons 20/999/14, pills de statut pleines, chiffres tabulaires
(`.tnum`), propriétés logiques uniquement (RTL sans redécoupe).

`shell/` — chrome applicatif : `nav.ts` (navigation par rôle, brief §5) et `app-frame.tsx`
(sidebar + topbar + tiroir mobile).

`finances/` — composants métier partagés (modale de paiement D4 ciblé/FIFO, contestation D6).

Le mapping statut métier → variante de badge est centralisé dans `lib/status.ts` : une couleur
raconte toujours la même chose, partout.
