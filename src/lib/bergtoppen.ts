import { maakServerClient } from "@/lib/supabase/server";
import type { BergtoppenInhoud } from "@/lib/bergtoppenStatus";

export interface Publicatie {
  versie: number;
  inhoud: BergtoppenInhoud;
  zichtbaar: boolean;
  gepubliceerdOp: string;
  gepubliceerdDoor: string | null;
}

export interface Bergtoppen {
  clusterId: string;
  /** Het concept: alleen gevuld voor de stuurgroep en de docent (de database geeft het aan anderen niet). */
  velden: Record<string, string>;
  /** De laatste publicatie; studenten krijgen die alleen als hij zichtbaar is. */
  publicatie: Publicatie | null;
  inschrijfLink: string | null;
}

/** De bergtoppen van een cluster. De database bepaalt wat de inlogger ziet. */
export async function laadBergtoppen(clusterId: string): Promise<Bergtoppen> {
  const supabase = await maakServerClient();
  const [veldenRes, pubRes, clusterRes] = await Promise.all([
    supabase.from("bergtop_veld").select("sleutel, tekst").eq("cluster_id", clusterId),
    supabase.from("bergtop_publicatie").select("versie, inhoud, zichtbaar, gepubliceerd_op, gepubliceerd_door_naam").eq("cluster_id", clusterId).maybeSingle(),
    supabase.from("cluster").select("inschrijf_link").eq("id", clusterId).maybeSingle(),
  ]);
  const velden: Record<string, string> = {};
  for (const r of veldenRes.data ?? []) if (r.tekst) velden[r.sleutel] = r.tekst;
  const p = pubRes.data;
  return {
    clusterId,
    velden,
    publicatie: p
      ? { versie: p.versie, inhoud: p.inhoud as BergtoppenInhoud, zichtbaar: p.zichtbaar, gepubliceerdOp: p.gepubliceerd_op, gepubliceerdDoor: p.gepubliceerd_door_naam }
      : null,
    inschrijfLink: clusterRes.data?.inschrijf_link ?? null,
  };
}

/** Alleen de zichtbare publicatie (voor het startscherm en Meer): `null` zolang er niets gepubliceerd is of hij is ingetrokken. */
export async function zichtbareBergtoppen(clusterId: string): Promise<Publicatie | null> {
  const supabase = await maakServerClient();
  const { data: p } = await supabase
    .from("bergtop_publicatie").select("versie, inhoud, zichtbaar, gepubliceerd_op, gepubliceerd_door_naam")
    .eq("cluster_id", clusterId).eq("zichtbaar", true).maybeSingle();
  return p
    ? { versie: p.versie, inhoud: p.inhoud as BergtoppenInhoud, zichtbaar: true, gepubliceerdOp: p.gepubliceerd_op, gepubliceerdDoor: p.gepubliceerd_door_naam }
    : null;
}
