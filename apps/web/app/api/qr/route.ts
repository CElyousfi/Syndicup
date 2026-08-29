/**
 * Génération de QR code (invitations J4 — le code est transmis manuellement par le syndic,
 * affiché/imprimé en hall d'immeuble). PNG, cache long : le contenu est dans l'URL.
 */
import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";

export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get("data");
  if (!data || data.length > 512) {
    return NextResponse.json({ error: "data requis" }, { status: 400 });
  }
  const png = await QRCode.toBuffer(data, {
    type: "png",
    width: 480,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
