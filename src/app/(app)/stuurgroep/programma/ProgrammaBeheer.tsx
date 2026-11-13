"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";
import { kiesGroep, locatieOpslaan, regelOpslaan, type RegelVelden } from "./actions";
import { formatGroepNummers, type ProgrammaRegel } from "@/lib/programma";
import { formatDag, formatTijd } from "@/lib/tijd";

export interface GroepRij {
  avfId: string;
  nummer: number;
  naam: string;
  titel: string | null;
  regelId: string | null;
  locatie: string | null;
}

const NAAM_SLEUTEL = "backpack_programmanaam";
const INVOER = "w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst disabled:bg-achtergrond";
type Melding = { soort: "ok" | "fout" | "waarschuwing" | "bezig"; tekst: string };

function Melding({ m }: { m: Melding | null }) {
  if (!m) return <p aria-live="polite" className="min-h-6" />;
  return (
    <p aria-live="polite" role={m.soort === "fout" ? "alert" : undefined} className={`mt-1 min-h-6 text-sm font-medium ${m.soort === "fout" ? "text-fout" : "text-kop"}`}>
      {m.soort === "ok" && <Check aria-hidden className="mr-1 inline size-4" />}
      {m.soort === "waarschuwing" && <TriangleAlert aria-hidden className="mr-1 inline size-4" />}
      {m.tekst}
    </p>
  );
}

function Tijdvak({ r }: { r: ProgrammaRegel }) {
  return (
    <p className="text-sm font-medium text-zacht">
      {formatDag(r.dag)} · {formatTijd(r.starttijd)}–{formatTijd(r.eindtijd)}
    </p>
  );
}

/** Eén tijdvak voor een belevenis: kies de projectgroep en de locatie. */
function ToewijsKaart({ regel, groepen, naam }: { regel: ProgrammaRegel; groepen: GroepRij[]; naam: string }) {
  const router = useRouter();
  const bezetter = groepen.find((g) => g.regelId === regel.id) ?? null;
  const [keuze, setKeuze] = useState(bezetter?.avfId ?? "");
  const [melding, setMelding] = useState<Melding | null>(null);
  const [bezet, setBezet] = useState<{ avfId: string; door: string; kanWisselen: boolean } | null>(null);
  const [locatie, setLocatie] = useState(bezetter?.locatie ?? "");

  async function kies(avfId: string, wissel = false) {
    setKeuze(avfId);
    setBezet(null);
    setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
    const res = await kiesGroep(regel.id, avfId || null, naam, wissel);
    if (res.status === "ok") {
      setMelding({ soort: "ok", tekst: avfId ? "Toegewezen" : "Tijdvak is vrij" });
      router.refresh();
    } else if (res.status === "bezet") {
      setKeuze(bezetter?.avfId ?? "");
      setBezet({ avfId, door: res.door, kanWisselen: res.kanWisselen });
      setMelding({ soort: "waarschuwing", tekst: `Dit tijdvak is al van ${res.door}.` });
    } else {
      setKeuze(bezetter?.avfId ?? "");
      setMelding({ soort: "fout", tekst: res.melding });
    }
  }

  async function bewaarLocatie() {
    if (!bezetter || locatie.trim() === (bezetter.locatie ?? "")) return;
    setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
    const res = await locatieOpslaan(bezetter.avfId, locatie, naam);
    if (res.status === "ok") { setMelding({ soort: "ok", tekst: "Locatie opgeslagen" }); router.refresh(); }
    else setMelding({ soort: "fout", tekst: res.melding });
  }

  const id = `toewijzen-${regel.id}`;
  return (
    <div className="rounded-han border border-rand bg-vlak p-4">
      <p className="font-bold text-kop">{regel.titel}</p>
      <Tijdvak r={regel} />
      <p className="text-sm text-zacht">
        Doen mee: projectgroep {formatGroepNummers(regel.deelnemers)}
        {regel.rocks_rivers_groepen.length > 0 && ` · Rocks & Rivers: projectgroep ${formatGroepNummers(regel.rocks_rivers_groepen)}`}
      </p>

      <label htmlFor={id} className="mt-3 block font-bold text-kop">Organiserende projectgroep</label>
      <select id={id} value={keuze} onChange={(e) => void kies(e.target.value)} disabled={!naam.trim()} className={`${INVOER} min-h-aanraak`}>
        <option value="">Nog niet toegewezen</option>
        {groepen.map((g) => (
          <option key={g.avfId} value={g.avfId}>
            {g.naam}{g.titel ? ` · ${g.titel}` : ""}{g.regelId && g.regelId !== regel.id ? " (heeft al een tijdvak)" : ""}
          </option>
        ))}
      </select>

      {bezet && (
        <div role="alert" className="mt-2 rounded-han border-2 border-kop bg-vlak p-3">
          <p className="font-medium text-kop">
            Dit tijdvak is al van {bezet.door}.{" "}
            {bezet.kanWisselen ? "Je kunt de twee groepen van tijdvak laten wisselen." : "Maak het tijdvak eerst vrij of kies een groep die al een tijdvak heeft om te wisselen."}
          </p>
          {bezet.kanWisselen && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void kies(bezet.avfId, true)} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk">Wisselen</button>
              <button type="button" onClick={() => setBezet(null)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Annuleren</button>
            </div>
          )}
        </div>
      )}

      <label className="mt-3 block font-bold text-kop">
        Locatie
        <span className="block text-sm font-normal text-zacht">
          {regel.locatie ? `Programma: ${regel.locatie}. ` : ""}Vul hier de precieze plek in. Projectgroepen kunnen dit niet wijzigen.
        </span>
        <input
          value={locatie} onChange={(e) => setLocatie(e.target.value)} onBlur={() => void bewaarLocatie()}
          disabled={!bezetter || !naam.trim()} maxLength={120} placeholder={bezetter ? "Bijvoorbeeld: veld naast de camping" : "Wijs eerst een groep toe"}
          className={`${INVOER} mt-1 min-h-aanraak`}
        />
      </label>
      <Melding m={melding} />
    </div>
  );
}

