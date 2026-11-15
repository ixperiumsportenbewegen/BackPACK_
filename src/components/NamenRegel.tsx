"use client";

import { useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import type { NamenResultaat } from "@/app/(app)/namen-actions";
import { useAutoBewaar } from "@/components/useAutoBewaar";

type Melding = { soort: "bezig" | "ok" | "fout" | "waarschuwing"; tekst: string };

/**
 * Een regel met een rol en de namen van de verantwoordelijke studenten.
 * Slaat op zodra je het veld verlaat. Heeft iemand anders deze regel net gewijzigd
 * (`updated_at` is veranderd), dan komt er een waarschuwing in plaats van een overschrijving.
 */
export function NamenRegel({
  label,
  uitleg,
  beginNamen,
  beginUpdatedAt,
  kanBewerken,
  opslaan,
}: {
  label: string;
  uitleg?: string;
  beginNamen: string | null;
  beginUpdatedAt: string;
  kanBewerken: boolean;
  opslaan: (namen: string, verwachtUpdatedAt: string) => Promise<NamenResultaat>;
}) {
  const [opgeslagen, setOpgeslagen] = useState({ namen: beginNamen, updatedAt: beginUpdatedAt });
  const [tekst, setTekst] = useState(beginNamen ?? "");
  const [melding, setMelding] = useState<Melding | null>(null);
  const [conflict, setConflict] = useState<{ namen: string | null; updatedAt: string; mijn: string } | null>(null);

  async function bewaar(namen: string, updatedAt: string) {
    setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
    const res = await opslaan(namen, updatedAt);
    if (res.status === "ok") {
      setOpgeslagen({ namen: res.namen, updatedAt: res.updatedAt });
      setTekst(res.namen ?? "");
      setConflict(null);
      setMelding({ soort: "ok", tekst: "Opgeslagen" });
    } else if (res.status === "conflict") {
      setConflict({ namen: res.namen, updatedAt: res.updatedAt, mijn: namen });
      setMelding({ soort: "waarschuwing", tekst: "Iemand anders heeft dit net gewijzigd." });
    } else {
      setMelding({ soort: "fout", tekst: res.melding });
    }
  }

  async function bijVerlaten() {
    const nieuw = tekst.trim().replace(/\s+/g, " ");
    if (nieuw === (opgeslagen.namen ?? "")) return;
    await bewaar(nieuw, opgeslagen.updatedAt);
  }

  // Opslaan terwijl je typt, zodat niets verloren gaat als je direct daarna doorklikt.
  const auto = useAutoBewaar(tekst, bijVerlaten, { actief: kanBewerken && !conflict });

  const id = `namen-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="rounded-han border border-rand bg-vlak p-4">
      <label htmlFor={id} className="block font-bold text-kop">{label}</label>
      {uitleg && <p className="text-sm text-zacht">{uitleg}</p>}
      {kanBewerken ? (
        <input
          id={id}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onBlur={() => void auto.bewaarNu()}
          maxLength={200}
          autoComplete="off"
          placeholder="Namen van de student(en)"
          className="mt-2 min-h-aanraak w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst"
        />
      ) : (
        <p id={id} className="mt-2 min-h-aanraak rounded-han bg-achtergrond px-3 py-3 text-tekst">
          {opgeslagen.namen ?? <span className="text-zacht">Nog niet ingevuld</span>}
        </p>
      )}

      {conflict && (
        <div role="alert" className="mt-3 rounded-han border-2 border-kop bg-vlak p-3">
          <p className="font-medium text-kop">Iemand anders heeft dit net gewijzigd. Nu staat er: “{conflict.namen ?? "(leeg)"}”</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setOpgeslagen({ namen: conflict.namen, updatedAt: conflict.updatedAt });
                setTekst(conflict.namen ?? "");
                setConflict(null);
                setMelding(null);
              }}
              className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
            >
              Hun versie houden
            </button>
            <button
              type="button"
              onClick={() => void bewaar(conflict.mijn, conflict.updatedAt)}
              className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk"
            >
              Mijn versie bewaren
            </button>
          </div>
        </div>
      )}

      <p
        aria-live="polite"
        role={melding?.soort === "fout" ? "alert" : undefined}
        className={`mt-2 min-h-6 text-sm font-medium ${melding?.soort === "fout" ? "text-fout" : "text-kop"}`}
      >
        {melding?.soort === "ok" && <Check aria-hidden className="mr-1 inline size-4" />}
        {melding?.soort === "waarschuwing" && <TriangleAlert aria-hidden className="mr-1 inline size-4" />}
        {melding?.tekst}
      </p>
    </div>
  );
}
