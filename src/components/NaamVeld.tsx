"use client";

import { useEffect, useState } from "react";

const SLEUTEL = "backpack_beoordelaarnaam";
const NAAM_GEWIJZIGD = "backpack-naam-gewijzigd";

/** Onthoudt per telefoon de naam van wie beoordeelt of indient (er zijn alleen gedeelde accounts). */
export function useNaam(sleutel: string = SLEUTEL): [string, (n: string) => void] {
  const [naam, setNaam] = useState("");
  useEffect(() => {
    try {
      // Eenmalig na het laden: opslag in de browser bestaat niet op de server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNaam(localStorage.getItem(sleutel) ?? "");
    } catch {
      /* opslag niet beschikbaar */
    }
    // Staat dezelfde naam op dezelfde pagina op meer plekken (beoordelen, verzoek, themacheck), dan lopen ze mee.
    function bijWijziging(e: Event) {
      const d = (e as CustomEvent<{ sleutel: string; naam: string }>).detail;
      if (d?.sleutel === sleutel) setNaam(d.naam);
    }
    window.addEventListener(NAAM_GEWIJZIGD, bijWijziging);
    return () => window.removeEventListener(NAAM_GEWIJZIGD, bijWijziging);
  }, [sleutel]);
  function wijzig(n: string) {
    setNaam(n);
    try {
      localStorage.setItem(sleutel, n);
    } catch {
      /* niet erg */
    }
    window.dispatchEvent(new CustomEvent(NAAM_GEWIJZIGD, { detail: { sleutel, naam: n } }));
  }
  return [naam, wijzig];
}

/** De opgeslagen naam op dit moment lezen (voor knoppen die niet bij het naamveld zelf horen). */
export function leesOpgeslagenNaam(sleutel: string = SLEUTEL): string {
  try {
    return localStorage.getItem(sleutel) ?? "";
  } catch {
    return "";
  }
}

export const AVF_NAAM_SLEUTEL = "backpack_avfnaam";

export function NaamVeld({ naam, setNaam, label = "Jouw naam" }: { naam: string; setNaam: (n: string) => void; label?: string }) {
  return (
    <label className="flex flex-col gap-1 font-medium text-kop">
      {label}
      <input
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        autoComplete="off"
        maxLength={60}
        placeholder="Bijvoorbeeld Sanne"
        className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst"
      />
    </label>
  );
}
