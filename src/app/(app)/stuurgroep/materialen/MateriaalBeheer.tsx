"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, Search } from "lucide-react";
import {
  lijstDefinitiefMaken, lijstTerugzetten, materiaalToevoegen, materiaalWijzigen, type Resultaat,
} from "@/app/(app)/materiaal-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import type { LijstStatus, Materiaal } from "@/lib/materialenTypes";
import { formatMoment } from "@/lib/tijd";

const INVOER = "min-h-aanraak w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst disabled:bg-achtergrond";

function Getal({ label, waarde, zet, uit }: { label: string; waarde: string; zet: (w: string) => void; uit?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-kop">
      {label}
      <input type="number" inputMode="numeric" min={0} max={99999} value={waarde} onChange={(e) => zet(e.target.value)} disabled={uit} className={INVOER} />
    </label>
  );
}

function Kaart({ m, kanWijzigen, naam }: { m: Materiaal; kanWijzigen: boolean; naam: string }) {
  const router = useRouter();
  const [v, setV] = useState({ naam: m.naam, categorie: m.categorie ?? "", camping: String(m.voorraadCamping), bivak: String(m.voorraadBivak), opmerking: m.opmerking ?? "", actief: m.actief });
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ fout: boolean; tekst: string } | null>(null);
  const gewijzigd = v.naam !== m.naam || v.categorie !== (m.categorie ?? "") || v.camping !== String(m.voorraadCamping)
    || v.bivak !== String(m.voorraadBivak) || v.opmerking !== (m.opmerking ?? "") || v.actief !== m.actief;

  async function bewaar() {
    setMelding(null);
    if (!naam.trim()) return setMelding({ fout: true, tekst: "Vul bovenaan eerst je naam in." });
    setBezig(true);
    const res: Resultaat = await materiaalWijzigen(
      m.id, { naam: v.naam, categorie: v.categorie, voorraadCamping: Number(v.camping), voorraadBivak: Number(v.bivak), opmerking: v.opmerking, actief: v.actief },
      naam, m.updatedAt,
    );
    setBezig(false);
    if (res.status === "ok") { setMelding({ fout: false, tekst: "Opgeslagen" }); router.refresh(); }
    else setMelding({ fout: true, tekst: res.melding });
  }

  if (!kanWijzigen) {
    return (
      <li className="rounded-han border border-rand bg-vlak p-3">
        <p className="font-bold text-kop">{m.naam}{!m.actief && " (niet meer beschikbaar)"}</p>
        <p className="text-sm text-zacht">{m.categorie ?? "Overig"} · camping {m.voorraadCamping} · bivak {m.voorraadBivak}</p>
        {m.opmerking && <p className="text-sm text-tekst">{m.opmerking}</p>}
      </li>
    );
  }

  return (
    <li className={`rounded-han border-2 bg-vlak p-3 ${m.actief ? "border-rand" : "border-zacht"}`}>
      <div className="grid gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-kop">
          Naam
          <input value={v.naam} onChange={(e) => setV({ ...v, naam: e.target.value })} maxLength={100} className={INVOER} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-kop">
          Categorie
          <input value={v.categorie} onChange={(e) => setV({ ...v, categorie: e.target.value })} maxLength={60} className={INVOER} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Getal label="Voorraad camping" waarde={v.camping} zet={(w) => setV({ ...v, camping: w })} />
          <Getal label="Voorraad bivak" waarde={v.bivak} zet={(w) => setV({ ...v, bivak: w })} />
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-kop">
          Opmerking
          <input value={v.opmerking} onChange={(e) => setV({ ...v, opmerking: e.target.value })} maxLength={300} className={INVOER} />
        </label>
        <label className="flex min-h-aanraak items-center gap-3 font-medium text-kop">
          <input type="checkbox" checked={v.actief} onChange={(e) => setV({ ...v, actief: e.target.checked })} className="size-6 accent-merk" />
          Beschikbaar voor projectgroepen
        </label>
      </div>
      {m.bijgewerktDoorNaam && <p className="mt-1 text-sm text-zacht">Laatst gewijzigd door {m.bijgewerktDoorNaam}, {formatMoment(m.updatedAt)}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void bewaar()} disabled={!gewijzigd || bezig} className="flex min-h-aanraak items-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-50">
          {bezig && <Loader2 aria-hidden className="size-5 animate-spin" />} {bezig ? "Bezig…" : "Opslaan"}
        </button>
        {melding && <span role={melding.fout ? "alert" : "status"} className={`font-medium ${melding.fout ? "text-fout" : "text-kop"}`}>{melding.tekst}</span>}
      </div>
    </li>
  );
}

