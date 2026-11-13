"use server";

import { revalidatePath } from "next/cache";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { isToegestaneAccent } from "@/lib/thema";

export type ThemaVeld = "naam" | "verhaal" | "slogan" | "accentkleur" | "sfeerbeeld_pad" | "logo_pad";

const MAX_LENGTE: Record<ThemaVeld, number> = {
  naam: 60, verhaal: 600, slogan: 80, accentkleur: 7, sfeerbeeld_pad: 300, logo_pad: 300,
};

export type OpslaanResultaat =
  | { status: "ok"; nieuw: string | null }
  | { status: "conflict"; huidig: string | null; door: string | null }
  | { status: "fout"; melding: string };

/**
 * Slaat één veld van het meerdaagsethema op. Het veld wordt alleen gewijzigd als het nog
 * de waarde heeft die de gebruiker zag (`oud`); heeft iemand anders het net gewijzigd, dan
 * komt er een waarschuwing in plaats van dat er iets wordt overschreven.
 */
export async function themaVeldOpslaan(
  veld: ThemaVeld,
  oud: string | null,
  nieuw: string | null,
  naam: string,
): Promise<OpslaanResultaat> {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") || !profiel.cluster) {
    return { status: "fout", melding: "Alleen de stuurgroep mag het meerdaagsethema wijzigen." };
  }
  if (!(veld in MAX_LENGTE)) return { status: "fout", melding: "Onbekend veld." };

  const wie = naam.trim().slice(0, 60);
  if (!wie) return { status: "fout", melding: "Vul eerst je naam in." };

  let waarde = nieuw === null ? null : nieuw.trim();
  if (waarde === "") waarde = null;
  if (waarde !== null && waarde.length > MAX_LENGTE[veld]) {
    return { status: "fout", melding: "Deze tekst is te lang." };
  }
  if (veld === "accentkleur" && waarde !== null && !isToegestaneAccent(waarde)) {
    return { status: "fout", melding: "Kies een van de vier HAN-kleuren." };
  }
  const clusterPrefix = `cluster/${profiel.cluster.id}/`;
  if ((veld === "sfeerbeeld_pad" || veld === "logo_pad") && waarde !== null) {
    const eigenBestand = waarde.startsWith(clusterPrefix) && !waarde.includes("..");
    const outdoorFoto = veld === "sfeerbeeld_pad" && /^fotos\/[a-z-]+$/.test(waarde);
    if (!eigenBestand && !outdoorFoto) return { status: "fout", melding: "Dit bestand hoort niet bij jullie cluster." };
  }

  const supabase = await maakServerClient();
  let q = supabase
    .from("meerdaagsethema")
    .update({ [veld]: waarde, bijgewerkt_door_naam: wie })
    .eq("cluster_id", profiel.cluster.id);
  q = oud === null ? q.is(veld, null) : q.eq(veld, oud);
  const { data, error } = await q.select("cluster_id");

  if (error) return { status: "fout", melding: "Opslaan is niet gelukt. Probeer het opnieuw." };
  if (!data || data.length === 0) {
    const { data: huidig } = await supabase
      .from("meerdaagsethema")
      .select(`${veld}, bijgewerkt_door_naam`)
      .eq("cluster_id", profiel.cluster.id)
      .single();
    const rij = huidig as unknown as Record<string, string | null> | null;
    return { status: "conflict", huidig: rij?.[veld] ?? null, door: rij?.bijgewerkt_door_naam ?? null };
  }

  revalidatePath("/", "layout");
  return { status: "ok", nieuw: waarde };
}
