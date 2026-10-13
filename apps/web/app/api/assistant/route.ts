/**
 * Proxy Dari (repères) : le navigateur ne parle jamais directement à l'API (jeton httpOnly) —
 * ce handler relaie GET /v1/assistant avec la session des cookies.
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api/client";
import type { AssistantEtat } from "../../../lib/api/types";

export async function GET(req: NextRequest) {
  const langue = req.nextUrl.searchParams.get("langue") === "ar" ? "ar" : "fr";
  const res = await apiFetch<AssistantEtat>("/assistant", { searchParams: { langue } });
  if (!res.ok) return NextResponse.json({ error: res.error.code }, { status: res.status });
  return NextResponse.json(res.data, { headers: { "Cache-Control": "private, no-store" } });
}
