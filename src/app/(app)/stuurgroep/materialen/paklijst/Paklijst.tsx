"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, MessageSquare, Printer, Search } from "lucide-react";
import { paklijstZetten } from "@/app/(app)/materiaal-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import type { Categorie, Locatie, Materiaal, Telling } from "@/lib/materialenTypes";

type Stap = "inpakken" | "op_kamp" | "retour";
type Veld = "meegenomen" | "op_kamp" | "retour";

const STAPPEN: { code: Stap; naam: string; veld: Veld; refLabel: string; veldLabel: string; uitleg: string }[] = [
  { code: "inpakken", naam: "Inpakken", veld: "meegenomen", refLabel: "Plan", veldLabel: "Mee", uitleg: "Vink aan wat klopt met de planning of pas het aantal aan dat echt meegaat." },
  { code: "op_kamp", naam: "Op locatie", veld: "op_kamp", refLabel: "Mee", veldLabel: "Aanwezig", uitleg: "Controleer bij aankomst of alles er is. Pas het aantal aan als er iets mist." },
  { code: "retour", naam: "Retour", veld: "retour", refLabel: "Mee", veldLabel: "Retour", uitleg: "Tel bij het opruimen wat er terugkomt. Het verschil laat zien wat er mist." },
];

const INVOER = "min-h-aanraak w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst";

interface Waarden {
  meegenomen: number | null;
  opKamp: number | null;
  retour: number | null;
  opmerking: string | null;
  updatedAt: string | null;
}

const leeg = (): Waarden => ({ meegenomen: null, opKamp: null, retour: null, opmerking: null, updatedAt: null });
const sleutel = (id: string, locatie: Locatie) => `${id}:${locatie}`;

function plan(m: Materiaal, locatie: Locatie): number | null {
  return locatie === "camping" ? m.voorraadCamping : m.voorraadBivak;
}

function refVoor(stap: Stap, m: Materiaal, locatie: Locatie, w: Waarden): number | null {
  return stap === "inpakken" ? plan(m, locatie) : (w.meegenomen ?? plan(m, locatie));
}

function veldWaarde(stap: Stap, w: Waarden): number | null {
  return stap === "inpakken" ? w.meegenomen : stap === "op_kamp" ? w.opKamp : w.retour;
}

function Verschil({ ref_, waarde }: { ref_: number | null; waarde: number | null }) {
  if (ref_ === null || waarde === null) return <span className="text-zacht">–</span>;
  const v = waarde - ref_;
  if (v === 0) return <span className="text-zacht">0</span>;
  return <span className="rounded-han bg-actie px-1.5 py-0.5 text-sm font-bold text-black">{v > 0 ? `+${v}` : v}</span>;
}

