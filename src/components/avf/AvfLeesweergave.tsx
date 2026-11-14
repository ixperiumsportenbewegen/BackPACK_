/* eslint-disable @next/next/no-img-element */
import { OPRUIMEN_VELDEN, WEER_SCENARIOS, WEER_VELDEN, SECTIES } from "@/config/avf-velden";
import { PROJECTGROEPROLLEN } from "@/config/projectgroeprollen";
import type { AvfGegevens } from "@/lib/avfData";
import { isGevuld, type Json } from "@/lib/avfVoortgang";
import { euro } from "@/lib/budgetTypes";
import { formatTijdvak } from "@/lib/tijd";
import { VerzoekSectie, type VerzoekContext } from "@/components/avf/VerzoekSectie";

const FASEN = [{ code: "kop", naam: "Kop" }, { code: "romp", naam: "Romp" }, { code: "staart", naam: "Staart" }] as const;
const tekst = (w: unknown) => (isGevuld(w) ? String(w) : "");

function Rij({ label, waarde }: { label: string; waarde: React.ReactNode }) {
  return (
    <div className="break-inside-avoid">
      <dt className="text-sm font-bold text-kop">{label}</dt>
      <dd className="whitespace-pre-wrap text-tekst">{waarde || <span className="text-zacht">–</span>}</dd>
    </div>
  );
}

function Blok({ code, children, onder }: { code: string; children: React.ReactNode; onder?: React.ReactNode }) {
  const s = SECTIES.find((x) => x.code === code)!;
  return (
    <section id={`sectie-${code}`} className="break-inside-avoid-page scroll-mt-24">
      <h2 className="border-b-2 border-kop pb-1 text-2xl">
        <span className="text-merk">{code}</span> · {s.naam}
      </h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
      {onder}
    </section>
  );
}

function Afbeelding({ pad, bijschrift }: { pad: string | null; bijschrift: string | null }) {
  if (!pad) return null;
  return (
    <figure className="break-inside-avoid">
      <img src={`/api/avf/${pad}`} alt={bijschrift || "Afbeelding bij het AVF"} className="max-h-80 w-auto max-w-full rounded-han border border-rand object-contain" />
      {bijschrift && <figcaption className="text-sm text-zacht">{bijschrift}</figcaption>}
    </figure>
  );
}

