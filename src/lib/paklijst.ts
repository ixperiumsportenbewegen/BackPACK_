import { maakServerClient } from "@/lib/supabase/server";
import type { PaklijstBlokCode } from "@/config/paklijst";

export interface PaklijstSpul {
  id: string;
  naam: string;
  aantal: string | null;
  toelichting: string | null;
  optioneel: boolean;
  onderdelen: PaklijstSpul[];
}

export interface PaklijstCategorie {
  id: string;
  blok: PaklijstBlokCode;
  naam: string;
  spullen: PaklijstSpul[];
}

export interface Paklijst {
  clusterId: string;
  categorieen: PaklijstCategorie[];
  /** Wanneer en door wie er voor het laatst iets is bijgewerkt (spullen en door de stuurgroep gemaakte of gewijzigde categorieën). */
  bijgewerkt: { moment: string; naam: string | null } | null;
}

/** Een spul telt mee op de lijst zodra het een naam heeft. */
export const heeftNaam = (s: PaklijstSpul) => s.naam.trim() !== "";

/** Alle spullen met een naam (ook onderdelen), voor de voortgang en om te weten of de lijst leeg is. */
export function alleSpullen(p: Paklijst): PaklijstSpul[] {
  return p.categorieen.flatMap((c) => c.spullen.flatMap((s) => [s, ...s.onderdelen])).filter(heeftNaam);
}

/** De paklijst van een cluster. De database bepaalt wie hem mag lezen (iedereen in het cluster en de docent). */
export async function laadPaklijst(clusterId: string): Promise<Paklijst> {
  const supabase = await maakServerClient();
  const [catRes, itemRes] = await Promise.all([
    supabase.from("paklijst_categorie").select("id, blok, naam, volgorde, bijgewerkt_door_naam, updated_at").eq("cluster_id", clusterId).order("volgorde"),
    supabase.from("paklijst_item").select("id, categorie_id, bovenliggend_id, naam, aantal, toelichting, optioneel, volgorde, bijgewerkt_door_naam, updated_at").eq("cluster_id", clusterId).order("volgorde"),
  ]);

  let nieuwste: { moment: string; naam: string | null } | null = null;
  const onthoud = (moment: string, naam: string | null) => {
    if (!nieuwste || moment > nieuwste.moment) nieuwste = { moment, naam };
  };

  const spulPerId = new Map<string, PaklijstSpul>();
  const kinderen: { ouder: string; spul: PaklijstSpul }[] = [];
  const perCategorie = new Map<string, PaklijstSpul[]>();
  for (const r of itemRes.data ?? []) {
    const spul: PaklijstSpul = { id: r.id, naam: r.naam ?? "", aantal: r.aantal, toelichting: r.toelichting, optioneel: Boolean(r.optioneel), onderdelen: [] };
    spulPerId.set(r.id, spul);
    if (r.naam?.trim()) onthoud(r.updated_at, r.bijgewerkt_door_naam);
    if (r.bovenliggend_id) kinderen.push({ ouder: r.bovenliggend_id, spul });
    else perCategorie.set(r.categorie_id, [...(perCategorie.get(r.categorie_id) ?? []), spul]);
  }
  for (const k of kinderen) spulPerId.get(k.ouder)?.onderdelen.push(k.spul);

  const categorieen: PaklijstCategorie[] = (catRes.data ?? []).map((c) => {
    if (c.bijgewerkt_door_naam) onthoud(c.updated_at, c.bijgewerkt_door_naam);
    return { id: c.id, blok: c.blok as PaklijstBlokCode, naam: c.naam, spullen: perCategorie.get(c.id) ?? [] };
  });
  return { clusterId, categorieen, bijgewerkt: nieuwste };
}
