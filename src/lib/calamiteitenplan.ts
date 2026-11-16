import { maakServerClient } from "@/lib/supabase/server";
import { planLijsten, planVelden } from "@/config/calamiteitenplan";

export interface PlanItem {
  id: string;
  velden: Record<string, string>;
}

export interface Plan {
  clusterId: string;
  velden: Record<string, string>;
  lijsten: Record<string, PlanItem[]>;
  groepsappLink: string | null;
  /** Wanneer en door wie het plan voor het laatst is bijgewerkt (de nieuwste wijziging in een veld of regel). */
  bijgewerkt: { moment: string; naam: string | null } | null;
}

/** Het plan van een cluster. De database bepaalt wie het mag lezen (iedereen in het cluster en de docent). */
export async function laadPlan(clusterId: string): Promise<Plan> {
  const supabase = await maakServerClient();
  const [veldenRes, itemsRes, clusterRes] = await Promise.all([
    supabase.from("calamiteit_veld").select("sleutel, tekst, bijgewerkt_door_naam, updated_at").eq("cluster_id", clusterId),
    supabase.from("calamiteit_item").select("id, lijst, volgorde, velden, bijgewerkt_door_naam, updated_at").eq("cluster_id", clusterId).order("volgorde"),
    supabase.from("cluster").select("whatsapp_link").eq("id", clusterId).maybeSingle(),
  ]);

  const bekend = new Set(planVelden().map((v) => v.sleutel));
  const velden: Record<string, string> = {};
  let nieuwste: { moment: string; naam: string | null } | null = null;
  const onthoud = (moment: string, naam: string | null) => {
    if (!nieuwste || moment > nieuwste.moment) nieuwste = { moment, naam };
  };
  for (const r of veldenRes.data ?? []) {
    if (r.tekst && bekend.has(r.sleutel)) velden[r.sleutel] = r.tekst;
    if (r.tekst) onthoud(r.updated_at, r.bijgewerkt_door_naam);
  }

  const lijsten: Record<string, PlanItem[]> = Object.fromEntries(planLijsten().map((l) => [l.sleutel, [] as PlanItem[]]));
  for (const r of itemsRes.data ?? []) {
    if (!(r.lijst in lijsten)) continue;
    const ruw = (r.velden ?? {}) as Record<string, unknown>;
    const schoon: Record<string, string> = {};
    for (const [k, v] of Object.entries(ruw)) if (typeof v === "string" && v.trim()) schoon[k] = v;
    lijsten[r.lijst].push({ id: r.id, velden: schoon });
    onthoud(r.updated_at, r.bijgewerkt_door_naam);
  }

  return { clusterId, velden, lijsten, groepsappLink: clusterRes.data?.whatsapp_link ?? null, bijgewerkt: nieuwste };
}

/** Staat er iets in het plan? (Voor de verwijzing vanuit het AVF: anders staat daar dat het plan nog volgt.) */
export function planHeeftInhoud(plan: Plan): boolean {
  return Object.keys(plan.velden).length > 0 || Object.values(plan.lijsten).some((l) => l.some((i) => Object.keys(i.velden).length > 0));
}
