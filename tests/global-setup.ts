/**
 * Vangnet voor de database-tests: ze werken op VD en VC (voor de afscherming tussen clusters) en ruimen zelf op, maar
 * dat gaat niet altijd goed (een vergeten locatie, logregels van een test). Vóór alle tests leggen we daarom vast hoe VD
 * en VC erbij staan; na alle tests zetten we dat terug en verwijderen we wat de tests hebben aangemaakt.
 *
 * Zo blijft VD leeg na de livegang, en blijven echte gegevens van VD en VC heel als iemand de tests toch draait.
 * Het cluster TEST laten we met rust: daar werken ook collega's.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Rij = Record<string, unknown>;

const CLUSTERS = ["VD", "VC"];
/** Tabellen met een avf_id waarin tests rijen aanmaken; wat na de start is gemaakt, verwijderen we. */
const AVF_KINDEREN = ["avf_onderdeel", "avf_materiaal", "materiaal_aanvraag", "avf_versie", "verbeterverzoek", "themacheck"];

function zonder(rij: Rij, ...kolommen: string[]): Rij {
  const kopie = { ...rij };
  for (const k of kolommen) delete kopie[k];
  return kopie;
}

async function lees(admin: SupabaseClient, tabel: string, kolom: string, waarden: string[]): Promise<Rij[]> {
  if (waarden.length === 0) return [];
  const { data, error } = await admin.from(tabel).select("*").in(kolom, waarden);
  if (error) throw new Error(`Vangnet: ${tabel} lezen mislukt: ${error.message}`);
  return (data ?? []) as Rij[];
}

export default async function setup() {
  config({ path: ".env.local", quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sleutel = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sleutel) return;
  const admin = createClient(url, sleutel, { auth: { autoRefreshToken: false, persistSession: false } });

  const start = new Date().toISOString();
  const { data: clusters } = await admin.from("cluster").select("id, code, teams_link, forms_link").in("code", CLUSTERS);
  const clusterIds = (clusters ?? []).map((c) => c.id as string);
  if (clusterIds.length === 0) return;

  const avfs = await lees(admin, "avf", "cluster_id", clusterIds);
  const avfIds = avfs.map((a) => a.id as string);
  const fasen = await lees(admin, "avf_fase", "avf_id", avfIds);
  const stuurRollen = await lees(admin, "stuurgroeprol", "cluster_id", clusterIds);
  const groepen = await lees(admin, "projectgroep", "cluster_id", clusterIds);
  const rolverdeling = await lees(admin, "projectgroep_rol", "projectgroep_id", groepen.map((g) => g.id as string));
  const themas = await lees(admin, "meerdaagsethema", "cluster_id", clusterIds);
  const budget = await lees(admin, "budgetaanvraag", "cluster_id", clusterIds);
  const regels = await lees(admin, "programma_regel", "cluster_id", clusterIds);
  const deadlines = await lees(admin, "deadline", "cluster_id", clusterIds);

  return async function teardown() {
    const fout = (tabel: string, error: { message: string } | null) => {
      if (error) console.error(`Vangnet: ${tabel} terugzetten mislukt: ${error.message}`);
    };

    // 1. wat de tests hebben aangemaakt, weg
    for (const t of AVF_KINDEREN) fout(t, (await admin.from(t).delete().in("avf_id", avfIds).gte("created_at", start)).error);
    fout("budgetaanvraag", (await admin.from("budgetaanvraag").delete().in("cluster_id", clusterIds).gte("created_at", start)).error);
    fout("deadline", (await admin.from("deadline").delete().in("cluster_id", clusterIds)).error);
    fout("programma_regel", (await admin.from("programma_regel").delete().in("cluster_id", clusterIds).gte("created_at", start)).error);

    // 2. wat er al stond, terug zoals het was
    for (const a of avfs) fout("avf", (await admin.from("avf").update(zonder(a, "id", "created_at", "updated_at", "cluster_id", "projectgroep_id")).eq("id", a.id as string)).error);
    for (const f of fasen) fout("avf_fase", (await admin.from("avf_fase").update(zonder(f, "avf_id", "fase", "created_at", "updated_at")).eq("avf_id", f.avf_id as string).eq("fase", f.fase as string)).error);
    for (const r of stuurRollen) fout("stuurgroeprol", (await admin.from("stuurgroeprol").update({ studenten: r.studenten }).eq("id", r.id as string)).error);
    for (const r of rolverdeling) fout("projectgroep_rol", (await admin.from("projectgroep_rol").update({ namen: r.namen }).eq("projectgroep_id", r.projectgroep_id as string).eq("rol", r.rol as string)).error);
    for (const t of themas) fout("meerdaagsethema", (await admin.from("meerdaagsethema").update(zonder(t, "cluster_id", "created_at", "updated_at")).eq("cluster_id", t.cluster_id as string)).error);
    for (const b of budget) fout("budgetaanvraag", (await admin.from("budgetaanvraag").update(zonder(b, "id", "created_at", "updated_at", "cluster_id", "projectgroep_id", "avf_id", "soort", "bedrag_aangevraagd")).eq("id", b.id as string)).error);
    for (const r of regels) fout("programma_regel", (await admin.from("programma_regel").update(zonder(r, "id", "created_at", "updated_at", "cluster_id")).eq("id", r.id as string)).error);
    for (const c of clusters ?? []) fout("cluster", (await admin.from("cluster").update({ teams_link: c.teams_link, forms_link: c.forms_link }).eq("id", c.id as string)).error);
    if (deadlines.length) fout("deadline", (await admin.from("deadline").insert(deadlines)).error);

    // 3. het logboek van VD en VC: alles wat tijdens de tests is bijgekomen
    fout("wijziging", (await admin.from("wijziging").delete().in("cluster_id", clusterIds).gte("created_at", start)).error);
  };
}
