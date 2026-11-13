"use server";

import { revalidatePath } from "next/cache";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";

export type Resultaat = { status: "ok" } | { status: "fout"; melding: string };

const FOUT = "Dat is niet gelukt. Probeer het opnieuw.";
const NAAM_NODIG = "Vul eerst je naam in.";
const FASEN = ["kop", "romp", "staart"];

function ververs() {
  revalidatePath("/avf", "layout");
  revalidatePath("/stuurgroep", "layout");
}

function schoonAantal(n: number): number | null {
  return Number.isInteger(n) && n >= 1 && n <= 9999 ? n : null;
}

async function eigenAvf() {
  const profiel = await getProfiel();
  if (!profiel || profiel.soort !== "projectgroep" || !profiel.projectgroep) return null;
  const supabase = await maakServerClient();
  const { data } = await supabase.from("avf").select("id").eq("projectgroep_id", profiel.projectgroep.id).maybeSingle();
  return data ? { supabase, avfId: data.id as string } : null;
}

function dbFout(error: { code?: string; message?: string }): string {
  if (error.code === "23514" && error.message?.includes("locatie")) return "Kies eerst de locatie van de belevenis in sectie A.";
  if (error.code === "23514") return "Dit materiaal is niet meer beschikbaar.";
  if (error.code === "23505") return "Dit materiaal staat er al. Pas het aantal aan.";
  if (error.code === "42501") return "Dit AVF is ingediend of de lijst is nog niet klaar. Je kunt nu geen materiaal wijzigen.";
  return FOUT;
}

// ------------------------------------------------------------ projectgroep (sectie F)

