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
  | { status: "ok"; updatedAt: string; verschoven: number }
  | { status: "conflict"; huidig: ProgrammaRegel }
  | { status: "fout"; melding: string };

export type ToewijsResultaat =
  | { status: "ok" }
  | { status: "bezet"; door: string; kanWisselen: boolean }
  | { status: "fout"; melding: string };

type Rpc = { ok: boolean; reden?: string; door?: string; huidig?: ProgrammaRegel; updated_at?: string; verschoven?: number; id?: string; aantal?: number };

const PAST_NIET = "Het meeschuiven past niet meer binnen de dag. Schuif een kleiner stuk op of kies \"niet meeschuiven\".";

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
export async function regelOpslaan(id: string, v: RegelVelden, verwachtUpdatedAt: string, naam: string, schuif = true): Promise<RegelResultaat> {
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
    p_verwacht: verwachtUpdatedAt, p_naam: naam, p_schuif: schuif,
  });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    revalidatePath("/programma");
    revalidatePath("/stuurgroep/programma");
    revalidatePath("/avf", "layout");
    return { status: "ok", updatedAt: res.updated_at!, verschoven: res.verschoven ?? 0 };
  }
  if (res.reden === "gewijzigd" && res.huidig) return { status: "conflict", huidig: res.huidig };
  if (res.reden === "naam") return { status: "fout", melding: NAAM_NODIG };
  if (res.reden === "past_niet") return { status: "fout", melding: PAST_NIET };
  return { status: "fout", melding: "Controleer de tijd en de titel." };
}

/** Zet een projectgroep in een tijdvak (of maakt het tijdvak vrij). Bij een bezet tijdvak kun je wisselen. */
export async function kiesGroep(regelId: string, avfId: string | null, naam: string, wissel: boolean): Promise<ToewijsResultaat> {
  const supabase = await beheerder();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan groepen toewijzen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };

  const { data: bezetter } = await supabase
    .from("avf").select("id, projectgroep:projectgroep_id(naam)").eq("programma_regel_id", regelId).maybeSingle();

  const klaar = (): ToewijsResultaat => {
    revalidatePath("/programma");
    revalidatePath("/stuurgroep/programma");
    revalidatePath("/avf", "layout");
    return { status: "ok" };
  };

  if (avfId === null) {
    if (!bezetter) return klaar();
    const { data, error } = await supabase.rpc("avf_planning_toewijzen", { p_avf_id: bezetter.id, p_regel_id: null, p_locatie: null, p_naam: naam });
    return error || !(data as Rpc).ok ? { status: "fout", melding: FOUT } : klaar();
  }

  const { data: groep } = await supabase.from("avf").select("id, programma_regel_id").eq("id", avfId).maybeSingle();
  if (!groep) return { status: "fout", melding: "Deze projectgroep is niet gevonden." };
  if (bezetter?.id === groep.id) return klaar();

  if (!bezetter) {
    const { data, error } = await supabase.rpc("avf_planning_toewijzen", { p_avf_id: groep.id, p_regel_id: regelId, p_locatie: null, p_naam: naam });
    return error || !(data as Rpc).ok ? { status: "fout", melding: FOUT } : klaar();
  }

  const door = (bezetter.projectgroep as unknown as { naam: string }).naam;
  if (!wissel || !groep.programma_regel_id) {
    return { status: "bezet", door, kanWisselen: !!groep.programma_regel_id };
  }
  const { data, error } = await supabase.rpc("avf_planning_wisselen", { p_avf_a: groep.id, p_avf_b: bezetter.id, p_naam: naam });
  return error || !(data as Rpc).ok ? { status: "fout", melding: FOUT } : klaar();
}

