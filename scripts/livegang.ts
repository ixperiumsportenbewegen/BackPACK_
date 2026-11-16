/**
 * Livegang: maakt de clusters VD en VC schoon voor echt gebruik door studenten.
 *
 *  - maakt eerst een export (export/voor-livegang-<tijd>.json en .xlsx);
 *  - verwijdert alle AVF-gegevens van het cluster: inhoud, fasen, onderdelen, versies, verbeterverzoeken, themachecks,
 *    gekozen materialen, materiaalaanvragen, budgetaanvragen, deadlines, het calamiteitenplan, de spullen op de persoonlijke paklijst (de categorieën blijven), logboek en de bestanden in Storage;
 *  - zet het meerdaagsethema, de rolverdeling en de namen van de stuurgroepleden terug naar leeg;
 *  - laadt de basisgegevens opnieuw (npm run seed) zonder voorbeeld-AVF: de groepen krijgen weer het standaardtijdvak;
 *  - maakt nieuwe wachtwoorden voor alle accounts van het cluster en trekt hun sessies in.
 *
 * Blijft staan: de materialenlijst (categorieën, voorraad, status), het programma (tijden en activiteiten), de links, het
 * clusterbudget, het docentaccount en het cluster TEST.
 *
 * Gebruik:
 *   npm run livegang -- --droog                 alleen laten zien wat er zou gebeuren
 *   npm run livegang                            VD en VC, met bevestiging (typ LIVEGANG)
 *   npm run livegang -- --cluster=TEST          oefenen op het fictieve cluster TEST (daarna: npm run seed)
 *   npm run livegang -- --cluster=VD --zonder-wachtwoorden
 *                                               alleen de gegevens van VD leegmaken; de wachtwoorden blijven gelijk,
 *                                               zodat wie nu test niet wordt uitgelogd
 *
 * Gebruikt de service role key: alleen draaien op een vertrouwde computer, en alleen door Bart.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { exportBestandsnaam, exporteerAlles } from "../src/lib/exporteren";
import { exportNaarExcel } from "../src/lib/exporterenExcel";

config({ path: ".env.local", quiet: true });

const BEVESTIGINGSWOORD = "LIVEGANG";
const BUCKETS = ["avf", "thema"];
const ALFABET = "abcdefghjkmnpqrstuvwxyz23456789";

const argumenten = process.argv.slice(2);
const vlag = (naam: string) => argumenten.includes(`--${naam}`);
const waarde = (naam: string) => argumenten.find((a) => a.startsWith(`--${naam}=`))?.split("=")[1];

const droog = vlag("droog");
/** Alleen de gegevens leegmaken; de wachtwoorden en sessies blijven zoals ze zijn (voor wie nu nog test). */
const zonderWachtwoorden = vlag("zonder-wachtwoorden");
const clusterCodes = (waarde("cluster") ?? "VD,VC").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
const geldig = ["VD", "VC", "TEST"];
if (clusterCodes.length === 0 || clusterCodes.some((c) => !geldig.includes(c))) {
  console.error(`Onbekend cluster. Kies uit: ${geldig.join(", ")}.`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sleutel = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !sleutel) {
  console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken in .env.local");
  process.exit(1);
}
const admin: SupabaseClient = createClient(url, sleutel, { auth: { autoRefreshToken: false, persistSession: false } });

function nieuwWachtwoord(): string {
  const groep = () => Array.from({ length: 4 }, () => ALFABET[randomInt(ALFABET.length)]).join("");
  return `${groep()}-${groep()}-${groep()}`;
}

async function tel(tabel: string, filter: (q: any) => any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { count, error } = await filter(admin.from(tabel).select("*", { count: "exact", head: true }));
  if (error) throw new Error(`Tellen van ${tabel} mislukt: ${error.message}`);
  return count ?? 0;
}

async function ok<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, wat: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${wat}: ${error.message}`);
  return data;
}

/** Alle bestandspaden onder een map in een bucket (recursief). */
async function bestandenIn(bucket: string, map: string): Promise<string[]> {
  const paden: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(bucket).list(map, { limit: 100, offset });
    if (error) throw new Error(`Storage ${bucket}/${map}: ${error.message}`);
    for (const item of data ?? []) {
      if (item.id === null) paden.push(...(await bestandenIn(bucket, `${map}/${item.name}`)));
      else paden.push(`${map}/${item.name}`);
    }
    if ((data ?? []).length < 100) break;
  }
  return paden;
}

interface Cluster { id: string; code: string; naam: string }

async function overzicht(c: Cluster) {
  const avfs = (await ok(admin.from("avf").select("id").eq("cluster_id", c.id), "avf")) as { id: string }[];
  const ids = avfs.map((a) => a.id);
  const perAvf = (tabel: string) => (ids.length ? tel(tabel, (q) => q.in("avf_id", ids)) : Promise.resolve(0));
  const accounts = await tel("account", (q) => q.eq("cluster_id", c.id).neq("soort", "docent"));
  let bestanden = 0;
  for (const b of BUCKETS) bestanden += (await bestandenIn(b, `cluster/${c.id}`)).length;
  return {
    avfs: ids.length, ids,
    onderdelen: await perAvf("avf_onderdeel"), versies: await perAvf("avf_versie"), verzoeken: await perAvf("verbeterverzoek"),
    themachecks: await perAvf("themacheck"), materialen: await perAvf("avf_materiaal"), materiaalaanvragen: await perAvf("materiaal_aanvraag"),
    budgetaanvragen: await perAvf("budgetaanvraag"), deadlines: await tel("deadline", (q) => q.eq("cluster_id", c.id)),
    calamiteitenplan: (await tel("calamiteit_veld", (q) => q.eq("cluster_id", c.id))) + (await tel("calamiteit_item", (q) => q.eq("cluster_id", c.id))),
    paklijst: await tel("paklijst_item", (q) => q.eq("cluster_id", c.id)), logboek: await tel("wijziging", (q) => q.eq("cluster_id", c.id)),
    accounts, bestanden,
  };
}

async function vraagBevestiging(): Promise<boolean> {
  const bevestigd = waarde("bevestig");
  if (bevestigd !== undefined) return bevestigd === BEVESTIGINGSWOORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const antwoord = await rl.question(`Typ ${BEVESTIGINGSWOORD} om door te gaan (alles anders stopt): `);
  rl.close();
  return antwoord.trim() === BEVESTIGINGSWOORD;
}

const LEGE_AVF = {
  status: "in_ontwikkeling", opnieuw_te_controleren: false, versie: 0, titel: null, verschijningsvorm: null, publieke_samenvatting: null,
  organiserende_studenten: null, doelgroep: null, aantal_deelnemers: null, contactpersoon: null, locatie_keuze: null, locatie_detail: null,
  locatie_tekst: null, programma_regel_id: null, beginsituatie: {}, doelen: {}, veiligheid: {}, organisatie: {}, communicatie: {},
  sectie_bijgewerkt: {}, ingediend_op: null, ingediend_door_naam: null, goedgekeurd_op: null, goedgekeurd_door_naam: null,
  goedgekeurd_door_account: null,
};

/** De rolverdeling van de projectgroepen en de namen van de stuurgroepleden terug naar leeg. */
async function maakNamenLeeg(c: Cluster) {
  const groepen = (await ok(admin.from("projectgroep").select("id").eq("cluster_id", c.id), "projectgroepen")) as { id: string }[];
  if (groepen.length) {
    await ok(admin.from("projectgroep_rol").update({ namen: null }).in("projectgroep_id", groepen.map((g) => g.id)), "rolverdeling");
  }
  await ok(admin.from("stuurgroeprol").update({ studenten: null }).eq("cluster_id", c.id), "namen stuurgroep");
}

async function maakSchoon(c: Cluster, ids: string[]) {
  console.log(`\n== ${c.code}: opruimen ==`);
  // 1. bestanden in Storage
  for (const b of BUCKETS) {
    const paden = await bestandenIn(b, `cluster/${c.id}`);
    for (let i = 0; i < paden.length; i += 100) {
      const { error } = await admin.storage.from(b).remove(paden.slice(i, i + 100));
      if (error) throw new Error(`Bestanden verwijderen uit ${b}: ${error.message}`);
    }
    console.log(`  Storage ${b}: ${paden.length} bestanden verwijderd`);
  }

  // 2. AVF-gegevens: eerst wat naar het AVF verwijst
  if (ids.length) {
    for (const tabel of ["materiaal_aanvraag", "avf_materiaal", "verbeterverzoek", "themacheck", "avf_versie", "avf_onderdeel"]) {
      await ok(admin.from(tabel).delete().in("avf_id", ids), `verwijderen ${tabel}`);
    }
    await ok(admin.from("budgetaanvraag").delete().in("avf_id", ids).eq("soort", "los"), "losse aanvragen");
    await ok(admin.from("budgetaanvraag").update({
      status: "concept", regels: [], omschrijving: null, toelichting: null, bedrag_toegekend: null, besluit_toelichting: null,
      besluit_door_naam: null, besluit_op: null, besteed: null, ingediend_door_naam: null, ingediend_op: null,
    }).in("avf_id", ids).eq("soort", "avf"), "financieel plan terugzetten");
    await ok(admin.from("avf_fase").update({
      organisatievorm: null, overzichtstekening_pad: null, overzichtstekening_bijschrift: null, coachen_instructies: null,
      stemgebruik_houding: null, opruimen: {},
    }).in("avf_id", ids), "fasen terugzetten");
    await ok(admin.from("avf").update(LEGE_AVF).in("id", ids), "AVF terugzetten");
  }
  console.log(`  ${ids.length} AVF's leeg gemaakt`);

  // 3. thema, rolverdeling en namen van de stuurgroepleden
  await ok(admin.from("meerdaagsethema").update({
    naam: null, verhaal: null, slogan: null, accentkleur: null, sfeerbeeld_pad: null, logo_pad: null, bijgewerkt_door_naam: null,
  }).eq("cluster_id", c.id), "thema terugzetten");
  await maakNamenLeeg(c);

  // 4. deadlines (testdata: de stuurgroep stelt ze na de livegang zelf in) en het logboek van dit cluster (na alle wijzigingen
  //    hierboven, want die loggen zelf ook)
  await ok(admin.from("deadline").delete().eq("cluster_id", c.id), "deadlines");
  // het calamiteitenplan is testdata tot de livegang; de link naar de groepsapp blijft staan (net als de Teams- en Forms-link)
  await ok(admin.from("calamiteit_veld").delete().eq("cluster_id", c.id), "calamiteitenplan (velden)");
  await ok(admin.from("calamiteit_item").delete().eq("cluster_id", c.id), "calamiteitenplan (regels)");
  // de persoonlijke paklijst: de spullen zijn testdata en gaan weg; de categorieën blijven staan (zoals de categorieën van de materialenlijst)
  await ok(admin.from("paklijst_item").delete().eq("cluster_id", c.id), "paklijst (spullen)");
  await ok(admin.from("wijziging").delete().eq("cluster_id", c.id), "logboek");
  console.log("  thema, rolverdeling, namen, deadlines, calamiteitenplan, paklijst-spullen en logboek teruggezet");
}

