/** Erreurs métier du module Rapports (M18) — mappées en HTTP dans ./http.ts. */
import type { ErrorCode } from "../http/respond";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class ConflitError extends Error {}
export class RapportError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}