/** Het volledige AVF als leesbare pagina die goed afdrukt (opslaan als PDF via de browser). */
export function AvfLeesweergave({ avf, verzoeken }: { avf: AvfGegevens; verzoeken?: VerzoekContext }) {
  const onder = (sectie: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H") => (verzoeken ? <VerzoekSectie ctx={verzoeken} sectie={sectie} /> : null);
  const i = avf.inhoud;
  const bs = i.beginsituatie as Json;
  const dl = i.doelen as Json;
  const v = i.veiligheid as Json;
  const g = i.organisatie as Json;
  const h = i.communicatie as Json;
  const persoonlijk = (dl.persoonlijk as { naam?: string; doel?: string }[] | undefined) ?? [];
  const risicos = (v.risicos as { risico?: string; maatregel?: string; wie?: string }[] | undefined) ?? [];
  const weer = (v.weer as Record<string, Json> | undefined) ?? {};
  const ehbo = (v.ehbo as Json | undefined) ?? {};

  return (
    <div className="flex flex-col gap-8">
      <Blok code="A" onder={onder("A")}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Rij label="Titel" waarde={tekst(i.titel)} />
          <Rij label="Verschijningsvorm" waarde={tekst(i.verschijningsvorm)} />
          <Rij label="Korte omschrijving voor andere groepen" waarde={tekst(i.publieke_samenvatting)} />
          <Rij label="Organiserende studenten" waarde={tekst(i.organiserende_studenten)} />
          <Rij label="Doelgroep" waarde={tekst(i.doelgroep)} />
          <Rij label="Aantal deelnemers" waarde={tekst(i.aantal_deelnemers)} />
          <Rij label="Contactpersoon" waarde={tekst(i.contactpersoon)} />
          <Rij label="Tijdvak" waarde={avf.tijdvak ? formatTijdvak(avf.tijdvak) : "Nog niet ingepland"} />
          <Rij label="Locatie" waarde={tekst(avf.locatie)} />
        </dl>
      </Blok>

      <Blok code="B" onder={onder("B")}>
        <dl className="flex flex-col gap-3">
          <Rij label="Algemene omschrijving van de groep" waarde={tekst(bs.algemeen)} />
          <Rij label="Motorische beginsituatie" waarde={tekst(bs.motorisch)} />
          <Rij label="Cognitieve beginsituatie" waarde={tekst(bs.cognitief)} />
          <Rij label="Sociaal-emotionele beginsituatie" waarde={tekst(bs.sociaal_emotioneel)} />
        </dl>
      </Blok>

      <Blok code="C" onder={onder("C")}>
        <dl className="flex flex-col gap-3">
          <Rij label="Motorisch doel" waarde={tekst(dl.motorisch)} />
          <Rij label="Cognitief doel" waarde={tekst(dl.cognitief)} />
          <Rij label="Sociaal-emotioneel doel" waarde={tekst(dl.sociaal_emotioneel)} />
          <Rij
            label="Persoonlijke leerdoelen"
            waarde={persoonlijk.length ? (
              <ul className="list-disc pl-5">
                {persoonlijk.map((p, n) => <li key={n}><strong>{p.naam || "Naam onbekend"}:</strong> {p.doel}</li>)}
              </ul>
            ) : ""}
          />
        </dl>
      </Blok>

      <Blok code="D" onder={onder("D")}>
        {FASEN.map((fase) => {
          const f = avf.fasen.find((x) => x.fase === fase.code)!;
          const onderdelen = avf.onderdelen.filter((o) => o.fase === fase.code);
          return (
            <div key={fase.code} className="flex flex-col gap-3">
              <h3 className="mt-2 text-xl">{fase.naam}</h3>
              <dl className="flex flex-col gap-3">
                <Rij label="Organisatievorm" waarde={tekst(f.organisatievorm)} />
                <Afbeelding pad={f.overzichtstekening_pad} bijschrift={f.overzichtstekening_bijschrift} />
                <Rij label="Coachen en instructies" waarde={tekst(f.coachen_instructies)} />
                <Rij label="Stemgebruik en houding" waarde={tekst(f.stemgebruik_houding)} />
                <Rij
                  label="Opruimen (6 W's)"
                  waarde={OPRUIMEN_VELDEN.map((w) => `${w.label}: ${tekst((f.opruimen as Json)?.[w.sleutel]) || "–"}`).join("\n")}
                />
              </dl>
              {onderdelen.length === 0 && <p className="text-zacht">Geen onderdelen.</p>}
              {onderdelen.map((o, n) => {
                const nvt = new Set(o.niet_van_toepassing ?? []);
                const veld = (sleutel: string) => (nvt.has(sleutel) ? "Niet van toepassing" : tekst(o[sleutel]));
                return (
                  <article key={o.id} className="break-inside-avoid rounded-han border border-rand p-3">
                    <h4 className="text-lg font-bold text-kop">{n + 1}. {tekst(o.naam) || "Onderdeel zonder naam"} {o.duur_minuten ? `· ${o.duur_minuten} min` : ""}</h4>
                    <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                      <Rij label="Beschrijving" waarde={tekst(o.beschrijving)} />
                      <Rij label="Sociale veiligheid" waarde={veld("sociale_veiligheid")} />
                      <Rij label="Fysieke veiligheid" waarde={tekst(o.fysieke_veiligheid)} />
                      <Rij label="Individu moeilijker" waarde={veld("individu_moeilijker")} />
                      <Rij label="Individu makkelijker" waarde={veld("individu_makkelijker")} />
                      <Rij label="Groep moeilijker" waarde={veld("groep_moeilijker")} />
                      <Rij label="Groep makkelijker" waarde={veld("groep_makkelijker")} />
                      <Rij label="USV: uitdagend" waarde={veld("usv_uitdagend")} />
                      <Rij label="USV: speelbaar" waarde={veld("usv_speelbaar")} />
                      <Rij label="USV: veilig" waarde={[tekst(o.fysieke_veiligheid), veld("usv_veilig_aanvulling") && `Aanvulling: ${veld("usv_veilig_aanvulling")}`].filter(Boolean).join("\n")} />
                    </dl>
                    <div className="mt-2"><Afbeelding pad={o.afbeelding_pad} bijschrift={o.afbeelding_bijschrift} /></div>
                    {verzoeken && <VerzoekSectie ctx={verzoeken} sectie="D" onderdeelId={o.id} />}
                  </article>
                );
              })}
            </div>
          );
        })}
      </Blok>

      <Blok code="E" onder={onder("E")}>
        <dl className="flex flex-col gap-3">
          <Rij
            label="Risico's"
            waarde={risicos.length ? (
              <table className="w-full border-collapse text-left text-sm">
                <thead><tr><th className="border border-rand p-1">Risico</th><th className="border border-rand p-1">Maatregel</th><th className="border border-rand p-1">Wie</th></tr></thead>
                <tbody>
                  {risicos.map((r, n) => (
                    <tr key={n}><td className="border border-rand p-1">{r.risico}</td><td className="border border-rand p-1">{r.maatregel}</td><td className="border border-rand p-1">{r.wie}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : ""}
          />
          {WEER_SCENARIOS.map((s) => {
            const sc = weer[s.sleutel] ?? {};
            return (
              <Rij
                key={s.sleutel}
                label={`Weer: ${s.label}`}
                waarde={
                  sc.relevant === true
                    ? WEER_VELDEN.map((f) => `${f.label}: ${tekst(sc[f.sleutel]) || "–"}`).join("\n")
                    : sc.relevant === false ? "Niet relevant" : "Nog niet afgewogen"
                }
              />
            );
          })}
          <Rij
            label="Aanvullende EHBO-maatregelen"
            waarde={ehbo.aanvullend === true ? tekst(ehbo.maatregelen) || "Ja" : ehbo.aanvullend === false ? "Nee: het algemene EHBO-plan geldt" : ""}
          />
        </dl>
      </Blok>

      <Blok code="G" onder={onder("G")}>
        <dl className="flex flex-col gap-3">
          <Rij label="Bijdrage aan het meerdaagsethema" waarde={tekst(g.bijdrage_thema)} />
          <Rij label="Samenhang met het programma" waarde={tekst(g.samenhang)} />
          <Rij
            label="Rolverdeling"
            waarde={PROJECTGROEPROLLEN.map((r) => `${r.naam}: ${tekst(avf.rolverdeling.find((x) => x.rol === r.code)?.namen) || "–"}`).join("\n")}
          />
          <Rij label="Afstemming met anderen" waarde={tekst(g.afstemming)} />
          <Rij label="Vervoer" waarde={tekst(g.vervoer)} />
          <Rij label="Opbouw en afbouw" waarde={tekst(g.opbouw_afbouw)} />
          <Rij label="Eten en drinken, uitgifte" waarde={tekst(g.catering)} />
          <Rij label="Rekening gehouden met allergieën" waarde={g.allergieen_rekening_gehouden === true ? "Ja" : g.allergieen_rekening_gehouden === false ? "Nee" : ""} />
          <Rij label="Corvee en schoonmaakrooster" waarde={tekst(g.corvee)} />
        </dl>
      </Blok>

      <Blok code="H" onder={onder("H")}>
        <dl className="flex flex-col gap-3">
          <Rij label="Voor" waarde={tekst(h.voor)} />
          <Rij label="Tijdens" waarde={tekst(h.tijdens)} />
          <Rij label="Na" waarde={tekst(h.na)} />
        </dl>
      </Blok>

      <Blok code="F" onder={onder("F")}>
        <dl className="flex flex-col gap-3">
          <Rij
            label="Materialen"
            waarde={avf.materialen.length ? (
              <ul className="list-disc pl-5">
                {avf.materialen.map((m) => (
                  <li key={m.id}>
                    {m.naam}: {m.aantalGecorrigeerd ?? m.aantal}
                    {m.aantalGecorrigeerd !== null && ` (gecorrigeerd van ${m.aantal})`}
                    {m.fase ? ` · ${m.fase}` : ""}{m.eigen ? " · eigen materiaal" : ""}
                  </li>
                ))}
              </ul>
            ) : ""}
          />
          <Rij
            label="Financieel plan"
            waarde={avf.financieelPlan && avf.financieelPlan.regels.length ? (
              <table className="w-full border-collapse text-left text-sm">
                <tbody>
                  {avf.financieelPlan.regels.map((r, n) => (
                    <tr key={n}><td className="border border-rand p-1">{r.omschrijving}</td><td className="w-24 border border-rand p-1 text-right">{euro(r.bedrag)}</td></tr>
                  ))}
                  <tr><th scope="row" className="border border-rand p-1 text-left">Totaal</th><td className="border border-rand p-1 text-right font-bold">{euro(avf.financieelPlan.totaal)}</td></tr>
                </tbody>
              </table>
            ) : ""}
          />
        </dl>
      </Blok>
    </div>
  );
}
