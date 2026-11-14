"use server";

import { revalidatePath } from "next/cache";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import type { BudgetRegel } from "@/lib/budgetTypes";

export type Resultaat = { status: "ok" } | { status: "fout"; melding: string };

const FOUT = "Dat is niet gelukt. Probeer het opnieuw.";
const NAAM_NODIG = "Vul eerst je naam in.";

function ververs() {
  revalidatePath("/", "layout");
}

async function projectgroep() {
  const profiel = await getProfiel();
  if (!profiel || profiel.soort !== "projectgroep" || !profiel.projectgroep) return null;
  const supabase = await maakServerClient();
  const { data } = await supabase.from("avf").select("id").eq("projectgroep_id", profiel.projectgroep.id).maybeSingle();
  return data ? { supabase, avfId: data.id as string } : null;
}

async function beoordelaar() {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent")) return null;
  return maakServerClient();
}

// ------------------------------------------------------------------ projectgroep

/** Slaat de regels van het financieel plan (of van een losse aanvraag) op. Waarschuwt bij gelijktijdig wijzigen. */
export async function budgetRegelsOpslaan(
  id: string, regels: BudgetRegel[], omschrijving: string, toelichting: string, naam: string, verwacht: string,
): Promise<{ status: "ok"; updatedAt: string; bedrag: number } | { status: "conflict" } | { status: "fout"; melding: string }> {
  const ctx = await projectgroep();
  if (!ctx) return { status: "fout", melding: "Alleen de projectgroep zelf kan het plan aanpassen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await ctx.supabase.rpc("budget_regels_opslaan", {
    p_id: id, p_regels: regels as never, p_omschrijving: omschrijving.trim().slice(0, 150), p_toelichting: toelichting.trim().slice(0, 500),
    p_naam: naam.trim().slice(0, 60), p_verwacht: verwacht,
  });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as { ok: boolean; reden?: string; updated_at?: string; bedrag?: number };
  if (res.ok) {
    ververs();
    return { status: "ok", updatedAt: res.updated_at!, bedrag: Number(res.bedrag ?? 0) };
  }
  if (res.reden === "gewijzigd") return { status: "conflict" };
  if (res.reden === "vergrendeld") return { status: "fout", melding: "Dit plan is al ingediend en kan niet meer worden aangepast." };
  if (res.reden === "vast") return { status: "fout", melding: "Het AVF is goedgekeurd: het financieel plan ligt vast. Extra kosten vraag je aan met een losse aanvraag." };
  if (res.reden === "ongeldig") return { status: "fout", melding: "Elke regel heeft een omschrijving en een bedrag van 0 tot en met 99.999 nodig." };
  return { status: "fout", melding: FOUT };
}

export async function losseAanvraagMaken(omschrijving: string, naam: string): Promise<Resultaat> {
  const ctx = await projectgroep();
  if (!ctx) return { status: "fout", melding: "Alleen de projectgroep zelf kan een aanvraag doen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (!omschrijving.trim()) return { status: "fout", melding: "Beschrijf waarvoor jullie extra budget nodig hebben." };
  const { data, error } = await ctx.supabase.rpc("budget_losse_aanvraag_maken", { p_avf_id: ctx.avfId, p_omschrijving: omschrijving.trim().slice(0, 150), p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as { ok: boolean; reden?: string };
  if (res.ok) {
    ververs();
    return { status: "ok" };
  }
  if (res.reden === "avf_niet_goedgekeurd") return { status: "fout", melding: "Een losse aanvraag kan pas nadat jullie AVF is goedgekeurd. Tot dan hoort alles in het financieel plan van het AVF." };
  return { status: "fout", melding: FOUT };
}

export async function budgetAanvraagIndienen(id: string, naam: string): Promise<Resultaat> {
  const ctx = await projectgroep();
  if (!ctx) return { status: "fout", melding: "Alleen de projectgroep zelf kan indienen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await ctx.supabase.rpc("budget_aanvraag_indienen", { p_id: id, p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as { ok: boolean; reden?: string };
  if (res.ok) {
    ververs();
    return { status: "ok" };
  }
  if (res.reden === "leeg") return { status: "fout", melding: "Vul eerst minstens één regel met een bedrag in." };
  if (res.reden === "omschrijving") return { status: "fout", melding: "Geef de aanvraag een omschrijving." };
  if (res.reden === "avf_niet_goedgekeurd") return { status: "fout", melding: "Een losse aanvraag kan pas als het AVF is goedgekeurd." };
  if (res.reden === "status") return { status: "fout", melding: "Dit kan nu niet worden ingediend. Het plan van het AVF gaat mee met het indienen van het AVF." };
  return { status: "fout", melding: FOUT };
}

// ---------------------------------------------------------------------- stuurgroep

export type BesluitResultaat = { status: "ok"; bovenResterend: boolean } | { status: "fout"; melding: string };

export async function budgetBesluit(id: string, besluit: "toegekend" | "teruggegeven" | "afgewezen", bedrag: number | null, toelichting: string, naam: string): Promise<BesluitResultaat> {
  const supabase = await beoordelaar();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan besluiten." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("budget_besluit", {
    p_id: id, p_besluit: besluit, p_bedrag: bedrag as number, p_toelichting: toelichting.trim().slice(0, 500), p_naam: naam.trim().slice(0, 60),
  });
  if (error) return { status: "fout", melding: "Alleen de stuurgroep van het cluster van deze groep kan hierover besluiten." };
  const res = data as { ok: boolean; reden?: string; boven_resterend?: boolean };
  if (res.ok) {
    ververs();
    return { status: "ok", bovenResterend: Boolean(res.boven_resterend) };
  }
  if (res.reden === "toelichting") return { status: "fout", melding: "Een toelichting is verplicht bij teruggeven, afwijzen of een lager bedrag." };
  if (res.reden === "bedrag") return { status: "fout", melding: "Het toegekende bedrag moet meer dan 0 zijn en niet hoger dan het aangevraagde bedrag." };
  if (res.reden === "status") return { status: "fout", melding: "Over deze aanvraag is al besloten. Ververs de pagina." };
  return { status: "fout", melding: FOUT };
}

export async function budgetBesteedZetten(id: string, bedrag: number | null, naam: string): Promise<Resultaat> {
  const supabase = await beoordelaar();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan het besteed bedrag invullen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("budget_besteed_zetten", { p_id: id, p_bedrag: bedrag as number, p_naam: naam.trim().slice(0, 60) });
  if (error || !(data as { ok: boolean }).ok) return { status: "fout", melding: FOUT };
  ververs();
  return { status: "ok" };
}

/** Het clusterbudget aanpassen (stuurgroep van het cluster en docent). */
export async function clusterBudgetZetten(clusterId: string, bedrag: number): Promise<Resultaat> {
  const supabase = await beoordelaar();
  if (!supabase) return { status: "fout", melding: "Alleen de stuurgroep kan het budget aanpassen." };
  if (!Number.isFinite(bedrag) || bedrag < 0 || bedrag > 99999) return { status: "fout", melding: "Vul een bedrag van 0 tot en met 99.999 in." };
  const { data, error } = await supabase.from("cluster_budget").update({ budget_totaal: Math.round(bedrag * 100) / 100 }).eq("cluster_id", clusterId).select("cluster_id");
  if (error || !data?.length) return { status: "fout", melding: "Je kunt alleen het budget van je eigen cluster aanpassen." };
  ververs();
  return { status: "ok" };
}
