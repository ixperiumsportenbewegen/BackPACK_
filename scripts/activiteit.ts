/**
 * Laat per account zien wanneer er voor het laatst is ingelogd en wanneer er voor het laatst is gewerkt. Alleen lezen.
 *
 * Gebruik:
 *   npm run activiteit                      VD
 *   npm run activiteit -- --cluster=VC      een ander cluster (VD, VC of TEST)
 *
 * Kolommen:
 *   Ingelogd  Laatste inlogmoment (Supabase Auth). Met "ingelogd blijven" verschijnt iemand die al ingelogd is
 *             niet opnieuw; kijk dan naar "Gewerkt".
 *   Gewerkt   Projectgroep: laatste wijziging in het AVF (ingevulde secties, fasen en onderdelen, indienen).
 *             Stuurgroep en docent: laatste actie in het logboek (indienen, goedkeuren, budget, deadlines, paklijst enz.).
 *   AVF       Status en voortgang van de projectgroep (alleen projectgroepen).
 * Er staan geen persoonsgegevens in: alleen gedeelde accounts.
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

const nu = Date.now();
function wanneer(iso: string | null | undefined): string {
  if (!iso) return "nog niet";
  const t = new Date(iso);
  const uren = (nu - t.getTime()) / 36e5;
  const dag = t.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const geleden = uren < 1 ? `${Math.max(1, Math.round(uren * 60))} min` : uren < 48 ? `${Math.round(uren)} u` : `${Math.round(uren / 24)} d`;
  return `${dag} (${geleden} geleden)`;
}
const laatste = (...d: (string | null | undefined)[]): string | null =>
  d.filter((x): x is string => !!x).sort().at(-1) ?? null;
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

const STATUS: Record<string, string> = {
  in_ontwikkeling: "in ontwikkeling", ingediend: "ingediend", aanpassing_gevraagd: "aanpassing gevraagd", goedgekeurd: "goedgekeurd",
};

async function main() {
  const { data: cluster } = await admin.from("cluster").select("id, code").eq("code", code).maybeSingle();
  if (!cluster) throw new Error(`Cluster ${code} bestaat niet.`);

  const { data: accounts, error: e1 } = await admin
    .from("account").select("id, gebruikersnaam, soort, projectgroep_id").eq("cluster_id", cluster.id).order("gebruikersnaam");
  if (e1) throw new Error(e1.message);

  // Laatste inlogmoment per auth-gebruiker
  const inlog = new Map<string, string | null>();
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const u of data.users) inlog.set(u.id, u.last_sign_in_at ?? null);
    if (data.users.length < 200) break;
  }

  const { data: avfs } = await admin.from("avf").select("id, projectgroep_id, status, tussentijds, ingediend_op, sectie_bijgewerkt").eq("cluster_id", cluster.id);
  const avfIds = (avfs ?? []).map((a) => a.id as string);
  const { data: fasen } = await admin.from("avf_fase").select("avf_id, organisatievorm, coachen_instructies, stemgebruik_houding, updated_at").in("avf_id", avfIds);
  const { data: onderdelen } = await admin.from("avf_onderdeel").select("avf_id, naam, beschrijving, updated_at").in("avf_id", avfIds);
  const { data: wijzigingen } = await admin
    .from("wijziging").select("account_id, created_at").in("account_id", (accounts ?? []).map((a) => a.id as string))
    .order("created_at", { ascending: false }).limit(5000);

  const avfAct = new Map<string, string | null>(); // avf_id -> laatste wijziging
  // Alleen echte wijzigingen: secties die iemand heeft opgeslagen, indienen, en fasen of onderdelen die na het aanmaken zijn aangepast
  // (anders tellen het aanmaken en het leegmaken van de AVF's mee).
  for (const a of avfs ?? []) {
    const secties = Object.values((a.sectie_bijgewerkt ?? {}) as Record<string, { updated_at?: string }>).map((v) => v?.updated_at);
    avfAct.set(a.id as string, laatste(a.ingediend_op as string | null, ...secties));
  }
  // Fasen en onderdelen tellen alleen mee als er iets in staat (het terugzetten door tests of de livegang raakt ze ook).
  const metInhoud = (r: Record<string, unknown>) => ["organisatievorm", "coachen_instructies", "stemgebruik_houding", "naam", "beschrijving"].some((k) => typeof r[k] === "string" && (r[k] as string).trim() !== "");
  for (const r of [...(fasen ?? []), ...(onderdelen ?? [])]) {
    if (!metInhoud(r as Record<string, unknown>)) continue;
    const k = r.avf_id as string;
    avfAct.set(k, laatste(avfAct.get(k), r.updated_at as string));
  }
  const logAct = new Map<string, string>();
  for (const w of wijzigingen ?? []) if (w.account_id && !logAct.has(w.account_id as string)) logAct.set(w.account_id as string, w.created_at as string);

  const regels = (accounts ?? []).map((a) => {
    const avf = (avfs ?? []).find((x) => x.projectgroep_id === a.projectgroep_id);
    const gewerkt = a.soort === "projectgroep" && avf ? avfAct.get(avf.id as string) ?? null : logAct.get(a.id as string) ?? null;
    return {
      naam: a.gebruikersnaam as string,
      soort: a.soort as string,
      ingelogd: inlog.get(a.id as string) ?? null,
      gewerkt,
      avf: avf ? `${STATUS[avf.status as string] ?? avf.status}${avf.tussentijds ? " (ter feedback)" : ""}` : "",
    };
  });

  console.log(`\nActiviteit cluster ${cluster.code} (${new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })})\n`);
  console.log(pad("Account", 26) + pad("Ingelogd", 28) + pad("Gewerkt", 28) + "AVF");
  console.log("-".repeat(100));
  for (const r of regels) {
    console.log(pad(r.naam, 26) + pad(wanneer(r.ingelogd), 28) + pad(wanneer(r.gewerkt), 28) + r.avf);
  }

  const tel = (soort: string) => regels.filter((r) => r.soort === soort);
  console.log("\nSamenvatting");
  for (const [soort, naam] of [["stuurgroep", "Stuurgroep"], ["projectgroep", "Projectgroepen"], ["student", "Student"], ["docent", "Docent"]] as const) {
    const lijst = tel(soort);
    if (!lijst.length) continue;
    const i = lijst.filter((r) => r.ingelogd).length;
    const g = lijst.filter((r) => r.gewerkt).length;
    console.log(`  ${pad(naam, 15)} ${i} van ${lijst.length} ooit ingelogd, ${g} van ${lijst.length} hebben gewerkt`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
