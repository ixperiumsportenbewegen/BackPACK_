import { maakServerClient } from "@/lib/supabase/server";
import type { ProjectgroepRolCode } from "@/config/projectgroeprollen";

export type VerzoekStatus = "open" | "aangepast" | "afgehandeld";

export interface Verzoek {
  id: string;
  avfId: string;
  sectie: string;
  onderdeelId: string | null;
  veldSleutel: string | null;
  rol: ProjectgroepRolCode;
  tekst: string;
  status: VerzoekStatus;
  doorNaam: string;
  createdAt: string;
  aangepastOp: string | null;
}

export interface Versie {
  id: string;
  versie: number;
  ingediendDoorNaam: string;
  wijzigingssamenvatting: string | null;
  createdAt: string;
}

export interface Themacheck {
  rol: string;
  oordeel: "akkoord" | "aandachtspunt";
  toelichting: string | null;
  doorNaam: string;
  updatedAt: string;
}

export interface AvfStand {
  avfId: string;
  status: "in_ontwikkeling" | "ingediend" | "aanpassing_gevraagd" | "goedgekeurd";
  opnieuwTeControleren: boolean;
  versie: number;
  open: number;
  aangepast: number;
}

const KOLOMMEN = "id, avf_id, sectie, onderdeel_id, veld_sleutel, projectgroeprol, tekst, status, door_naam, created_at, aangepast_op";

type Rij = {
  id: string; avf_id: string; sectie: string; onderdeel_id: string | null; veld_sleutel: string | null;
  projectgroeprol: ProjectgroepRolCode; tekst: string; status: VerzoekStatus; door_naam: string;
  created_at: string; aangepast_op: string | null;
};

function naarVerzoek(r: Rij): Verzoek {
  return {
    id: r.id, avfId: r.avf_id, sectie: r.sectie, onderdeelId: r.onderdeel_id, veldSleutel: r.veld_sleutel,
    rol: r.projectgroeprol, tekst: r.tekst, status: r.status, doorNaam: r.door_naam,
    createdAt: r.created_at, aangepastOp: r.aangepast_op,
  };
}

/** Verbeterverzoeken van één AVF, oudste eerst. De database bepaalt wie ze mag zien. */
export async function laadVerzoeken(avfId: string): Promise<Verzoek[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase.from("verbeterverzoek").select(KOLOMMEN).eq("avf_id", avfId).order("created_at");
  return ((data ?? []) as Rij[]).map(naarVerzoek);
}

/** Verbeterverzoeken van alle AVF's in een cluster. */
export async function laadVerzoekenCluster(clusterId: string): Promise<Verzoek[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("verbeterverzoek")
    .select(`${KOLOMMEN}, avf:avf_id!inner(cluster_id)`)
    .eq("avf.cluster_id", clusterId)
    .order("created_at");
  return ((data ?? []) as unknown as Rij[]).map(naarVerzoek);
}

/**
 * Verbeterverzoeken zoals de projectgroep ze ziet. De stuurgroep verzamelt verzoeken eerst als concept; pas bij
 * "Aanpassing vragen" gaan ze naar de groep. Zolang het AVF is ingediend of goedgekeurd zijn ze voor de groep verborgen.
 */
export async function laadVerzoekenVoorGroep(avfId: string, status: string): Promise<Verzoek[]> {
  if (status !== "aanpassing_gevraagd") return [];
  return laadVerzoeken(avfId);
}

export async function laadVersies(avfId: string): Promise<Versie[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("avf_versie").select("id, versie, ingediend_door_naam, wijzigingssamenvatting, created_at")
    .eq("avf_id", avfId).order("versie", { ascending: false });
  return (data ?? []).map((v) => ({
    id: v.id, versie: v.versie, ingediendDoorNaam: v.ingediend_door_naam,
    wijzigingssamenvatting: v.wijzigingssamenvatting, createdAt: v.created_at,
  }));
}

export async function laadThemachecks(avfId: string): Promise<Themacheck[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("themacheck").select("stuurgroeprol_code, oordeel, toelichting, door_naam, updated_at").eq("avf_id", avfId);
  return (data ?? []).map((t) => ({
    rol: t.stuurgroeprol_code, oordeel: t.oordeel, toelichting: t.toelichting, doorNaam: t.door_naam, updatedAt: t.updated_at,
  }));
}

/** Status, label "Opnieuw te controleren" en aantal verzoeken van alle AVF's in een cluster (voor stuurgroep en docent). */
export async function laadStanden(clusterId: string): Promise<Record<string, AvfStand>> {
  const supabase = await maakServerClient();
  const [{ data: avfs }, verzoeken] = await Promise.all([
    supabase.from("avf").select("id, status, opnieuw_te_controleren, versie").eq("cluster_id", clusterId),
    laadVerzoekenCluster(clusterId),
  ]);
  const standen: Record<string, AvfStand> = {};
  for (const a of avfs ?? []) {
    standen[a.id] = { avfId: a.id, status: a.status, opnieuwTeControleren: a.opnieuw_te_controleren, versie: a.versie, open: 0, aangepast: 0 };
  }
  for (const v of verzoeken) {
    const s = standen[v.avfId];
    if (!s) continue;
    if (v.status === "open") s.open += 1;
    else if (v.status === "aangepast") s.aangepast += 1;
  }
  return standen;
}

/** Groepeert verzoeken per sectie. */
export function perSectie(verzoeken: Verzoek[]): Map<string, Verzoek[]> {
  const m = new Map<string, Verzoek[]>();
  for (const v of verzoeken) m.set(v.sectie, [...(m.get(v.sectie) ?? []), v]);
  return m;
}