async function nieuweWachtwoorden(clusters: Cluster[]) {
  console.log("\n== Nieuwe wachtwoorden ==");
  const pad = path.join("seed", "wachtwoorden.local.json");
  const bestaand: Record<string, string> = existsSync(pad) ? JSON.parse(readFileSync(pad, "utf8")) : {};
  const regels: string[] = [
    "Inloggegevens na de livegang. Deel per groep via het Teams-kanaal van de groep en verwijder dit bestand daarna.",
    `Gemaakt op ${new Date().toLocaleString("nl-NL")}.`, "",
  ];
  for (const c of clusters) {
    const accounts = (await ok(
      admin.from("account").select("id, gebruikersnaam, soort, projectgroep:projectgroep_id(naam), stuurgroeprol:stuurgroeprol_id(naam)")
        .eq("cluster_id", c.id).neq("soort", "docent").order("gebruikersnaam"), "accounts",
    )) as unknown as { id: string; gebruikersnaam: string; soort: string; projectgroep: { naam: string } | null; stuurgroeprol: { naam: string } | null }[];
    regels.push(`===== ${c.naam} (${c.code}) =====`);
    for (const a of accounts) {
      const wachtwoord = nieuwWachtwoord();
      const { error } = await admin.auth.admin.updateUserById(a.id, { password: wachtwoord });
      if (error) throw new Error(`Wachtwoord van ${a.gebruikersnaam}: ${error.message}`);
      await admin.rpc("account_sessies_verwijderen", { p_user_id: a.id });
      bestaand[a.gebruikersnaam] = wachtwoord;
      const label = a.projectgroep?.naam ?? (a.stuurgroeprol ? `Stuurgroep · ${a.stuurgroeprol.naam}` : "Studenten");
      regels.push("", `${label}`, `  Website: ${url!.includes("supabase") ? "https://back-pack-one.vercel.app" : ""}`, `  Gebruikersnaam: ${a.gebruikersnaam}`, `  Wachtwoord: ${wachtwoord}`);
    }
    regels.push("");
    console.log(`  ${c.code}: ${accounts.length} wachtwoorden vernieuwd`);
  }
  writeFileSync(pad, JSON.stringify(bestaand, null, 2) + "\n");
  writeFileSync(path.join("seed", "livegang-inloggegevens.txt"), regels.join("\n") + "\n");
  rmSync(".auth-cache", { recursive: true, force: true }); // oude testsessies zijn niet meer geldig
  console.log("  Opgeslagen in seed/wachtwoorden.local.json en seed/livegang-inloggegevens.txt (niet in git).");
}

