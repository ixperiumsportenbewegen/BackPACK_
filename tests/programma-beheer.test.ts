/**
 * Programma beheren: tijden schuiven mee, activiteiten toevoegen en verwijderen, belevenisvakken blijven vast.
 * Draait op het TEST-cluster (account test-stuur) en zet alles daarna terug.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type Res = { ok: boolean; reden?: string; verschoven?: number; id?: string; updated_at?: string; aantal?: number };
interface Rij {
  id: string; volgorde: number; dag: string; starttijd: string; eindtijd: string; soort: string; titel: string;
  omschrijving: string | null; locatie: string | null; deelnemers: number[]; rocks_rivers_groepen: number[];
  oorspronkelijke_starttijd: string | null; oorspronkelijke_eindtijd: string | null; updated_at: string;
}

let TEST: string;
let beginstand: Rij[] = [];

async function lees(): Promise<Rij[]> {
  const { data } = await admin.from("programma_regel").select("*").eq("cluster_id", TEST).order("volgorde");
  return (data ?? []) as Rij[];
}

const hm = (t: string) => t.slice(0, 5);

/** Wijzigt een regel (standaard alleen de gegeven velden). */
async function wijzig(r: Rij, velden: Partial<{ titel: string; start: string; eind: string; dag: string; schuif: boolean; verwacht: string }>, naam = "Testpersoon") {
  const stuur = await inloggenAls("test-stuur");
  const { data, error } = await stuur.rpc("programma_regel_wijzigen", {
    p_id: r.id, p_titel: velden.titel ?? r.titel, p_omschrijving: r.omschrijving, p_locatie: r.locatie,
    p_dag: velden.dag ?? r.dag, p_start: velden.start ?? r.starttijd, p_eind: velden.eind ?? r.eindtijd,
    p_deelnemers: r.deelnemers, p_rocks_rivers: r.rocks_rivers_groepen,
    p_verwacht: velden.verwacht ?? r.updated_at, p_naam: naam, p_schuif: velden.schuif ?? true,
  });
  return { res: data as Res, error };
}

async function herstel() {
  // extra (vaste) activiteiten weg, volgorde en tijden terug naar het begin
  const nu = await lees();
  const extra = nu.filter((r) => !beginstand.some((b) => b.id === r.id));
  if (extra.length) await admin.from("programma_regel").delete().in("id", extra.map((e) => e.id));
  for (const [i, b] of beginstand.entries()) await admin.from("programma_regel").update({ volgorde: 1000 + i }).eq("id", b.id);
  for (const b of beginstand) {
    await admin.from("programma_regel").update({
      volgorde: b.volgorde, dag: b.dag, starttijd: b.starttijd, eindtijd: b.eindtijd, titel: b.titel,
      omschrijving: b.omschrijving, locatie: b.locatie, oorspronkelijke_starttijd: null, oorspronkelijke_eindtijd: null,
    }).eq("id", b.id);
  }
}

beforeAll(async () => {
  TEST = await clusterId("TEST");
  beginstand = await lees();
  expect(beginstand).toHaveLength(18);
  // een eerdere afgebroken run kan wijzigingen hebben achtergelaten: de beginstand moet het standaardprogramma zijn
  expect(beginstand.every((r) => r.oorspronkelijke_starttijd === null)).toBe(true);
});

afterAll(herstel);
// ook na een mislukte test begint de volgende met het standaardprogramma
afterEach(herstel);

