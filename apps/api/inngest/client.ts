/**
 * Client Inngest — M12 (Master Spec Partie 15.3). En local : `npx inngest-cli@latest dev
 * -u http://localhost:3001/api/inngest` (aucun compte cloud requis). En production :
 * INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY (provisioning M0).
 */
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "syndicup-api" });
