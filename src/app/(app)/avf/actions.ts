"use server";

import { revalidatePath } from "next/cache";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { AVF_VELDEN, ONDERDEEL_NVT_MOGELIJK, OPRUIMEN_VELDEN, VERSCHIJNINGSVORMEN, type SectieCode } from "@/config/avf-velden";

export type Waarde = string | number | boolean | null;
export type FaseCode = "kop" | "romp" | "staart";
export type JsonSectie = "beginsituatie" | "doelen" | "veiligheid" | "organisatie" | "communicatie";

const KOLOMMEN_A = ["titel", "verschijningsvorm", "publieke_samenvatting", "organiserende_studenten", "doelgroep", "aantal_deelnemers", "contactpersoon"] as const;
const FASE_KOLOMMEN = ["organisatievorm", "coachen_instructies", "stemgebruik_houding", "overzichtstekening_pad", "overzichtstekening_bijschrift"] as const;
const ONDERDEEL_KOLOMMEN = [
  "naam", "duur_minuten", "beschrijving", "sociale_veiligheid", "fysieke_veiligheid", "individu_moeilijker", "individu_makkelijker",
  "groep_moeilijker", "groep_makkelijker", "usv_uitdagend", "usv_speelbaar", "usv_veilig_aanvulling", "afbeelding_pad", "afbeelding_bijschrift",
] as const;
const JSON_SECTIES: Record<JsonSectie, SectieCode> = { beginsituatie: "B", doelen: "C", veiligheid: "E", organisatie: "G", communicatie: "H" };
const GETAL_KOLOMMEN = new Set(["aantal_deelnemers", "duur_minuten"]);
const MAX_STANDAARD = 3000;

export type VeldDoel =
  | { soort: "kolom"; kolom: (typeof KOLOMMEN_A)[number] }
  | { soort: "json"; sectie: JsonSectie; pad: string[] }
  | { soort: "fase"; fase: FaseCode; kolom: (typeof FASE_KOLOMMEN)[number] }
  | { soort: "opruimen"; fase: FaseCode; sleutel: (typeof OPRUIMEN_VELDEN)[number]["sleutel"] }
  | { soort: "onderdeel"; id: string; kolom: (typeof ONDERDEEL_KOLOMMEN)[number] };

export type OpslaanResultaat =
  | { status: "ok"; nieuw: Waarde }
  | { status: "conflict"; huidig: Waarde }
  | { status: "fout"; melding: string };

type Lijstresultaat = { ok: boolean; reden?: string; item?: { id: string } };

const VERGRENDELD = "Dit AVF is ingediend en kan niet meer worden gewijzigd.";
const ALGEMEEN_FOUT = "Opslaan is niet gelukt. Probeer het opnieuw.";

async function eigenAvf() {
  const profiel = await getProfiel();
  if (!profiel || profiel.soort !== "projectgroep") return null;
  const supabase = await maakServerClient();
  const { data: account } = await supabase.from("account").select("projectgroep_id").maybeSingle();
  if (!account?.projectgroep_id) return null;
  const { data } = await supabase.from("avf").select("id, status, cluster_id").eq("projectgroep_id", account.projectgroep_id).maybeSingle();
  if (!data) return null;
  return { supabase, avfId: data.id as string, clusterId: data.cluster_id as string };
}

async function isVergrendeld(supabase: Awaited<ReturnType<typeof maakServerClient>>, avfId: string): Promise<boolean> {
  const { data } = await supabase.from("avf").select("status").eq("id", avfId).maybeSingle();
  return data?.status === "ingediend";
}

function schoon(w: Waarde, kolom?: string): Waarde {
  if (typeof w === "string") {
    const t = w.trim();
    if (t === "") return null;
    if (kolom && GETAL_KOLOMMEN.has(kolom)) return Number(t);
    return t;
  }
  return w;
}

function letterVoor(doel: VeldDoel): SectieCode {
  if (doel.soort === "kolom") return "A";
  if (doel.soort === "json") return JSON_SECTIES[doel.sectie];
  return "D";
}

