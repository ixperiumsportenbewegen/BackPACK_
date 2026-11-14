import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function gelijk(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Houdt de website en de database wakker: een kleine leesvraag op Supabase. Alleen met de geheime sleutel
 * (CRON_SECRET) in de header; Vercel Cron stuurt die als "Authorization: Bearer <sleutel>", andere aanroepers
 * kunnen hem ook als "x-cron-secret" meesturen. Geeft verder niets prijs.
 */
export async function GET(request: NextRequest) {
  const sleutel = process.env.CRON_SECRET;
  if (!sleutel) return NextResponse.json({ fout: "Niet ingesteld." }, { status: 503 });

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const kop = request.headers.get("x-cron-secret") ?? "";
  if (!gelijk(bearer, sleutel) && !gelijk(kop, sleutel)) {
    return NextResponse.json({ fout: "Geen toegang." }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.rpc("blijf_actief");
  if (error) return NextResponse.json({ fout: "De database antwoordt niet." }, { status: 502 });
  return new NextResponse("ok", { headers: { "Cache-Control": "no-store" } });
}
