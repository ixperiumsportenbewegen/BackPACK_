import { cache } from "react";
import { maakServerClient } from "@/lib/supabase/server";
import type { AvfInhoud, FaseInhoud, Json, OnderdeelInhoud } from "@/lib/avfVoortgang";
import { isGevuld } from "@/lib/avfVoortgang";

export interface Tijdvak {
  id: string;
  dag: string;
  starttijd: string;
  eindtijd: string;
  titel: string;
  locatie: string | null;
}

export interface FaseRij extends FaseInhoud {
  overzichtstekening_bijschrift: string | null;
}

export interface OnderdeelRij extends OnderdeelInhoud {
  id: string;
  volgorde: number;
  niet_van_toepassing: string[];
  afbeelding_pad: string | null;
  afbeelding_bijschrift: string | null;
}

export interface AvfGegevens {
  id: string;
  projectgroepId: string;
  clusterId: string;
  projectgroepNaam: string;
  projectgroepNummer: number;
  status: "in_ontwikkeling" | "ingediend" | "aanpassing_gevraagd" | "goedgekeurd";
  opnieuwTeControleren: boolean;
  versie: number;
  locatie: string | null;
  tijdvak: Tijdvak | null;
  sectieBijgewerkt: Record<string, { updated_at: string; naam: string }>;
  inhoud: AvfInhoud;
  rolverdeling: { rol: string; namen: string | null }[];
  fasen: FaseRij[];
  onderdelen: OnderdeelRij[];
}

const FASEN = ["kop", "romp", "staart"] as const;

/** Laadt een AVF met fasen, onderdelen en tijdvak. De database bepaalt wat de gebruiker mag zien (null = geen toegang). */
export async function laadAvf(avfId: string): Promise<AvfGegevens | null> {
  const supabase = await maakServerClient();
  const { data: a } = await supabase
    .from("avf")
    .select("*, projectgroep:projectgroep_id(naam, nummer)")
    .eq("id", avfId)
    .maybeSingle();
  if (!a) return null;

  const [{ data: fasenRaw }, { data: onderdelenRaw }, { data: rollen }, regel] = await Promise.all([
    supabase.from("avf_fase").select("*").eq("avf_id", avfId),
    supabase.from("avf_onderdeel").select("*").eq("avf_id", avfId).order("fase").order("volgorde"),
    supabase.from("projectgroep_rol").select("rol, namen").eq("projectgroep_id", a.projectgroep_id),
    a.programma_regel_id
      ? supabase.from("programma_regel").select("id, dag, starttijd, eindtijd, titel, locatie").eq("id", a.programma_regel_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const fasen: FaseRij[] = FASEN.map((fase) => {
    const f = (fasenRaw ?? []).find((x) => x.fase === fase);
    return {
      fase,
      organisatievorm: f?.organisatievorm ?? null,
      coachen_instructies: f?.coachen_instructies ?? null,
      stemgebruik_houding: f?.stemgebruik_houding ?? null,
      overzichtstekening_pad: f?.overzichtstekening_pad ?? null,
      overzichtstekening_bijschrift: f?.overzichtstekening_bijschrift ?? null,
      opruimen: (f?.opruimen ?? {}) as Json,
    };
  });
  const onderdelen = (onderdelenRaw ?? []) as OnderdeelRij[];

  const inhoud: AvfInhoud = {
    titel: a.titel, verschijningsvorm: a.verschijningsvorm, publieke_samenvatting: a.publieke_samenvatting,
    organiserende_studenten: a.organiserende_studenten, doelgroep: a.doelgroep, aantal_deelnemers: a.aantal_deelnemers,
    contactpersoon: a.contactpersoon,
    beginsituatie: a.beginsituatie ?? {}, doelen: a.doelen ?? {}, veiligheid: a.veiligheid ?? {},
    organisatie: a.organisatie ?? {}, communicatie: a.communicatie ?? {},
    fasen, onderdelen,
    rollenIngevuld: (rollen ?? []).filter((r) => isGevuld(r.namen)).length,
  };

  const pg = a.projectgroep as unknown as { naam: string; nummer: number };
  return {
    id: a.id,
    projectgroepId: a.projectgroep_id,
    clusterId: a.cluster_id,
    projectgroepNaam: pg.naam,
    projectgroepNummer: pg.nummer,
    status: a.status,
    opnieuwTeControleren: a.opnieuw_te_controleren,
    versie: a.versie,
    locatie: a.locatie_tekst,
    tijdvak: (regel.data as Tijdvak | null) ?? null,
    sectieBijgewerkt: (a.sectie_bijgewerkt ?? {}) as AvfGegevens["sectieBijgewerkt"],
    inhoud, fasen, onderdelen,
    rolverdeling: (rollen ?? []) as { rol: string; namen: string | null }[],
  };
}

/** Het AVF van de ingelogde projectgroep. */
export const laadEigenAvf = cache(async (): Promise<AvfGegevens | null> => {
  const supabase = await maakServerClient();
  const { data: account } = await supabase.from("account").select("projectgroep_id").maybeSingle();
  if (!account?.projectgroep_id) return null;
  const { data: a } = await supabase.from("avf").select("id").eq("projectgroep_id", account.projectgroep_id).maybeSingle();
  return a ? laadAvf(a.id) : null;
});

export interface PubliekeKaart {
  id: string;
  projectgroepNummer: number;
  groepNaam: string;
  titel: string | null;
  verschijningsvorm: string | null;
  samenvatting: string | null;
  tijdvak: { dag: string; starttijd: string; eindtijd: string } | null;
  status: "in_ontwikkeling" | "ingediend" | "aanpassing_gevraagd" | "goedgekeurd";
}

/** De publieke kaarten van alle belevenissen in een cluster (alleen wat avf_publiek toont). */
export async function laadKaarten(clusterId: string): Promise<PubliekeKaart[]> {
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("avf_publiek")
    .select("id, projectgroep_nummer, projectgroep_naam, titel, verschijningsvorm, publieke_samenvatting, status, dag, starttijd, eindtijd")
    .eq("cluster_id", clusterId)
    .order("projectgroep_nummer");
  return (data ?? []).map((r) => ({
    id: r.id,
    projectgroepNummer: r.projectgroep_nummer,
    groepNaam: r.projectgroep_naam,
    titel: r.titel,
    verschijningsvorm: r.verschijningsvorm,
    samenvatting: r.publieke_samenvatting,
    tijdvak: r.dag ? { dag: r.dag, starttijd: r.starttijd, eindtijd: r.eindtijd } : null,
    status: r.status,
  }));
}
