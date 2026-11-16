"use server";

import { revalidatePath } from "next/cache";
import { planLijst, planVeld } from "@/config/calamiteitenplan";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";

export type PlanResultaat =
  | { status: "ok" }
  | { status: "conflict"; huidig: string | null }
  | { status: "fout"; melding: string };

type Rpc = { ok: boolean; reden?: string; huidig?: string | null; id?: string; velden?: number; regels?: number };

const FOUT = "Opslaan is niet gelukt. Probeer het opnieuw.";
const NAAM_NODIG = "Vul eerst je naam in.";
const GEEN_RECHT = "Alleen de stuurgroep en de docent kunnen het calamiteitenplan aanpassen.";

function ververs() {
  revalidatePath("/meer/calamiteitenplan", "layout");
  revalidatePath("/avf", "layout");
}

/** De stuurgroep van het eigen cluster en de docent mogen schrijven; de database controleert dat ook. */
async function schrijver(clusterId?: string) {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent")) return null;
  if (clusterId && profiel.cluster?.id !== clusterId) return null;
  return { profiel, supabase: await maakServerClient() };
}

function vertaal(res: Rpc, ok: () => PlanResultaat = () => ({ status: "ok" })): PlanResultaat {
  if (res.ok) return ok();
  if (res.reden === "conflict") return { status: "conflict", huidig: res.huidig ?? null };
  if (res.reden === "naam") return { status: "fout", melding: NAAM_NODIG };
  if (res.reden === "te_veel") return { status: "fout", melding: "Er kunnen niet meer dan 50 regels in een lijst." };
  return { status: "fout", melding: FOUT };
}

/** Eén tekstveld van het plan opslaan; alleen als het nog de waarde heeft die de gebruiker zag. */
export async function planVeldOpslaan(clusterId: string, sleutel: string, oud: string, nieuw: string, naam: string): Promise<PlanResultaat> {
  const veld = planVeld(sleutel);
  const ctx = await schrijver(clusterId);
  if (!ctx) return { status: "fout", melding: GEEN_RECHT };
  if (!veld) return { status: "fout", melding: "Onbekend veld." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (nieuw.length > veld.maxLengte) return { status: "fout", melding: "Deze tekst is te lang." };
  const { data, error } = await ctx.supabase.rpc("calamiteit_veld_opslaan", {
    p_cluster_id: clusterId, p_sleutel: sleutel, p_oud: oud, p_nieuw: nieuw, p_naam: naam.trim().slice(0, 60),
  });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc, () => { ververs(); return { status: "ok" }; });
}

export type ItemToevoegResultaat = { status: "ok"; id: string } | { status: "fout"; melding: string };

export async function planItemToevoegen(clusterId: string, lijst: string, naam: string): Promise<ItemToevoegResultaat> {
  const ctx = await schrijver(clusterId);
  if (!ctx) return { status: "fout", melding: GEEN_RECHT };
  if (!planLijst(lijst)) return { status: "fout", melding: "Onbekende lijst." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await ctx.supabase.rpc("calamiteit_item_toevoegen", { p_cluster_id: clusterId, p_lijst: lijst, p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok && res.id) { ververs(); return { status: "ok", id: res.id }; }
  const v = vertaal(res);
  return { status: "fout", melding: v.status === "fout" ? v.melding : FOUT };
}

/** Eén veld van een regel opslaan. `lijst` en `veld` worden gecontroleerd tegen de opzet van het plan. */
export async function planItemVeldOpslaan(
  clusterId: string, lijst: string, itemId: string, veld: string, oud: string, nieuw: string, naam: string,
): Promise<PlanResultaat> {
  const ctx = await schrijver(clusterId);
  if (!ctx) return { status: "fout", melding: GEEN_RECHT };
  const definitie = planLijst(lijst)?.velden.find((v) => v.sleutel === veld);
  if (!definitie || !/^[0-9a-f-]{36}$/.test(itemId)) return { status: "fout", melding: "Onbekend veld." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  if (nieuw.length > definitie.maxLengte) return { status: "fout", melding: "Deze tekst is te lang." };
  const { data, error } = await ctx.supabase.rpc("calamiteit_item_veld_opslaan", {
    p_id: itemId, p_veld: veld, p_oud: oud, p_nieuw: nieuw, p_naam: naam.trim().slice(0, 60),
  });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc, () => { ververs(); return { status: "ok" }; });
}

export async function planItemVerplaatsen(clusterId: string, itemId: string, omhoog: boolean, naam: string): Promise<PlanResultaat> {
  const ctx = await schrijver(clusterId);
  if (!ctx) return { status: "fout", melding: GEEN_RECHT };
  if (!/^[0-9a-f-]{36}$/.test(itemId)) return { status: "fout", melding: FOUT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await ctx.supabase.rpc("calamiteit_item_verplaatsen", { p_id: itemId, p_omhoog: omhoog, p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc, () => { ververs(); return { status: "ok" }; });
}

export async function planItemVerwijderen(clusterId: string, itemId: string, naam: string): Promise<PlanResultaat> {
  const ctx = await schrijver(clusterId);
  if (!ctx) return { status: "fout", melding: GEEN_RECHT };
  if (!/^[0-9a-f-]{36}$/.test(itemId)) return { status: "fout", melding: FOUT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await ctx.supabase.rpc("calamiteit_item_verwijderen", { p_id: itemId, p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: FOUT };
  return vertaal(data as Rpc, () => { ververs(); return { status: "ok" }; });
}

/** De link naar de groepsapp voor noodmeldingen. Leeg haalt hem weg. */
export async function groepsappLinkOpslaan(clusterId: string, link: string, naam: string): Promise<PlanResultaat> {
  const ctx = await schrijver(clusterId);
  if (!ctx) return { status: "fout", melding: GEEN_RECHT };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const { data, error } = await ctx.supabase.rpc("cluster_whatsapp_link_zetten", { p_cluster_id: clusterId, p_link: link.trim(), p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) { ververs(); revalidatePath("/", "layout"); return { status: "ok" }; }
  if (res.reden === "ongeldig") return { status: "fout", melding: "Dit is geen geldige link. Een link begint met https:// en heeft geen spaties." };
  return vertaal(res);
}

export type OvernemenResultaat = { status: "ok"; velden: number; regels: number; tekst: string } | { status: "fout"; melding: string };

/** De docent kopieert het plan van het ene cluster naar het andere; het plan in het doelcluster wordt vervangen. */
export async function planOvernemen(vanClusterId: string, naarClusterId: string, naam: string): Promise<OvernemenResultaat> {
  const profiel = await getProfiel();
  if (!profiel || profiel.soort !== "docent") return { status: "fout", melding: "Alleen de docent kan het plan overnemen." };
  if (!naam.trim()) return { status: "fout", melding: NAAM_NODIG };
  const supabase = await maakServerClient();
  const { data, error } = await supabase.rpc("calamiteitenplan_overnemen", { p_van: vanClusterId, p_naar: naarClusterId, p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: FOUT };
  const res = data as Rpc;
  if (res.ok) {
    ververs();
    const velden = res.velden ?? 0;
    const regels = res.regels ?? 0;
    return { status: "ok", velden, regels, tekst: `Overgenomen: ${velden} tekstvelden en ${regels} regels.` };
  }
  if (res.reden === "ongeldig") return { status: "fout", melding: "Kies twee verschillende clusters." };
  return { status: "fout", melding: res.reden === "naam" ? NAAM_NODIG : FOUT };
}