export async function materiaalKiezen(materiaalId: string, fase: string | null, aantal: number, naam: string): Promise<Resultaat> {
  const ctx = await eigenAvf();
  if (!ctx) return { status: "fout", melding: "Alleen de projectgroep zelf kan materiaal kiezen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const n = schoonAantal(aantal);
  if (n === null) return { status: "fout", melding: "Vul een aantal in van 1 of meer." };
  if (fase !== null && !FASEN.includes(fase)) return { status: "fout", melding: "Onbekende fase." };
  const { error } = await ctx.supabase.from("avf_materiaal").insert({ avf_id: ctx.avfId, materiaal_id: materiaalId, aantal: n, fase: fase as never });
  if (error) return { status: "fout", melding: dbFout(error) };
  await ctx.supabase.rpc("avf_sectie_markeren", { p_avf_id: ctx.avfId, p_letter: "F", p_naam: naam.trim().slice(0, 60) });
  ververs();
  return { status: "ok" };
}

export async function aanvullendToevoegen(omschrijving: string, aantal: number, naam: string): Promise<Resultaat> {
  const ctx = await eigenAvf();
  if (!ctx) return { status: "fout", melding: "Alleen de projectgroep zelf kan materiaal toevoegen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const n = schoonAantal(aantal);
  if (n === null) return { status: "fout", melding: "Vul een aantal in van 1 of meer." };
  const tekst = omschrijving.trim();
  if (tekst.length < 1 || tekst.length > 150) return { status: "fout", melding: "Beschrijf het materiaal in een paar woorden." };
  const { error } = await ctx.supabase.from("avf_materiaal").insert({ avf_id: ctx.avfId, omschrijving: tekst, aantal: n });
  if (error) return { status: "fout", melding: dbFout(error) };
  await ctx.supabase.rpc("avf_sectie_markeren", { p_avf_id: ctx.avfId, p_letter: "F", p_naam: naam.trim().slice(0, 60) });
  ververs();
  return { status: "ok" };
}

export async function materiaalAantalWijzigen(id: string, aantal: number, naam: string): Promise<Resultaat> {
  const ctx = await eigenAvf();
  if (!ctx) return { status: "fout", melding: "Alleen de projectgroep zelf kan het aantal wijzigen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const n = schoonAantal(aantal);
  if (n === null) return { status: "fout", melding: "Vul een aantal in van 1 of meer." };
  const { data, error } = await ctx.supabase.from("avf_materiaal").update({ aantal: n }).eq("id", id).eq("avf_id", ctx.avfId).select("id");
  if (error) return { status: "fout", melding: dbFout(error) };
  if (!data?.length) return { status: "fout", melding: "Dit AVF is ingediend. Je kunt nu geen materiaal wijzigen." };
  await ctx.supabase.rpc("avf_sectie_markeren", { p_avf_id: ctx.avfId, p_letter: "F", p_naam: naam.trim().slice(0, 60) });
  ververs();
  return { status: "ok" };
}

export async function materiaalVerwijderen(id: string, naam: string): Promise<Resultaat> {
  const ctx = await eigenAvf();
  if (!ctx) return { status: "fout", melding: "Alleen de projectgroep zelf kan materiaal verwijderen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await ctx.supabase.from("avf_materiaal").delete().eq("id", id).eq("avf_id", ctx.avfId).select("id");
  if (error || !data?.length) return { status: "fout", melding: error ? dbFout(error) : "Dit AVF is ingediend. Je kunt nu geen materiaal verwijderen." };
  await ctx.supabase.rpc("avf_sectie_markeren", { p_avf_id: ctx.avfId, p_letter: "F", p_naam: naam.trim().slice(0, 60) });
  ververs();
  return { status: "ok" };
}

// ----------------------------------------------------- Logistiek & Facilitair (de lijst)

async function stuurgroepOfDocent() {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent")) return null;
  return maakServerClient();
}

export interface MateriaalVelden {
  naam: string;
  categorie: string;
  voorraadCamping: number;
  voorraadBivak: number;
  opmerking: string;
}

function checkVelden(v: MateriaalVelden): string | null {
  if (!v.naam.trim() || v.naam.trim().length > 100) return "Geef het materiaal een naam (maximaal 100 tekens).";
  for (const n of [v.voorraadCamping, v.voorraadBivak]) {
    if (!Number.isInteger(n) || n < 0 || n > 99999) return "De voorraad moet een getal van 0 of meer zijn.";
  }
  if (v.categorie.length > 60 || v.opmerking.length > 300) return "Categorie of opmerking is te lang.";
  return null;
}

export async function materiaalToevoegen(v: MateriaalVelden, naam: string): Promise<Resultaat> {
  const supabase = await stuurgroepOfDocent();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan materialen toevoegen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const fout = checkVelden(v);
  if (fout) return { status: "fout", melding: fout };
  const { error } = await supabase.from("materiaal").insert({
    naam: v.naam.trim(), categorie: v.categorie.trim() || null, voorraad_camping: v.voorraadCamping, voorraad_bivak: v.voorraadBivak,
    opmerking: v.opmerking.trim() || null, bijgewerkt_door_naam: naam.trim().slice(0, 60),
  });
  if (error) {
    if (error.code === "23505") return { status: "fout", melding: "Dit materiaal staat al in de lijst." };
    if (error.code === "42501") return { status: "fout", melding: "Jouw rol mag geen materialen toevoegen." };
    return { status: "fout", melding: FOUT };
  }
  ververs();
  return { status: "ok" };
}

export async function materiaalWijzigen(id: string, v: MateriaalVelden & { actief: boolean }, naam: string, verwachtUpdatedAt: string): Promise<Resultaat> {
  const supabase = await stuurgroepOfDocent();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan de lijst wijzigen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const fout = checkVelden(v);
  if (fout) return { status: "fout", melding: fout };
  const { data, error } = await supabase.from("materiaal").update({
    naam: v.naam.trim(), categorie: v.categorie.trim() || null, voorraad_camping: v.voorraadCamping, voorraad_bivak: v.voorraadBivak,
    opmerking: v.opmerking.trim() || null, actief: v.actief, bijgewerkt_door_naam: naam.trim().slice(0, 60),
  }).eq("id", id).eq("updated_at", verwachtUpdatedAt).select("id");
  if (error) return { status: "fout", melding: error.code === "23505" ? "Er is al een materiaal met deze naam." : FOUT };
  if (!data?.length) {
    const { data: bestaat } = await supabase.from("materiaal").select("id").eq("id", id).maybeSingle();
    return { status: "fout", melding: bestaat ? "Iemand anders heeft dit materiaal net gewijzigd. Ververs de pagina en probeer het opnieuw." : "Jouw rol mag de lijst niet wijzigen. Je kunt wel materialen toevoegen." };
  }
  ververs();
  return { status: "ok" };
}

export async function lijstDefinitiefMaken(naam: string): Promise<Resultaat> {
  const supabase = await stuurgroepOfDocent();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan de lijst definitief maken." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("materiaallijst_definitief_maken", { p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: "Jouw rol mag de lijst niet definitief maken." };
  const res = data as { ok: boolean; reden?: string };
  if (res.ok) {
    ververs();
    return { status: "ok" };
  }
  if (res.reden === "leeg") return { status: "fout", melding: "Er staan nog geen actieve materialen in de lijst." };
  if (res.reden === "al_definitief") return { status: "fout", melding: "De lijst is al definitief." };
  return { status: "fout", melding: FOUT };
}

export async function lijstTerugzetten(naam: string): Promise<Resultaat> {
  const supabase = await stuurgroepOfDocent();
  if (!supabase) return { status: "fout", melding: "Alleen de docent kan de lijst terugzetten." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("materiaallijst_terugzetten", { p_naam: naam.trim().slice(0, 60) });
  if (error || !(data as { ok: boolean }).ok) return { status: "fout", melding: "Alleen de docent kan de lijst weer op concept zetten." };
  ververs();
  return { status: "ok" };
}

/** Correctie van de stuurgroep op het aantal bij een belevenis (leeg = correctie weghalen). */
export async function materiaalCorrigeren(id: string, aantal: number | null, naam: string): Promise<Resultaat> {
  const supabase = await stuurgroepOfDocent();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan aantallen corrigeren." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (aantal !== null && (!Number.isInteger(aantal) || aantal < 0 || aantal > 9999)) return { status: "fout", melding: "Vul een geldig aantal in." };
  const { data, error } = await supabase.rpc("avf_materiaal_corrigeren", { p_id: id, p_aantal: aantal as number, p_naam: naam.trim().slice(0, 60) });
  if (error || !(data as { ok: boolean }).ok) return { status: "fout", melding: FOUT };
  ververs();
  return { status: "ok" };
}
