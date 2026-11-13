import type { ToegewezenBelevenis } from "@/components/ProgrammaWeergave";
import type { AvfStatus } from "@/components/BelevenisKaart";
import { maakServerClient } from "@/lib/supabase/server";
import type { ProgrammaRegel } from "@/lib/programma";

/** Het programma van een cluster en welke belevenis (titel en status) in welk tijdvak zit. De database bepaalt wat zichtbaar is. */
export async function laadProgramma(clusterId: string): Promise<{ regels: ProgrammaRegel[]; toegewezen: ToegewezenBelevenis[] }> {
  const supabase = await maakServerClient();
  const [{ data: regels }, { data: avf }] = await Promise.all([
    supabase.from("programma_regel").select("*").eq("cluster_id", clusterId).order("volgorde"),
    supabase.from("avf_publiek").select("programma_regel_id, projectgroep_nummer, projectgroep_naam, titel, status").eq("cluster_id", clusterId),
  ]);
  const toegewezen: ToegewezenBelevenis[] = (avf ?? [])
    .filter((a) => a.programma_regel_id)
    .map((a) => ({
      regelId: a.programma_regel_id as string,
      groepNummer: a.projectgroep_nummer as number,
      groepNaam: a.projectgroep_naam as string,
      titel: a.titel as string | null,
      status: a.status as AvfStatus,
    }));
  return { regels: (regels ?? []) as ProgrammaRegel[], toegewezen };
}
