"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  regelOpslaan, regelToevoegen, regelVerwijderen, wijzigingenBevestigen,
  type NieuweActiviteit, type RegelVelden,
} from "./actions";
import { isAangepast, type ProgrammaRegel } from "@/lib/programma";
import { berekenVerschuiving, naarMinuten, naarTijd, type Verschuiving } from "@/lib/programmaSchuiven";
import { formatDag, formatTijd } from "@/lib/tijd";

export interface GroepInfo {
  avfId: string;
  nummer: number;
  naam: string;
  titel: string | null;
  regelId: string | null;
}

const INVOER = "w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst disabled:bg-achtergrond";
const DAGKLEUREN = ["bg-han-oranje", "bg-han-groen", "bg-han-blauw"] as const;
type Melding = { soort: "ok" | "fout" | "waarschuwing" | "bezig"; tekst: string };

/** Het uitroepteken bij aangepaste tijden (met tekst voor schermlezers; nooit alleen een kleur). */
function Uitroepteken() {
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-kop font-heading text-sm font-black text-white" title="Tijd aangepast">
      <span aria-hidden>!</span>
      <span className="sr-only">Tijd aangepast</span>
    </span>
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

/** Laat zien welke volgende activiteiten meeschuiven, voordat je opslaat. */
function Voorbeeld({ verschoven, pastNiet }: { verschoven: Verschuiving[]; pastNiet: boolean }) {
  if (pastNiet) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-han border-2 border-kop bg-vlak p-3 font-medium text-kop">
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        Het meeschuiven past niet meer binnen de dag. Schuif minder op, of zet meeschuiven uit.
      </p>
    );
  }
  if (verschoven.length === 0) return null;
  return (
    <div className="rounded-han border-2 border-kop bg-vlak p-3" aria-live="polite">
      <p className="font-bold text-kop">Zo schuiven de volgende activiteiten mee (met een uitroepteken):</p>
      <ul className="mt-1 text-sm text-tekst">
        {verschoven.map((v) => (
          <li key={v.id}>{v.oudStart}–{v.oudEind} wordt <strong>{v.nieuwStart}–{v.nieuwEind}</strong></li>
        ))}
      </ul>
    </div>
  );
}

function MeeschuivenVink({ aan, setAan, tekst }: { aan: boolean; setAan: (b: boolean) => void; tekst: string }) {
  return (
    <label className="flex min-h-aanraak items-center gap-3 font-medium text-kop">
      <input type="checkbox" checked={aan} onChange={(e) => setAan(e.target.checked)} className="size-6 accent-merk" />
      {tekst}
    </label>
  );
}

/** Een nieuwe vaste activiteit, na een bestaande activiteit. */
function NieuweActiviteitFormulier({
  na, alleRegels, naam, onBericht, onKlaar,
}: {
  na: ProgrammaRegel;
  alleRegels: ProgrammaRegel[];
  naam: string;
  onBericht: (t: string) => void;
  onKlaar: () => void;
}) {
  const router = useRouter();
  const naEind = formatTijd(na.eindtijd);
  const [v, setV] = useState<NieuweActiviteit>({ titel: "", omschrijving: "", locatie: "", start: naEind, eind: naarTijd(Math.min(1439, naarMinuten(naEind) + 30)) });
  const [schuif, setSchuif] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const delta = naarMinuten(v.eind) - naarMinuten(naEind);
  const voorbeeld = schuif && delta !== 0 && v.eind > v.start
    ? berekenVerschuiving(alleRegels, { dag: na.dag, volgorde: na.volgorde }, na.eindtijd, delta)
    : { verschoven: [], pastNiet: false };

  async function voegToe() {
    setFout(null);
    setBezig(true);
    const res = await regelToevoegen(na.id, v, schuif, naam);
    setBezig(false);
    if (res.status === "ok") {
      onBericht(`Activiteit toegevoegd${res.verschoven ? ` · ${res.verschoven} volgende activiteiten zijn meegeschoven (gemarkeerd met !)` : ""}`);
      onKlaar();
      router.refresh();
    } else setFout(res.melding);
  }

  return (
    <div className="flex flex-col gap-3 rounded-han border-2 border-dashed border-kop bg-vlak p-3">
      <p className="font-heading text-lg font-bold text-kop">Nieuwe activiteit na “{na.titel}”</p>
      <label className="font-bold text-kop">Titel<input value={v.titel} onChange={(e) => setV({ ...v, titel: e.target.value })} maxLength={120} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
      <label className="font-bold text-kop">Toelichting (mag leeg)<input value={v.omschrijving} onChange={(e) => setV({ ...v, omschrijving: e.target.value })} maxLength={300} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
      <label className="font-bold text-kop">Locatie (mag leeg)<input value={v.locatie} onChange={(e) => setV({ ...v, locatie: e.target.value })} maxLength={120} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="font-bold text-kop">Start<input type="time" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
        <label className="font-bold text-kop">Einde<input type="time" value={v.eind} onChange={(e) => setV({ ...v, eind: e.target.value })} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
      </div>
      <MeeschuivenVink aan={schuif} setAan={setSchuif} tekst="Volgende activiteiten opschuiven" />
      <Voorbeeld {...voorbeeld} />
      {fout && <p role="alert" className="font-medium text-fout">{fout}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void voegToe()} disabled={!naam.trim() || bezig} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
          Activiteit toevoegen
        </button>
        <button type="button" onClick={onKlaar} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Annuleren</button>
      </div>
    </div>
  );
}