/** Corrigeert de locatie (camping of bivak) van een belevenis. De projectgroep kiest die zelf; dit is voor als de stuurgroep het wil aanpassen. */
export async function locatieOpslaan(avfId: string, locatie: string, naam: string): Promise<{ status: "ok" } | { status: "fout"; melding: string }> {
  const supabase = await beheerder();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan locaties aanpassen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (locatie !== "camping" && locatie !== "bivak") return { status: "fout", melding: "Kies camping of bivak." };
  const { data: avf } = await supabase.from("avf").select("programma_regel_id").eq("id", avfId).maybeSingle();
  if (!avf?.programma_regel_id) return { status: "fout", melding: "Wijs eerst een tijdvak toe." };
  const { data, error } = await supabase.rpc("avf_planning_toewijzen", { p_avf_id: avfId, p_regel_id: avf.programma_regel_id, p_locatie: locatie, p_naam: naam });
  if (error || !(data as Rpc).ok) return { status: "fout", melding: FOUT };
  revalidatePath("/programma");
  revalidatePath("/stuurgroep/programma");
  revalidatePath("/avf", "layout");
  return { status: "ok" };
}

function verversen() {
  revalidatePath("/programma");
  revalidatePath("/stuurgroep/programma");
  revalidatePath("/avf", "layout");
  revalidatePath("/", "layout");
}

export interface NieuweActiviteit {
  titel: string;
  omschrijving: string;
  locatie: string;
  start: string;
  eind: string;
}

/** Voegt een vaste activiteit toe na een bestaande activiteit. Belevenisvakken kun je niet toevoegen: het blijven er zes. */
export async function regelToevoegen(
  naRegelId: string, v: NieuweActiviteit, schuif: boolean, naam: string,
): Promise<{ status: "ok"; verschoven: number } | { status: "fout"; melding: string }> {
  const supabase = await beheerder();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan het programma aanpassen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (!/^\d{2}:\d{2}$/.test(v.start) || !/^\d{2}:\d{2}$/.test(v.eind) || v.eind <= v.start) {
    return { status: "fout", melding: "De eindtijd moet na de starttijd liggen." };
  }
  if (!v.titel.trim()) return { status: "fout", melding: "Vul een titel in." };
  const { data, error } = await supabase.rpc("programma_regel_toevoegen", {
    p_na_regel_id: naRegelId, p_titel: v.titel, p_omschrijving: v.omschrijving, p_locatie: v.locatie,
    p_start: v.start, p_eind: v.eind, p_schuif: schuif, p_naam: naam,
  });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) { verversen(); return { status: "ok", verschoven: res.verschoven ?? 0 }; }
  if (res.reden === "past_niet") return { status: "fout", melding: PAST_NIET };
  return { status: "fout", melding: "Controleer de tijden en de titel." };
}

/** Verwijdert een vaste activiteit. Een belevenisvak van een projectgroep kan nooit worden verwijderd. */
export async function regelVerwijderen(
  id: string, schuif: boolean, naam: string,
): Promise<{ status: "ok"; verschoven: number } | { status: "fout"; melding: string }> {
  const supabase = await beheerder();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan het programma aanpassen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("programma_regel_verwijderen", { p_id: id, p_schuif: schuif, p_naam: naam });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) { verversen(); return { status: "ok", verschoven: res.verschoven ?? 0 }; }
  if (res.reden === "vast_vak") return { status: "fout", melding: "Een belevenisvak van een projectgroep kan niet worden verwijderd. Je kunt wel de tijd aanpassen." };
  if (res.reden === "past_niet") return { status: "fout", melding: PAST_NIET };
  return { status: "fout", melding: FOUT };
}

/** Haalt de uitroeptekens weg: de huidige tijden gelden voortaan als de bedoelde tijden. */
export async function wijzigingenBevestigen(regelId: string | null, naam: string): Promise<{ status: "ok"; aantal: number } | { status: "fout"; melding: string }> {
  const profiel = await getProfiel();
  const supabase = await beheerder();
  if (!supabase || !profiel?.cluster) return { status: "fout", melding: "Alleen de stuurgroep kan het programma aanpassen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("programma_wijzigingen_bevestigen", { p_cluster_id: profiel.cluster.id, p_regel_id: regelId, p_naam: naam });
  if (error || !(data as Rpc).ok) return { status: "fout", melding: FOUT };
  verversen();
  return { status: "ok", aantal: (data as Rpc).aantal ?? 0 };
}