async function markeer(supabase: Awaited<ReturnType<typeof maakServerClient>>, avfId: string, letter: SectieCode, naam: string) {
  await supabase.rpc("avf_sectie_markeren", { p_avf_id: avfId, p_letter: letter, p_naam: naam });
}

function geldigDoel(doel: VeldDoel): boolean {
  switch (doel.soort) {
    case "kolom": return (KOLOMMEN_A as readonly string[]).includes(doel.kolom);
    case "json": return doel.sectie in JSON_SECTIES && doel.pad.length > 0 && doel.pad.length <= 4 && doel.pad.every((p) => /^[a-z0-9_-]{1,64}$/i.test(p));
    case "fase": return (["kop", "romp", "staart"] as string[]).includes(doel.fase) && (FASE_KOLOMMEN as readonly string[]).includes(doel.kolom);
    case "opruimen": return (["kop", "romp", "staart"] as string[]).includes(doel.fase) && OPRUIMEN_VELDEN.some((w) => w.sleutel === doel.sleutel);
    case "onderdeel": return /^[0-9a-f-]{36}$/.test(doel.id) && (ONDERDEEL_KOLOMMEN as readonly string[]).includes(doel.kolom);
  }
}

function maxLengteVoor(doel: VeldDoel): number {
  if (doel.soort === "kolom") return AVF_VELDEN.find((v) => v.sleutel === doel.kolom)?.maxLengte ?? MAX_STANDAARD;
  if (doel.soort === "json") {
    const sleutel = `${doel.sectie}.${doel.pad.filter((p) => !/^[0-9a-f-]{36}$/.test(p)).join(".")}`;
    return AVF_VELDEN.find((v) => v.sleutel === sleutel)?.maxLengte ?? 1000;
  }
  return MAX_STANDAARD;
}

/**
 * Slaat één veld van het eigen AVF op. Het veld wordt alleen gewijzigd als het nog de waarde heeft
 * die de gebruiker zag (`oud`). Heeft iemand anders het net gewijzigd, dan komt er een waarschuwing
 * met de huidige waarde. Andere velden worden nooit aangeraakt.
 */
