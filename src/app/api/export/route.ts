import { NextResponse, type NextRequest } from "next/server";
import { exportBestandsnaam, exporteerAlles } from "@/lib/exporteren";
import { exportNaarExcel } from "@/lib/exporterenExcel";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Alle gegevens exporteren als JSON of Excel. Alleen voor de docent; de export gebruikt de sessie van de docent,
 * dus de database bepaalt wat er in zit. Afbeeldingen uit Storage zitten er niet in.
 */
export async function GET(request: NextRequest) {
  const profiel = await getProfiel();
  if (!profiel || profiel.soort !== "docent") {
    return NextResponse.json({ fout: "Alleen de docent kan exporteren." }, { status: 403 });
  }
  const formaat = request.nextUrl.searchParams.get("formaat") === "excel" ? "excel" : "json";
  const supabase = await maakServerClient();
  const data = await exporteerAlles(supabase);

  if (formaat === "excel") {
    const bestand = await exportNaarExcel(data);
    return new NextResponse(new Uint8Array(bestand), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportBestandsnaam("xlsx")}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportBestandsnaam("json")}"`,
      "Cache-Control": "no-store",
    },
  });
}
