/**
 * Controleert of een cluster echt leeg is (zoals na de livegang): geen AVF-inhoud, onderdelen, materialen, aanvragen,
 * deadlines, logboek, rolverdeling, namen of thema. Alleen lezen; er verandert niets.
 *
 * Gebruik:
 *   npm run controleer-leeg                 VD
 *   npm run controleer-leeg -- --cluster=VC  een ander cluster (VD, VC of TEST)
 *
 * Eindigt met afsluitcode 1 als er nog iets in staat, zodat je het ook in een script kunt gebruiken.
 * Let op: voor VC is "leeg" pas na de echte livegang zo; tot dan staan er voorbeeldnamen in de rolverdeling.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sleutel = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !sleutel) {
  console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken in .env.local");
  process.exit(1);
}
const admin = createClient(url, sleutel, { auth: { autoRefreshToken: false, persistSession: false } });

const code = (process.argv.find((a) => a.startsWith("--cluster="))?.split("=")[1] ?? "VD").toUpperCase();

const leeg = (v: unknown): boolean =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v as object).length === 0);

const AVF_VELDEN = [
  "titel", "verschijningsvorm", "publieke_samenvatting", "organiserende_studenten", "doelgroep", "aantal_deelnemers", "contactpersoon",
  "locatie_keuze", "locatie_detail", "beginsituatie", "doelen", "veiligheid", "organisatie", "communicatie", "sectie_bijgewerkt",
  "ingediend_op", "ingediend_door_naam", "goedgekeurd_op", "goedgekeurd_door_naam",
];

async function telling(tabel: string, filter: (q: any) => any): Promise<number> {
  const { count, error } = await filter(admin.from(tabel).select("*", { count: "exact", head: true }));
  if (error) throw new Error(`${tabel}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const { data: cluster } = await admin.from("cluster").select("id, code, naam").eq("code", code).maybeSingle();
  if (!cluster) throw new Error(`Cluster ${code} bestaat niet.`);
  const problemen: string[] = [];
  const meld = (tekst: string) => problemen.push(tekst);

  const { data: avfs } = await admin.from("avf").select("*").eq("cluster_id", cluster.id);
  const ids = (avfs ?? []).map((a) => a.id as string);
  for (const a of avfs ?? []) {
    const gevuld = AVF_VELDEN.filter((k) => !leeg((a as Record<string, unknown>)[k]));
    if (gevuld.length) meld(`AVF van groep ${a.projectgroep_id.slice(0, 8)}…: ingevuld: ${gevuld.join(", ")}`);
    if (a.status !== "in_ontwikkeling" || a.versie !== 0) meld(`AVF ${a.id.slice(0, 8)}…: status ${a.status}, versie ${a.versie}`);
  }

  const { data: fasen } = await admin.from("avf_fase").select("*").in("avf_id", ids);
  const fasenGevuld = (fasen ?? []).filter((f) => f.organisatievorm || f.coachen_instructies || f.stemgebruik_houding || f.overzichtstekening_pad || !leeg(f.opruimen)).length;
  if (fasenGevuld) meld(`${fasenGevuld} fase(s) met inhoud`);

  for (const t of ["avf_onderdeel", "avf_materiaal", "materiaal_aanvraag", "avf_versie", "verbeterverzoek", "themacheck"]) {
    const n = await telling(t, (q) => q.in("avf_id", ids));
    if (n) meld(`${n} rij(en) in ${t}`);
  }
  const budget = await telling("budgetaanvraag", (q) => q.eq("cluster_id", cluster.id).neq("status", "concept"));
  if (budget) meld(`${budget} budgetaanvraag/aanvragen die niet op concept staan`);
  const regels = await telling("budgetaanvraag", (q) => q.eq("cluster_id", cluster.id).eq("soort", "los"));
  if (regels) meld(`${regels} losse budgetaanvraag/aanvragen`);
  const dl = await telling("deadline", (q) => q.eq("cluster_id", cluster.id));
  if (dl) meld(`${dl} deadline(s)`);
  const planVelden = await telling("calamiteit_veld", (q) => q.eq("cluster_id", cluster.id));
  if (planVelden) meld(`${planVelden} tekstveld(en) in het calamiteitenplan`);
  const planRegels = await telling("calamiteit_item", (q) => q.eq("cluster_id", cluster.id));
  if (planRegels) meld(`${planRegels} regel(s) in het calamiteitenplan`);
  const log = await telling("wijziging", (q) => q.eq("cluster_id", cluster.id));
  if (log) meld(`${log} logregel(s)`);

  const { data: groepen } = await admin.from("projectgroep").select("id").eq("cluster_id", cluster.id);
  const rollen = await telling("projectgroep_rol", (q) => q.in("projectgroep_id", (groepen ?? []).map((g) => g.id)).not("namen", "is", null));
  if (rollen) meld(`${rollen} rol(len) in de rolverdeling met een naam`);
  const { data: stuur } = await admin.from("stuurgroeprol").select("code, studenten").eq("cluster_id", cluster.id);
  const metNamen = (stuur ?? []).filter((r) => r.studenten).length;
  if (metNamen) meld(`${metNamen} stuurgroeprol(len) met namen`);
  const { data: thema } = await admin.from("meerdaagsethema").select("naam, verhaal, slogan, accentkleur, sfeerbeeld_pad, logo_pad").eq("cluster_id", cluster.id).maybeSingle();
  if (thema && Object.values(thema).some((v) => !leeg(v))) meld("het meerdaagsethema is ingevuld");

  console.log(`Cluster ${cluster.naam} (${cluster.code}): ${ids.length} AVF's gecontroleerd.`);
  if (problemen.length === 0) {
    console.log("Leeg: er staat niets in.");
    return;
  }
  console.log("Niet leeg:");
  for (const p of problemen) console.log(`  - ${p}`);
  process.exit(1);
}

main().catch((e) => {
  console.error("Fout:", e instanceof Error ? e.message : e);
  process.exit(1);
});