describe("meeschuiven van tijden", () => {
  it("een andere eindtijd schuift de aansluitende activiteiten van die dag mee, met een markering", async () => {
    const [r1, r2, r3, r4, r5, r6] = beginstand.slice(0, 6);
    expect(hm(r1.eindtijd)).toBe("08:30");

    const { res } = await wijzig(r1, { eind: "09:00" });
    expect(res.ok).toBe(true);
    expect(res.verschoven).toBe(5);

    const nu = (await lees()).slice(0, 6);
    expect(nu.map((r) => `${hm(r.starttijd)}-${hm(r.eindtijd)}`)).toEqual([
      "08:00-09:00", "09:00-12:00", "12:00-13:00", "13:00-17:00", "17:00-20:00", "20:00-21:30",
    ]);
    // de duur blijft gelijk en elke aangepaste regel onthoudt de oorspronkelijke tijd
    expect(nu.map((r) => `${hm(r.oorspronkelijke_starttijd!)}-${hm(r.oorspronkelijke_eindtijd!)}`)).toEqual([
      `${hm(r1.starttijd)}-${hm(r1.eindtijd)}`, `${hm(r2.starttijd)}-${hm(r2.eindtijd)}`, `${hm(r3.starttijd)}-${hm(r3.eindtijd)}`,
      `${hm(r4.starttijd)}-${hm(r4.eindtijd)}`, `${hm(r5.starttijd)}-${hm(r5.eindtijd)}`, `${hm(r6.starttijd)}-${hm(r6.eindtijd)}`,
    ]);
    // andere dagen blijven staan
    const rest = (await lees()).slice(6);
    expect(rest.every((r) => r.oorspronkelijke_starttijd === null)).toBe(true);
    expect(rest.map((r) => r.starttijd)).toEqual(beginstand.slice(6).map((r) => r.starttijd));
  });

  it("terug naar de oorspronkelijke eindtijd haalt alle markeringen weg", async () => {
    const [r1] = await lees();
    const { res } = await wijzig(r1, { eind: beginstand[0].eindtijd });
    expect(res.ok).toBe(true);
    const nu = await lees();
    expect(nu.every((r) => r.oorspronkelijke_starttijd === null && r.oorspronkelijke_eindtijd === null)).toBe(true);
    expect(nu.slice(0, 6).map((r) => r.starttijd)).toEqual(beginstand.slice(0, 6).map((r) => r.starttijd));
  });

  it("zonder meeschuiven verandert alleen de eigen regel", async () => {
    const [r1] = await lees();
    const { res } = await wijzig(r1, { eind: "09:00", schuif: false });
    expect(res.ok).toBe(true);
    expect(res.verschoven).toBe(0);
    const nu = await lees();
    expect(hm(nu[0].eindtijd)).toBe("09:00");
    expect(nu[1].starttijd).toBe(beginstand[1].starttijd); // de volgende begint nog op de oude tijd
    expect(nu[0].oorspronkelijke_eindtijd).not.toBeNull();
    expect(nu[1].oorspronkelijke_starttijd).toBeNull();
    await herstel();
  });

  it("bij een gat in het programma stopt het meeschuiven", async () => {
    const [r1, , r3, r4] = await lees();
    // activiteit 4 begint een half uur later: tussen 3 en 4 zit nu een gat
    await wijzig(r4, { start: "13:00", schuif: false });
    const { res } = await wijzig(r1, { eind: "09:00" });
    expect(res.ok).toBe(true);
    expect(res.verschoven).toBe(2); // alleen 2 en 3
    const nu = await lees();
    expect(hm(nu[2].eindtijd)).toBe(hm(r3.eindtijd).replace("12:30", "13:00"));
    expect(hm(nu[3].starttijd)).toBe("13:00"); // 4 is gebleven
    await herstel();
  });

  it("past het meeschuiven niet meer in de dag, dan gebeurt er niets", async () => {
    const dag1 = (await lees()).slice(0, 6);
    // de laatste activiteit van de dag sluit aan op de vorige en eindigt om 23:00; drie uur opschuiven past niet meer
    await wijzig(dag1[5], { start: dag1[5].starttijd, eind: "23:00", schuif: false });
    const voor = await lees();
    const { res } = await wijzig(voor[0], { eind: "11:30" }); // 3 uur later
    expect(res.ok).toBe(false);
    expect(res.reden).toBe("past_niet");
    const na = await lees();
    expect(na.map((r) => `${r.starttijd}-${r.eindtijd}`)).toEqual(voor.map((r) => `${r.starttijd}-${r.eindtijd}`)); // niets half uitgevoerd
    await herstel();
  });

  it("een regel die intussen is gewijzigd wordt niet overschreven", async () => {
    const [r1] = await lees();
    const { res } = await wijzig(r1, { titel: "Verouderd", verwacht: "2020-01-01T00:00:00Z" });
    expect(res.ok).toBe(false);
    expect(res.reden).toBe("gewijzigd");
  });
});