function PakRij({
  m, locatie, stap, w, opslaan,
}: {
  m: Materiaal; locatie: Locatie; stap: (typeof STAPPEN)[number]; w: Waarden;
  opslaan: (m: Materiaal, veld: Veld | "opmerking", waarde: number | null, tekst: string) => Promise<string | null>;
}) {
  const waarde = veldWaarde(stap.code, w);
  const ref_ = refVoor(stap.code, m, locatie, w);
  const [tekst, setTekst] = useState<string | null>(null);
  const [opm, setOpm] = useState<string | null>(null);
  const [opmOpen, setOpmOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const getoond = tekst ?? (waarde === null ? "" : String(waarde));

  async function bewaar(t: string) {
    const s = t.trim();
    const n = s === "" ? null : Number(s);
    if (n !== null && (!Number.isInteger(n) || n < 0)) { setFout("Vul een heel getal van 0 of meer in."); return; }
    if (n === waarde) { setTekst(null); return; }
    setFout(null);
    setBezig(true);
    const f = await opslaan(m, stap.veld, n, "");
    setBezig(false);
    setTekst(null);
    if (f) setFout(f);
  }

  async function bewaarOpmerking(t: string) {
    if (t.trim() === (w.opmerking ?? "")) { setOpm(null); return; }
    setBezig(true);
    const f = await opslaan(m, "opmerking", null, t);
    setBezig(false);
    setOpm(null);
    if (f) setFout(f);
  }

  return (
    <>
      <tr className="border-t border-rand">
        <td className="py-2 pl-3 pr-1 align-middle">
          <span className="block font-medium text-kop">{m.naam}</span>
          {w.opmerking && !opmOpen && <span className="block text-xs font-bold text-kop">{w.opmerking}</span>}
        </td>
        <td className="px-1 text-center align-middle font-bold text-kop">{ref_ ?? "–"}</td>
        <td className="px-1 py-1 text-center align-middle">
          <input
            type="number" inputMode="numeric" min={0} max={99999} value={getoond} placeholder="–" disabled={bezig}
            aria-label={`${stap.veldLabel} ${m.naam}`}
            onChange={(e) => setTekst(e.target.value)} onBlur={() => void bewaar(getoond)}
            className="min-h-aanraak w-16 rounded-han border-2 border-zacht bg-vlak px-1 text-center text-base text-tekst"
          />
        </td>
        <td className="px-0 text-center align-middle">
          <button
            type="button" aria-label={`${m.naam}: klopt`} disabled={bezig || ref_ === null || waarde === ref_}
            onClick={() => void bewaar(String(ref_))}
            className="flex size-aanraak items-center justify-center rounded-han border-2 border-kop text-kop disabled:border-rand disabled:text-rand"
          >
            {bezig ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Check aria-hidden className="size-5" />}
          </button>
        </td>
        <td className="px-1 text-center align-middle"><Verschil ref_={ref_} waarde={waarde} /></td>
        <td className="pr-1 align-middle">
          <button type="button" aria-label={`Opmerking bij ${m.naam}`} aria-expanded={opmOpen} onClick={() => setOpmOpen((x) => !x)} className="flex size-aanraak items-center justify-center rounded-han text-kop">
            <MessageSquare aria-hidden className={`size-5 ${w.opmerking ? "fill-actie" : ""}`} />
          </button>
        </td>
      </tr>
      {opmOpen && (
        <tr className="bg-achtergrond">
          <td colSpan={6} className="p-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-kop">
              Opmerking (bijvoorbeeld &quot;2 lek&quot; of &quot;1 beschadigd&quot;)
              <input value={opm ?? w.opmerking ?? ""} onChange={(e) => setOpm(e.target.value)} onBlur={() => void bewaarOpmerking(opm ?? w.opmerking ?? "")} maxLength={300} className={INVOER} />
            </label>
          </td>
        </tr>
      )}
      {fout && <tr><td colSpan={6} role="alert" className="px-3 pb-2 text-sm font-bold text-fout">{fout}</td></tr>}
    </>
  );
}

/**
 * De materiaalcontrole: per locatie en per stap (inpakken, op locatie, retour) wat er klopt en wat niet.
 * Wat er echt is telt direct mee in de beschikbaarheid voor de projectgroepen.
 */
export function Paklijst({ materialen, categorieen, tellingen }: { materialen: Materiaal[]; categorieen: Categorie[]; tellingen: Telling[] }) {
  const [naam, setNaam] = useNaam();
  const [locatie, setLocatie] = useState<Locatie>("camping");
  const [stapCode, setStapCode] = useState<Stap>("inpakken");
  const [zoek, setZoek] = useState("");
  const [alleenOpen, setAlleenOpen] = useState(false);
  const [data, setData] = useState<Record<string, Waarden>>(() => {
    const d: Record<string, Waarden> = {};
    for (const t of tellingen) d[sleutel(t.materiaalId, t.locatie)] = { meegenomen: t.meegenomen, opKamp: t.opKamp, retour: t.retour, opmerking: t.opmerking, updatedAt: t.updatedAt };
    return d;
  });
  const [algemeneFout, setAlgemeneFout] = useState<string | null>(null);

  const stap = STAPPEN.find((s) => s.code === stapCode)!;
  const actief = materialen.filter((m) => m.actief);
  const waardenVan = (m: Materiaal) => data[sleutel(m.id, locatie)] ?? leeg();
  const klaar = actief.filter((m) => veldWaarde(stapCode, waardenVan(m)) !== null).length;
  const zichtbaar = useMemo(
    () => actief.filter((m) =>
      (!zoek.trim() || m.naam.toLowerCase().includes(zoek.trim().toLowerCase()))
      && (!alleenOpen || veldWaarde(stapCode, data[sleutel(m.id, locatie)] ?? leeg()) === null)),
    [actief, zoek, alleenOpen, data, stapCode, locatie],
  );
  const groepen = categorieen.map((c) => ({ c, items: zichtbaar.filter((m) => m.categorie === c.naam) })).filter((g) => g.items.length > 0);

  async function opslaan(m: Materiaal, veld: Veld | "opmerking", waarde: number | null, tekst: string): Promise<string | null> {
    if (!naam.trim()) return "Vul bovenaan eerst je naam in.";
    const k = sleutel(m.id, locatie);
    const huidig = data[k] ?? leeg();
    const res = await paklijstZetten(m.id, locatie, veld, waarde, tekst, naam, huidig.updatedAt);
    if (res.status === "ok") {
      setData((d) => ({
        ...d,
        [k]: {
          ...huidig, updatedAt: res.updatedAt,
          meegenomen: veld === "meegenomen" ? waarde : huidig.meegenomen,
          opKamp: veld === "op_kamp" ? waarde : huidig.opKamp,
          retour: veld === "retour" ? waarde : huidig.retour,
          opmerking: veld === "opmerking" ? (tekst.trim() || null) : huidig.opmerking,
        },
      }));
      return null;
    }
    if (res.status === "conflict") return "Iemand anders heeft deze regel net gewijzigd. Ververs de pagina.";
    return res.melding;
  }

  const tab = (actiefTab: boolean) => `flex min-h-aanraak flex-1 items-center justify-center rounded-han border-2 px-2 text-sm font-bold ${actiefTab ? "border-merk bg-merk text-op-merk" : "border-rand bg-vlak text-kop"}`;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-han border border-rand bg-vlak p-4">
        <NaamVeld naam={naam} setNaam={setNaam} label="Wie telt er? (jouw naam)" />
      </section>

      <div role="group" aria-label="Locatie" className="flex gap-2">
        {(["camping", "bivak"] as const).map((l) => (
          <button key={l} type="button" aria-pressed={locatie === l} onClick={() => setLocatie(l)} className={tab(locatie === l)}>{l === "camping" ? "Camping" : "Bivak"}</button>
        ))}
      </div>
      <div role="group" aria-label="Stap" className="flex gap-2">
        {STAPPEN.map((s) => (
          <button key={s.code} type="button" aria-pressed={stapCode === s.code} onClick={() => setStapCode(s.code)} className={tab(stapCode === s.code)}>{s.naam}</button>
        ))}
      </div>

      <section className="rounded-han border-2 border-kop bg-vlak p-4" aria-live="polite">
        <p className="text-tekst">{stap.uitleg}</p>
        <p className="mt-1 font-bold text-kop">{klaar} van {actief.length} materialen gecontroleerd</p>
        <div className="mt-1 h-3 overflow-hidden rounded-han bg-rand" aria-hidden>
          <div className="h-full bg-goedgekeurd" style={{ width: `${actief.length ? Math.round((klaar / actief.length) * 100) : 0}%` }} />
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <label className="relative block">
          <span className="sr-only">Zoeken</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zacht" />
          <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een materiaal" className={`${INVOER} pl-10`} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={alleenOpen} onClick={() => setAlleenOpen((x) => !x)} className={`min-h-aanraak rounded-han border-2 px-3 text-sm font-bold ${alleenOpen ? "border-kop bg-kop text-white" : "border-zacht bg-vlak text-kop"}`}>
            Alleen nog te doen ({actief.length - klaar})
          </button>
          <Link href={`/stuurgroep/materialen/afdrukken?papier=${locatie}`} className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-kop bg-vlak px-3 text-sm font-bold text-kop">
            <Printer aria-hidden className="size-5" /> Papieren lijst {locatie === "camping" ? "camping" : "bivak"}
          </Link>
        </div>
      </div>
      {algemeneFout && <p role="alert" className="font-bold text-fout">{algemeneFout}</p>}

      {groepen.length === 0 && <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Geen materialen gevonden.</p>}
      {groepen.map(({ c, items }) => (
        <section key={c.id} aria-labelledby={`pak-${c.id}`}>
          <h2 id={`pak-${c.id}`} className="mb-1 text-xl">{c.naam}</h2>
          <div className="overflow-hidden rounded-han border border-rand bg-vlak">
            <table className="w-full table-fixed text-left">
              <thead className="bg-achtergrond text-xs font-bold uppercase text-zacht">
                <tr>
                  <th scope="col" className="py-1 pl-3 pr-1">Materiaal</th>
                  <th scope="col" className="w-12 px-1 text-center">{stap.refLabel}</th>
                  <th scope="col" className="w-[4.5rem] px-1 text-center">{stap.veldLabel}</th>
                  <th scope="col" className="w-11"><span className="sr-only">Klopt</span></th>
                  <th scope="col" className="w-12 px-1 text-center">Verschil</th>
                  <th scope="col" className="w-11"><span className="sr-only">Opmerking</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <PakRij
                    key={`${m.id}-${locatie}`} m={m} locatie={locatie} stap={stap} w={waardenVan(m)}
                    opslaan={async (mm, veld, waarde, t) => { const f = await opslaan(mm, veld, waarde, t); if (f) setAlgemeneFout(null); return f; }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
