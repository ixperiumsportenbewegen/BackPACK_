"use server";

import { revalidatePath } from "next/cache";
import { DEADLINE_CODES, deadlineWaarschuwing, nlNaarMoment } from "@/lib/deadlines";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";

export type DeadlineResultaat =
  | { status: "ok"; updatedAt: string | null; verschoven: boolean; waarschuwing: string | null }
  | { status: "conflict"; momentIso: string | null; toelichting: string | null; updatedAt: string | null; door: string | null }
  | { status: "fout"; melding: string };

const FOUT = "Dat is niet gelukt. Probeer het opnieuw.";
const NAAM_NODIG = "Vul bovenaan eerst je naam in.";

async function beheerder() {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") || !profiel.cluster) return null;
  return { clusterId: profiel.cluster.id, supabase: await maakServerClient() };
}

type RpcAntwoord = {
  ok: boolean; reden?: string; updated_at?: string | null; verschoven?: boolean;
  huidig_moment?: string | null; huidige_toelichting?: string | null; door?: string | null;
};

function conflict(r: RpcAntwoord): DeadlineResultaat {
  return { status: "conflict", momentIso: r.huidig_moment ?? null, toelichting: r.huidige_toelichting ?? null, updatedAt: r.updated_at ?? null, door: r.door ?? null };
}

/**
 * Stelt de deadline van een onderdeel in of verschuift hem. Datum en tijd zijn Nederlandse tijd.
 * `verwacht` is de updated_at die je zag (null als er nog geen deadline was): is die intussen veranderd, dan
 * overschrijft dit niets en krijg je de huidige deadline terug.
 */
export async function deadlineOpslaan(
  onderdeel: string, dag: string, tijd: string, toelichting: string, naam: string, verwacht: string | null,
): Promise<DeadlineResultaat> {
  const b = await beheerder();
  if (!b) return { status: "fout", melding: "Alleen de stuurgroep en de docent stellen deadlines in." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (!(DEADLINE_CODES as string[]).includes(onderdeel)) return { status: "fout", melding: FOUT };
  const moment = nlNaarMoment(dag, tijd);
  if (!moment) return { status: "fout", melding: "Kies een geldige datum en tijd." };

  const { data, error } = await b.supabase.rpc("deadline_zetten", {
    p_cluster_id: b.clusterId, p_onderdeel: onderdeel, p_moment: moment.toISOString(),
    p_toelichting: toelichting.trim().slice(0, 200), p_naam: naam.trim().slice(0, 60), p_verwacht: verwacht,
  });
  if (error) return { status: "fout", melding: "Alleen de stuurgroep van dit cluster en de docent stellen deadlines in." };
  const r = data as RpcAntwoord;
  if (r.ok) {
    revalidatePath("/", "layout");
    return { status: "ok", updatedAt: r.updated_at ?? null, verschoven: Boolean(r.verschoven), waarschuwing: deadlineWaarschuwing(moment) };
  }
  if (r.reden === "conflict") return conflict(r);
  if (r.reden === "moment") return { status: "fout", melding: "Kies een datum tussen 2026 en 2028." };
  if (r.reden === "toelichting") return { status: "fout", melding: "De toelichting mag niet langer zijn dan 200 tekens." };
  if (r.reden === "naam") return { status: "fout", melding: NAAM_NODIG };
  return { status: "fout", melding: FOUT };
}

/** Verwijdert de deadline van een onderdeel (met dezelfde waarschuwing bij een gelijktijdige wijziging). */
export async function deadlineVerwijderen(onderdeel: string, naam: string, verwacht: string | null): Promise<DeadlineResultaat> {
  const b = await beheerder();
  if (!b) return { status: "fout", melding: "Alleen de stuurgroep en de docent stellen deadlines in." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await b.supabase.rpc("deadline_wissen", {
    p_cluster_id: b.clusterId, p_onderdeel: onderdeel, p_naam: naam.trim().slice(0, 60), p_verwacht: verwacht,
  });
  if (error) return { status: "fout", melding: "Alleen de stuurgroep van dit cluster en de docent stellen deadlines in." };
  const r = data as RpcAntwoord;
  if (r.ok) {
    revalidatePath("/", "layout");
    return { status: "ok", updatedAt: null, verschoven: false, waarschuwing: null };
  }
  if (r.reden === "conflict") return conflict(r);
  return { status: "fout", melding: FOUT };
}
