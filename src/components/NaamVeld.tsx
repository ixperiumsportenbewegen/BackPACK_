"use client";

import { useEffect, useState } from "react";

const SLEUTEL = "backpack_beoordelaarnaam";

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
  }, [sleutel]);
  function wijzig(n: string) {
    setNaam(n);
    try {
      localStorage.setItem(sleutel, n);
    } catch {
      /* niet erg */
    }
  }
  return [naam, wijzig];
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
