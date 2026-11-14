import { maakServerClient } from "@/lib/supabase/server";
import type { BudgetAanvraag, BudgetAanvraagMetGroep, BudgetRegel, BudgetStatus } from "@/lib/budgetTypes";

export * from "@/lib/budgetTypes";

const KOLOMMEN =
  "id, avf_id, projectgroep_id, soort, omschrijving, toelichting, regels, bedrag_aangevraagd, status, bedrag_toegekend, besluit_toelichting, besluit_door_naam, besluit_op, besteed, ingediend_op, updated_at";

type Rij = {
  id: string; avf_id: string; projectgroep_id: string; soort: "avf" | "los"; omschrijving: string | null; toelichting: string | null;
  regels: unknown; bedrag_aangevraagd: number | string; status: BudgetStatus; bedrag_toegekend: number | string | null;
  besluit_toelichting: string | null; besluit_door_naam: string | null; besluit_op: string | null; besteed: number | string | null;
  ingediend_op: string | null; updated_at: string;
};

const getal = (w: number | string | null): number | null => (w === null ? null : Number(w));

function naarAanvraag(r: Rij): BudgetAanvraag {
  return {
    id: r.id, avfId: r.avf_id, projectgroepId: r.projectgroep_id, soort: r.soort, omschrijving: r.omschrijving, toelichting: r.toelichting,
    regels: Array.isArray(r.regels) ? (r.regels as BudgetRegel[]).map((x) => ({ omschrijving: String(x.omschrijving ?? ""), bedrag: Number(x.bedrag ?? 0) })) : [],
    bedragAangevraagd: Number(r.bedrag_aangevraagd), status: r.status, bedragToegekend: getal(r.bedrag_toegekend),
    besluitToelichting: r.besluit_toelichting, besluitDoorNaam: r.besluit_door_naam, besluitOp: r.besluit_op, besteed: getal(r.besteed),
    ingediendOp: r.ingediend_op, updatedAt: r.updated_at,
  };
}

/** De aanvragen van één AVF (financieel plan en losse aanvragen), oudste eerst. */
export async function laadBudgetAvf(avfId: string): Promise<BudgetAanvraag[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase.from("budgetaanvraag").select(KOLOMMEN).eq("avf_id", avfId).order("created_at");
  return ((data ?? []) as Rij[]).map(naarAanvraag);
}

/** Alle aanvragen in een cluster (alleen voor stuurgroep en docent), met de projectgroep erbij. */
export async function laadBudgetCluster(clusterId: string): Promise<BudgetAanvraagMetGroep[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("budgetaanvraag")
    .select(`${KOLOMMEN}, avf:avf_id(titel), groep:projectgroep_id(naam, nummer)`)
    .eq("cluster_id", clusterId).order("created_at");
  return ((data ?? []) as unknown as (Rij & { avf: { titel: string | null }; groep: { naam: string; nummer: number } })[]).map((r) => ({
    ...naarAanvraag(r), groepNaam: r.groep.naam, groepNummer: r.groep.nummer, titel: r.avf?.titel ?? null,
  }));
}

/** Het clusterbudget (alleen voor stuurgroep en docent). */
export async function laadClusterBudget(clusterId: string): Promise<number | null> {
  const supabase = await maakServerClient();
  const { data } = await supabase.from("cluster_budget").select("budget_totaal").eq("cluster_id", clusterId).maybeSingle();
  return data ? Number(data.budget_totaal) : null;
}

/** De resterende ruimte van het cluster: budget min wat is toegekend. Iedereen in het cluster mag dit zien. */
export async function laadResterend(clusterId: string): Promise<number | null> {
  const supabase = await maakServerClient();
  const { data, error } = await supabase.rpc("budget_resterend", { p_cluster_id: clusterId });
  return error || data === null ? null : Number(data);
}