function Chips({ label, waarde, onChange }: { label: string; waarde: number[]; onChange: (n: number[]) => void }) {
  return (
    <fieldset>
      <legend className="font-bold text-kop">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const aan = waarde.includes(n);
          return (
            <button
              key={n} type="button" aria-pressed={aan}
              onClick={() => onChange(aan ? waarde.filter((x) => x !== n) : [...waarde, n].sort())}
              className={`flex size-aanraak items-center justify-center rounded-han border-2 font-bold ${aan ? "border-kop bg-kop text-white" : "border-zacht bg-vlak text-kop"}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function naarVelden(r: ProgrammaRegel): RegelVelden {
  return {
    titel: r.titel, omschrijving: r.omschrijving ?? "", locatie: r.locatie ?? "", dag: r.dag,
    start: formatTijd(r.starttijd), eind: formatTijd(r.eindtijd), deelnemers: r.deelnemers, rocksRivers: r.rocks_rivers_groepen,
  };
}

/** Eén regel van het programma bewerken. Met het tijdstip van de laatste wijziging wordt een gelijktijdige wijziging herkend. */
function RegelFormulier({ regel, naam }: { regel: ProgrammaRegel; naam: string }) {
  const router = useRouter();
  const [v, setV] = useState<RegelVelden>(naarVelden(regel));
  const [verwacht, setVerwacht] = useState(regel.updated_at);
  const [melding, setMelding] = useState<Melding | null>(null);
  const [conflict, setConflict] = useState<ProgrammaRegel | null>(null);
  const set = <K extends keyof RegelVelden>(k: K, w: RegelVelden[K]) => setV((x) => ({ ...x, [k]: w }));

  async function bewaar() {
    setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
    const res = await regelOpslaan(regel.id, v, verwacht, naam);
    if (res.status === "ok") {
      setVerwacht(res.updatedAt);
      setConflict(null);
      setMelding({ soort: "ok", tekst: "Opgeslagen" });
      router.refresh();
    } else if (res.status === "conflict") {
      setConflict(res.huidig);
      setMelding({ soort: "waarschuwing", tekst: `${res.huidig.bijgewerkt_door_naam || "Iemand anders"} heeft deze regel net gewijzigd.` });
    } else {
      setMelding({ soort: "fout", tekst: res.melding });
    }
  }

  return (
    <details className="rounded-han border border-rand bg-vlak">
      <summary className="flex min-h-aanraak cursor-pointer items-center gap-3 p-3">
        <span className="rounded-han bg-kop px-2 py-1 text-sm font-bold text-white">{formatTijd(regel.starttijd)}–{formatTijd(regel.eindtijd)}</span>
        <span className="flex-1 font-bold text-kop">{regel.titel}</span>
        <span className="text-sm text-zacht">{formatDag(regel.dag).split(" ")[0]}</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-rand p-3">
        <label className="font-bold text-kop">Titel<input value={v.titel} onChange={(e) => set("titel", e.target.value)} maxLength={120} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
        <label className="font-bold text-kop">Toelichting<textarea value={v.omschrijving} onChange={(e) => set("omschrijving", e.target.value)} maxLength={300} rows={2} className={`${INVOER} mt-1 py-2`} /></label>
        <label className="font-bold text-kop">Locatie<input value={v.locatie} onChange={(e) => set("locatie", e.target.value)} maxLength={120} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
        <label className="font-bold text-kop">Dag<input type="date" value={v.dag} onChange={(e) => set("dag", e.target.value)} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="font-bold text-kop">Start<input type="time" value={v.start} onChange={(e) => set("start", e.target.value)} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
          <label className="font-bold text-kop">Einde<input type="time" value={v.eind} onChange={(e) => set("eind", e.target.value)} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
        </div>
        {regel.soort === "belevenis" && (
          <>
            <Chips label="Projectgroepen die meedoen" waarde={v.deelnemers} onChange={(n) => set("deelnemers", n)} />
            <Chips label="Projectgroepen met Rocks & Rivers" waarde={v.rocksRivers} onChange={(n) => set("rocksRivers", n)} />
          </>
        )}
        {conflict && (
          <div role="alert" className="rounded-han border-2 border-kop bg-vlak p-3">
            <p className="font-medium text-kop">
              Nu staat er: {conflict.titel}, {formatTijd(conflict.starttijd)}–{formatTijd(conflict.eindtijd)}. Wat wil je?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setV(naarVelden(conflict)); setVerwacht(conflict.updated_at); setConflict(null); setMelding(null); }} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
                Hun versie houden
              </button>
              <button type="button" onClick={() => { setVerwacht(conflict.updated_at); setConflict(null); void (async () => {
                setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
                const res = await regelOpslaan(regel.id, v, conflict.updated_at, naam);
                if (res.status === "ok") { setVerwacht(res.updatedAt); setMelding({ soort: "ok", tekst: "Opgeslagen" }); router.refresh(); }
                else setMelding({ soort: "fout", tekst: res.status === "fout" ? res.melding : "Opnieuw gewijzigd door iemand anders." });
              })(); }} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk">
                Mijn versie bewaren
              </button>
            </div>
          </div>
        )}
        <button type="button" onClick={() => void bewaar()} disabled={!naam.trim()} className="min-h-aanraak rounded-han bg-merk px-4 text-lg font-bold text-op-merk disabled:opacity-60">
          Opslaan
        </button>
        <Melding m={melding} />
      </div>
    </details>
  );
}

export function ProgrammaBeheer({ regels, groepen }: { regels: ProgrammaRegel[]; groepen: GroepRij[] }) {
  const [naam, setNaam] = useState("");
  useEffect(() => {
    try {
      // Eenmalig na het laden: opslag in de browser bestaat niet op de server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNaam(localStorage.getItem(NAAM_SLEUTEL) ?? "");
    } catch { /* niet erg */ }
  }, []);
  function wijzig(w: string) {
    setNaam(w);
    try { localStorage.setItem(NAAM_SLEUTEL, w); } catch { /* niet erg */ }
  }

  const slots = regels.filter((r) => r.soort === "belevenis");
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-han border border-rand bg-vlak p-4">
        <label className="flex flex-col gap-1 font-medium text-kop">
          Wie werkt hier? (jouw naam)
          <input value={naam} onChange={(e) => wijzig(e.target.value)} maxLength={60} autoComplete="off" placeholder="Bijvoorbeeld Sanne" className={`${INVOER} min-h-aanraak`} />
        </label>
        <p className="mt-2 text-sm text-zacht">Met je naam leggen we vast wie het programma heeft aangepast.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Groepen toewijzen aan de zes tijdvakken</h2>
        <p className="text-zacht">Elke projectgroep krijgt precies één tijdvak en elk tijdvak hoort bij één groep. Projectgroepen zien hun tijdvak en locatie, maar kunnen die niet wijzigen.</p>
        {slots.map((r) => (
          <ToewijsKaart key={`${r.id}:${groepen.find((g) => g.regelId === r.id)?.avfId ?? ""}`} regel={r} groepen={groepen} naam={naam} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Het hele programma aanpassen</h2>
        <p className="text-zacht">Tijden, titels en locaties van alle regels. Wijzigt een tijdvak, dan verschuift de belevenis in dat tijdvak mee.</p>
        {regels.map((r) => <RegelFormulier key={`${r.id}:${r.updated_at}`} regel={r} naam={naam} />)}
      </section>
    </div>
  );
}
