"use client";

import { useRef, useState } from "react";
import { Check, Plus, TriangleAlert, X } from "lucide-react";
import type { NamenResultaat } from "@/app/(app)/namen-actions";
import { useAutoBewaar } from "@/components/useAutoBewaar";
import { MAX_LENGTE_NAAM, MAX_NAMEN_PER_ROL, splitNamen, voegNamenSamen } from "@/lib/namen";

type Melding = { soort: "bezig" | "ok" | "fout" | "waarschuwing"; tekst: string };

/** De namen als invoervelden: elke ingevulde naam, plus altijd één leeg veld om iemand toe te voegen. */
function metLeegVeld(namen: string[]): string[] {
  return namen.length < MAX_NAMEN_PER_ROL ? [...namen, ""] : namen;
}

/**
 * Een rol met de namen van de verantwoordelijke studenten: één naam per veld, en onder de ingevulde namen
 * altijd een leeg veld erbij. Slaat op terwijl je typt en zodra je het veld verlaat. Heeft iemand anders deze rol
 * net gewijzigd (`updated_at` is veranderd), dan komt er een waarschuwing in plaats van een overschrijving.
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
  const [opgeslagen, setOpgeslagenState] = useState({ namen: voegNamenSamen(splitNamen(beginNamen)), updatedAt: beginUpdatedAt });
  const [velden, setVelden] = useState<string[]>(() => metLeegVeld(splitNamen(beginNamen)));
  // De nieuwste waarden staan ook in refs: een opslag die direct na een andere volgt (de eerste is nog bezig) moet de
  // laatste tijdstempel en de laatste tekst gebruiken, niet die van de vorige render.
  const opgeslagenRef = useRef(opgeslagen);
  const veldenRef = useRef(velden);
  function setOpgeslagen(nieuw: { namen: string | null; updatedAt: string }) {
    opgeslagenRef.current = nieuw;
    setOpgeslagenState(nieuw);
  }
  function zetVelden(maak: (v: string[]) => string[]) {
    const nieuw = maak(veldenRef.current);
    veldenRef.current = nieuw;
    setVelden(nieuw);
  }
  const [melding, setMelding] = useState<Melding | null>(null);
  const [conflict, setConflict] = useState<{ namen: string | null; updatedAt: string; mijn: string } | null>(null);
  const lijstRef = useRef<HTMLDivElement | null>(null);

  const tekst = voegNamenSamen(velden) ?? "";

  async function bewaar(namen: string, updatedAt: string) {
    setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
    const res = await opslaan(namen, updatedAt);
    if (res.status === "ok") {
      // De velden blijven zoals ze zijn: wie intussen doortypt, mag niets kwijtraken.
      setOpgeslagen({ namen: res.namen, updatedAt: res.updatedAt });
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
    const nu = voegNamenSamen(veldenRef.current) ?? "";
    if (nu === (opgeslagenRef.current.namen ?? "")) return;
    await bewaar(nu, opgeslagenRef.current.updatedAt);
  }

  const auto = useAutoBewaar(tekst, bijVerlaten, { actief: kanBewerken && !conflict });

  function wijzig(i: number, waarde: string) {
    const schoon = waarde.replace(/[,;]/g, ""); // een komma scheidt namen: één naam per veld
    zetVelden((v) => {
      const nieuw = [...v];
      nieuw[i] = schoon;
      const laatsteGevuld = i === nieuw.length - 1 && schoon.trim() !== "";
      return laatsteGevuld && nieuw.length < MAX_NAMEN_PER_ROL ? [...nieuw, ""] : nieuw;
    });
  }

  function bijVeldVerlaten(i: number) {
    // Een leeggemaakt veld midden in de lijst verdwijnt; het lege veld onderaan blijft staan.
    zetVelden((v) => (v[i]?.trim() === "" && i < v.length - 1 ? v.filter((_, j) => j !== i) : v));
    void auto.bewaarNu();
  }

  function verwijder(i: number) {
    zetVelden((v) => {
      const rest = v.filter((_, j) => j !== i);
      return rest.some((n) => n.trim() === "") ? rest : metLeegVeld(rest);
    });
  }

  function volgendeVeld(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const velden = Array.from(lijstRef.current?.querySelectorAll<HTMLInputElement>("input") ?? []);
    const volgende = velden[velden.indexOf(e.currentTarget) + 1];
    if (volgende) volgende.focus();
    else e.currentTarget.blur();
  }

  const id = `namen-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const leesbaar = splitNamen(opgeslagen.namen);
  return (
    <div className="rounded-han border border-rand bg-vlak p-4">
      <p id={`${id}-label`} className="font-bold text-kop">{label}</p>
      {uitleg && <p className="text-sm text-zacht">{uitleg}</p>}
      {kanBewerken ? (
        <div ref={lijstRef} role="group" aria-labelledby={`${id}-label`} className="mt-2 flex flex-col gap-2">
          {velden.map((naam, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                id={i === 0 ? id : `${id}-${i + 1}`}
                aria-label={`${label}, naam ${i + 1}`}
                value={naam}
                onChange={(e) => wijzig(i, e.target.value)}
                onBlur={() => bijVeldVerlaten(i)}
                onKeyDown={volgendeVeld}
                maxLength={MAX_LENGTE_NAAM}
                autoComplete="off"
                enterKeyHint="next"
                placeholder={naam.trim() === "" && i > 0 ? "Nog een naam toevoegen" : "Naam van één student"}
                className="min-h-aanraak min-w-0 flex-1 rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst"
              />
              {naam.trim() !== "" ? (
                <button
                  type="button"
                  onClick={() => verwijder(i)}
                  aria-label={`Verwijder ${naam.trim()}`}
                  className="flex min-h-aanraak min-w-aanraak items-center justify-center rounded-han border-2 border-rand bg-vlak text-kop"
                >
                  <X aria-hidden className="size-5" />
                </button>
              ) : (
                <span aria-hidden className="flex min-h-aanraak min-w-aanraak items-center justify-center text-zacht">
                  <Plus className="size-5" />
                </span>
              )}
            </div>
          ))}
          {velden.length >= MAX_NAMEN_PER_ROL && (
            <p className="text-sm text-zacht">Meer dan {MAX_NAMEN_PER_ROL} namen per rol kan niet.</p>
          )}
        </div>
      ) : (
        <p id={id} className="mt-2 min-h-aanraak rounded-han bg-achtergrond px-3 py-3 text-tekst">
          {leesbaar.length > 0 ? leesbaar.join(", ") : <span className="text-zacht">Nog niet ingevuld</span>}
        </p>
      )}

      {conflict && (
        <div role="alert" className="mt-3 rounded-han border-2 border-kop bg-vlak p-3">
          <p className="font-medium text-kop">
            Iemand anders heeft dit net gewijzigd. Nu staat er: “{splitNamen(conflict.namen).join(", ") || "(leeg)"}”
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setOpgeslagen({ namen: conflict.namen, updatedAt: conflict.updatedAt });
                zetVelden(() => metLeegVeld(splitNamen(conflict.namen)));
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
