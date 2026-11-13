import { cache } from "react";
import { cookies } from "next/headers";
import { maakServerClient } from "@/lib/supabase/server";
import { accountLabel, type Accountsoort } from "@/lib/label";

export interface Profiel {
  gebruikersnaam: string;
  soort: Accountsoort;
  label: string;
  /** Cluster waarin het account werkt; bij de docent het gekozen cluster. */
  cluster: { id: string; code: string; naam: string; teams_link: string | null } | null;
  alleClusters: { code: string; naam: string }[]; // alleen gevuld bij de docent
  stuurgroeprol: { code: string; naam: string; pack: string } | null;
  thema: {
    naam: string | null; verhaal: string | null; slogan: string | null; accentkleur: string | null;
    sfeerbeeld_pad: string | null; logo_pad: string | null; bijgewerkt_door_naam: string | null;
  } | null;
}

/** Het ingelogde account met label, cluster en meerdaagsethema. null = niet ingelogd. */
export const getProfiel = cache(async (): Promise<Profiel | null> => {
  const supabase = await maakServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: a } = await supabase
    .from("account")
    .select(`gebruikersnaam, soort,
      cluster:cluster_id (id, code, naam, teams_link),
      projectgroep:projectgroep_id (naam),
      stuurgroeprol:stuurgroeprol_id (code, naam, pack)`)
    .eq("id", user.id)
    .single();
  if (!a) return null;

  const soort = a.soort as Accountsoort;
  const eigenCluster = a.cluster as unknown as Profiel["cluster"];
  const rol = a.stuurgroeprol as unknown as Profiel["stuurgroeprol"];
  const groep = a.projectgroep as unknown as { naam: string } | null;

  let cluster = eigenCluster;
  let alleClusters: Profiel["alleClusters"] = [];
  if (soort === "docent") {
    const { data: lijst } = await supabase
      .from("cluster").select("id, code, naam, teams_link").order("code", { ascending: false });
    const gekozen = (await cookies()).get("docent_cluster")?.value;
    alleClusters = (lijst ?? []).map((c) => ({ code: c.code, naam: c.naam }));
    cluster = lijst?.find((c) => c.code === gekozen) ?? lijst?.find((c) => c.code === "VD") ?? lijst?.[0] ?? null;
  }

  let thema: Profiel["thema"] = null;
  if (cluster) {
    const { data } = await supabase
      .from("meerdaagsethema").select("naam, verhaal, slogan, accentkleur, sfeerbeeld_pad, logo_pad, bijgewerkt_door_naam")
      .eq("cluster_id", cluster.id).maybeSingle();
    thema = data;
  }

  return {
    gebruikersnaam: a.gebruikersnaam,
    soort,
    label: accountLabel({
      soort, clusterCode: eigenCluster?.code, projectgroepNaam: groep?.naam, stuurgroeprolNaam: rol?.naam,
    }),
    cluster,
    alleClusters,
    stuurgroeprol: rol,
    thema,
  };
});
