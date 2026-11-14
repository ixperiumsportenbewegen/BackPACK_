"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import {
  categorieHernoemen, categorieToevoegen, categorieVerwijderen, lijstDefinitiefMaken, lijstTerugzetten,
  materiaalToevoegen, materiaalUitLijstVerwijderen, materiaalVoorraadZetten, materiaalWijzigen,
} from "@/app/(app)/materiaal-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import { isIngeschat, totaalVoorraad, type Categorie, type LijstStatus, type Materiaal } from "@/lib/materialenTypes";
import { formatMoment } from "@/lib/tijd";

const INVOER = "min-h-aanraak w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst disabled:bg-achtergrond";
const GETAL = "min-h-aanraak w-16 rounded-han border-2 bg-vlak px-1 text-center text-base text-tekst";

function tekstNaarGetal(t: string): number | null | "ongeldig" {
  const s = t.trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 99999 ? n : "ongeldig";
}

/** Eén materiaal als tabelrij: de voorraad op camping en bivak direct invulbaar, de rest achter het potlood. */
function Rij({ m, categorieen, kanWijzigen, naam, gepubliceerd }: { m: Materiaal; categorieen: Categorie[]; kanWijzigen: boolean; naam: string; gepubliceerd: boolean }) {
  const router = useRouter();
  const verwacht = useRef(m.updatedAt);
  const bewaard = useRef({ camping: m.voorraadCamping, bivak: m.voorraadBivak });
  const [camping, setCamping] = useState(m.voorraadCamping === null ? "" : String(m.voorraadCamping));
  const [bivak, setBivak] = useState(m.voorraadBivak === null ? "" : String(m.voorraadBivak));
  const [bezig, setBezig] = useState<"camping" | "bivak" | "details" | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [bevestigWeg, setBevestigWeg] = useState(false);
  const [d, setD] = useState({ naam: m.naam, categorie: m.categorie, opmerking: m.opmerking ?? "", actief: m.actief });

  async function bewaarVoorraad(locatie: "camping" | "bivak", tekst: string) {
    const w = tekstNaarGetal(tekst);
    if (w === "ongeldig") return setFout("Vul een heel getal van 0 of meer in.");
    if (w === bewaard.current[locatie]) return;
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setFout(null);
    setBezig(locatie);
    const res = await materiaalVoorraadZetten(m.id, locatie, w, naam, verwacht.current);
    setBezig(null);
    if (res.status === "ok") {
      verwacht.current = res.updatedAt;
      bewaard.current = { ...bewaard.current, [locatie]: w };
      router.refresh();
    } else {
      setFout(res.melding);
      const terug = bewaard.current[locatie];
      (locatie === "camping" ? setCamping : setBivak)(terug === null ? "" : String(terug));
    }
  }

  async function bewaarDetails() {
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    const c = tekstNaarGetal(camping);
    const b = tekstNaarGetal(bivak);
    if (c === "ongeldig" || b === "ongeldig") return setFout("Vul een heel getal van 0 of meer in.");
    setBezig("details");
    const res = await materiaalWijzigen(
      m.id, { naam: d.naam, categorie: d.categorie, voorraadCamping: c, voorraadBivak: b, opmerking: d.opmerking, actief: d.actief }, naam, verwacht.current,
    );
    setBezig(null);
    if (res.status === "ok") { setOpen(false); router.refresh(); }
    else setFout(res.melding);
  }

  async function verwijder() {
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setBezig("details");
    const res = await materiaalUitLijstVerwijderen(m.id, naam);
    setBezig(null);
    setBevestigWeg(false);
    if (res.status === "ok") router.refresh();
    else setFout(res.melding);
  }

  const totaal = totaalVoorraad({
    voorraadCamping: tekstNaarGetal(camping) === "ongeldig" ? null : (tekstNaarGetal(camping) as number | null),
    voorraadBivak: tekstNaarGetal(bivak) === "ongeldig" ? null : (tekstNaarGetal(bivak) as number | null),
  });
  const volgt = m.actief && !(tekstNaarGetal(camping) !== null && tekstNaarGetal(camping) !== "ongeldig" && tekstNaarGetal(bivak) !== null && tekstNaarGetal(bivak) !== "ongeldig");
  const leeg = (t: string) => t.trim() === "";
  const cel = (locatie: "camping" | "bivak", waarde: string, zet: (w: string) => void) =>
    kanWijzigen ? (
      <input
        type="number" inputMode="numeric" min={0} max={99999} value={waarde} placeholder="–"
        aria-label={`Voorraad ${locatie} ${m.naam}`}
        onChange={(e) => zet(e.target.value)} onBlur={() => void bewaarVoorraad(locatie, waarde)}
        disabled={bezig !== null}
        className={`${GETAL} ${leeg(waarde) && m.actief ? "border-actie" : "border-zacht"}`}
      />
    ) : (
      <span className={leeg(waarde) ? "text-zacht" : "font-bold text-kop"}>{leeg(waarde) ? "–" : waarde}</span>
    );

  return (
    <>
      <tr className={`border-t border-rand ${m.actief ? "" : "bg-achtergrond text-zacht"}`}>
        <td className="py-2 pl-3 pr-2 align-middle">
          <span className="block font-medium text-kop">{m.naam}</span>
          {!m.actief && <span className="block text-xs font-bold">Niet beschikbaar voor projectgroepen</span>}
          {volgt && gepubliceerd && <span className="block text-xs font-bold text-kop">Voorraad volgt: nog niet te kiezen</span>}
          {m.opmerking && <span className="block text-xs text-zacht">{m.opmerking}</span>}
        </td>
        <td className="px-1 py-1 text-center align-middle">{cel("camping", camping, setCamping)}</td>
        <td className="px-1 py-1 text-center align-middle">{cel("bivak", bivak, setBivak)}</td>
        <td className="px-1 text-center align-middle font-bold text-kop">{totaal === null ? "–" : totaal}</td>
        <td className="w-11 pr-1 text-right align-middle">
          {bezig && bezig !== "details" ? (
            <Loader2 aria-label="Bezig met opslaan" className="inline size-5 animate-spin" />
          ) : kanWijzigen ? (
            <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-label={`Wijzig ${m.naam}`} className="flex size-aanraak items-center justify-center rounded-han text-kop">
              <Pencil aria-hidden className="size-5" />
            </button>
          ) : null}
        </td>
      </tr>
      {fout && (
        <tr><td colSpan={5} role="alert" className="px-3 pb-2 text-sm font-bold text-fout">{fout}</td></tr>
      )}
      {open && kanWijzigen && (
        <tr className="bg-achtergrond">
          <td colSpan={5} className="p-3">
            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-kop">
                Naam
                <input value={d.naam} onChange={(e) => setD({ ...d, naam: e.target.value })} maxLength={100} className={INVOER} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-kop">
                Categorie
                <select value={d.categorie} onChange={(e) => setD({ ...d, categorie: e.target.value })} className={INVOER}>
                  {categorieen.map((c) => <option key={c.id} value={c.naam}>{c.naam}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-kop">
                Opmerking (bijvoorbeeld de eenheid of waar het ligt)
                <input value={d.opmerking} onChange={(e) => setD({ ...d, opmerking: e.target.value })} maxLength={300} className={INVOER} />
              </label>
              <label className="flex min-h-aanraak items-center gap-3 font-medium text-kop">
                <input type="checkbox" checked={d.actief} onChange={(e) => setD({ ...d, actief: e.target.checked })} className="size-6 accent-merk" />
                Beschikbaar voor projectgroepen
              </label>
              {m.bijgewerktDoorNaam && <p className="text-sm text-zacht">Laatst gewijzigd door {m.bijgewerktDoorNaam}, {formatMoment(m.updatedAt)}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => void bewaarDetails()} disabled={bezig !== null} className="flex min-h-aanraak items-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
                  {bezig === "details" && <Loader2 aria-hidden className="size-5 animate-spin" />} {bezig === "details" ? "Bezig…" : "Opslaan"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Sluiten</button>
              </div>
              {bevestigWeg ? (
                <div className="rounded-han border-2 border-kop p-3">
                  <p className="font-bold text-kop">Dit materiaal uit de lijst verwijderen?</p>
                  <p className="text-sm text-tekst">Dat kan alleen als geen projectgroep het heeft gekozen. Anders zet je het op &apos;niet beschikbaar&apos;.</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => void verwijder()} disabled={bezig !== null} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">{bezig === "details" ? "Bezig…" : "Ja, verwijderen"}</button>
                    <button type="button" onClick={() => setBevestigWeg(false)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Nee</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setBevestigWeg(true)} className="flex min-h-aanraak items-center gap-2 text-sm font-bold text-kop underline">
                  <Trash2 aria-hidden className="size-4" /> Verwijderen uit de lijst
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Beheer van de vaste categorielijst (alleen voor wie de lijst bouwt). */
function CategorieBeheer({ categorieen }: { categorieen: Categorie[] }) {
  const router = useRouter();
  const [nieuw, setNieuw] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function voegToe(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setBezig(true);
    const res = await categorieToevoegen(nieuw);
    setBezig(false);
    if (res.status === "ok") { setNieuw(""); router.refresh(); } else setFout(res.melding);
  }

  async function hernoem(c: Categorie, waarde: string) {
    if (waarde.trim() === c.naam) return;
    setFout(null);
    const res = await categorieHernoemen(c.id, waarde);
    if (res.status === "ok") router.refresh(); else setFout(res.melding);
  }

  async function verwijder(c: Categorie) {
    setFout(null);
    const res = await categorieVerwijderen(c.id);
    if (res.status === "ok") router.refresh(); else setFout(res.melding);
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <p className="text-sm text-zacht">Een vaste lijst, zodat alles op dezelfde manier is ingedeeld. Een categorie hernoemen werkt direct door bij alle materialen.</p>
      <ul className="flex flex-col gap-2">
        {categorieen.map((c) => (
          <li key={`${c.id}-${c.naam}`} className="flex items-center gap-2">
            <input defaultValue={c.naam} maxLength={60} aria-label={`Naam van categorie ${c.naam}`} onBlur={(e) => void hernoem(c, e.target.value)} className={INVOER} />
            <span className="w-8 shrink-0 text-center text-sm text-zacht" title="Aantal materialen">{c.aantal}</span>
            <button
              type="button" onClick={() => void verwijder(c)} disabled={c.aantal > 0} aria-label={`Verwijder categorie ${c.naam}`}
              className="flex size-aanraak shrink-0 items-center justify-center rounded-han border-2 border-rand text-kop disabled:opacity-30"
            >
              <Trash2 aria-hidden className="size-5" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={voegToe} className="flex gap-2">
        <input value={nieuw} onChange={(e) => setNieuw(e.target.value)} maxLength={60} placeholder="Nieuwe categorie" aria-label="Nieuwe categorie" className={INVOER} />
        <button type="submit" disabled={bezig || !nieuw.trim()} className="flex min-h-aanraak shrink-0 items-center gap-1 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-50">
          <Plus aria-hidden className="size-5" /> Toevoegen
        </button>
      </form>
      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}
    </div>
  );
}

/** De gedeelde materialenlijst als overzichtelijke tabel per categorie. */
export function MateriaalBeheer({
  materialen, categorieen, status, kanBeheren, kanAanpassen, isDocent,
}: { materialen: Materiaal[]; categorieen: Categorie[]; status: LijstStatus; kanBeheren: boolean; kanAanpassen: boolean; isDocent: boolean }) {
  const router = useRouter();
  const [naam, setNaam] = useNaam();
  const [zoek, setZoek] = useState("");
  const [categorie, setCategorie] = useState("");
  const [alleenLeeg, setAlleenLeeg] = useState(false);
  const [nieuw, setNieuw] = useState({ naam: "", categorie: "Overig", camping: "", bivak: "", opmerking: "" });
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bevestigDefinitief, setBevestigDefinitief] = useState(false);

  const actief = materialen.filter((m) => m.actief);
  const ingeschat = actief.filter(isIngeschat).length;
  const nogTeDoen = actief.length - ingeschat;
  const zichtbaar = useMemo(
    () => materialen.filter((m) =>
      (!categorie || m.categorie === categorie)
      && (!zoek.trim() || m.naam.toLowerCase().includes(zoek.trim().toLowerCase()))
      && (!alleenLeeg || (m.actief && !isIngeschat(m)))),
    [materialen, categorie, zoek, alleenLeeg],
  );
  const groepen = categorieen
    .map((c) => ({ c, items: zichtbaar.filter((m) => m.categorie === c.naam) }))
    .filter((g) => g.items.length > 0);

  async function voegToe(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    const c = tekstNaarGetal(nieuw.camping);
    const b = tekstNaarGetal(nieuw.bivak);
    if (c === "ongeldig" || b === "ongeldig") return setFout("Vul een heel getal van 0 of meer in, of laat het leeg.");
    setBezig("toevoegen");
    const res = await materiaalToevoegen({ naam: nieuw.naam, categorie: nieuw.categorie, voorraadCamping: c, voorraadBivak: b, opmerking: nieuw.opmerking }, naam);
    setBezig(null);
    if (res.status === "ok") { setNieuw({ ...nieuw, naam: "", camping: "", bivak: "", opmerking: "" }); router.refresh(); }
    else setFout(res.melding);
  }

  async function actie(soort: "definitief" | "terug") {
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setBezig(soort);
    const res = soort === "definitief" ? await lijstDefinitiefMaken(naam) : await lijstTerugzetten(naam);
    setBezig(null);
    if (res.status === "ok") { setBevestigDefinitief(false); router.refresh(); }
    else { setBevestigDefinitief(false); setFout(res.melding); }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-han border border-rand bg-vlak p-4">
        <NaamVeld naam={naam} setNaam={setNaam} label="Wie werkt hier? (jouw naam)" />
      </section>

      {status.status === "concept" ? (
        <section className="rounded-han border-2 border-actie bg-vlak p-4" aria-label="Status van de lijst">
          <h2 className="text-xl">Concept: nog niet gepubliceerd</h2>
          <p className="mt-1 text-tekst">
            Schat per materiaal in hoeveel er op de <strong>camping</strong> en op het <strong>bivak</strong> aanwezig moet zijn. Vul 0 in als er niets is.
            Projectgroepen kunnen pas kiezen als je de lijst publiceert; daarna ziet VC hem ook. Materialen waarvan de voorraad nog niet is ingeschat, kun je later aanvullen.
          </p>
          <p className="mt-2 font-bold text-kop" aria-live="polite">{ingeschat} van {actief.length} materialen ingeschat</p>
          <div className="mt-1 h-3 overflow-hidden rounded-han bg-rand" aria-hidden>
            <div className="h-full bg-goedgekeurd" style={{ width: `${actief.length ? Math.round((ingeschat / actief.length) * 100) : 0}%` }} />
          </div>
          {kanBeheren && (
            bevestigDefinitief ? (
              <div className="mt-3 rounded-han border-2 border-kop p-3">
                <p className="font-bold text-kop">De lijst publiceren?</p>
                <p className="text-tekst">
                  Projectgroepen kunnen hierna materialen kiezen en VC ziet de lijst. {nogTeDoen > 0
                    ? `Bij ${nogTeDoen} ${nogTeDoen === 1 ? "materiaal" : "materialen"} is de voorraad nog niet ingeschat. Die zijn voor groepen nog niet te kiezen ("voorraad volgt") tot je ze invult.`
                    : "Alle voorraden zijn ingeschat."} Je kunt de lijst daarna blijven aanpassen.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void actie("definitief")} disabled={bezig !== null} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
                    {bezig === "definitief" ? "Bezig…" : "Ja, publiceren"}
                  </button>
                  <button type="button" onClick={() => setBevestigDefinitief(false)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Nog niet</button>
                </div>
              </div>
            ) : (
              <button
                type="button" onClick={() => setBevestigDefinitief(true)}
                className="mt-3 flex min-h-aanraak w-full items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-50"
              >
                <CheckCircle2 aria-hidden className="size-5" /> Lijst publiceren
              </button>
            )
          )}
        </section>
      ) : (
        <section className="rounded-han border-2 border-goedgekeurd bg-vlak p-4" aria-label="Status van de lijst">
          <h2 className="flex items-center gap-2 text-xl"><CheckCircle2 aria-hidden className="size-6" /> De lijst is gepubliceerd</h2>
          <p className="mt-1 text-tekst">
            {status.definitiefDoorNaam ? `Gepubliceerd door ${status.definitiefDoorNaam}` : "Gepubliceerd"}
            {status.definitiefOp ? `, ${formatMoment(status.definitiefOp)}` : ""}. Projectgroepen kunnen materialen kiezen.
            {" Logistiek & Facilitair van VD en VC kunnen de lijst aanpassen, bijvoorbeeld op aanvraag van een projectgroep."}
          </p>
          {isDocent && (
            <button type="button" onClick={() => void actie("terug")} disabled={bezig !== null} className="mt-2 min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60">
              {bezig === "terug" ? "Bezig…" : "Terug naar concept (docent)"}
            </button>
          )}
        </section>
      )}

      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}

      <div className="flex flex-col gap-2">
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
              {categorieen.map((c) => <option key={c.id} value={c.naam}>{c.naam}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {kanAanpassen && (
            <button
              type="button" aria-pressed={alleenLeeg} onClick={() => setAlleenLeeg((x) => !x)}
              className={`min-h-aanraak rounded-han border-2 px-3 text-sm font-bold ${alleenLeeg ? "border-kop bg-kop text-white" : "border-zacht bg-vlak text-kop"}`}
            >
              Alleen nog in te vullen ({nogTeDoen})
            </button>
          )}
          <Link href="/stuurgroep/materialen/afdrukken" className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-kop bg-vlak px-3 text-sm font-bold text-kop">
            <Printer aria-hidden className="size-5" /> Afdrukken / PDF
          </Link>
        </div>
      </div>

      {groepen.length === 0 && <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Geen materialen gevonden.</p>}
      {groepen.map(({ c, items }) => (
        <section key={c.id} aria-labelledby={`cat-${c.id}`}>
          <h2 id={`cat-${c.id}`} className="mb-1 flex items-baseline justify-between text-xl">
            {c.naam} <span className="text-sm font-normal text-zacht">{items.length} {items.length === 1 ? "materiaal" : "materialen"}</span>
          </h2>
          <div className="overflow-hidden rounded-han border border-rand bg-vlak">
            <table className="w-full table-fixed text-left">
              <thead className="bg-achtergrond text-xs font-bold uppercase text-zacht">
                <tr>
                  <th scope="col" className="py-1 pl-3 pr-2">Materiaal</th>
                  <th scope="col" className="w-[4.25rem] px-1 text-center">Camp.</th>
                  <th scope="col" className="w-[4.25rem] px-1 text-center">Bivak</th>
                  <th scope="col" className="w-12 px-1 text-center">Totaal</th>
                  <th scope="col" className="w-11"><span className="sr-only">Wijzigen</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => <Rij key={m.id} m={m} categorieen={categorieen} kanWijzigen={kanAanpassen} naam={naam} gepubliceerd={status.status === "definitief"} />)}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {kanAanpassen && (
        <details className="rounded-han border-2 border-kop bg-vlak">
          <summary className="flex min-h-aanraak cursor-pointer items-center gap-2 px-4 font-bold text-kop"><Plus aria-hidden className="size-5" /> Materiaal toevoegen</summary>
          <form onSubmit={voegToe} className="flex flex-col gap-3 border-t border-rand p-4">
            <label className="flex flex-col gap-1 font-medium text-kop">
              Naam
              <input value={nieuw.naam} onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })} maxLength={100} className={`${INVOER} font-normal`} />
            </label>
            <label className="flex flex-col gap-1 font-medium text-kop">
              Categorie
              <select value={nieuw.categorie} onChange={(e) => setNieuw({ ...nieuw, categorie: e.target.value })} className={`${INVOER} font-normal`}>
                {categorieen.map((c) => <option key={c.id} value={c.naam}>{c.naam}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-kop">
                Voorraad camping
                <input type="number" inputMode="numeric" min={0} value={nieuw.camping} onChange={(e) => setNieuw({ ...nieuw, camping: e.target.value })} placeholder={status.status === "definitief" ? "0" : "–"} className={INVOER} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-kop">
                Voorraad bivak
                <input type="number" inputMode="numeric" min={0} value={nieuw.bivak} onChange={(e) => setNieuw({ ...nieuw, bivak: e.target.value })} placeholder={status.status === "definitief" ? "0" : "–"} className={INVOER} />
              </label>
            </div>
            <label className="flex flex-col gap-1 font-medium text-kop">
              Opmerking (bijvoorbeeld de eenheid)
              <input value={nieuw.opmerking} onChange={(e) => setNieuw({ ...nieuw, opmerking: e.target.value })} maxLength={300} className={`${INVOER} font-normal`} />
            </label>
            <button type="submit" disabled={bezig !== null} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
              {bezig === "toevoegen" ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Plus aria-hidden className="size-5" />} {bezig === "toevoegen" ? "Bezig…" : "Toevoegen"}
            </button>
          </form>
        </details>
      )}

      {kanBeheren && (
        <details className="rounded-han border border-rand bg-vlak">
          <summary className="flex min-h-aanraak cursor-pointer items-center px-4 font-bold text-kop">Categorieën beheren</summary>
          <div className="border-t border-rand p-3"><CategorieBeheer categorieen={categorieen} /></div>
        </details>
      )}
    </div>
  );
}
