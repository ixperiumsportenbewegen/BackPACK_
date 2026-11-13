import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AVF_VELDEN, SECTIES, eigenarenVanSectie } from "@/config/avf-velden";
import { PROJECTGROEPROLLEN } from "@/config/projectgroeprollen";
import {
  alleOntbrekend, legeInhoud, samenvatting, sectieVoortgang, voortgangPerSectie, type AvfInhoud, type FaseCode,
} from "@/lib/avfVoortgang";

describe("veldenlijst en docs/avf-velden.md lopen gelijk", () => {
  const docs = readFileSync("docs/avf-velden.md", "utf8");
  const docSleutels = new Set<string>();
  for (const regel of docs.split(/\r?\n/)) {
    if (!regel.startsWith("| `")) continue;
    const eersteKolom = (regel.split("|")[1] ?? "").replace(/\([^)]*\)/g, "");
    for (const m of eersteKolom.matchAll(/`([^`]+)`/g)) docSleutels.add(m[1]);
  }
  const configSleutels = new Set(AVF_VELDEN.flatMap((v) => v.docSleutels ?? [v.sleutel]));

  it("elk veld uit de docs staat in de veldenlijst", () => {
    const ontbreekt = [...docSleutels].filter((s) => !configSleutels.has(s));
    expect(ontbreekt).toEqual([]);
  });

  it("elk veld uit de veldenlijst staat in de docs", () => {
    const extra = [...configSleutels].filter((s) => !docSleutels.has(s));
    expect(extra).toEqual([]);
  });

  it("sleutels zijn uniek per niveau en rollen bestaan", () => {
    const sleutels = AVF_VELDEN.map((v) => `${v.niveau}:${v.sleutel}`);
    expect(new Set(sleutels).size).toBe(sleutels.length);
    const pgRollen = new Set<string>(PROJECTGROEPROLLEN.map((r) => r.code));
    for (const v of AVF_VELDEN) {
      if (v.pgRol) expect(pgRollen.has(v.pgRol), v.sleutel).toBe(true);
      expect(SECTIES.some((s) => s.code === v.sectie), v.sleutel).toBe(true);
    }
  });

  it("de koppeling met PACK klopt met de stuurgroeprollen", () => {
    const pack: Record<string, string> = {
      projectleiding: "K", programma_kwaliteit: "A", beleving_thema: "A",
      veiligheid_welzijn: "P", logistiek_facilitair: "P", communicatie_financien: "C",
    };
    for (const v of AVF_VELDEN) {
      if (v.sgRol && v.pack) expect(v.pack, v.sleutel).toBe(pack[v.sgRol]);
    }
  });

  it("elke sectie heeft minstens één eigenaar behalve niets", () => {
    for (const s of SECTIES) expect(eigenarenVanSectie(s.code).length, s.code).toBeGreaterThan(0);
  });

  it("wezenlijke velden zijn aangemerkt zoals in de docs (W ✔)", () => {
    const wezenlijk = AVF_VELDEN.filter((v) => v.wezenlijk).map((v) => v.sleutel).sort();
    expect(wezenlijk).toEqual([
      "avf_materiaal", "avf_materiaal.aanvullend", "fysieke_veiligheid", "onderdelen", "veiligheid.ehbo.aanvullend",
      "veiligheid.ehbo.maatregelen", "veiligheid.risicos[]", "veiligheid.weer.*", "verschijningsvorm",
    ].sort());
  });
});

// Een volledig ingevuld AVF volgens het voorbeeld
function volledig(): AvfInhoud {
  const voorbeeld = JSON.parse(readFileSync("seed/avf-voorbeeld.json", "utf8"));
  const inhoud: AvfInhoud = {
    titel: voorbeeld.titel, verschijningsvorm: voorbeeld.verschijningsvorm,
    publieke_samenvatting: voorbeeld.publieke_samenvatting, organiserende_studenten: voorbeeld.organiserende_studenten,
    doelgroep: voorbeeld.doelgroep, aantal_deelnemers: voorbeeld.aantal_deelnemers, contactpersoon: voorbeeld.contactpersoon,
    beginsituatie: voorbeeld.beginsituatie, doelen: voorbeeld.doelen, veiligheid: voorbeeld.veiligheid,
    organisatie: voorbeeld.organisatie, communicatie: voorbeeld.communicatie,
    fasen: voorbeeld.fasen, onderdelen: voorbeeld.onderdelen, rollenIngevuld: 6,
  };
  return inhoud;
}

describe("voortgang per sectie", () => {
  it("een leeg AVF is overal niet gestart (F telt niet mee)", () => {
    const v = voortgangPerSectie(legeInhoud());
    for (const s of v) expect(s.status, s.sectie).toBe(s.sectie === "F" ? "nvt" : "niet_gestart");
    expect(samenvatting(v)).toEqual({ compleet: 0, totaal: 7 });
  });

  it("het voorbeeld-AVF is compleet", () => {
    const v = voortgangPerSectie(volledig());
    expect(alleOntbrekend(v)).toEqual([]);
    expect(samenvatting(v)).toEqual({ compleet: 7, totaal: 7 });
  });

  it("sectie A is onvolledig met alleen een titel en noemt wat ontbreekt", () => {
    const i = legeInhoud();
    i.titel = "Mijn belevenis";
    const a = sectieVoortgang("A", i);
    expect(a.status).toBe("onvolledig");
    expect(a.ontbrekend.map((o) => o.sleutel)).toEqual(
      expect.arrayContaining(["verschijningsvorm", "publieke_samenvatting", "organiserende_studenten", "doelgroep", "aantal_deelnemers", "contactpersoon"]),
    );
    expect(a.ontbrekend.map((o) => o.sleutel)).not.toContain("titel");
  });

  it("spaties tellen niet als ingevuld", () => {
    const i = legeInhoud();
    i.titel = "   ";
    expect(sectieVoortgang("A", i).status).toBe("niet_gestart");
  });

  it("B en C vragen minstens één domein of doel", () => {
    const i = volledig();
    i.beginsituatie = { algemeen: "Tien studenten" };
    expect(sectieVoortgang("B", i).status).toBe("onvolledig");
    i.beginsituatie = { algemeen: "Tien studenten", cognitief: "6 van de 10 ..." };
    expect(sectieVoortgang("B", i).status).toBe("compleet");
    i.doelen = { persoonlijk: [{ id: "1", naam: "A", doel: "B" }] };
    expect(sectieVoortgang("C", i).status).toBe("onvolledig"); // alleen persoonlijke leerdoelen is niet genoeg
    i.doelen = { motorisch: "8 van de 10 ..." };
    expect(sectieVoortgang("C", i).status).toBe("compleet");
  });

  it("D vraagt per fase velden, opruimen met alle zes W's en onderdelen met fysieke veiligheid", () => {
    const i = volledig();
    expect(sectieVoortgang("D", i).status).toBe("compleet");

    const zonderStaart = { ...i, onderdelen: i.onderdelen.filter((o) => o.fase !== "staart") };
    const s = sectieVoortgang("D", zonderStaart);
    expect(s.status).toBe("onvolledig");
    expect(s.ontbrekend.map((o) => o.melding)).toContain("Staart: minstens één onderdeel");

    const zonderVeilig = { ...i, onderdelen: i.onderdelen.map((o, n) => (n === 0 ? { ...o, fysieke_veiligheid: "" } : o)) };
    expect(sectieVoortgang("D", zonderVeilig).ontbrekend.map((o) => o.melding).join("|")).toContain("fysieke veiligheid");

    const opruimen = { ...i, fasen: i.fasen.map((f) => (f.fase === ("kop" as FaseCode) ? { ...f, opruimen: { wie: "Allen" } } : f)) };
    expect(sectieVoortgang("D", opruimen).ontbrekend.map((o) => o.melding).join("|")).toContain("Kop: opruimen, nog in te vullen");
  });

  it("E vraagt alle vier weerscenario's, risico's en de EHBO-vraag", () => {
    const i = volledig();
    expect(sectieVoortgang("E", i).status).toBe("compleet");

    // niet relevant is een geldige afweging
    const weer = (i.veiligheid.weer as Record<string, unknown>);
    expect((weer.koel as { relevant: boolean }).relevant).toBe(false);

    // één scenario niet afgewogen
    const v = JSON.parse(JSON.stringify(i.veiligheid));
    delete v.weer.koel.relevant;
    expect(sectieVoortgang("E", { ...i, veiligheid: v }).ontbrekend.map((o) => o.melding)).toContain('Weer "Koel": afwegen (wel of niet relevant)');

    // relevant maar zonder stopcriterium
    const v2 = JSON.parse(JSON.stringify(i.veiligheid));
    v2.weer.onweer.stopcriterium = "";
    expect(sectieVoortgang("E", { ...i, veiligheid: v2 }).ontbrekend.map((o) => o.melding).join("|")).toContain("stopcriterium");

    // EHBO ja zonder maatregelen, en EHBO nee is geldig
    const v3 = JSON.parse(JSON.stringify(i.veiligheid));
    v3.ehbo = { aanvullend: true, maatregelen: "" };
    expect(sectieVoortgang("E", { ...i, veiligheid: v3 }).status).toBe("onvolledig");
    v3.ehbo = { aanvullend: false };
    expect(sectieVoortgang("E", { ...i, veiligheid: v3 }).status).toBe("compleet");

    const geenRisico = { ...i, veiligheid: { ...i.veiligheid, risicos: [] } };
    expect(sectieVoortgang("E", geenRisico).ontbrekend.map((o) => o.melding)).toContain("Minstens één risico met maatregel");
  });

  it("G vraagt de thema-bijdrage, alle zes rollen en de allergievraag bij catering", () => {
    const i = volledig();
    expect(sectieVoortgang("G", i).status).toBe("compleet");
    expect(sectieVoortgang("G", { ...i, rollenIngevuld: 5 }).status).toBe("onvolledig");
    const zonderAllergie = { ...i, organisatie: { ...i.organisatie, allergieen_rekening_gehouden: undefined } };
    expect(sectieVoortgang("G", zonderAllergie).ontbrekend.map((o) => o.sleutel)).toContain("organisatie.allergieen_rekening_gehouden");
    const zonderCatering = { ...i, organisatie: { bijdrage_thema: "x" } };
    expect(sectieVoortgang("G", zonderCatering).status).toBe("compleet");
  });

  it("H vraagt voor en tijdens, na is optioneel", () => {
    const i = volledig();
    expect(sectieVoortgang("H", { ...i, communicatie: { voor: "a", tijdens: "b" } }).status).toBe("compleet");
    expect(sectieVoortgang("H", { ...i, communicatie: { voor: "a" } }).status).toBe("onvolledig");
  });
});
