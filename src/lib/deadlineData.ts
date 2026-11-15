import { maakServerClient } from "@/lib/supabase/server";
import { sorteerDeadlines, type DeadlineRij } from "@/lib/deadlines";

/** De deadlines van een cluster, eerst wat het eerst afloopt. Alle accounts van het cluster en de docent mogen dit lezen. */
export async function laadDeadlines(clusterId: string): Promise<DeadlineRij[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("deadline")
    .select("onderdeel, moment, toelichting, gezet_door_naam, updated_at")
    .eq("cluster_id", clusterId);
  return sorteerDeadlines(
    (data ?? []).map((r) => ({
      onderdeel: r.onderdeel as string,
      moment: new Date(r.moment as string),
      toelichting: (r.toelichting as string | null) ?? null,
      gezetDoorNaam: r.gezet_door_naam as string,
      updatedAt: r.updated_at as string,
    })),
  );
}