export async function slaVeldOp(doel: VeldDoel, oudRuw: Waarde, nieuwRuw: Waarde, naam: string): Promise<OpslaanResultaat> {
  const ctx = await eigenAvf();
  if (!ctx) return { status: "fout", melding: "Alleen de projectgroep zelf kan het AVF invullen." };
  if (!geldigDoel(doel)) return { status: "fout", melding: "Onbekend veld." };
  const wie = naam.trim().slice(0, 60);
  if (!wie) return { status: "fout", melding: "Vul eerst je naam in." };

  const kolomNaam = doel.soort === "kolom" || doel.soort === "onderdeel" ? doel.kolom : undefined;
  const oud = schoon(oudRuw, kolomNaam);
  const nieuw = schoon(nieuwRuw, kolomNaam);
  if (typeof nieuw === "number" && !Number.isFinite(nieuw)) return { status: "fout", melding: "Vul een getal in." };
  if (doel.soort === "kolom" && doel.kolom === "verschijningsvorm" && nieuw !== null) {
    const gekozen = typeof nieuw === "string" ? nieuw.split(", ") : [];
    if (gekozen.length === 0 || !gekozen.every((g) => (VERSCHIJNINGSVORMEN as readonly string[]).includes(g))) {
      return { status: "fout", melding: "Kies uit de genoemde vormen." };
    }
  }
  if (typeof nieuw === "string" && nieuw.length > maxLengteVoor(doel)) return { status: "fout", melding: "Deze tekst is te lang." };
  if (doel.soort === "fase" && doel.kolom === "overzichtstekening_pad" && typeof nieuw === "string"
      && !nieuw.startsWith(`cluster/${ctx.clusterId}/avf/${ctx.avfId}/`)) return { status: "fout", melding: "Dit bestand hoort niet bij jullie AVF." };
  if (doel.soort === "onderdeel" && doel.kolom === "afbeelding_pad" && typeof nieuw === "string"
      && !nieuw.startsWith(`cluster/${ctx.clusterId}/avf/${ctx.avfId}/`)) return { status: "fout", melding: "Dit bestand hoort niet bij jullie AVF." };

  const { supabase, avfId } = ctx;

  const afhandelen = async (gelukt: boolean, huidig: () => Promise<Waarde | undefined>): Promise<OpslaanResultaat> => {
    if (gelukt) {
      await markeer(supabase, avfId, letterVoor(doel), wie);
      revalidatePath("/avf", "layout");
      return { status: "ok", nieuw };
    }
    if (await isVergrendeld(supabase, avfId)) return { status: "fout", melding: VERGRENDELD };
    const nu = await huidig();
    if (nu === undefined) return { status: "fout", melding: ALGEMEEN_FOUT };
    return { status: "conflict", huidig: nu };
  };

  if (doel.soort === "kolom") {
    let q = supabase.from("avf").update({ [doel.kolom]: nieuw }).eq("id", avfId);
    q = oud === null ? q.is(doel.kolom, null) : q.eq(doel.kolom, oud);
    const { data, error } = await q.select("id");
    if (error) return { status: "fout", melding: error.code === "23514" ? "Deze waarde is niet toegestaan." : ALGEMEEN_FOUT };
    return afhandelen((data?.length ?? 0) > 0, async () => {
      const { data: rij } = await supabase.from("avf").select(doel.kolom).eq("id", avfId).maybeSingle();
      return rij ? ((rij as unknown as Record<string, Waarde>)[doel.kolom] ?? null) : undefined;
    });
  }

  if (doel.soort === "json") {
    const { data, error } = await supabase.rpc("avf_veld_opslaan", {
      p_avf_id: avfId, p_sectie: doel.sectie, p_pad: doel.pad, p_oud: oud, p_nieuw: nieuw,
    });
    if (error) return { status: "fout", melding: ALGEMEEN_FOUT };
    const res = data as { ok: boolean; reden?: string; huidig?: Waarde };
    if (res.ok) return afhandelen(true, async () => undefined);
    if (res.reden === "gewijzigd") return { status: "conflict", huidig: res.huidig ?? null };
    if (res.reden === "verdwenen") return { status: "fout", melding: "Dit onderdeel is intussen verwijderd door iemand anders. Ververs de pagina." };
    if (await isVergrendeld(supabase, avfId)) return { status: "fout", melding: VERGRENDELD };
    return { status: "fout", melding: ALGEMEEN_FOUT };
  }

  if (doel.soort === "fase") {
    let q = supabase.from("avf_fase").update({ [doel.kolom]: nieuw }).eq("avf_id", avfId).eq("fase", doel.fase);
    q = oud === null ? q.is(doel.kolom, null) : q.eq(doel.kolom, oud);
    const { data, error } = await q.select("fase");
    if (error) return { status: "fout", melding: ALGEMEEN_FOUT };
    return afhandelen((data?.length ?? 0) > 0, async () => {
      const { data: rij } = await supabase.from("avf_fase").select(doel.kolom).eq("avf_id", avfId).eq("fase", doel.fase).maybeSingle();
      return rij ? ((rij as unknown as Record<string, Waarde>)[doel.kolom] ?? null) : undefined;
    });
  }

  if (doel.soort === "opruimen") {
    const { data, error } = await supabase.rpc("avf_fase_opruimen_opslaan", {
      p_avf_id: avfId, p_fase: doel.fase, p_sleutel: doel.sleutel, p_oud: oud as string | null, p_nieuw: nieuw as string | null,
    });
    if (error) return { status: "fout", melding: ALGEMEEN_FOUT };
    const res = data as { ok: boolean; reden?: string; huidig?: Waarde };
    if (res.ok) return afhandelen(true, async () => undefined);
    if (res.reden === "gewijzigd") return { status: "conflict", huidig: res.huidig ?? null };
    if (await isVergrendeld(supabase, avfId)) return { status: "fout", melding: VERGRENDELD };
    return { status: "fout", melding: ALGEMEEN_FOUT };
  }

  // onderdeel
  let q = supabase.from("avf_onderdeel").update({ [doel.kolom]: nieuw }).eq("id", doel.id).eq("avf_id", avfId);
  q = oud === null ? q.is(doel.kolom, null) : q.eq(doel.kolom, oud);
  const { data, error } = await q.select("id");
  if (error) return { status: "fout", melding: error.code === "23514" ? "Deze waarde is niet toegestaan." : ALGEMEEN_FOUT };
  return afhandelen((data?.length ?? 0) > 0, async () => {
    const { data: rij } = await supabase.from("avf_onderdeel").select(doel.kolom).eq("id", doel.id).maybeSingle();
    return rij ? ((rij as unknown as Record<string, Waarde>)[doel.kolom] ?? null) : undefined;
  });
}

