"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { PAKLIJST_BLOKKEN } from "@/config/paklijst";
import type { PaklijstCategorie, PaklijstSpul } from "@/lib/paklijst";

/** Items met een naam; een item zonder naam is nog niet ingevuld en blijft verborgen. */
const metNaam = (s: PaklijstSpul) => s.naam.trim() !== "";

function bewaarSleutel(clusterId: string) {
  return `backpack_paklijst_afgevinkt_${clusterId}`;
}


/** Eén item met zijn onderdelen: een vinkje, de naam, het aantal en een eventuele toelichting. */
function SpulRij({ s, onderdeel = false, afgevinkt, wissel }: { s: PaklijstSpul; onderdeel?: boolean; afgevinkt: Set<string>; wissel: (id: string) => void }) {
  const id = `spul-${s.id}`;
  const gedaan = afgevinkt.has(s.id);
  return (
    <li className="print:break-inside-avoid">
      <label htmlFor={id} className="flex min-h-aanraak cursor-pointer items-start gap-3 py-1">
        <input id={id} type="checkbox" checked={gedaan} onChange={() => wissel(s.id)} className={`mt-1 shrink-0 ${onderdeel ? "size-5" : "size-6"}`} />
        <span className={`flex-1 ${gedaan ? "text-zacht line-through print:text-tekst print:no-underline" : "text-tekst"} ${onderdeel ? "text-base" : "text-lg"}`}>
          <span className={onderdeel ? "" : "font-medium"}>{s.naam}</span>
          {s.aantal && <span className="font-bold text-kop"> · {s.aantal}</span>}
          {s.optioneel && <span className="ml-2 rounded-han bg-rand px-2 py-0.5 text-xs font-bold text-kop">Optioneel</span>}
          {s.toelichting && <span className="block text-sm italic text-zacht">{s.toelichting}</span>}
        </span>
      </label>
      {s.onderdelen.length > 0 && (
        <ul className="ml-8 border-l-2 border-rand pl-3">
          {s.onderdelen.map((o) => <SpulRij key={o.id} s={o} onderdeel afgevinkt={afgevinkt} wissel={wissel} />)}
        </ul>
      )}
    </li>
  );
}

/**
 * De paklijst om te lezen en af te vinken. Wat je afvinkt blijft alleen op deze telefoon bewaard (niet in de database), zodat
 * er niets van studenten wordt opgeslagen. Optionele items tellen niet mee in de voortgang.
 */
export function PaklijstLezen({ clusterId, categorieen }: { clusterId: string; categorieen: PaklijstCategorie[] }) {
  const [afgevinkt, setAfgevinkt] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const opgeslagen = JSON.parse(localStorage.getItem(bewaarSleutel(clusterId)) ?? "[]");
      // Eenmalig na het laden: opslag in de browser bestaat niet op de server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(opgeslagen)) setAfgevinkt(new Set(opgeslagen.filter((x): x is string => typeof x === "string")));
    } catch {
      /* opslag niet beschikbaar of kapot: dan begint de lijst leeg */
    }
  }, [clusterId]);

  function zet(nieuw: Set<string>) {
    setAfgevinkt(nieuw);
    try {
      localStorage.setItem(bewaarSleutel(clusterId), JSON.stringify([...nieuw]));
    } catch {
      /* niet erg: het afvinken werkt dan alleen zolang de pagina openstaat */
    }
  }

  function wissel(id: string) {
    const nieuw = new Set(afgevinkt);
    if (nieuw.has(id)) nieuw.delete(id);
    else nieuw.add(id);
    zet(nieuw);
  }

  const zichtbaar = categorieen
    .map((c) => ({ ...c, spullen: c.spullen.filter(metNaam).map((s) => ({ ...s, onderdelen: s.onderdelen.filter(metNaam) })) }))
    .filter((c) => c.spullen.length > 0);
  const verplicht = zichtbaar.flatMap((c) => c.spullen.flatMap((s) => [s, ...s.onderdelen])).filter((s) => !s.optioneel);
  const klaar = verplicht.filter((s) => afgevinkt.has(s.id)).length;

  if (zichtbaar.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2 rounded-han border-2 border-kop bg-vlak p-3" data-testid="voortgang">
        <p className="text-lg font-bold text-kop" aria-live="polite">
          {klaar} van {verplicht.length} ingepakt
        </p>
        <button
          type="button" disabled={afgevinkt.size === 0} onClick={() => zet(new Set())}
          className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-rand bg-vlak px-3 font-bold text-kop disabled:opacity-50"
        >
          <RotateCcw aria-hidden className="size-4" /> Alles uitvinken
        </button>
      </div>

      <div className="flex flex-col gap-8 print:grid print:grid-cols-2 print:items-start print:gap-6">
        {PAKLIJST_BLOKKEN.map((blok) => {
          const cats = zichtbaar.filter((c) => c.blok === blok.code);
          if (cats.length === 0) return null;
          return (
            <section key={blok.code} id={blok.code} aria-labelledby={`blok-${blok.code}`} className="flex scroll-mt-24 flex-col gap-3">
              <div>
                <h2 id={`blok-${blok.code}`} className="text-2xl">{blok.naam}</h2>
                <p className="text-sm text-zacht">{blok.uitleg}</p>
              </div>
              {cats.map((c) => (
                <article key={c.id} className="rounded-han border border-rand bg-vlak p-4 print:break-inside-avoid print:border-0 print:p-0">
                  <h3 className="text-xl">{c.naam}</h3>
                  <ul className="mt-1">
                    {c.spullen.map((s) => <SpulRij key={s.id} s={s} afgevinkt={afgevinkt} wissel={wissel} />)}
                  </ul>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
