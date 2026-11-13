"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";
import { kiesGroep, locatieOpslaan } from "./actions";
import { ProgrammaRegels } from "./ProgrammaRegels";
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

const LOCATIES = ["Camping", "Bivak"] as const;
type LocatieKeuze = "" | (typeof LOCATIES)[number] | "Anders";

/** Een bewaarde locatie terugvertalen naar de keuze: camping, bivak of anders (met de ingevulde naam). */
function leesLocatie(w: string | null): { keuze: LocatieKeuze; anders: string } {
  const t = (w ?? "").trim();
  if (!t) return { keuze: "", anders: "" };
  const bekend = LOCATIES.find((l) => l.toLowerCase() === t.toLowerCase());
  return bekend ? { keuze: bekend, anders: "" } : { keuze: "Anders", anders: t };
}

/** Eén tijdvak voor een belevenis: kies de projectgroep en de locatie. */
function ToewijsKaart({ regel, groepen, naam }: { regel: ProgrammaRegel; groepen: GroepRij[]; naam: string }) {
  const router = useRouter();
  const bezetter = groepen.find((g) => g.regelId === regel.id) ?? null;
  const [keuze, setKeuze] = useState(bezetter?.avfId ?? "");
  const [melding, setMelding] = useState<Melding | null>(null);
  const [bezet, setBezet] = useState<{ avfId: string; door: string; kanWisselen: boolean } | null>(null);
  const startLocatie = leesLocatie(bezetter?.locatie ?? null);
  const [locKeuze, setLocKeuze] = useState<LocatieKeuze>(startLocatie.keuze);
  const [locAnders, setLocAnders] = useState(startLocatie.anders);

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

  async function bewaarLocatie(waarde: string) {
    if (!bezetter || waarde === (bezetter.locatie ?? "")) return;
    setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
    const res = await locatieOpslaan(bezetter.avfId, waarde, naam);
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
      <select id={id} value={keuze} onChange={(e) => void kies(e.target.value)} disabled={!naam.trim() || melding?.soort === "bezig"} className={`${INVOER} min-h-aanraak`}>
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

      <label htmlFor={`locatie-${regel.id}`} className="mt-3 block font-bold text-kop">Locatie</label>
      <p className="text-sm text-zacht">
        {regel.locatie ? `Programma: ${regel.locatie}. ` : ""}Kies camping, bivak of anders. Projectgroepen kunnen dit niet wijzigen.
      </p>
      <select
        id={`locatie-${regel.id}`} value={locKeuze} disabled={!bezetter || !naam.trim()}
        onChange={(e) => {
          const k = e.target.value as LocatieKeuze;
          setLocKeuze(k);
          if (k !== "Anders") void bewaarLocatie(k);
        }}
        className={`${INVOER} min-h-aanraak`}
      >
        <option value="">{bezetter ? "Nog niet gekozen" : "Wijs eerst een groep toe"}</option>
        <option value="Camping">Camping</option>
        <option value="Bivak">Bivak</option>
        <option value="Anders">Anders, namelijk…</option>
      </select>
      {locKeuze === "Anders" && (
        <label className="mt-2 block font-bold text-kop">
          Naam van de locatie
          <input
            id={`locatie-anders-${regel.id}`} value={locAnders} onChange={(e) => setLocAnders(e.target.value)}
            onBlur={() => { if (locAnders.trim()) void bewaarLocatie(locAnders.trim()); }}
            disabled={!bezetter || !naam.trim()} maxLength={120} placeholder="Bijvoorbeeld: veld naast de camping"
            className={`${INVOER} mt-1 min-h-aanraak`}
          />
        </label>
      )}
      <Melding m={melding} />
    </div>
  );
}

export function ProgrammaBeheer({ regels, groepen }: { regels: ProgrammaRegel[]; groepen: GroepRij[] }) {
  const [naam, setNaam] = useState("");
  const [bericht, setBericht] = useState<string | null>(null);
  useEffect(() => {
    if (!bericht) return;
    const t = setTimeout(() => setBericht(null), 9000);
    return () => clearTimeout(t);
  }, [bericht]);
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
        <p className="text-zacht">
          Tijden, titels en locaties van alle activiteiten, per dag. Verandert de eindtijd van een activiteit, dan schuiven de
          aansluitende activiteiten van die dag standaard mee, met een uitroepteken zodat iedereen ziet wat is aangepast.
          Je kunt vaste activiteiten toevoegen en verwijderen. De zes belevenisvakken van de projectgroepen blijven altijd staan.
        </p>
        <ProgrammaRegels regels={regels} groepen={groepen} naam={naam} onBericht={setBericht} />
      </section>

      {bericht && (
        <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-xl items-start gap-3 rounded-han bg-kop p-3 text-white shadow-lg md:bottom-6 md:left-64">
          <Check aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p className="flex-1 font-medium">{bericht}</p>
          <button type="button" onClick={() => setBericht(null)} className="min-h-aanraak px-2 font-bold underline">Sluiten</button>
        </div>
      )}
    </div>
  );
}