describe("activiteiten toevoegen en verwijderen", () => {
  it("toevoegen na een activiteit schuift de volgende op; verwijderen schuift terug", async () => {
    const stuur = await inloggenAls("test-stuur");
    const [, r2] = await lees();
    const dag2 = (await lees()).filter((r) => r.dag !== r2.dag);

    const toe = await stuur.rpc("programma_regel_toevoegen", {
      p_na_regel_id: r2.id, p_titel: "Testactiviteit", p_omschrijving: "Even rusten", p_locatie: "Camping",
      p_start: r2.eindtijd, p_eind: "12:00", p_schuif: true, p_naam: "Testpersoon",
    });
    const res = toe.data as Res;
    expect(res.ok).toBe(true);
    expect(res.verschoven).toBe(4); // activiteit 3 t/m 6 een half uur later

    const nu = await lees();
    expect(nu).toHaveLength(19);
    const nieuw = nu.find((r) => r.id === res.id)!;
    expect(nieuw).toMatchObject({ titel: "Testactiviteit", soort: "vast", volgorde: r2.volgorde + 1 });
    expect(hm(nieuw.starttijd)).toBe("11:30");
    expect(nu.slice(0, 7).map((r) => `${hm(r.starttijd)}-${hm(r.eindtijd)}`)).toEqual([
      "08:00-08:30", "08:30-11:30", "11:30-12:00", "12:00-13:00", "13:00-17:00", "17:00-20:00", "20:00-21:30",
    ]);
    // de volgnummers lopen door zonder dubbelen
    expect(new Set(nu.map((r) => r.volgorde)).size).toBe(19);
    // andere dagen: alleen het volgnummer is opgeschoven, niet als wijziging geteld (updated_at blijft gelijk)
    const dag2Nu = nu.filter((r) => dag2.some((d) => d.id === r.id));
    expect(dag2Nu.map((r) => r.updated_at)).toEqual(dag2.map((r) => r.updated_at));

    // verwijderen met meeschuiven zet alles terug
    const weg = await stuur.rpc("programma_regel_verwijderen", { p_id: res.id, p_schuif: true, p_naam: "Testpersoon" });
    expect((weg.data as Res).ok).toBe(true);
    expect((weg.data as Res).verschoven).toBe(4);
    const terug = await lees();
    expect(terug).toHaveLength(18);
    expect(terug.slice(0, 6).map((r) => `${hm(r.starttijd)}-${hm(r.eindtijd)}`)).toEqual(
      beginstand.slice(0, 6).map((r) => `${hm(r.starttijd)}-${hm(r.eindtijd)}`),
    );
    await herstel();
  });

  it("verwijderen zonder meeschuiven laat een gat; toevoegen zonder meeschuiven verandert de rest niet", async () => {
    const stuur = await inloggenAls("test-stuur");
    const [, r2, r3] = await lees();
    const toe = (await stuur.rpc("programma_regel_toevoegen", {
      p_na_regel_id: r2.id, p_titel: "Testactiviteit", p_omschrijving: null, p_locatie: null,
      p_start: "11:30", p_eind: "12:00", p_schuif: false, p_naam: "Testpersoon",
    })).data as Res;
    expect(toe.ok).toBe(true);
    expect(toe.verschoven).toBe(0);
    const nu = await lees();
    expect(nu.find((r) => r.id === r3.id)!.starttijd).toBe(r3.starttijd);
    const weg = (await stuur.rpc("programma_regel_verwijderen", { p_id: toe.id, p_schuif: false, p_naam: "Testpersoon" })).data as Res;
    expect(weg.ok).toBe(true);
    expect(weg.verschoven).toBe(0);
    await herstel();
  });

  it("een ongeldige activiteit (eindtijd voor starttijd, geen titel, geen naam) wordt geweigerd", async () => {
    const stuur = await inloggenAls("test-stuur");
    const [r1] = await lees();
    const basis = { p_na_regel_id: r1.id, p_titel: "Test", p_omschrijving: null, p_locatie: null, p_start: "09:00", p_eind: "10:00", p_schuif: false, p_naam: "Testpersoon" };
    expect(((await stuur.rpc("programma_regel_toevoegen", { ...basis, p_eind: "08:00" })).data as Res).ok).toBe(false);
    expect(((await stuur.rpc("programma_regel_toevoegen", { ...basis, p_titel: " " })).data as Res).ok).toBe(false);
    expect(((await stuur.rpc("programma_regel_toevoegen", { ...basis, p_naam: " " })).data as Res).reden).toBe("naam");
    expect(await lees()).toHaveLength(18);
  });
});

