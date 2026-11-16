import { maakServerClient } from "@/lib/supabase/server";
import { tekort, vraagVan, type Aanvraag, type AvfMateriaal, type Beschikbaarheid, type Categorie, type LijstStatus, type Materiaal, type MateriaalMelding, type Telling } from "@/lib/materialenTypes";

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
/** De vaste categorielijst, met het aantal materialen per categorie. */
export async function laadCategorieen(): Promise<Categorie[]> {
  const supabase = await maakServerClient();
  const [{ data: cats }, { data: mats }] = await Promise.all([
    supabase.from("materiaal_categorie").select("id, naam, volgorde").order("volgorde").order("naam"),
    supabase.from("materiaal").select("categorie"),
  ]);
  const aantal = new Map<string, number>();
  for (const m of mats ?? []) aantal.set(m.categorie, (aantal.get(m.categorie) ?? 0) + 1);
  return (cats ?? []).map((c) => ({ id: c.id, naam: c.naam, volgorde: c.volgorde, aantal: aantal.get(c.naam) ?? 0 }));
}

export async function laadMaterialen(): Promise<Materiaal[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("materiaal")
    .select("id, naam, categorie, voorraad_camping, voorraad_bivak, opmerking, actief, toegevoegd_door_cluster, bijgewerkt_door_naam, updated_at")
    .order("naam");
  return (data ?? []).map((m) => ({
    id: m.id, naam: m.naam, categorie: m.categorie ?? "Overig", voorraadCamping: m.voorraad_camping, voorraadBivak: m.voorraad_bivak,
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
  for (const r of (data ?? []) as { materiaal_id: string; voorraad: number; anderen: number; ingeschat: boolean }[]) {
    uit[r.materiaal_id] = { voorraad: r.voorraad, anderen: r.anderen, ingeschat: r.ingeschat };
  }
  return uit;
}

/** Voor de stuurgroep: per belevenis en materiaal de voorraad en het gebruik door anderen. */
export async function laadContext(clusterId: string): Promise<Record<string, Beschikbaarheid & { locatie: string }>> {
  const supabase = await maakServerClient();
  const { data } = await supabase.rpc("materiaal_context", { p_cluster_id: clusterId });
  const uit: Record<string, Beschikbaarheid & { locatie: string }> = {};
  for (const r of (data ?? []) as { avf_id: string; materiaal_id: string; locatie: string; voorraad: number; anderen: number }[]) {
    uit[`${r.avf_id}:${r.materiaal_id}`] = { voorraad: r.voorraad, anderen: r.anderen, locatie: r.locatie, ingeschat: true };
  }
  return uit;
}

type AanvraagRij = {
  id: string; avf_id: string; materiaal_id: string | null; omschrijving: string | null; aantal: number; toelichting: string | null;
  status: Aanvraag["status"]; door_naam: string; uitkomst: string | null; afgehandeld_door_naam: string | null; afgehandeld_op: string | null; created_at: string;
};
const AANVRAAG_KOLOMMEN = "id, avf_id, materiaal_id, omschrijving, aantal, toelichting, status, door_naam, uitkomst, afgehandeld_door_naam, afgehandeld_op, created_at";
const naarAanvraag = (r: AanvraagRij): Aanvraag => ({
  id: r.id, avfId: r.avf_id, materiaalId: r.materiaal_id, omschrijving: r.omschrijving, aantal: r.aantal, toelichting: r.toelichting,
  status: r.status, doorNaam: r.door_naam, uitkomst: r.uitkomst, afgehandeldDoorNaam: r.afgehandeld_door_naam, afgehandeldOp: r.afgehandeld_op, createdAt: r.created_at,
});

/** De aanvragen van één AVF (de eigen groep, de stuurgroep van het cluster en de docent mogen ze zien). */
export async function laadAanvragen(avfId: string): Promise<Aanvraag[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase.from("materiaal_aanvraag").select(AANVRAAG_KOLOMMEN).eq("avf_id", avfId).order("created_at", { ascending: false });
  return ((data ?? []) as AanvraagRij[]).map(naarAanvraag);
}

/** Alle aanvragen van de AVF's in een cluster, met de naam van de projectgroep. */
export async function laadAanvragenCluster(clusterId: string): Promise<(Aanvraag & { groepNaam: string; groepNummer: number })[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("materiaal_aanvraag")
    .select(`${AANVRAAG_KOLOMMEN}, avf:avf_id!inner(cluster_id, projectgroep:projectgroep_id(naam, nummer))`)
    .eq("avf.cluster_id", clusterId).order("created_at", { ascending: false });
  return ((data ?? []) as unknown as (AanvraagRij & { avf: { projectgroep: { naam: string; nummer: number } } })[]).map((r) => ({
    ...naarAanvraag(r), groepNaam: r.avf.projectgroep.naam, groepNummer: r.avf.projectgroep.nummer,
  }));
}

/** De paklijst: alle tellingen (alleen voor stuurgroep en docent). */
export async function laadTellingen(): Promise<Telling[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase.from("materiaal_telling").select("materiaal_id, locatie, meegenomen, op_kamp, retour, opmerking, bijgewerkt_door_naam, updated_at");
  return (data ?? []).map((t) => ({
    materiaalId: t.materiaal_id, locatie: t.locatie as Telling["locatie"], meegenomen: t.meegenomen, opKamp: t.op_kamp, retour: t.retour,
    opmerking: t.opmerking, bijgewerktDoorNaam: t.bijgewerkt_door_naam, updatedAt: t.updated_at,
  }));
}

/**
 * Meldingen voor een projectgroep: een gekozen materiaal is niet meer beschikbaar of er is een tekort.
 * Zo kan de groep er op tijd op anticiperen, ook als de voorraad tijdens het inpakken of op locatie lager blijkt.
 */
export async function laadMateriaalMeldingen(avfId: string): Promise<MateriaalMelding[]> {
  const [regels, materialen, beschikbaar] = await Promise.all([laadAvfMaterialen(avfId), laadMaterialen(), laadBeschikbaarheid(avfId)]);
  const lijst = regels.filter((r) => r.materiaalId);
  const perId = new Map(materialen.map((m) => [m.id, m]));
  const meldingen: MateriaalMelding[] = [];
  for (const id of new Set(lijst.map((r) => r.materiaalId!))) {
    const m = perId.get(id);
    if (!m) continue;
    if (!m.actief) {
      meldingen.push({ soort: "niet_beschikbaar", materiaal: m.naam, tekst: `${m.naam} is niet meer beschikbaar.` });
      continue;
    }
    const b = beschikbaar[id];
    if (!b) continue;
    const vraag = vraagVan(lijst.filter((r) => r.materiaalId === id));
    const tk = tekort(vraag, b);
    if (tk > 0) meldingen.push({ soort: "tekort", materiaal: m.naam, tekst: `${m.naam}: tekort van ${tk}. Er is ${b.voorraad}, jullie hebben ${vraag} nodig${b.anderen > 0 ? ` en een andere belevenis gebruikt op hetzelfde moment ${b.anderen}` : ""}.` });
  }
  return meldingen;
}
