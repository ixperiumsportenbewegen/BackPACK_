"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import {
  DEADLINE_ONDERDELEN, DEADLINE_STANDAARD_TIJD, deadlineNiveau, deadlineWaarschuwing, formatDeadline, momentNaarNl, nlNaarMoment, resterendTekst,
} from "@/lib/deadlines";
import { deadlineOpslaan, deadlineVerwijderen } from "./actions";

export interface BestaandeDeadline {
  onderdeel: string;
  momentIso: string;
  toelichting: string | null;
  updatedAt: string;
  door: string;
}

const INVOER = "min-h-aanraak w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst";

type Melding = { soort: "ok" | "fout" | "waarschuwing"; tekst: string };

function Rij({
  info, begin, naam, nu,
}: { info: (typeof DEADLINE_ONDERDELEN)[number]; begin: BestaandeDeadline | null; naam: string; nu: Date | null }) {
  const router = useRouter();
  const startWaarde = begin ? momentNaarNl(new Date(begin.momentIso)) : { dag: "", tijd: DEADLINE_STANDAARD_TIJD };
  const [dag, setDag] = useState(startWaarde.dag);
  const [tijd, setTijd] = useState(startWaarde.tijd);
  const [toelichting, setToelichting] = useState(begin?.toelichting ?? "");
  const [versie, setVersie] = useState<string | null>(begin?.updatedAt ?? null); // de updated_at die we zagen
  const [opgeslagen, setOpgeslagen] = useState(begin ? { dag: startWaarde.dag, tijd: startWaarde.tijd, toelichting: begin.toelichting ?? "" } : null);
  const [bezig, setBezig] = useState<"opslaan" | "wissen" | null>(null);
  const [melding, setMelding] = useState<Melding | null>(null);
  const [conflict, setConflict] = useState<{ momentIso: string | null; toelichting: string | null; updatedAt: string | null; door: string | null } | null>(null);

  const moment = dag ? nlNaarMoment(dag, tijd || DEADLINE_STANDAARD_TIJD) : null;
  const gewijzigd = !opgeslagen || opgeslagen.dag !== dag || opgeslagen.tijd !== tijd || opgeslagen.toelichting !== toelichting;
  const waarschuwing = moment && nu ? deadlineWaarschuwing(moment, nu) : null;
  const toon = opgeslagen && !gewijzigd ? nlNaarMoment(opgeslagen.dag, opgeslagen.tijd) : null;

  async function bewaar(verwacht: string | null) {
    setMelding(null);
    setConflict(null);
    setBezig("opslaan");
    const res = await deadlineOpslaan(info.code, dag, tijd || DEADLINE_STANDAARD_TIJD, toelichting, naam, verwacht);
    setBezig(null);
    if (res.status === "ok") {
      setVersie(res.updatedAt);
      setOpgeslagen({ dag, tijd: tijd || DEADLINE_STANDAARD_TIJD, toelichting: toelichting.trim() });
      setToelichting(toelichting.trim());
      setMelding({ soort: res.waarschuwing ? "waarschuwing" : "ok", tekst: res.waarschuwing ? `Opgeslagen. ${res.waarschuwing}` : res.verschoven ? "Opgeslagen: de deadline is verschoven" : "Opgeslagen" });
      router.refresh();
    } else if (res.status === "conflict") {
      setConflict(res);
    } else {
      setMelding({ soort: "fout", tekst: res.melding });
    }
  }

  async function wis() {
    setMelding(null);
    setConflict(null);
    setBezig("wissen");
    const res = await deadlineVerwijderen(info.code, naam, versie);
    setBezig(null);
    if (res.status === "ok") {
      setDag(""); setTijd(DEADLINE_STANDAARD_TIJD); setToelichting(""); setVersie(null); setOpgeslagen(null);
      setMelding({ soort: "ok", tekst: "Deadline verwijderd" });
      router.refresh();
    } else if (res.status === "conflict") setConflict(res);
    else setMelding({ soort: "fout", tekst: res.melding });
  }

  function neemOver() {
    // hun versie houden
    if (!conflict) return;
    if (conflict.momentIso) {
      const n = momentNaarNl(new Date(conflict.momentIso));
      setDag(n.dag); setTijd(n.tijd); setToelichting(conflict.toelichting ?? "");
      setOpgeslagen({ dag: n.dag, tijd: n.tijd, toelichting: conflict.toelichting ?? "" });
    } else {
      setDag(""); setTijd(DEADLINE_STANDAARD_TIJD); setToelichting(""); setOpgeslagen(null);
    }
    setVersie(conflict.updatedAt);
    setConflict(null);
  }

  const id = `deadline-${info.code}`;
  return (
    <li className="flex flex-col gap-3 rounded-han border border-rand bg-vlak p-4" data-testid={`deadline-rij-${info.code}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-kop">{info.naam}</h3>
          <p className="text-sm text-zacht">Klaar als: {info.uitleg.charAt(0).toLowerCase() + info.uitleg.slice(1)}</p>
        </div>
        {toon && nu && <DeadlineBadge niveau={deadlineNiveau(toon, nu)} tekst={resterendTekst(toon, nu)} />}
      </div>

      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <label htmlFor={`${id}-dag`} className="flex flex-col gap-1 font-medium text-kop">
          Datum
          <input id={`${id}-dag`} type="date" value={dag} onChange={(e) => setDag(e.target.value)} className={INVOER} />
        </label>
        <label htmlFor={`${id}-tijd`} className="flex flex-col gap-1 font-medium text-kop">
          Tijd
          <input id={`${id}-tijd`} type="time" value={tijd} onChange={(e) => setTijd(e.target.value)} className={INVOER} />
        </label>
      </div>
      <label htmlFor={`${id}-toelichting`} className="flex flex-col gap-1 font-medium text-kop">
        Waarom deze datum? <span className="text-sm font-normal text-zacht">Wat wacht erop? (mag leeg)</span>
        <input id={`${id}-toelichting`} value={toelichting} onChange={(e) => setToelichting(e.target.value)} maxLength={200} autoComplete="off" className={INVOER} />
      </label>

      {waarschuwing && gewijzigd && (
        <p className="flex items-start gap-2 font-medium text-kop"><TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" /> {waarschuwing} Je kunt hem toch opslaan.</p>
      )}

      {conflict && (
        <div role="alert" className="rounded-han border-2 border-kop bg-vlak p-3">
          <p className="font-medium text-kop">
            {conflict.door ?? "Iemand anders"} heeft dit net gewijzigd. Nu staat er:{" "}
            {conflict.momentIso ? `${formatDeadline(new Date(conflict.momentIso))}${conflict.toelichting ? ` (${conflict.toelichting})` : ""}` : "geen deadline meer"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={neemOver} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Hun versie houden</button>
            <button type="button" onClick={() => void bewaar(conflict.updatedAt)} disabled={!dag} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">Mijn versie bewaren</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button" onClick={() => void bewaar(versie)} disabled={!dag || !gewijzigd || bezig !== null || !naam.trim()}
          className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60"
        >
          {bezig === "opslaan" && <Loader2 aria-hidden className="size-5 animate-spin" />} Opslaan
        </button>
        {opgeslagen && (
          <button
            type="button" onClick={() => void wis()} disabled={bezig !== null || !naam.trim()}
            className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60"
          >
            {bezig === "wissen" && <Loader2 aria-hidden className="size-5 animate-spin" />} Verwijderen
          </button>
        )}
      </div>
      {!naam.trim() && <p className="text-sm text-zacht">Vul bovenaan eerst je naam in om op te slaan.</p>}
      <p aria-live="polite" role={melding?.soort === "fout" ? "alert" : undefined} className={`min-h-6 text-sm font-medium ${melding?.soort === "fout" ? "text-fout" : "text-kop"}`}>
        {melding?.soort === "ok" && <Check aria-hidden className="mr-1 inline size-4" />}
        {melding?.tekst}
      </p>
      {begin && <p className="-mt-2 text-xs text-zacht">Laatst gezet door {begin.door}.</p>}
    </li>
  );
}

/** Per onderdeel van het AVF een deadline instellen, verschuiven of verwijderen. Een deadline is een afspraak en blokkeert niets. */
export function DeadlinesBeheer({ bestaand }: { bestaand: BestaandeDeadline[] }) {
  const [naam, setNaam] = useNaam();
  const [nu, setNu] = useState<Date | null>(null);
  useEffect(() => {
    // Alleen in de browser: de server en de browser hebben niet precies dezelfde tijd.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNu(new Date());
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-han border border-rand bg-vlak p-4">
        <NaamVeld naam={naam} setNaam={setNaam} label="Wie werkt hier? (jouw naam)" />
        <p className="mt-2 text-sm text-zacht">Met je naam leggen we vast wie een deadline heeft gezet of verschoven.</p>
      </section>
      <ul className="flex flex-col gap-3">
        {DEADLINE_ONDERDELEN.map((o) => (
          <Rij key={o.code} info={o} begin={bestaand.find((b) => b.onderdeel === o.code) ?? null} naam={naam} nu={nu} />
        ))}
      </ul>
    </div>
  );
}