// --------------------------------------------------------------- lijsten (risico's, persoonlijke leerdoelen)

export async function lijstToevoegen(
  sectie: JsonSectie, pad: string[], item: Record<string, string>, naam: string,
): Promise<{ status: "ok"; item: { id: string } } | { status: "fout"; melding: string }> {
  const ctx = await eigenAvf();
  const wie = naam.trim().slice(0, 60);
  if (!ctx || !(sectie in JSON_SECTIES) || !pad.every((p) => /^[a-z_]{1,40}$/.test(p))) return { status: "fout", melding: "Niet toegestaan." };
  if (!wie) return { status: "fout", melding: "Vul eerst je naam in." };
  const { data, error } = await ctx.supabase.rpc("avf_lijst_toevoegen", { p_avf_id: ctx.avfId, p_sectie: sectie, p_pad: pad, p_item: item });
  const res = data as Lijstresultaat | null;
  if (error || !res?.ok || !res.item) {
    if (await isVergrendeld(ctx.supabase, ctx.avfId)) return { status: "fout", melding: VERGRENDELD };
    return { status: "fout", melding: ALGEMEEN_FOUT };
  }
  await markeer(ctx.supabase, ctx.avfId, JSON_SECTIES[sectie], wie);
  revalidatePath("/avf", "layout");
  return { status: "ok", item: res.item };
}

export async function lijstVerwijderen(
  sectie: JsonSectie, pad: string[], itemId: string, naam: string,
): Promise<{ status: "ok" } | { status: "fout"; melding: string }> {
  const ctx = await eigenAvf();
  const wie = naam.trim().slice(0, 60);
  if (!ctx || !(sectie in JSON_SECTIES) || !pad.every((p) => /^[a-z_]{1,40}$/.test(p)) || !/^[0-9a-f-]{36}$/.test(itemId)) {
    return { status: "fout", melding: "Niet toegestaan." };
  }
  if (!wie) return { status: "fout", melding: "Vul eerst je naam in." };
  const { data, error } = await ctx.supabase.rpc("avf_lijst_verwijderen", { p_avf_id: ctx.avfId, p_sectie: sectie, p_pad: pad, p_item_id: itemId });
  if (error || !(data as Lijstresultaat | null)?.ok) {
    if (await isVergrendeld(ctx.supabase, ctx.avfId)) return { status: "fout", melding: VERGRENDELD };
    return { status: "fout", melding: ALGEMEEN_FOUT };
  }
  await markeer(ctx.supabase, ctx.avfId, JSON_SECTIES[sectie], wie);
  revalidatePath("/avf", "layout");
  return { status: "ok" };
}

// --------------------------------------------------------------- onderdelen