describe("belevenisvakken blijven vast", () => {
  it("een belevenisvak kan niet worden verwijderd, ook niet door de stuurgroep of de docent", async () => {
    const vak = beginstand.find((r) => r.soort === "belevenis")!;
    for (const naam of ["test-stuur", "docent"]) {
      const res = (await (await inloggenAls(naam)).rpc("programma_regel_verwijderen", { p_id: vak.id, p_schuif: true, p_naam: "Testpersoon" })).data as Res;
      expect(res.ok, naam).toBe(false);
      expect(res.reden, naam).toBe("vast_vak");
    }
    // ook rechtstreeks in de database is het beschermd
    const direct = await admin.from("programma_regel").delete().eq("id", vak.id);
    expect(direct.error).not.toBeNull();
    expect((await lees()).some((r) => r.id === vak.id)).toBe(true);
  });

  it("de soort van een regel kan niet veranderen", async () => {
    const vak = beginstand.find((r) => r.soort === "belevenis")!;
    const upd = await admin.from("programma_regel").update({ soort: "vast" }).eq("id", vak.id);
    expect(upd.error).not.toBeNull();
    const vast = beginstand.find((r) => r.soort === "vast")!;
    expect((await admin.from("programma_regel").update({ soort: "belevenis" }).eq("id", vast.id)).error).not.toBeNull();
  });

  it("de tijd van een belevenisvak mag wel worden aangepast en schuift de koppeling mee", async () => {
    const vak = (await lees()).find((r) => r.soort === "belevenis")!;
    const { res } = await wijzig(vak, { start: "20:00", eind: "21:30", schuif: false });
    expect(res.ok).toBe(true);
    const nu = (await lees()).find((r) => r.id === vak.id)!;
    expect(hm(nu.starttijd)).toBe("20:00");
    expect(nu.oorspronkelijke_starttijd).not.toBeNull();
    await herstel();
  });

  it("de koppeling met de projectgroep blijft bestaan na verschuiven (de groep behoudt haar tijdvak)", async () => {
    const vak = beginstand.find((r) => r.soort === "belevenis")!;
    const { data: voor } = await admin.from("avf").select("id").eq("programma_regel_id", vak.id).maybeSingle();
    expect(voor).not.toBeNull();
    await wijzig((await lees()).find((r) => r.id === vak.id)!, { eind: "21:15", schuif: false });
    const { data: na } = await admin.from("avf").select("id").eq("programma_regel_id", vak.id).maybeSingle();
    expect(na?.id).toBe(voor!.id);
    await herstel();
  });
});

describe("wijzigingen bevestigen en rechten", () => {
  it("bevestigen haalt het uitroepteken weg zonder de tijden te veranderen", async () => {
    const [r1] = await lees();
    await wijzig(r1, { eind: "09:00" });
    const stuur = await inloggenAls("test-stuur");
    const bev = (await stuur.rpc("programma_wijzigingen_bevestigen", { p_cluster_id: TEST, p_regel_id: null, p_naam: "Testpersoon" })).data as Res;
    expect(bev.ok).toBe(true);
    expect(bev.aantal).toBe(6);
    const nu = await lees();
    expect(nu.every((r) => r.oorspronkelijke_starttijd === null)).toBe(true);
    expect(hm(nu[0].eindtijd)).toBe("09:00"); // de nieuwe tijden blijven
    await herstel();
  });

  it("alleen de stuurgroep van het cluster en de docent kunnen deze functies gebruiken", async () => {
    const [r1] = await lees();
    const aanroepen = (client: ReturnType<typeof anoniem>) => [
      client.rpc("programma_regel_wijzigen", {
        p_id: r1.id, p_titel: "X", p_omschrijving: null, p_locatie: null, p_dag: r1.dag, p_start: r1.starttijd, p_eind: r1.eindtijd,
        p_deelnemers: [], p_rocks_rivers: [], p_verwacht: r1.updated_at, p_naam: "X", p_schuif: true,
      }),
      client.rpc("programma_regel_toevoegen", { p_na_regel_id: r1.id, p_titel: "X", p_omschrijving: null, p_locatie: null, p_start: "09:00", p_eind: "10:00", p_schuif: false, p_naam: "X" }),
      client.rpc("programma_regel_verwijderen", { p_id: r1.id, p_schuif: false, p_naam: "X" }),
      client.rpc("programma_wijzigingen_bevestigen", { p_cluster_id: TEST, p_regel_id: null, p_naam: "X" }),
    ];
    for (const naam of ["test-groep-1", "test-student", "vd-stuur-programma", "vc-stuur-programma"]) {
      for (const p of aanroepen(await inloggenAls(naam))) expect((await p).error, naam).not.toBeNull();
    }
    for (const p of aanroepen(anoniem())) expect((await p).error).not.toBeNull();
    expect(await lees()).toHaveLength(18);
    expect((await lees())[0].titel).toBe(beginstand[0].titel);
  });

  it("niemand kan de hulpfunctie voor het schuiven rechtstreeks aanroepen", async () => {
    const res = await (await inloggenAls("test-stuur")).rpc("programma_schuiven", { p_cluster_id: TEST, p_dag: "2027-06-28", p_na_volgorde: 0, p_oud_eind: "08:00", p_delta_min: 60 });
    expect(res.error).not.toBeNull();
  });
});