async function main() {
  const host = new URL(url!).host;
  console.log(`Project: ${host}`);
  console.log(`Clusters: ${clusterCodes.join(", ")}${droog ? "  (DROGE RUN: er verandert niets)" : ""}\n`);

  const clusters = (await ok(admin.from("cluster").select("id, code, naam").in("code", clusterCodes), "clusters")) as Cluster[];
  if (clusters.length !== clusterCodes.length) throw new Error("Niet alle gekozen clusters bestaan in de database.");

  const per = new Map<string, Awaited<ReturnType<typeof overzicht>>>();
  for (const c of clusters) {
    const o = await overzicht(c);
    per.set(c.code, o);
    console.log(`${c.naam} (${c.code}): ${o.avfs} AVF's (${o.onderdelen} onderdelen, ${o.versies} versies, ${o.verzoeken} verbeterverzoeken, ${o.themachecks} themachecks),`);
    console.log(`  ${o.materialen} gekozen materialen, ${o.materiaalaanvragen} materiaalaanvragen, ${o.budgetaanvragen} budgetaanvragen, ${o.deadlines} deadlines, ${o.calamiteitenplan} regels in het calamiteitenplan, ${o.paklijst} spullen op de paklijst, ${o.logboek} logregels, ${o.bestanden} bestanden in Storage,`);
    console.log(zonderWachtwoorden ? `  ${o.accounts} accounts houden hun wachtwoord (--zonder-wachtwoorden).` : `  ${o.accounts} accounts krijgen een nieuw wachtwoord.`);
  }
  console.log("\nBlijft staan: de materialenlijst, het programma (tijden en activiteiten), de links, het clusterbudget, het docentaccount en cluster TEST.");

  if (droog) {
    console.log("\nDroge run klaar. Er is niets gewijzigd.");
    return;
  }

  console.log("\nLET OP: dit verwijdert de gegevens hierboven in het echte project en kan niet ongedaan worden gemaakt (de export vooraf is je vangnet).");
  if (!(await vraagBevestiging())) {
    console.log("Gestopt. Er is niets gewijzigd.");
    return;
  }

  // 1. Export vooraf
  mkdirSync("export", { recursive: true });
  const data = await exporteerAlles(admin);
  const jsonPad = path.join("export", exportBestandsnaam("json", "voor-livegang"));
  writeFileSync(jsonPad, JSON.stringify(data, null, 2));
  writeFileSync(path.join("export", exportBestandsnaam("xlsx", "voor-livegang")), await exportNaarExcel(data));
  console.log(`\nExport gemaakt: ${jsonPad} (en een Excel-bestand ernaast).`);

  // 2. Opruimen. De links onthouden we eerst: de seed hieronder schrijft ze anders terug naar de waarde uit seed/basis.json.
  const linksVoor = new Map<string, { teams_link: string | null; forms_link: string | null }>();
  for (const c of clusters) {
    const { data } = await admin.from("cluster").select("teams_link, forms_link").eq("id", c.id).single();
    linksVoor.set(c.id, { teams_link: data?.teams_link ?? null, forms_link: data?.forms_link ?? null });
  }
  for (const c of clusters) await maakSchoon(c, per.get(c.code)!.ids);

  // 3. Markering: na de livegang laadt seed het voorbeeld-AVF niet meer in VD
  if (clusters.some((c) => c.code === "VD" || c.code === "VC")) {
    await ok(admin.from("systeem_instelling").upsert({ sleutel: "livegang_op", waarde: new Date().toISOString() }).select(), "markering");
  }

  // 4. Basisgegevens opnieuw laden (de groepen krijgen weer hun standaardtijdvak), zonder voorbeeld-AVF in VD
  console.log("\n== Basisgegevens opnieuw laden ==");
  const seed = spawnSync("npx", ["tsx", "scripts/seed.ts"], { stdio: "inherit", shell: true });
  if (seed.status !== 0) throw new Error("npm run seed is mislukt");

  // De seed zet ook de links, de voorbeeldnamen van de rolverdeling en de stuurgroepleden terug uit seed/basis.json en logt dat.
  // Daarom hier opnieuw: links terug zoals ze waren, namen leeg, logboek leeg.
  console.log("\n== Links, namen en logboek na de seed herstellen ==");
  for (const c of clusters) {
    const voor = linksVoor.get(c.id)!;
    await ok(admin.from("cluster").update(voor).eq("id", c.id), "links terugzetten");
    await maakNamenLeeg(c);
    await ok(admin.from("wijziging").delete().eq("cluster_id", c.id), "logboek");
    console.log(`  ${c.code}: links zoals voor de livegang, namen en logboek leeg`);
  }

  // 5. Nieuwe wachtwoorden (tenzij je ze bewust laat staan)
  if (zonderWachtwoorden) {
    console.log("\n== Wachtwoorden ==\n  Ongewijzigd (--zonder-wachtwoorden): de bestaande wachtwoorden en sessies blijven geldig.");
    console.log("\nKlaar. Volgende stappen:");
    console.log("  1. Controleer de website als student (bijvoorbeeld vd-student) en als docent.");
    console.log("  2. Bewaar de export in export/ op een veilige plek.");
    return;
  }
  await nieuweWachtwoorden(clusters);

  console.log("\nKlaar. Volgende stappen:");
  console.log("  1. Deel per groep de inloggegevens uit seed/livegang-inloggegevens.txt via Teams en verwijder dat bestand daarna.");
  console.log("  2. Controleer de website als student (bijvoorbeeld vd-student) en als docent.");
  console.log("  3. Bewaar de export in export/ op een veilige plek.");
}

main().catch((e) => { console.error("\nFout:", e instanceof Error ? e.message : e); process.exit(1); });
