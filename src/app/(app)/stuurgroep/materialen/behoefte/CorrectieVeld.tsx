"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { materiaalCorrigeren } from "@/app/(app)/materiaal-actions";
import { leesOpgeslagenNaam, useNaam } from "@/components/NaamVeld";

/** Correctie van het aantal door de stuurgroep. Het aantal van de groep zelf blijft zichtbaar. */
export function CorrectieVeld({ id, aantal, gecorrigeerd, titel }: { id: string; aantal: number; gecorrigeerd: number | null; titel: string }) {
  const router = useRouter();
  const [waarde, setWaarde] = useState(String(gecorrigeerd ?? aantal));
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function bewaar() {
    const n = Number(waarde);
    if (n === (gecorrigeerd ?? aantal)) return;
    setFout(null);
    setBezig(true);
    const res = await materiaalCorrigeren(id, Number.isInteger(n) ? n : NaN, leesOpgeslagenNaam());
    setBezig(false);
    if (res.status === "ok") router.refresh();
    else { setFout(res.melding); setWaarde(String(gecorrigeerd ?? aantal)); }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-sm font-medium text-kop">
        <span className="sr-only">Gecorrigeerd aantal {titel}</span>
        {bezig && <Loader2 aria-hidden className="size-4 animate-spin" />}
        <input
          type="number" inputMode="numeric" min={0} max={9999} value={waarde} disabled={bezig}
          onChange={(e) => setWaarde(e.target.value)} onBlur={() => void bewaar()}
          className="min-h-aanraak w-24 rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst"
        />
      </label>
      {gecorrigeerd !== null && <span className="text-xs text-zacht">groep vroeg {aantal}</span>}
      {fout && <span role="alert" className="text-xs font-bold text-fout">{fout}</span>}
    </div>
  );
}

/** Eenmalig je naam invullen voor correcties (gedeeld met de rest van de stuurgroeppagina's). */
export function NaamVoorCorrecties() {
  const [naam, setNaam] = useNaam();
  return (
    <label className="flex flex-col gap-1 font-medium text-kop">
      Wie werkt hier? (jouw naam)
      <input
        value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={60} autoComplete="off" placeholder="Bijvoorbeeld Sanne"
        className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst"
      />
    </label>
  );
}
