import { NextResponse } from "next/server";
import { maakServerClient } from "@/lib/supabase/server";

/**
 * Levert een sfeerbeeld of logo uit de privé-bucket `thema`.
 * De afscherming zit in de database: alleen het eigen cluster (en de docent) krijgt het bestand.
 * Bestandsnamen bevatten een tijdstempel, dus ze veranderen bij elke nieuwe upload en mogen lang in de cache.
 */
export async function GET(_verzoek: Request, { params }: { params: Promise<{ pad: string[] }> }) {
  const { pad } = await params;
  const volledig = pad.join("/");
  if (pad[0] !== "cluster" || pad.some((deel) => deel === ".." || deel === "." || deel === "")) {
    return new NextResponse("Niet gevonden", { status: 404 });
  }

  const supabase = await maakServerClient();
  const { data, error } = await supabase.storage.from("thema").download(volledig);
  if (error || !data) return new NextResponse("Niet gevonden", { status: 404 });

  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
