/**
 * Alle gegevens van BackPACK_ als één geheel exporteren (JSON en Excel).
 * Geen servercode van Next.js, zodat zowel de beheerpagina (met de sessie van de docent) als het exportscript
 * (met de service role) dit kunnen gebruiken. Afbeeldingen uit Storage zitten er niet in.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Alle tabellen die meegaan in de export, met de kolom waarop wordt gesorteerd (voor stabiele paginering). */
export const EXPORT_TABELLEN: { naam: string; sorteer: string }[] = [
  { naam: "editie", sorteer: "created_at" },
  { naam: "cluster", sorteer: "created_at" },
  { naam: "cluster_budget", sorteer: "created_at" },
  { naam: "meerdaagsethema", sorteer: "created_at" },
  { naam: "stuurgroeprol", sorteer: "created_at" },
  { naam: "projectgroep", sorteer: "created_at" },
  { naam: "projectgroep_rol", sorteer: "created_at" },
  { naam: "account", sorteer: "created_at" },
  { naam: "programma_regel", sorteer: "created_at" },
  { naam: "avf", sorteer: "created_at" },
  { naam: "avf_fase", sorteer: "created_at" },
  { naam: "avf_onderdeel", sorteer: "created_at" },
  { naam: "avf_versie", sorteer: "created_at" },
  { naam: "verbeterverzoek", sorteer: "created_at" },
  { naam: "themacheck", sorteer: "created_at" },
  { naam: "materiaal_categorie", sorteer: "volgorde" },
  { naam: "materiaal", sorteer: "created_at" },
  { naam: "materiaallijst_status", sorteer: "updated_at" },
  { naam: "avf_materiaal", sorteer: "created_at" },
  { naam: "materiaal_telling", sorteer: "created_at" },
  { naam: "materiaal_aanvraag", sorteer: "created_at" },
  { naam: "budgetaanvraag", sorteer: "created_at" },
  { naam: "deadline", sorteer: "created_at" },
  { naam: "calamiteit_veld", sorteer: "created_at" },
  { naam: "calamiteit_item", sorteer: "created_at" },
  { naam: "paklijst_categorie", sorteer: "created_at" },
  { naam: "paklijst_item", sorteer: "created_at" },
  { naam: "wijziging", sorteer: "created_at" },
];

export interface Export {
  gemaaktOp: string;
  aantallen: Record<string, number>;
  tabellen: Record<string, Record<string, unknown>[]>;
}

const PAGINA = 1000;

/** Leest alle rijen van alle tabellen met de rechten van de meegegeven client. */
export async function exporteerAlles(client: SupabaseClient): Promise<Export> {
  const tabellen: Export["tabellen"] = {};
  for (const { naam, sorteer } of EXPORT_TABELLEN) {
    const rijen: Record<string, unknown>[] = [];
    for (let van = 0; ; van += PAGINA) {
      const { data, error } = await client.from(naam).select("*").order(sorteer, { ascending: true }).range(van, van + PAGINA - 1);
      if (error) throw new Error(`Exporteren van ${naam} mislukt: ${error.message}`);
      rijen.push(...((data ?? []) as Record<string, unknown>[]));
      if ((data ?? []).length < PAGINA) break;
    }
    tabellen[naam] = rijen;
  }
  return {
    gemaaktOp: new Date().toISOString(),
    aantallen: Object.fromEntries(Object.entries(tabellen).map(([n, r]) => [n, r.length])),
    tabellen,
  };
}

/** Bestandsnaam met datum en tijd, bijvoorbeeld backpack-export-2026-11-14-0930.json. */
export function exportBestandsnaam(extensie: "json" | "xlsx", voorvoegsel = "backpack-export", nu: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${voorvoegsel}-${nu.getFullYear()}-${p(nu.getMonth() + 1)}-${p(nu.getDate())}-${p(nu.getHours())}${p(nu.getMinutes())}.${extensie}`;
}
