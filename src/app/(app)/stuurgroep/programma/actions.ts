"use server";

import { revalidatePath } from "next/cache";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import type { ProgrammaRegel } from "@/lib/programma";

export interface RegelVelden {
  titel: string;
  omschrijving: string;
  locatie: string;
  dag: string;
  start: string;
  eind: string;
  deelnemers: number[];
  rocksRivers: number[];
}

export type RegelResultaat =
  | { status: "ok"; updatedAt: string }
  | { status: "conflict"; huidig: ProgrammaRegel }
  | { status: "fout"; melding: string };

export type ToewijsResultaat =
  | { status: "ok" }
  | { status: "bezet"; door: string; kanWisselen: boolean }
  | { status: "fout"; melding: string };

type Rpc = { ok: boolean; reden?: string; door?: string; huidig?: ProgrammaRegel; updated_at?: string };

async function beheerder() {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent")) return null;
  return maakServerClient();
}

const NAAM_NODIG = "Vul eerst je naam in.";
const FOUT = "Opslaan is niet gelukt. Probeer het opnieuw.";

function nummers(lijst: number[]): number[] {
  return [...new Set(lijst.filter((n) => Number.isInteger(n) && n >= 1 && n <= 6))].sort();
}

/** Past een regel van het programma aan (titel, tijd, locatie en deelnemers). */
export async function regelOpslaan(id: string, v: RegelVelden, verwachtUpdatedAt: string, naam: string): Promise<RegelResultaat> {
  const supabase = await beheerder();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan het programma aanpassen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.dag) || !/^\d{2}:\d{2}$/.test(v.start) || !/^\d{2}:\d{2}$/.test(v.eind)) {
    return { status: "fout", melding: "Vul een geldige dag en tijd in." };
  }
  if (v.eind <= v.start) return { status: "fout", melding: "De eindtijd moet na de starttijd liggen." };
  if (!v.titel.trim()) return { status: "fout", melding: "Vul een titel in." };

  const { data, error } = await supabase.rpc("programma_regel_wijzigen", {
    p_id: id, p_titel: v.titel, p_omschrijving: v.omschrijving, p_locatie: v.locatie,
    p_dag: v.dag, p_start: v.start, p_eind: v.eind,
    p_deelnemers: nummers(v.deelnemers), p_rocks_rivers: nummers(v.rocksRivers),
    p_verwacht: verwachtUpdatedAt, p_naam: naam,
  });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    revalidatePath("/programma");
    revalidatePath("/stuurgroep/programma");
    revalidatePath("/avf", "layout");
    return { status: "ok", updatedAt: res.updated_at! };
  }
  if (res.reden === "gewijzigd" && res.huidig) return { status: "conflict", huidig: res.huidig };
  if (res.reden === "naam") return { status: "fout", melding: NAAM_NODIG };
  return { status: "fout", melding: "Controleer de tijd en de titel." };
}

/** Zet een projectgroep in een tijdvak (of maakt het tijdvak vrij). Bij een bezet tijdvak kun je wisselen. */
export async function kiesGroep(regelId: string, avfId: string | null, naam: string, wissel: boolean): Promise<ToewijsResultaat> {
  const supabase = await beheerder();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan groepen toewijzen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };

  const { data: bezetter } = await supabase
    .from("avf").select("id, locatie_tekst, projectgroep:projectgroep_id(naam)").eq("programma_regel_id", regelId).maybeSingle();

  const klaar = (): ToewijsResultaat => {
    revalidatePath("/programma");
    revalidatePath("/stuurgroep/programma");
    revalidatePath("/avf", "layout");
    return { status: "ok" };
  };

  if (avfId === null) {
    if (!bezetter) return klaar();
    const { data, error } = await supabase.rpc("avf_planning_toewijzen", { p_avf_id: bezetter.id, p_regel_id: null, p_locatie: bezetter.locatie_tekst, p_naam: naam });
    return error || !(data as Rpc).ok ? { status: "fout", melding: FOUT } : klaar();
  }

  const { data: groep } = await supabase.from("avf").select("id, programma_regel_id, locatie_tekst").eq("id", avfId).maybeSingle();
  if (!groep) return { status: "fout", melding: "Deze projectgroep is niet gevonden." };
  if (bezetter?.id === groep.id) return klaar();

  if (!bezetter) {
    const { data, error } = await supabase.rpc("avf_planning_toewijzen", { p_avf_id: groep.id, p_regel_id: regelId, p_locatie: groep.locatie_tekst, p_naam: naam });
    return error || !(data as Rpc).ok ? { status: "fout", melding: FOUT } : klaar();
  }

  const door = (bezetter.projectgroep as unknown as { naam: string }).naam;
  if (!wissel || !groep.programma_regel_id) {
    return { status: "bezet", door, kanWisselen: !!groep.programma_regel_id };
  }
  const { data, error } = await supabase.rpc("avf_planning_wisselen", { p_avf_a: groep.id, p_avf_b: bezetter.id, p_naam: naam });
  return error || !(data as Rpc).ok ? { status: "fout", melding: FOUT } : klaar();
}

/** Past de locatie van een toegewezen belevenis aan. */
export async function locatieOpslaan(avfId: string, locatie: string, naam: string): Promise<{ status: "ok" } | { status: "fout"; melding: string }> {
  const supabase = await beheerder();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan locaties aanpassen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (locatie.length > 120) return { status: "fout", melding: "Deze locatie is te lang." };
  const { data: avf } = await supabase.from("avf").select("programma_regel_id").eq("id", avfId).maybeSingle();
  if (!avf?.programma_regel_id) return { status: "fout", melding: "Wijs eerst een tijdvak toe." };
  const { data, error } = await supabase.rpc("avf_planning_toewijzen", { p_avf_id: avfId, p_regel_id: avf.programma_regel_id, p_locatie: locatie, p_naam: naam });
  if (error || !(data as Rpc).ok) return { status: "fout", melding: FOUT };
  revalidatePath("/programma");
  revalidatePath("/stuurgroep/programma");
  revalidatePath("/avf", "layout");
  return { status: "ok" };
}