/** De gedeelde materialenlijst: bouwen als concept, definitief maken, daarna aanvullen. */
export function MateriaalBeheer({
  materialen, status, kanBeheren, kanToevoegen, isDocent,
}: { materialen: Materiaal[]; status: LijstStatus; kanBeheren: boolean; kanToevoegen: boolean; isDocent: boolean }) {
  const router = useRouter();
  const [naam, setNaam] = useNaam();
  const [zoek, setZoek] = useState("");
  const [categorie, setCategorie] = useState("");
  const [nieuw, setNieuw] = useState({ naam: "", categorie: "", camping: "0", bivak: "0", opmerking: "" });
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bevestigDefinitief, setBevestigDefinitief] = useState(false);

  const categorieen = useMemo(() => [...new Set(materialen.map((m) => m.categorie ?? "Overig"))].sort(), [materialen]);
  const zichtbaar = materialen.filter((m) =>
    (!categorie || (m.categorie ?? "Overig") === categorie) && (!zoek.trim() || m.naam.toLowerCase().includes(zoek.trim().toLowerCase())));

  async function voegToe(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setBezig("toevoegen");
    const res = await materiaalToevoegen({ naam: nieuw.naam, categorie: nieuw.categorie, voorraadCamping: Number(nieuw.camping), voorraadBivak: Number(nieuw.bivak), opmerking: nieuw.opmerking }, naam);
    setBezig(null);
    if (res.status === "ok") { setNieuw({ naam: "", categorie: nieuw.categorie, camping: "0", bivak: "0", opmerking: "" }); router.refresh(); }
    else setFout(res.melding);
  }

  async function actie(soort: "definitief" | "terug") {
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setBezig(soort);
    const res = soort === "definitief" ? await lijstDefinitiefMaken(naam) : await lijstTerugzetten(naam);
    setBezig(null);
    if (res.status === "ok") { setBevestigDefinitief(false); router.refresh(); }
    else setFout(res.melding);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-han border border-rand bg-vlak p-4">
        <NaamVeld naam={naam} setNaam={setNaam} label="Wie werkt hier? (jouw naam)" />
        <p className="mt-2 text-sm text-zacht">Jullie delen één account. Met je naam zie je wie de lijst het laatst wijzigde.</p>
      </section>

      {status.status === "concept" ? (
        <section className="rounded-han border-2 border-actie bg-vlak p-4" aria-label="Status van de lijst">
          <h2 className="text-xl">De lijst is nog een concept</h2>
          <p className="mt-1 text-tekst">
            Maak de lijst compleet met de voorraad op de camping en op het bivak, op basis van ervaring van vorige jaren. Projectgroepen kunnen er pas uit kiezen
            als je de lijst definitief maakt. Daarna ziet ook VC de lijst en kan VC materialen toevoegen.
          </p>
          {kanBeheren && (
            bevestigDefinitief ? (
              <div className="mt-3 rounded-han border-2 border-kop p-3">
                <p className="font-bold text-kop">Weet je zeker dat de voorraad op de camping en het bivak klopt?</p>
                <p className="text-tekst">Projectgroepen gaan hierna materialen kiezen. Je kunt daarna nog materialen toevoegen en de voorraad aanpassen.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void actie("definitief")} disabled={bezig !== null} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
                    {bezig === "definitief" ? "Bezig…" : "Ja, definitief maken"}
                  </button>
                  <button type="button" onClick={() => setBevestigDefinitief(false)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Nog niet</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setBevestigDefinitief(true)} className="mt-3 flex min-h-aanraak w-full items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk">
                <CheckCircle2 aria-hidden className="size-5" /> Lijst definitief maken
              </button>
            )
          )}
        </section>
      ) : (
        <section className="rounded-han border-2 border-goedgekeurd bg-vlak p-4" aria-label="Status van de lijst">
          <h2 className="flex items-center gap-2 text-xl"><CheckCircle2 aria-hidden className="size-6" /> De lijst is definitief</h2>
          <p className="mt-1 text-tekst">
            {status.definitiefDoorNaam ? `Definitief gemaakt door ${status.definitiefDoorNaam}` : "Definitief gemaakt"}
            {status.definitiefOp ? `, ${formatMoment(status.definitiefOp)}` : ""}. Projectgroepen kunnen materialen kiezen.
            {kanBeheren ? " Je kunt nog materialen toevoegen en de voorraad aanpassen." : " Jullie kunnen materialen toevoegen die nog ontbreken."}
          </p>
          {isDocent && (
            <button type="button" onClick={() => void actie("terug")} disabled={bezig !== null} className="mt-2 min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60">
              {bezig === "terug" ? "Bezig…" : "Terug naar concept (docent)"}
            </button>
          )}
        </section>
      )}

      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}

      {kanToevoegen && (
        <form onSubmit={voegToe} className="flex flex-col gap-3 rounded-han border-2 border-kop bg-vlak p-4">
          <h2 className="text-xl">Materiaal toevoegen</h2>
          <label className="flex flex-col gap-1 font-medium text-kop">
            Naam
            <input value={nieuw.naam} onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })} maxLength={100} className={`${INVOER} font-normal`} />
          </label>
          <label className="flex flex-col gap-1 font-medium text-kop">
            Categorie
            <input value={nieuw.categorie} onChange={(e) => setNieuw({ ...nieuw, categorie: e.target.value })} list="categorieen" maxLength={60} className={`${INVOER} font-normal`} />
            <datalist id="categorieen">{categorieen.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Getal label="Voorraad camping" waarde={nieuw.camping} zet={(w) => setNieuw({ ...nieuw, camping: w })} />
            <Getal label="Voorraad bivak" waarde={nieuw.bivak} zet={(w) => setNieuw({ ...nieuw, bivak: w })} />
          </div>
          <label className="flex flex-col gap-1 font-medium text-kop">
            Opmerking (bijvoorbeeld waar het ligt)
            <input value={nieuw.opmerking} onChange={(e) => setNieuw({ ...nieuw, opmerking: e.target.value })} maxLength={300} className={`${INVOER} font-normal`} />
          </label>
          <button type="submit" disabled={bezig !== null} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
            {bezig === "toevoegen" ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Plus aria-hidden className="size-5" />} {bezig === "toevoegen" ? "Bezig…" : "Toevoegen"}
          </button>
        </form>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Alle materialen ({materialen.length})</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="relative block">
            <span className="sr-only">Zoeken</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zacht" />
            <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een materiaal" className={`${INVOER} pl-10`} />
          </label>
          <label className="block">
            <span className="sr-only">Categorie</span>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={INVOER}>
              <option value="">Alle categorieën</option>
              {categorieen.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        {zichtbaar.length === 0 && <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Geen materialen gevonden.</p>}
        <ul className="flex flex-col gap-3">
          {zichtbaar.map((m) => <Kaart key={`${m.id}-${m.updatedAt}`} m={m} kanWijzigen={kanBeheren} naam={naam} />)}
        </ul>
      </section>
    </div>
  );
}
