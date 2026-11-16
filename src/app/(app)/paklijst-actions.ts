"use server";

import { revalidatePath } from "next/cache";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import type { PaklijstBlokCode } from "@/config/paklijst";
import type { PlanResultaat } from "./calamiteitenplan-actions";

type Rpc = { ok: boolean; reden?: string; huidig?: string | null; id?: string; aantal?: number; aantal_spullen?: number; categorieen?: number; spullen?: number };

const FOUT = "Opslaan is niet gelukt. Probeer het opnieuw.";
const NAAM_NODIG = "Vul eerst je naam in.";
const GEEN_RECHT = "Alleen de stuurgroep en de docent kunnen de paklijst aanpassen.";
const UUID = /^[0-9a-f-]{36}$/;
const VELDEN = { naam: 150, aantal: 40, toelichting: 500, optioneel: 3 } as const;

function ververs() {
  revalidatePath("/meer/paklijst", "layout");
}

/** De stuurgroep van het eigen cluster en de docent mogen schrijven; de database controleert dat ook. */
async function schrijver(clusterId: string) {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent")) return null;
  if (profiel.cluster?.id !== clusterId) return null;
  return await maakServerClient();
}

function vertaal(res: Rpc, ok: () => PlanResultaat = () => { ververs(); return { status: "ok" }; }): PlanResultaat {
  if (res.ok) return ok();
  if (res.reden === "conflict") return { status: "conflict", huidig: res.huidig ?? null };
  if (res.reden === "naam") return { status: "fout", melding: NAAM_NODIG };
  if (res.reden === "te_veel") return { status: "fout", melding: "Dat zijn er te veel. Een categorie heeft maximaal 100 items en een item maximaal 30 onderdelen." };
  if (res.reden === "leeg") return { status: "fout", melding: "Er staat niets in de tekst om toe te voegen." };
  return { status: "fout", melding: FOUT };
}

const wie = (naam: string) => naam.trim().slice(0, 60);

export type NieuwResultaat = { status: "ok"; id: string } | { status: "fout"; melding: string };

export async function paklijstCategorieToevoegen(clusterId: string, blok: PaklijstBlokCode, categorie: string, naam: string): Promise<NieuwResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (!categorie.trim()) return { status: "fout", melding: "Geef de categorie een naam." };
  const { data, error } = await supabase.rpc("paklijst_categorie_toevoegen", { p_cluster_id: clusterId, p_blok: blok, p_categorie: categorie.trim().slice(0, 80), p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok && res.id) {
    ververs();
    return { status: "ok", id: res.id };
  }
  if (res.reden === "te_veel") return { status: "fout", melding: "Er kunnen niet meer dan 30 categorieën in een blok." };
  const v = vertaal(res);
  return { status: "fout", melding: v.status === "fout" ? v.melding : FOUT };
}

export async function paklijstCategorieHernoemen(clusterId: string, id: string, oud: string, nieuw: string, naam: string): Promise<PlanResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!UUID.test(id)) return { status: "fout", melding: FOUT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (!nieuw.trim()) return { status: "fout", melding: "Een categorie heeft een naam nodig." };
  if (nieuw.trim().length > 80) return { status: "fout", melding: "Deze naam is te lang." };
  const { data, error } = await supabase.rpc("paklijst_categorie_hernoemen", { p_id: id, p_oud: oud, p_nieuw: nieuw, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc);
}

export async function paklijstCategorieVerplaatsen(clusterId: string, id: string, omhoog: boolean, naam: string): Promise<PlanResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!UUID.test(id)) return { status: "fout", melding: FOUT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("paklijst_categorie_verplaatsen", { p_id: id, p_omhoog: omhoog, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc);
}

export async function paklijstCategorieVerwijderen(clusterId: string, id: string, naam: string): Promise<PlanResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!UUID.test(id)) return { status: "fout", melding: FOUT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("paklijst_categorie_verwijderen", { p_id: id, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc);
}

export async function paklijstSpulToevoegen(clusterId: string, categorieId: string, bovenliggendId: string | null, naam: string): Promise<NieuwResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!UUID.test(categorieId) || (bovenliggendId !== null && !UUID.test(bovenliggendId))) return { status: "fout", melding: FOUT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("paklijst_item_toevoegen", { p_categorie_id: categorieId, p_bovenliggend_id: bovenliggendId, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok && res.id) {
    ververs();
    return { status: "ok", id: res.id };
  }
  const v = vertaal(res);
  return { status: "fout", melding: v.status === "fout" ? v.melding : FOUT };
}

/** Eén veld van een item: naam, aantal, toelichting of optioneel (ja of leeg). */
export async function paklijstSpulVeldOpslaan(
  clusterId: string, id: string, veld: keyof typeof VELDEN, oud: string, nieuw: string, naam: string,
): Promise<PlanResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!UUID.test(id) || !(veld in VELDEN)) return { status: "fout", melding: "Onbekend veld." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (nieuw.length > VELDEN[veld]) return { status: "fout", melding: "Deze tekst is te lang." };
  const { data, error } = await supabase.rpc("paklijst_item_veld_opslaan", { p_id: id, p_veld: veld, p_oud: oud, p_nieuw: nieuw, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc);
}

export async function paklijstSpulVerplaatsen(clusterId: string, id: string, omhoog: boolean, naam: string): Promise<PlanResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!UUID.test(id)) return { status: "fout", melding: FOUT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("paklijst_item_verplaatsen", { p_id: id, p_omhoog: omhoog, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc);
}

export async function paklijstSpulVerwijderen(clusterId: string, id: string, naam: string): Promise<PlanResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!UUID.test(id)) return { status: "fout", melding: FOUT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("paklijst_item_verwijderen", { p_id: id, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc);
}

export type PlakResultaat = { status: "ok"; aantal: number } | { status: "fout"; melding: string };

/** Een geplakte lijst toevoegen aan een categorie: elke regel een item, streepjes of inspringen geven onderdelen. */
export async function paklijstLijstPlakken(clusterId: string, categorieId: string, tekst: string, naam: string): Promise<PlakResultaat> {
  const supabase = await schrijver(clusterId);
  if (!supabase) return { status: "fout", melding: GEEN_RECHT };
  if (!UUID.test(categorieId)) return { status: "fout", melding: FOUT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await supabase.rpc("paklijst_items_plakken", { p_categorie_id: categorieId, p_tekst: tekst.slice(0, 20000), p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    ververs();
    return { status: "ok", aantal: res.aantal ?? 0 };
  }
  const v = vertaal(res);
  return { status: "fout", melding: v.status === "fout" ? v.melding : FOUT };
}

/** De docent kopieert de paklijst van het ene cluster naar het andere; de lijst in het doelcluster wordt vervangen. */
export async function paklijstOvernemen(vanClusterId: string, naarClusterId: string, naam: string): Promise<{ status: "ok"; tekst: string } | { status: "fout"; melding: string }> {
  const profiel = await getProfiel();
  if (!profiel || profiel.soort !== "docent") return { status: "fout", melding: "Alleen de docent kan de paklijst overnemen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const supabase = await maakServerClient();
  const { data, error } = await supabase.rpc("paklijst_overnemen", { p_van: vanClusterId, p_naar: naarClusterId, p_naam: wie(naam) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    ververs();
    return { status: "ok", tekst: `Overgenomen: ${res.categorieen ?? 0} categorieën en ${res.spullen ?? 0} items.` };
  }
  if (res.reden === "ongeldig") return { status: "fout", melding: "Kies twee verschillende clusters." };
  return { status: "fout", melding: res.reden === "naam" ? NAAM_NODIG : FOUT };
}
