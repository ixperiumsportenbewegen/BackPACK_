"use server";

import { revalidatePath } from "next/cache";
import { PROJECTGROEPROLLEN } from "@/config/projectgroeprollen";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";

type Rpc = { ok: boolean; reden?: string; ontbrekend?: string[]; verzoeken?: { id: string; sectie: string; tekst: string }[]; aantal?: number; versie?: number };

export type Resultaat = { status: "ok" } | { status: "fout"; melding: string };

export type IndienResultaat =
  | { status: "ok"; versie: number }
  | { status: "fout"; melding: string }
  | { status: "ontbreekt"; ontbrekend: string[] }
  | { status: "open_verzoeken"; verzoeken: { id: string; sectie: string; tekst: string }[] };

export type GoedkeurResultaat = { status: "ok" } | { status: "fout"; melding: string } | { status: "open_verzoeken"; aantal: number };

const FOUT = "Dat is niet gelukt. Probeer het opnieuw.";
const NAAM_NODIG = "Vul eerst je naam in.";

async function beoordelaar() {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent")) return null;
  return maakServerClient();
}

function ververs() {
  revalidatePath("/", "layout");
}

/** Dient het eigen AVF in. Zie de functie `avf_indienen` in de database voor de controles. */
export async function avfIndienen(naam: string, samenvatting: string, openBevestigd: boolean): Promise<IndienResultaat> {
  const profiel = await getProfiel();
  if (!profiel || profiel.soort !== "projectgroep" || !profiel.projectgroep) return { status: "fout", melding: "Alleen de projectgroep zelf kan indienen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const supabase = await maakServerClient();
  const { data: avf } = await supabase.from("avf").select("id").eq("projectgroep_id", profiel.projectgroep.id).maybeSingle();
  if (!avf) return { status: "fout", melding: FOUT };

  const { data, error } = await supabase.rpc("avf_indienen", {
    p_avf_id: avf.id, p_naam: naam.trim().slice(0, 60), p_samenvatting: samenvatting.trim().slice(0, 1000), p_open_bevestigd: openBevestigd,
  });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    ververs();
    return { status: "ok", versie: res.versie ?? 1 };
  }
  switch (res.reden) {
    case "naam": return { status: "fout", melding: NAAM_NODIG };
    case "samenvatting": return { status: "fout", melding: "Beschrijf kort wat jullie hebben aangepast sinds de vorige keer." };
    case "status": return { status: "fout", melding: "Dit AVF kan nu niet worden ingediend. Misschien is het al ingediend. Ververs de pagina." };
    case "ontbreekt": return { status: "ontbreekt", ontbrekend: res.ontbrekend ?? [] };
    case "open_verzoeken": return { status: "open_verzoeken", verzoeken: res.verzoeken ?? [] };
    default: return { status: "fout", melding: FOUT };
  }
}

export async function aanpassingVragen(avfId: string, naam: string): Promise<Resultaat> {
  const supabase = await beoordelaar();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan beoordelen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("avf_aanpassing_vragen", { p_avf_id: avfId, p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    ververs();
    return { status: "ok" };
  }
  if (res.reden === "geen_open_verzoek") return { status: "fout", melding: "Plaats eerst minstens één verbeterverzoek bij het AVF. Anders weet de projectgroep niet wat er moet gebeuren." };
  if (res.reden === "status") return { status: "fout", melding: "Bij deze status kun je geen aanpassing vragen." };
  return { status: "fout", melding: FOUT };
}

export async function goedkeuren(avfId: string, naam: string, openBevestigd: boolean): Promise<GoedkeurResultaat> {
  const supabase = await beoordelaar();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan beoordelen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("avf_goedkeuren", { p_avf_id: avfId, p_naam: naam.trim().slice(0, 60), p_open_bevestigd: openBevestigd });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    ververs();
    return { status: "ok" };
  }
  if (res.reden === "open_verzoeken") return { status: "open_verzoeken", aantal: res.aantal ?? 0 };
  if (res.reden === "status") return { status: "fout", melding: "Dit AVF is niet ingediend (of al goedgekeurd), dus er valt niets goed te keuren." };
  return { status: "fout", melding: FOUT };
}

export async function verzoekPlaatsen(
  avfId: string, sectie: string, onderdeelId: string | null, veldSleutel: string | null, rol: string, tekst: string, naam: string,
): Promise<Resultaat> {
  const supabase = await beoordelaar();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan verbeterverzoeken plaatsen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (!tekst.trim()) return { status: "fout", melding: "Schrijf eerst wat er verbeterd moet worden." };
  if (!PROJECTGROEPROLLEN.some((r) => r.code === rol)) return { status: "fout", melding: "Kies voor welke rol het verzoek is." };
  const { data, error } = await supabase.rpc("verbeterverzoek_plaatsen", {
    p_avf_id: avfId, p_sectie: sectie, p_onderdeel_id: onderdeelId, p_veld_sleutel: veldSleutel,
    p_rol: rol as never, p_tekst: tekst.trim().slice(0, 1000), p_naam: naam.trim().slice(0, 60),
  });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    ververs();
    return { status: "ok" };
  }
  if (res.reden === "status") return { status: "fout", melding: "Bij een AVF dat nog in ontwikkeling is kun je nog geen verbeterverzoek plaatsen. Wacht tot de groep het indient." };
  return { status: "fout", melding: FOUT };
}

export async function verzoekStatusZetten(id: string, status: "open" | "afgehandeld", naam: string): Promise<Resultaat> {
  const supabase = await beoordelaar();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan beoordelen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("verbeterverzoek_status_zetten", { p_id: id, p_status: status, p_naam: naam.trim().slice(0, 60) });
  if (error || !(data as Rpc).ok) return { status: "fout", melding: FOUT };
  ververs();
  return { status: "ok" };
}

export async function themacheckZetten(avfId: string, rol: string, oordeel: "akkoord" | "aandachtspunt", toelichting: string, naam: string): Promise<Resultaat> {
  const supabase = await beoordelaar();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan beoordelen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("themacheck_zetten", {
    p_avf_id: avfId, p_rol: rol as never, p_oordeel: oordeel, p_toelichting: toelichting.trim().slice(0, 1000), p_naam: naam.trim().slice(0, 60),
  });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    ververs();
    return { status: "ok" };
  }
  if (res.reden === "toelichting") return { status: "fout", melding: "Bij een aandachtspunt hoort een korte toelichting." };
  return { status: "fout", melding: FOUT };
}
