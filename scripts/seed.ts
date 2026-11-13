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
import { randomInt } from "node:crypto";
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

  // Programma per cluster. Bestaande regels blijven staan, zodat wijzigingen van de stuurgroep niet worden overschreven.
  for (const c of basis.clusters) {
    let volgorde = 0;
    for (const dag of programma.dagen) {
      for (const r of dag.regels) {
        volgorde++;
        check(await admin.from("programma_regel").upsert({
          cluster_id: clusterId[c.code], volgorde, dag: dag.dag, starttijd: r.start, eindtijd: r.eind,
          soort: r.soort ?? "vast", titel: r.titel, omschrijving: r.omschrijving ?? null, locatie: r.locatie ?? null,
          deelnemers: r.deelnemers ?? [], rocks_rivers_groepen: r.rocks_rivers_groepen ?? [],
        }, { onConflict: "cluster_id,volgorde", ignoreDuplicates: true }).select(), `programma ${c.code} ${volgorde}`);
      }
    }
    // Voorlopige toewijzing: elke groep krijgt het tijdvak waarin zij volgens het programma organiseert
    const { data: regels } = await admin.from("programma_regel")
      .select("id, volgorde").eq("cluster_id", clusterId[c.code]).eq("soort", "belevenis");
    let nr = 0;
    const organisatorPerVolgorde = new Map<number, number>();
    for (const dag of programma.dagen) {
      for (const r of dag.regels) {
        nr++;
        if (r.soort === "belevenis") organisatorPerVolgorde.set(nr, r.organisator);
      }
    }
    for (const regel of regels ?? []) {
      const groepNr = organisatorPerVolgorde.get(regel.volgorde);
      const pgId = groepNr ? groepId[`${c.code}:${groepNr}`] : undefined;
      if (!pgId) continue;
      await admin.from("avf").update({ programma_regel_id: regel.id })
        .eq("projectgroep_id", pgId).is("programma_regel_id", null);
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
  console.log("Materialen volgen in opdracht 5 (tabel bestaat nog niet).");
}

main().catch((e) => { console.error(e); process.exit(1); });
