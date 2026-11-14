/**
 * Laadt seed/basis.json in het Supabase-project: editie, clusters, thema's,
 * stuurgroeprollen, projectgroepen en alle accounts.
 *
 * - Herhaalbaar: bestaande gegevens worden bijgewerkt, bestaande accounts worden overgeslagen.
 * - Wachtwoorden worden gegenereerd en bewaard in seed/wachtwoorden.local.json (niet in git).
 * - Gebruikt de service role key: alleen draaien op een vertrouwde computer.
 *
 * Gebruik: npm run seed
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomInt, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const basisPad = path.join("seed", "basis.json");
const wachtwoordPad = path.join("seed", "wachtwoorden.local.json");
const basis = JSON.parse(readFileSync(basisPad, "utf8"));
const programma = JSON.parse(readFileSync(path.join("seed", "programma.json"), "utf8"));
const voorbeeld = JSON.parse(readFileSync(path.join("seed", "avf-voorbeeld.json"), "utf8"));
const materialenSeed = JSON.parse(readFileSync(path.join("seed", "materialen.json"), "utf8"));

const wachtwoorden: Record<string, string> = existsSync(wachtwoordPad)
  ? JSON.parse(readFileSync(wachtwoordPad, "utf8"))
  : {};

const ALFABET = "abcdefghjkmnpqrstuvwxyz23456789"; // zonder tekens die op elkaar lijken
function nieuwWachtwoord(): string {
  const groep = () => Array.from({ length: 4 }, () => ALFABET[randomInt(ALFABET.length)]).join("");
  return `${groep()}-${groep()}-${groep()}`;
}

function opslaanWachtwoorden() {
  writeFileSync(wachtwoordPad, JSON.stringify(wachtwoorden, null, 2) + "\n");
}

function check<T>(res: { data: T; error: { message: string } | null }, wat: string): NonNullable<T> {
  if (res.error || res.data === null) {
    console.error(`Fout bij ${wat}: ${res.error?.message ?? "geen resultaat"}`);
    process.exit(1);
  }
  return res.data as NonNullable<T>;
}

async function main() {
  // Editie
  let { data: editie } = await admin
    .from("editie").select("id").eq("naam", basis.editie.naam).maybeSingle();
  if (!editie) {
    editie = check(
      await admin.from("editie").insert(basis.editie).select("id").single(),
      "editie aanmaken",
    );
  }
  const editieId = editie!.id as string;

  const clusterId: Record<string, string> = {};
  const stuurrolId: Record<string, string> = {}; // `${cluster}:${code}`
  const groepId: Record<string, string> = {}; // `${cluster}:${nummer}`

  for (const c of basis.clusters) {
    const cl = check(
      await admin.from("cluster").upsert({
        editie_id: editieId, code: c.code, naam: c.naam,
        teams_link: c.teams_link || null, forms_link: c.forms_link || null,
      }, { onConflict: "editie_id,code" }).select("id").single(),
      `cluster ${c.code}`,
    );
    clusterId[c.code] = cl.id;

    check(await admin.from("cluster_budget").upsert(
      { cluster_id: cl.id, budget_totaal: c.budget_totaal }, { onConflict: "cluster_id" },
    ).select(), `budget ${c.code}`);

    const th = c.meerdaagsethema ?? {};
    check(await admin.from("meerdaagsethema").upsert({
      cluster_id: cl.id, naam: th.naam ?? null, verhaal: th.verhaal ?? null,
      slogan: th.slogan ?? null, accentkleur: th.accentkleur ?? null,
    }, { onConflict: "cluster_id" }).select(), `thema ${c.code}`);

    for (const r of c.stuurgroeprollen) {
      const rol = check(await admin.from("stuurgroeprol").upsert({
        cluster_id: cl.id, code: r.code, naam: r.naam, focus: r.focus,
        studenten: r.studenten, pack: r.pack,
      }, { onConflict: "cluster_id,code" }).select("id").single(), `stuurgroeprol ${r.code}`);
      stuurrolId[`${c.code}:${r.code}`] = rol.id;
    }

    for (const g of c.projectgroepen) {
      const pg = check(await admin.from("projectgroep").upsert({
        cluster_id: cl.id, nummer: g.nummer, naam: g.naam,
      }, { onConflict: "cluster_id,nummer" }).select("id").single(), `projectgroep ${g.nummer}`);
      groepId[`${c.code}:${g.nummer}`] = pg.id;

      for (const pr of basis.projectgroeprollen) {
        const namen = (g.rolverdeling ?? {})[pr.code] || null;
        check(await admin.from("projectgroep_rol").upsert({
          projectgroep_id: pg.id, rol: pr.code, namen,
        }, { onConflict: "projectgroep_id,rol" }).select(), `rol ${pr.code}`);
      }
    }
  }

  // Programma per cluster. Elk cluster heeft zijn eigen programma (VC is gespiegeld); TEST gebruikt dat van VD.
  // - Heeft een cluster al een programma, dan blijft dat staan: de stuurgroep kan tijden aanpassen en activiteiten
  //   toevoegen of verwijderen, en dat mag een nieuwe seed nooit terugdraaien.
  // - Met --programma-opnieuw=VC,VD wordt het programma van die clusters teruggezet naar het standaardprogramma:
  //   de belevenisvakken blijven bestaan (met hun toegewezen projectgroep), de vaste activiteiten worden vervangen.
  const opnieuw = new Set(
    (process.argv.find((x) => x.startsWith("--programma-opnieuw="))?.split("=")[1] ?? "").split(",").filter(Boolean),
  );
  type SeedRegel = Record<string, unknown>;
  const dagenVan = (code: string): { dag: string; regels: SeedRegel[] }[] => {
    const bron = programma.programmas[code];
    return typeof bron === "string" ? programma.programmas[bron].dagen : bron.dagen;
  };
  const seedPerCluster = (code: string): SeedRegel[] =>
    dagenVan(code).flatMap((d) => d.regels.map((r): SeedRegel => ({ ...r, dag: d.dag })));
  const rij = (cluster: string, volgorde: number, r: SeedRegel) => ({
    cluster_id: cluster, volgorde, dag: r.dag, starttijd: r.start, eindtijd: r.eind,
    soort: r.soort ?? "vast", titel: r.titel, omschrijving: r.omschrijving ?? null, locatie: r.locatie ?? null,
    deelnemers: r.deelnemers ?? [], rocks_rivers_groepen: r.rocks_rivers_groepen ?? [],
    oorspronkelijke_starttijd: null, oorspronkelijke_eindtijd: null,
  });

  // Startlijst met materialen (één lijst voor beide clusters), zonder voorraad: Logistiek & Facilitair schat die zelf in.
  // Alleen als de lijst nog leeg is: daarna beheert Logistiek & Facilitair de lijst in de app (toevoegen en verwijderen),
  // en moet een nieuwe seed-run niets terugzetten wat bewust is verwijderd.
  {
    const { count } = await admin.from("materiaal").select("id", { count: "exact", head: true });
    if ((count ?? 0) === 0) {
      const nieuw = (materialenSeed.materialen as { naam: string; categorie: string; opmerking?: string }[])
        .map((m) => ({ naam: m.naam, categorie: m.categorie, opmerking: m.opmerking ?? null, voorraad_camping: null, voorraad_bivak: null, bijgewerkt_door_naam: "Seed" }));
      check(await admin.from("materiaal").insert(nieuw).select(), "materialen");
      console.log(`Materialen: ${nieuw.length} geladen.`);
    } else {
      console.log(`Materialen: de lijst heeft al ${count} materialen en blijft zoals hij is.`);
    }
  }

  for (const c of basis.clusters) {
    const cluster = clusterId[c.code];
    const standaard = seedPerCluster(c.code);
    const { count } = await admin.from("programma_regel").select("id", { count: "exact", head: true }).eq("cluster_id", cluster);

    if ((count ?? 0) === 0) {
      check(await admin.from("programma_regel").insert(standaard.map((r, i) => rij(cluster, i + 1, r))).select(), `programma ${c.code}`);
    } else if (opnieuw.has(c.code)) {
      const { data: bestaand } = await admin.from("programma_regel").select("id, soort, volgorde").eq("cluster_id", cluster).order("volgorde");
      const vakken = (bestaand ?? []).filter((r) => r.soort === "belevenis");
      const zesVakken = standaard.filter((r) => r.soort === "belevenis");
      if (vakken.length !== zesVakken.length) {
        console.error(`Programma ${c.code} niet opnieuw geladen: ${vakken.length} belevenisvakken gevonden, ${zesVakken.length} verwacht.`);
        process.exit(1);
      }
      // Eerst alle volgnummers vrijmaken, dan de vaste activiteiten vervangen en de vakken bijwerken
      for (const [i, r] of (bestaand ?? []).entries()) await admin.from("programma_regel").update({ volgorde: 1000 + i }).eq("id", r.id);
      await admin.from("programma_regel").delete().eq("cluster_id", cluster).eq("soort", "vast");
      let vak = 0;
      for (const [i, r] of standaard.entries()) {
        if (r.soort === "belevenis") {
          const bestaandVak = vakken[vak++];
          check(await admin.from("programma_regel").update(rij(cluster, i + 1, r)).eq("id", bestaandVak.id).select(), `vak ${c.code}`);
        } else {
          check(await admin.from("programma_regel").insert(rij(cluster, i + 1, r)).select(), `vast ${c.code}`);
        }
      }
    }

    // Voorlopige toewijzing: elke groep krijgt het tijdvak waarin zij volgens het programma organiseert.
    // Het n-de belevenisvak (op volgorde) hoort bij de n-de organisator uit het standaardprogramma.
    const organisatoren = standaard.filter((r) => r.soort === "belevenis").map((r) => r.organisator as number);
    const { data: vakken } = await admin.from("programma_regel")
      .select("id, volgorde").eq("cluster_id", cluster).eq("soort", "belevenis").order("volgorde");
    for (const [i, vak] of (vakken ?? []).entries()) {
      const pgId = groepId[`${c.code}:${organisatoren[i]}`];
      if (!pgId) continue;
      await admin.from("avf").update({ programma_regel_id: vak.id }).eq("projectgroep_id", pgId).is("programma_regel_id", null);
    }
  }

  // Voorbeeld-AVF bij projectgroep 1 van VD (tot de livegang) en van TEST (blijvend). Alleen als het AVF nog leeg is.
  // Na de livegang (markering livegang_op) komt er in VD geen voorbeeld-AVF meer; TEST houdt het altijd.
  const { data: livegang } = await admin.from("systeem_instelling").select("waarde").eq("sleutel", "livegang_op").maybeSingle();
  for (const code of livegang ? ["TEST"] : ["VD", "TEST"]) {
    const pgId = groepId[`${code}:1`];
    const { data: leegAvf } = await admin.from("avf").select("id, titel").eq("projectgroep_id", pgId).single();
    const { count } = await admin.from("avf_onderdeel").select("id", { count: "exact", head: true }).eq("avf_id", leegAvf!.id);
    if (leegAvf!.titel || (count ?? 0) > 0) continue;
    const metId = (lijst: Record<string, unknown>[]) => lijst.map((x) => ({ ...x, id: randomUUID() }));
    const doelen = { ...voorbeeld.doelen, persoonlijk: metId(voorbeeld.doelen.persoonlijk) };
    const veiligheid = { ...voorbeeld.veiligheid, risicos: metId(voorbeeld.veiligheid.risicos) };
    check(await admin.from("avf").update({
      titel: voorbeeld.titel, verschijningsvorm: voorbeeld.verschijningsvorm, publieke_samenvatting: voorbeeld.publieke_samenvatting,
      organiserende_studenten: voorbeeld.organiserende_studenten, doelgroep: voorbeeld.doelgroep,
      aantal_deelnemers: voorbeeld.aantal_deelnemers, contactpersoon: voorbeeld.contactpersoon,
      locatie_keuze: voorbeeld.locatie_keuze, locatie_detail: voorbeeld.locatie_detail,
      beginsituatie: voorbeeld.beginsituatie, doelen, veiligheid, organisatie: voorbeeld.organisatie, communicatie: voorbeeld.communicatie,
    }).eq("id", leegAvf!.id).select(), `voorbeeld-avf ${code}`);
    for (const f of voorbeeld.fasen) {
      check(await admin.from("avf_fase").update({
        organisatievorm: f.organisatievorm, coachen_instructies: f.coachen_instructies,
        stemgebruik_houding: f.stemgebruik_houding, opruimen: f.opruimen,
      }).eq("avf_id", leegAvf!.id).eq("fase", f.fase).select(), `voorbeeld-fase ${f.fase}`);
    }
    for (const o of voorbeeld.onderdelen) {
      const { fase, volgorde, naam, duur_minuten, beschrijving, sociale_veiligheid, fysieke_veiligheid, individu_moeilijker,
        individu_makkelijker, groep_moeilijker, groep_makkelijker, usv_uitdagend, usv_speelbaar, usv_veilig_aanvulling } = o;
      const leeg = (t: string) => (t === "" ? null : t);
      check(await admin.from("avf_onderdeel").insert({
        avf_id: leegAvf!.id, fase, volgorde, naam, duur_minuten, beschrijving, sociale_veiligheid, fysieke_veiligheid,
        individu_moeilijker: leeg(individu_moeilijker), individu_makkelijker: leeg(individu_makkelijker),
        groep_moeilijker: leeg(groep_moeilijker), groep_makkelijker: leeg(groep_makkelijker),
        usv_uitdagend, usv_speelbaar, usv_veilig_aanvulling: leeg(usv_veilig_aanvulling),
      }).select(), `voorbeeld-onderdeel ${naam}`);
    }
  }

  // Bestaande auth-gebruikers ophalen (om dubbele aanmaak te voorkomen)
  const bestaand = new Map<string, string>();
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) { console.error("Gebruikers ophalen mislukt:", error.message); process.exit(1); }
    data.users.forEach((u) => u.email && bestaand.set(u.email, u.id));
    if (data.users.length < 200) break;
  }

  let nieuw = 0;
  let overgeslagen = 0;
  try {
    for (const a of basis.accounts) {
      const { data: rij } = await admin.from("account").select("id").eq("gebruikersnaam", a.gebruikersnaam).maybeSingle();
      if (rij) { overgeslagen++; continue; }

      const email = `${a.gebruikersnaam}@ardennen.invalid`;
      const wachtwoord = wachtwoorden[a.gebruikersnaam] ?? nieuwWachtwoord();
      let userId = bestaand.get(email);
      if (userId) {
        check(await admin.auth.admin.updateUserById(userId, { password: wachtwoord }).then(
          (r) => ({ data: r.data.user, error: r.error })), `wachtwoord ${a.gebruikersnaam}`);
      } else {
        const res = await admin.auth.admin.createUser({ email, password: wachtwoord, email_confirm: true });
        userId = check({ data: res.data.user, error: res.error }, `gebruiker ${a.gebruikersnaam}`).id;
      }
      wachtwoorden[a.gebruikersnaam] = wachtwoord;

      check(await admin.from("account").insert({
        id: userId, gebruikersnaam: a.gebruikersnaam, soort: a.soort,
        cluster_id: a.cluster ? clusterId[a.cluster] : null,
        projectgroep_id: a.projectgroep ? groepId[`${a.cluster}:${a.projectgroep}`] : null,
        stuurgroeprol_id: a.stuurgroeprol ? stuurrolId[`${a.cluster}:${a.stuurgroeprol}`] : null,
      }).select(), `account ${a.gebruikersnaam}`);
      nieuw++;
    }
  } finally {
    opslaanWachtwoorden();
  }

  console.log(`Klaar. Accounts nieuw: ${nieuw}, al aanwezig: ${overgeslagen}.`);
  console.log(`Wachtwoorden staan in ${wachtwoordPad} (niet in git).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
