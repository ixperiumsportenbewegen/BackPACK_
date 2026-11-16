"use server";

import { revalidatePath } from "next/cache";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { PROJECTGROEPROLLEN } from "@/config/projectgroeprollen";
import { splitNamen, voegNamenSamen } from "@/lib/namen";

export type NamenResultaat =
  | { status: "ok"; namen: string | null; updatedAt: string }
  | { status: "conflict"; namen: string | null; updatedAt: string }
  | { status: "fout"; melding: string };

/** De namen komen als tekst met komma's binnen (één naam per veld in de app) en worden opgeschoond opgeslagen. */
function schoon(namen: string): string | null {
  return voegNamenSamen(splitNamen(namen));
}

/** Naam van de verantwoordelijke student(en) bij een rol van de eigen projectgroep. */
export async function projectgroepRolOpslaan(rol: string, namen: string, verwachtUpdatedAt: string): Promise<NamenResultaat> {
  const profiel = await getProfiel();
  if (!profiel || profiel.soort !== "projectgroep") {
    return { status: "fout", melding: "Alleen de projectgroep zelf kan de rolverdeling aanpassen." };
  }
  if (!PROJECTGROEPROLLEN.some((r) => r.code === rol)) return { status: "fout", melding: "Onbekende rol." };

  const supabase = await maakServerClient();
  const { data: account } = await supabase.from("account").select("projectgroep_id").single();
  const groepId = account?.projectgroep_id;
  if (!groepId) return { status: "fout", melding: "Geen projectgroep gevonden." };

  const waarde = schoon(namen);
  const { data } = await supabase
    .from("projectgroep_rol")
    .update({ namen: waarde })
    .eq("projectgroep_id", groepId)
    .eq("rol", rol)
    .eq("updated_at", verwachtUpdatedAt)
    .select("namen, updated_at");
  if (data && data.length === 1) {
    revalidatePath("/meer/rolverdeling");
    return { status: "ok", namen: data[0].namen, updatedAt: data[0].updated_at };
  }

  const { data: huidig } = await supabase
    .from("projectgroep_rol").select("namen, updated_at").eq("projectgroep_id", groepId).eq("rol", rol).maybeSingle();
  if (huidig) return { status: "conflict", namen: huidig.namen, updatedAt: huidig.updated_at };
  return { status: "fout", melding: "Opslaan is niet gelukt. Probeer het opnieuw." };
}

/** Namen van de twee studenten bij een stuurgroeprol: eigen rol, of alle rollen voor de docent. */
export async function stuurgroepRolOpslaan(rolId: string, studenten: string, verwachtUpdatedAt: string): Promise<NamenResultaat> {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent")) {
    return { status: "fout", melding: "Alleen de stuurgroep kan dit aanpassen." };
  }
  const supabase = await maakServerClient();
  const waarde = schoon(studenten);
  const { data } = await supabase
    .from("stuurgroeprol")
    .update({ studenten: waarde })
    .eq("id", rolId)
    .eq("updated_at", verwachtUpdatedAt)
    .select("studenten, updated_at");
  if (data && data.length === 1) {
    revalidatePath("/stuurgroep");
    return { status: "ok", namen: data[0].studenten, updatedAt: data[0].updated_at };
  }

  const { data: huidig } = await supabase
    .from("stuurgroeprol").select("studenten, updated_at").eq("id", rolId).maybeSingle();
  if (huidig && huidig.updated_at !== verwachtUpdatedAt) {
    return { status: "conflict", namen: huidig.studenten, updatedAt: huidig.updated_at };
  }
  return { status: "fout", melding: "Je kunt alleen de namen bij jullie eigen rol aanpassen." };
}
