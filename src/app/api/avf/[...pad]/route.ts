import { NextResponse } from "next/server";
import { maakServerClient } from "@/lib/supabase/server";

/**
 * Levert een afbeelding uit de privé-bucket `avf`.
 * De afscherming zit in de database: alleen de eigen projectgroep, de stuurgroep van het cluster en de docent
 * krijgen het bestand. Bestandsnamen bevatten een tijdstempel en mogen dus lang in de cache.
 */
export async function GET(_verzoek: Request, { params }: { params: Promise<{ pad: string[] }> }) {
  const { pad } = await params;
  if (pad[0] !== "cluster" || pad[2] !== "avf" || pad.length !== 5 || pad.some((deel) => deel === ".." || deel === "." || deel === "")) {
    return new NextResponse("Niet gevonden", { status: 404 });
  }
  const supabase = await maakServerClient();
  const { data, error } = await supabase.storage.from("avf").download(pad.join("/"));
  if (error || !data) return new NextResponse("Niet gevonden", { status: 404 });
  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
