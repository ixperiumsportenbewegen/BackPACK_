import { maakServerClient } from "@/lib/supabase/server";
import type { AvfMateriaal, Beschikbaarheid, LijstStatus, Materiaal } from "@/lib/materialenTypes";

export * from "@/lib/materialenTypes";

export async function laadLijstStatus(): Promise<LijstStatus> {
  const supabase = await maakServerClient();
  const { data } = await supabase.from("materiaallijst_status").select("status, definitief_op, definitief_door_naam").maybeSingle();
  return {
    status: data?.status === "definitief" ? "definitief" : "concept",
    definitiefOp: data?.definitief_op ?? null,
    definitiefDoorNaam: data?.definitief_door_naam ?? null,
  };
}

/** De materialenlijst zoals de ingelogde gebruiker hem mag zien (de database bepaalt dat). */
export async function laadMaterialen(): Promise<Materiaal[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("materiaal")
    .select("id, naam, categorie, voorraad_camping, voorraad_bivak, opmerking, actief, toegevoegd_door_cluster, bijgewerkt_door_naam, updated_at")
    .order("categorie", { nullsFirst: false })
    .order("naam");
  return (data ?? []).map((m) => ({
    id: m.id, naam: m.naam, categorie: m.categorie, voorraadCamping: m.voorraad_camping, voorraadBivak: m.voorraad_bivak,
    opmerking: m.opmerking, actief: m.actief, toegevoegdDoorCluster: m.toegevoegd_door_cluster,
    bijgewerktDoorNaam: m.bijgewerkt_door_naam, updatedAt: m.updated_at,
  }));
}

type Rij = {
  id: string; avf_id: string; fase: AvfMateriaal["fase"]; materiaal_id: string | null; omschrijving: string | null;
  aantal: number; aantal_gecorrigeerd: number | null; gecorrigeerd_door_naam: string | null;
};
const naarRegel = (r: Rij): AvfMateriaal => ({
  id: r.id, avfId: r.avf_id, fase: r.fase, materiaalId: r.materiaal_id, omschrijving: r.omschrijving,
  aantal: r.aantal, aantalGecorrigeerd: r.aantal_gecorrigeerd, gecorrigeerdDoorNaam: r.gecorrigeerd_door_naam,
});

export async function laadAvfMaterialen(avfId: string): Promise<AvfMateriaal[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("avf_materiaal")
    .select("id, avf_id, fase, materiaal_id, omschrijving, aantal, aantal_gecorrigeerd, gecorrigeerd_door_naam")
    .eq("avf_id", avfId).order("created_at");
  return ((data ?? []) as Rij[]).map(naarRegel);
}

/** Alle materialen van de AVF's in een cluster (voor de stuurgroep). */
export async function laadClusterMaterialen(clusterId: string): Promise<AvfMateriaal[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("avf_materiaal")
    .select("id, avf_id, fase, materiaal_id, omschrijving, aantal, aantal_gecorrigeerd, gecorrigeerd_door_naam, avf:avf_id!inner(cluster_id)")
    .eq("avf.cluster_id", clusterId).order("created_at");
  return ((data ?? []) as unknown as Rij[]).map(naarRegel);
}

/** Per materiaal: wat ligt er op de locatie van dit AVF en wat gebruiken anderen op hetzelfde moment. */
export async function laadBeschikbaarheid(avfId: string): Promise<Record<string, Beschikbaarheid>> {
  const supabase = await maakServerClient();
  const { data } = await supabase.rpc("materiaal_beschikbaar", { p_avf_id: avfId });
  const uit: Record<string, Beschikbaarheid> = {};
  for (const r of (data ?? []) as { materiaal_id: string; voorraad: number; anderen: number }[]) {
    uit[r.materiaal_id] = { voorraad: r.voorraad, anderen: r.anderen };
  }
  return uit;
}

/** Voor de stuurgroep: per belevenis en materiaal de voorraad en het gebruik door anderen. */
export async function laadContext(clusterId: string): Promise<Record<string, Beschikbaarheid & { locatie: string }>> {
  const supabase = await maakServerClient();
  const { data } = await supabase.rpc("materiaal_context", { p_cluster_id: clusterId });
  const uit: Record<string, Beschikbaarheid & { locatie: string }> = {};
  for (const r of (data ?? []) as { avf_id: string; materiaal_id: string; locatie: string; voorraad: number; anderen: number }[]) {
    uit[`${r.avf_id}:${r.materiaal_id}`] = { voorraad: r.voorraad, anderen: r.anderen, locatie: r.locatie };
  }
  return uit;
}
