"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { verzoekPlaatsen, verzoekStatusZetten } from "@/app/(app)/beoordeling-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import { PROJECTGROEPROLLEN } from "@/config/projectgroeprollen";

/**
 * "Verbeterverzoek" bij een sectie of onderdeel van een AVF. De rol waar het verzoek voor bedoeld is staat
 * standaard goed (uit de veldkoppeling) maar is aan te passen.
 */
export function VerzoekFormulier({
  avfId, sectie, onderdeelId = null, veldSleutel = null, standaardRol, startOpen = false, actief,
}: {
  avfId: string;
  sectie: string;
  onderdeelId?: string | null;
  veldSleutel?: string | null;
  standaardRol: string;
  startOpen?: boolean;
  /** false zolang het AVF nog in ontwikkeling is: de stuurgroep kan dan nog geen verzoek plaatsen. */
  actief: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [tekst, setTekst] = useState("");
  const [rol, setRol] = useState(standaardRol);
  const [naam, setNaam] = useNaam();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  if (!actief) return null;

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setBezig(true);
    const res = await verzoekPlaatsen(avfId, sectie, onderdeelId, veldSleutel, rol, tekst, naam);
    setBezig(false);
    if (res.status === "ok") {
      setTekst("");
      setOpen(false);
      router.refresh();
    } else setFout(res.melding);
  }

  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-kop bg-vlak px-3 font-bold text-kop"
      >
        <MessageSquarePlus aria-hidden className="size-5" /> Verbeterverzoek
      </button>
    );
  }

  return (
    <form onSubmit={verstuur} className="flex flex-col gap-3 rounded-han border-2 border-kop bg-vlak p-3">
      <label className="flex flex-col gap-1 font-medium text-kop">
        Wat moet er beter?
        <textarea
          value={tekst} onChange={(e) => setTekst(e.target.value)} rows={4} maxLength={1000} required autoFocus={startOpen}
          placeholder="Schrijf concreet wat de groep moet aanpassen."
          className="rounded-han border-2 border-zacht bg-vlak p-3 text-base font-normal text-tekst"
        />
      </label>
      <label className="flex flex-col gap-1 font-medium text-kop">
        Voor welke rol in de projectgroep?
        <select value={rol} onChange={(e) => setRol(e.target.value)} className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst">
          {PROJECTGROEPROLLEN.map((r) => <option key={r.code} value={r.code}>{r.naam}</option>)}
        </select>
      </label>
      <NaamVeld naam={naam} setNaam={setNaam} />
      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={bezig} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
          {bezig ? "Bezig…" : "Verzoek plaatsen"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
          Annuleren
        </button>
      </div>
    </form>
  );
}

/** Knoppen om een bestaand verzoek af te handelen of weer te openen. */
export function VerzoekKnoppen({ id, status }: { id: string; status: "open" | "aangepast" | "afgehandeld" }) {
  const router = useRouter();
  const [naam, setNaam] = useNaam();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function zet(nieuw: "open" | "afgehandeld") {
    setFout(null);
    if (!naam.trim()) return setFout("Vul eerst je naam in (bij ‘Aanpassing vragen’ of ‘Goedkeuren’ bovenaan).");
    setBezig(true);
    const res = await verzoekStatusZetten(id, nieuw, naam);
    setBezig(false);
    if (res.status === "ok") router.refresh();
    else setFout(res.melding);
  }

  const klasse = "min-h-aanraak rounded-han border-2 border-kop bg-vlak px-3 text-sm font-bold text-kop disabled:opacity-60";
  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {status !== "afgehandeld" && <button type="button" disabled={bezig} onClick={() => zet("afgehandeld")} className={klasse}>Afhandelen</button>}
        {status !== "open" && <button type="button" disabled={bezig} onClick={() => zet("open")} className={klasse}>Weer openen</button>}
      </div>
      {!naam.trim() && <NaamVeld naam={naam} setNaam={setNaam} />}
      {fout && <p role="alert" className="text-sm font-bold text-fout">{fout}</p>}
    </div>
  );
}
