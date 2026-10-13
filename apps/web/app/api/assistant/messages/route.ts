/**
 * Proxy Dari (conversation) : relaie POST /v1/assistant/messages avec la session des cookies.
 * Le corps est revalidé par l'API (Zod) ; ici on borne seulement la taille.
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../../lib/api/client";
import type { AssistantReponse } from "../../../../lib/api/types";

export async function POST(req: NextRequest) {
  const texte = await req.text();
  if (texte.length > 40_000) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(texte);
  } catch {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }
  const res = await apiFetch<AssistantReponse>("/assistant/messages", { method: "POST", body });
  if (!res.ok) return NextResponse.json({ error: res.error.code }, { status: res.status });
  return NextResponse.json(res.data, { headers: { "Cache-Control": "private, no-store" } });
}