/** Eén activiteit van het programma bewerken. Een belevenisvak kan in tijd worden aangepast, maar nooit worden verwijderd. */
function RegelFormulier({
  regel, alleRegels, groepen, naam, onBericht,
}: {
  regel: ProgrammaRegel;
  alleRegels: ProgrammaRegel[];
  groepen: GroepInfo[];
  naam: string;
  onBericht: (t: string) => void;
}) {
  const router = useRouter();
  const belevenis = regel.soort === "belevenis";
  const aangepast = isAangepast(regel);
  const verantwoordelijk = belevenis ? groepen.find((g) => g.regelId === regel.id) : undefined;

  const [v, setV] = useState<RegelVelden>(naarVelden(regel));
  const [verwacht, setVerwacht] = useState(regel.updated_at);
  const [schuif, setSchuif] = useState(true);
  const [melding, setMelding] = useState<Melding | null>(null);
  const [conflict, setConflict] = useState<ProgrammaRegel | null>(null);
  const [toevoegen, setToevoegen] = useState(false);
  const [verwijderen, setVerwijderen] = useState(false);
  const set = <K extends keyof RegelVelden>(k: K, w: RegelVelden[K]) => setV((x) => ({ ...x, [k]: w }));

  const deltaEind = naarMinuten(v.eind) - naarMinuten(formatTijd(regel.eindtijd));
  const eindGewijzigd = v.dag === regel.dag && deltaEind !== 0 && v.eind > v.start;
  const voorbeeld = schuif && eindGewijzigd
    ? berekenVerschuiving(alleRegels, { dag: regel.dag, volgorde: regel.volgorde }, regel.eindtijd, deltaEind)
    : { verschoven: [], pastNiet: false };

  async function bewaar(versie = verwacht) {
    setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
    const res = await regelOpslaan(regel.id, v, versie, naam, schuif);
    if (res.status === "ok") {
      setVerwacht(res.updatedAt);
      setConflict(null);
      setMelding({ soort: "ok", tekst: "Opgeslagen" });
      onBericht(`Opgeslagen${res.verschoven ? ` · ${res.verschoven} volgende activiteiten zijn meegeschoven (gemarkeerd met !)` : ""}`);
      router.refresh();
    } else if (res.status === "conflict") {
      setConflict(res.huidig);
      setMelding({ soort: "waarschuwing", tekst: `${res.huidig.bijgewerkt_door_naam || "Iemand anders"} heeft deze activiteit net gewijzigd.` });
    } else {
      setMelding({ soort: "fout", tekst: res.melding });
    }
  }

  async function verwijder(metSchuiven: boolean) {
    const res = await regelVerwijderen(regel.id, metSchuiven, naam);
    if (res.status === "ok") {
      onBericht(`Activiteit verwijderd${res.verschoven ? ` · ${res.verschoven} volgende activiteiten zijn naar voren geschoven (gemarkeerd met !)` : ""}`);
      router.refresh();
    } else {
      setVerwijderen(false);
      setMelding({ soort: "fout", tekst: res.melding });
    }
  }

  async function bevestig() {
    const res = await wijzigingenBevestigen(regel.id, naam);
    if (res.status === "ok") { onBericht("Wijziging bevestigd: het uitroepteken is weg"); router.refresh(); }
    else setMelding({ soort: "fout", tekst: res.melding });
  }

  return (
    <details className={belevenis ? "rounded-han border-2 border-kop bg-vlak" : "rounded-han border border-rand bg-achtergrond"}>
      <summary className={`flex min-h-aanraak cursor-pointer items-center gap-3 p-3 ${belevenis ? "border-l-8 border-kop" : ""}`}>
        <span className="flex shrink-0 flex-col items-center gap-0.5">
          <span className={`rounded-han px-2 py-1 text-sm font-bold ${aangepast ? "bg-actie text-black" : "bg-kop text-white"}`}>
            {formatTijd(regel.starttijd)}–{formatTijd(regel.eindtijd)}
          </span>
        </span>
        {aangepast && <Uitroepteken />}
        <span className="flex-1">
          <span className="block font-bold text-kop">{regel.titel}</span>
          {belevenis && (
            <span className="mt-0.5 flex items-center gap-1 text-sm font-medium text-kop">
              <Lock aria-hidden className="size-3.5" />
              {verantwoordelijk ? `${verantwoordelijk.naam} is verantwoordelijk` : "Nog geen projectgroep toegewezen"}
            </span>
          )}
          {aangepast && (
            <span className="block text-sm text-tekst">
              was {formatTijd(regel.oorspronkelijke_starttijd!)}–{formatTijd(regel.oorspronkelijke_eindtijd!)}
            </span>
          )}
        </span>
      </summary>

      <div className="flex flex-col gap-3 border-t border-rand p-3">
        {belevenis && (
          <p className="flex items-start gap-2 rounded-han bg-kop p-3 text-white">
            <Lock aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span>
              <strong>Belevenisvak: vast.</strong>{" "}
              {verantwoordelijk ? `${verantwoordelijk.naam} bereidt deze belevenis voor.` : "Er is nog geen projectgroep aan dit vak toegewezen."}{" "}
              Dit vak kan niet worden verwijderd, omdat de AVF&apos;s eraan hangen. Je kunt de tijd en de toelichting wel aanpassen.
            </span>
          </p>
        )}

        {aangepast && (
          <div className="flex flex-wrap items-center gap-2 rounded-han border-2 border-kop bg-vlak p-3">
            <Uitroepteken />
            <span className="flex-1 font-medium text-kop">
              Aangepast: was {formatTijd(regel.oorspronkelijke_starttijd!)}–{formatTijd(regel.oorspronkelijke_eindtijd!)}
            </span>
            <button type="button" onClick={() => void bevestig()} disabled={!naam.trim()} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-3 font-bold text-kop disabled:opacity-60">
              Wijziging bevestigen
            </button>
          </div>
        )}

        <label className="font-bold text-kop">Titel<input value={v.titel} onChange={(e) => set("titel", e.target.value)} maxLength={120} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
        <label className="font-bold text-kop">Toelichting<textarea value={v.omschrijving} onChange={(e) => set("omschrijving", e.target.value)} maxLength={300} rows={2} className={`${INVOER} mt-1 py-2`} /></label>
        <label className="font-bold text-kop">Locatie<input value={v.locatie} onChange={(e) => set("locatie", e.target.value)} maxLength={120} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
        <label className="font-bold text-kop">Dag<input type="date" value={v.dag} onChange={(e) => set("dag", e.target.value)} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="font-bold text-kop">Start<input type="time" value={v.start} onChange={(e) => set("start", e.target.value)} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
          <label className="font-bold text-kop">Einde<input type="time" value={v.eind} onChange={(e) => set("eind", e.target.value)} className={`${INVOER} mt-1 min-h-aanraak`} /></label>
        </div>

        {eindGewijzigd && <MeeschuivenVink aan={schuif} setAan={setSchuif} tekst="Volgende activiteiten mee laten schuiven" />}
        <Voorbeeld {...voorbeeld} />

        {belevenis && (
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
              <button type="button" onClick={() => { setV(naarVelden(conflict)); setVerwacht(conflict.updated_at); setConflict(null); setMelding(null); router.refresh(); }} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
                Hun versie houden
              </button>
              <button type="button" onClick={() => { setVerwacht(conflict.updated_at); setConflict(null); void bewaar(conflict.updated_at); }} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk">
                Mijn versie bewaren
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={() => void bewaar()} disabled={!naam.trim() || voorbeeld.pastNiet} className="min-h-aanraak rounded-han bg-merk px-4 text-lg font-bold text-op-merk disabled:opacity-60">
          Opslaan
        </button>
        {melding && (
          <p aria-live="polite" role={melding.soort === "fout" ? "alert" : undefined} className={`font-medium ${melding.soort === "fout" ? "text-fout" : "text-kop"}`}>{melding.tekst}</p>
        )}

        <div className="flex flex-col gap-2 border-t border-rand pt-3">
          <button type="button" onClick={() => setToevoegen((x) => !x)} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
            <Plus aria-hidden className="size-5" /> Activiteit hierna toevoegen
          </button>
          {toevoegen && (
            <NieuweActiviteitFormulier na={regel} alleRegels={alleRegels} naam={naam} onBericht={onBericht} onKlaar={() => setToevoegen(false)} />
          )}

          {!belevenis && !verwijderen && (
            <button type="button" onClick={() => setVerwijderen(true)} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-fout bg-vlak px-4 font-bold text-kop">
              <Trash2 aria-hidden className="size-5" /> Deze activiteit verwijderen
            </button>
          )}
          {!belevenis && verwijderen && (
            <div role="alert" className="rounded-han border-2 border-fout bg-vlak p-3">
              <p className="font-bold text-kop">“{regel.titel}” verwijderen?</p>
              <p className="text-sm text-tekst">Wat moet er met de tijden van de volgende activiteiten gebeuren?</p>
              <div className="mt-2 flex flex-col gap-2">
                <button type="button" onClick={() => void verwijder(true)} disabled={!naam.trim()} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
                  Verwijderen en volgende activiteiten naar voren schuiven
                </button>
                <button type="button" onClick={() => void verwijder(false)} disabled={!naam.trim()} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60">
                  Verwijderen, tijden laten staan
                </button>
                <button type="button" onClick={() => setVerwijderen(false)} className="min-h-aanraak rounded-han px-4 font-bold text-kop underline">Annuleren</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

/** Het hele programma, per dag gegroepeerd en met kleur, zodat je de dagen goed uit elkaar houdt. */
export function ProgrammaRegels({
  regels, groepen, naam, onBericht,
}: {
  regels: ProgrammaRegel[];
  groepen: GroepInfo[];
  naam: string;
  onBericht: (t: string) => void;
}) {
  const router = useRouter();
  const [toevoegenNa, setToevoegenNa] = useState<string | null>(null);
  const perDag = new Map<string, ProgrammaRegel[]>();
  for (const r of [...regels].sort((a, b) => a.volgorde - b.volgorde)) perDag.set(r.dag, [...(perDag.get(r.dag) ?? []), r]);
  const aangepast = regels.filter(isAangepast);

  async function alleBevestigen() {
    const res = await wijzigingenBevestigen(null, naam);
    if (res.status === "ok") { onBericht(`${res.aantal} wijzigingen bevestigd: de uitroeptekens zijn weg`); router.refresh(); }
    else onBericht(res.melding);
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap gap-x-5 gap-y-2 rounded-han border border-rand bg-vlak p-3 text-sm text-kop" aria-label="Uitleg van de weergave">
        <li className="flex items-center gap-2"><span className="inline-block h-5 w-8 rounded-han border border-rand bg-achtergrond" /> Vaste activiteit: kan worden aangepast, toegevoegd en verwijderd</li>
        <li className="flex items-center gap-2"><span className="inline-block h-5 w-8 rounded-han border-2 border-kop border-l-8 bg-vlak" /> <Lock aria-hidden className="size-4" /> Belevenisvak van een projectgroep: tijd aanpasbaar, nooit te verwijderen</li>
        <li className="flex items-center gap-2"><Uitroepteken /> Tijd aangepast; er staat bij wat het was</li>
      </ul>

      {aangepast.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-han border-2 border-kop bg-vlak p-3">
          <Uitroepteken />
          <p className="flex-1 font-medium text-kop">{aangepast.length} activiteiten hebben aangepaste tijden.</p>
          <button type="button" onClick={() => void alleBevestigen()} disabled={!naam.trim()} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-3 font-bold text-kop disabled:opacity-60">
            Alles bevestigen
          </button>
        </div>
      )}

      {[...perDag.entries()].map(([dag, lijst], i) => {
        const laatste = lijst[lijst.length - 1];
        return (
          <section key={dag} aria-labelledby={`beheer-dag-${dag}`} className="flex flex-col gap-2">
            <h3 id={`beheer-dag-${dag}`} className={`flex items-baseline justify-between rounded-han px-4 py-3 text-2xl capitalize text-black ${DAGKLEUREN[i % DAGKLEUREN.length]}`}>
              <span>{formatDag(dag).split(" ")[0]}</span>{" "}
              <span className="text-lg normal-case">{formatDag(dag).split(" ").slice(1).join(" ")}</span>
            </h3>
            <div className="flex flex-col gap-2 border-l-4 border-kop pl-2">
              {lijst.map((r) => (
                <RegelFormulier key={`${r.id}:${r.updated_at}`} regel={r} alleRegels={regels} groepen={groepen} naam={naam} onBericht={onBericht} />
              ))}
              {toevoegenNa === laatste.id ? (
                <NieuweActiviteitFormulier na={laatste} alleRegels={regels} naam={naam} onBericht={onBericht} onKlaar={() => setToevoegenNa(null)} />
              ) : (
                <button type="button" onClick={() => setToevoegenNa(laatste.id)} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-dashed border-kop bg-vlak px-4 font-bold text-kop">
                  <Plus aria-hidden className="size-5" /> Activiteit toevoegen aan het einde van {formatDag(dag).split(" ")[0]}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