export async function onderdeelToevoegen(fase: FaseCode, naam: string): Promise<{ status: "ok"; id: string } | { status: "fout"; melding: string }> {
  const ctx = await eigenAvf();
  const wie = naam.trim().slice(0, 60);
  if (!ctx || !(["kop", "romp", "staart"] as string[]).includes(fase)) return { status: "fout", melding: "Niet toegestaan." };
  if (!wie) return { status: "fout", melding: "Vul eerst je naam in." };
  const { data, error } = await ctx.supabase.rpc("avf_onderdeel_toevoegen", { p_avf_id: ctx.avfId, p_fase: fase });
  if (error || !data) {
    if (await isVergrendeld(ctx.supabase, ctx.avfId)) return { status: "fout", melding: VERGRENDELD };
    return { status: "fout", melding: ALGEMEEN_FOUT };
  }
  await markeer(ctx.supabase, ctx.avfId, "D", wie);
  revalidatePath("/avf", "layout");
  return { status: "ok", id: (data as { id: string }).id };
}

export async function onderdeelVerplaatsen(id: string, richting: -1 | 1, naam: string): Promise<{ status: "ok" } | { status: "fout"; melding: string }> {
  const ctx = await eigenAvf();
  const wie = naam.trim().slice(0, 60);
  if (!ctx || !/^[0-9a-f-]{36}$/.test(id)) return { status: "fout", melding: "Niet toegestaan." };
  if (!wie) return { status: "fout", melding: "Vul eerst je naam in." };
  const { error } = await ctx.supabase.rpc("avf_onderdeel_verplaatsen", { p_onderdeel_id: id, p_richting: richting });
  if (error) return { status: "fout", melding: ALGEMEEN_FOUT };
  await markeer(ctx.supabase, ctx.avfId, "D", wie);
  revalidatePath("/avf", "layout");
  return { status: "ok" };
}

export async function onderdeelVerwijderen(id: string, naam: string): Promise<{ status: "ok" } | { status: "fout"; melding: string }> {
  const ctx = await eigenAvf();
  const wie = naam.trim().slice(0, 60);
  if (!ctx || !/^[0-9a-f-]{36}$/.test(id)) return { status: "fout", melding: "Niet toegestaan." };
  if (!wie) return { status: "fout", melding: "Vul eerst je naam in." };
  const { data: oud } = await ctx.supabase.from("avf_onderdeel").select("afbeelding_pad").eq("id", id).eq("avf_id", ctx.avfId).maybeSingle();
  const { data, error } = await ctx.supabase.from("avf_onderdeel").delete().eq("id", id).eq("avf_id", ctx.avfId).select("id");
  if (error || !data?.length) {
    if (await isVergrendeld(ctx.supabase, ctx.avfId)) return { status: "fout", melding: VERGRENDELD };
    return { status: "fout", melding: ALGEMEEN_FOUT };
  }
  if (oud?.afbeelding_pad) await ctx.supabase.storage.from("avf").remove([oud.afbeelding_pad]);
  await markeer(ctx.supabase, ctx.avfId, "D", wie);
  revalidatePath("/avf", "layout");
  return { status: "ok" };
}

export async function nvtZetten(id: string, veld: string, aan: boolean, naam: string): Promise<{ status: "ok" } | { status: "fout"; melding: string }> {
  const ctx = await eigenAvf();
  const wie = naam.trim().slice(0, 60);
  if (!ctx || !/^[0-9a-f-]{36}$/.test(id) || !(ONDERDEEL_NVT_MOGELIJK as readonly string[]).includes(veld)) return { status: "fout", melding: "Niet toegestaan." };
  if (!wie) return { status: "fout", melding: "Vul eerst je naam in." };
  const { data, error } = await ctx.supabase.rpc("avf_onderdeel_nvt_zetten", { p_onderdeel_id: id, p_veld: veld, p_aan: aan });
  if (error || !data) {
    if (await isVergrendeld(ctx.supabase, ctx.avfId)) return { status: "fout", melding: VERGRENDELD };
    return { status: "fout", melding: ALGEMEEN_FOUT };
  }
  await markeer(ctx.supabase, ctx.avfId, "D", wie);
  revalidatePath("/avf", "layout");
  return { status: "ok" };
}
