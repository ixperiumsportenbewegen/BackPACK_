"use server";

import { revalidatePath } from "next/cache";
import { BERGTOP_MAX } from "@/config/bergtoppen";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import type { PlanResultaat } from "./calamiteitenplan-actions";

type Rpc = { ok: boolean; reden?: string; huidig?: string | null; versie?: number; ontbrekend?: string[]; velden?: number };

const FOUT = "Opslaan is niet gelukt. Probeer het opnieuw.";
const NAAM_NODIG = "Vul eerst je naam in.";
const GEEN_RECHT = "Alleen de stuurgroep en de docent kunnen de bergtoppen aanpassen.";
const SLEUTEL = /^(top_([1-9]|10)_(titel|afspraak)|toelichting_titel|toelichting)$/;

function ververs() {
  revalidatePath("/bergtoppen", "layout");
  revalidatePath("/meer", "layout");
  revalidatePath("/", "layout");
  revalidatePath("/stuurgroep", "layout");
}

/** De stuurgroep van het eigen cluster en de docent mogen schrijven; de database controleert dat ook. */
async function schrijver(clusterId: string) {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent")) return null;
  if (profiel.cluster?.id !== clusterId) return null;
  return await maakServerClient();
}

const wie = (naam: string) => naam.trim().slice(0, 60);

function maxLengte(sleutel: string) {
  if (sleutel === "toelichting") return BERGTOP_MAX.toelichting;
  if (sleutel === "toelichting_titel") return BERGTOP_MAX.toelichtingTitel;
  return sleutel.endsWith("_afspraak") ? BERGTOP_MAX.afspraak : BERGTOP_MAX.titel;
}

/** Eén veld van het concept opslaan; alleen als het nog de waarde heeft die de gebruiker zag. */
export async function bergtopVeldOpslaan(clusterId: string, sleutel: string, oud: string, nieuw: string, naam: string): Promise<PlanResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!SLEUTEL.test(sleutel)) return { status: "fout", melding: "Onbekend veld." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (nieuw.length > maxLengte(sleutel)) return { status: "fout", melding: "Deze tekst is te lang." };
  const { data, error } = await supabase.rpc("bergtop_veld_opslaan", { p_cluster_id: clusterId, p_sleutel: sleutel, p_oud: oud, p_nieuw: nieuw, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) { ververs(); return { status: "ok" }; }
  if (res.reden === "conflict") return { status: "conflict", huidig: res.huidig ?? null };
  if (res.reden === "naam") return { status: "fout", melding: NAAM_NODIG };
  return { status: "fout", melding: FOUT };
}

export type PubliceerResultaat = { status: "ok"; versie: number } | { status: "fout"; melding: string };

/** Het concept bewust publiceren: studenten zien vanaf dat moment deze versie. */
export async function bergtoppenPubliceren(clusterId: string, naam: string): Promise<PubliceerResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("bergtop_publiceren", { p_cluster_id: clusterId, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) { ververs(); return { status: "ok", versie: res.versie ?? 1 }; }
  if (res.reden === "onvolledig") return { status: "fout", melding: `Nog niet compleet: ${(res.ontbrekend ?? []).join(", ")}.` };
  if (res.reden === "naam") return { status: "fout", melding: NAAM_NODIG };
  return { status: "fout", melding: FOUT };
}

/** De gepubliceerde versie verbergen voor studenten. Het concept blijft bestaan. */
export async function bergtoppenIntrekken(clusterId: string, naam: string): Promise<PlanResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("bergtop_intrekken", { p_cluster_id: clusterId, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) { ververs(); return { status: "ok" }; }
  if (res.reden === "naam") return { status: "fout", melding: NAAM_NODIG };
  return { status: "fout", melding: res.reden === "niet_gepubliceerd" ? "Er is niets gepubliceerd." : FOUT };
}

/** De link naar het inschrijfformulier waar studenten de afspraken ondertekenen. Leeg haalt hem weg. */
export async function inschrijfLinkOpslaan(clusterId: string, link: string, naam: string): Promise<PlanResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("cluster_inschrijf_link_zetten", { p_cluster_id: clusterId, p_link: link.trim(), p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) { ververs(); return { status: "ok" }; }
  if (res.reden === "ongeldig") return { status: "fout", melding: "Dit is geen geldige link. Een link begint met https:// en heeft geen spaties." };
  return { status: "fout", melding: res.reden === "naam" ? NAAM_NODIG : FOUT };
}

/** De docent kopieert het concept van het ene cluster naar het andere; het concept in het doelcluster wordt vervangen. */
export async function bergtoppenOvernemen(vanClusterId: string, naarClusterId: string, naam: string): Promise<{ status: "ok"; tekst: string } | { status: "fout"; melding: string }> {
  const profiel = await getProfiel();
  if (!profiel || profiel.soort !== "docent") return { status: "fout", melding: "Alleen de docent kan de bergtoppen overnemen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const supabase = await maakServerClient();
  const { data, error } = await supabase.rpc("bergtoppen_overnemen", { p_van: vanClusterId, p_naar: naarClusterId, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) { ververs(); return { status: "ok", tekst: `Overgenomen als concept: ${res.velden ?? 0} velden. Publiceer het zelf als je het goed vindt.` }; }
  if (res.reden === "ongeldig") return { status: "fout", melding: "Kies twee verschillende clusters." };
  return { status: "fout", melding: res.reden === "naam" ? NAAM_NODIG : FOUT };
}
